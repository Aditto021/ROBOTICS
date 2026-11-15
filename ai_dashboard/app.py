"""ResQBot AI Mission Control - laptop-side AI dashboard.

Start with start.bat (or: python app.py). Then open http://127.0.0.1:5000
The ESP32 / ESP32-CAM firmware is not changed: this app reads the CAM's
video stream (port 81) and /data, and forwards settings to /set.
"""
import argparse
import logging
import sys
import threading
import time
import webbrowser
from pathlib import Path

import cv2
import numpy as np
from flask import Flask, Response, abort, jsonify, request, send_from_directory

sys.path.insert(0, str(Path(__file__).resolve().parent))
from resqbot_ai import config  # noqa: E402
from resqbot_ai.brain import MissionBrain  # noqa: E402
from resqbot_ai.camera import CameraReader, FrameHub, TelemetryPoller  # noqa: E402
from resqbot_ai.llm import RoverLLM  # noqa: E402
from resqbot_ai.vision import VisionEngine, encode, enhance  # noqa: E402

app = Flask(__name__, static_folder=str(config.STATIC_DIR), static_url_path="")
hub = FrameHub()
cam = CameraReader(config.STREAM_URL, hub)
tel = TelemetryPoller(config.DATA_URL, config.SET_URL)
vision = VisionEngine(hub)
brain = None   # created in main() (trains the hazard model)
llm = None

# /set parameters accepted by the ESP32-CAM firmware and their valid ranges
SET_KEYS = {"sonar": (0, 1), "dist": (5, 300), "fs": (5, 13), "q": (8, 40),
            "flash": (0, 255), "vf": (0, 1), "hm": (0, 1)}
MODES = ("raw", "enhanced", "depth")


def _placeholder(lines):
    img = np.full((480, 640, 3), 24, np.uint8)
    for i, text in enumerate(lines):
        (tw, _), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.7 if i == 0 else 0.5, 1)
        cv2.putText(img, text, ((640 - tw) // 2, 230 + i * 30), cv2.FONT_HERSHEY_SIMPLEX,
                    0.7 if i == 0 else 0.5, (195, 194, 183), 1, cv2.LINE_AA)
    return encode(img, 70)


PLACEHOLDER = {
    "raw": _placeholder(["NO SIGNAL", "waiting for the ResQBot-CAM video stream"]),
    "enhanced": _placeholder(["ENHANCED VIEW", "waiting for camera frames"]),
    "depth": _placeholder(["DEPTH VIEW", "waiting for the depth AI (needs the depth model)"]),
}


# ---------------------------------------------------------------------- pages / video
@app.route("/")
def index():
    return send_from_directory(config.STATIC_DIR, "index.html")


_wifi = {"t": 0.0, "name": None}


def wifi_name():
    """Name of the Wi-Fi the laptop is on (Windows), refreshed every 5 s - shown when there is no video."""
    if sys.platform != "win32" or time.time() - _wifi["t"] < 5.0:
        return _wifi["name"]
    _wifi["t"] = time.time()
    try:
        import subprocess
        out = subprocess.run(["netsh", "wlan", "show", "interfaces"], capture_output=True, text=True,
                             timeout=3, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)).stdout
        names = [ln.split(":", 1)[1].strip() for ln in out.splitlines()
                 if ln.strip().startswith("SSID") and not ln.strip().startswith("BSSID")]
        name = names[0] if names else ""
        if name.upper() == "UNKNOWN":   # Windows hides the name when Location is off - use the address
            import socket
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            try:
                s.connect((config.CAM_HOST, 80))           # no packet is sent, just a route lookup
                ip = s.getsockname()[0]
            finally:
                s.close()
            name = "ResQBot-CAM" if ip.startswith(config.CAM_HOST.rsplit(".", 1)[0] + ".") else "another network"
        _wifi["name"] = name
    except Exception:
        _wifi["name"] = None
    return _wifi["name"]


@app.route("/video")
def video():
    mode = request.args.get("mode", "raw")
    if mode not in MODES:
        mode = "raw"

    gap = 1.0 / config.VIDEO_FPS if config.VIDEO_FPS > 0 else 0.0

    live = "raw" if mode == "enhanced" else mode   # enhanced view = live video, enhanced per frame

    def gen():
        last, due = -1, 0.0
        while True:
            wait = due - time.time()               # steady 30 fps: never faster than VIDEO_FPS
            if wait > 0:
                time.sleep(wait)
            fid, jpeg, ts = hub.wait(live, last, 1.5)
            if jpeg is None or time.time() - ts > 3.0:
                jpeg = PLACEHOLDER[mode]      # keeps the connection alive while offline
            elif mode == "enhanced" and fid != last:
                img = cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)
                if img is not None:
                    bright = float(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)[::4, ::4].mean())
                    jpeg = encode(enhance(img, bright), 85) or jpeg
            last = fid
            due = max(due + gap, time.time() - gap)   # fixed time grid, no drift
            yield (b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: "
                   + str(len(jpeg)).encode() + b"\r\n\r\n" + jpeg + b"\r\n")

    return Response(gen(), mimetype="multipart/x-mixed-replace; boundary=frame",
                    headers={"Cache-Control": "no-store"})


# ---------------------------------------------------------------------- API
@app.get("/api/state")
def api_state():
    data, ts = tel.snapshot()
    vis = vision.get_result()
    now = time.time()
    st = brain.public_state()
    st.update({
        "now": now,
        "cam": {"online": cam.online, "fps": round(min(cam.fps, config.VIDEO_FPS or cam.fps), 1),
                "frames": cam.frames, "error": cam.error, "w": cam.width, "h": cam.height,
                "wifi": wifi_name()},
        "tel": {"online": tel.online, "age": round(now - ts, 1) if ts else None,
                "data": data, "error": tel.error},
        "ai": {"state": vision.state, "message": vision.message, "models": vision.models,
               "settings": vision.settings, "fps": round(vision.fps, 1),
               "result": {**vis, "age": round(now - vis["ts"], 2) if vis["ts"] else None}},
        "llm": llm.info(),
        "limits": {"gas_warn": config.GAS_WARN, "gas_alarm": config.GAS_ALARM,
                   "temp_warn": config.TEMP_WARN, "temp_alarm": config.TEMP_ALARM},
    })
    return jsonify(st)


@app.get("/api/history")
def api_history():
    secs = max(30, min(900, request.args.get("s", 300, type=int)))
    return jsonify(brain.history_series(secs))


@app.get("/api/set")
def api_set():
    params = {}
    for k, (lo, hi) in SET_KEYS.items():
        if k in request.args:
            try:
                v = int(float(request.args[k]))
            except ValueError:
                return jsonify(ok=False, error=f"bad value for {k}"), 400
            params[k] = max(lo, min(hi, v))
    if not params:
        return jsonify(ok=False, error="nothing to set"), 400
    ok, msg = tel.send(params)
    if ok and "sonar" in params:
        brain.events.add("CONTROL", "info",
                         f"Safety brake {'enabled' if params['sonar'] else 'DISABLED'} by operator",
                         force=True)
    if ok and "dist" in params:
        brain.events.add("CONTROL", "info", f"Brake trigger distance set to {params['dist']} cm",
                         key="ctl-dist", cooldown=3)
    return jsonify(ok=ok, message=msg)


@app.post("/api/ai")
def api_ai():
    body = request.get_json(silent=True) or {}
    for k in ("enabled", "objects", "depth", "enhance"):
        if k in body:
            vision.settings[k] = bool(body[k])
    return jsonify(ok=True, settings=vision.settings)


@app.post("/api/snapshot")
def api_snapshot():
    url = brain.manual_snapshot()
    return jsonify(ok=bool(url), url=url)


@app.post("/api/ask")
def api_ask():
    body = request.get_json(silent=True) or {}
    q = str(body.get("question", "")).strip()[:500]
    if not q:
        return jsonify(error="empty question"), 400
    hist = body.get("history") if isinstance(body.get("history"), list) else []
    return jsonify(llm.ask(q, brain.llm_context(), hist))


@app.post("/api/report")
def api_report():
    return jsonify(llm.report(brain.llm_context()))


@app.get("/api/reports")
def api_reports():
    files = sorted(config.REPORT_DIR.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)
    return jsonify([{"file": p.name, "time": time.strftime("%Y-%m-%d %H:%M", time.localtime(p.stat().st_mtime))}
                    for p in files[:20]])


@app.get("/reports/<name>")
def get_report(name):
    if not name.endswith(".md"):
        abort(404)
    return send_from_directory(config.REPORT_DIR, name, as_attachment=request.args.get("dl") == "1")


@app.get("/snapshots/<path:p>")
def get_snapshot(p):
    return send_from_directory(config.SNAP_DIR, p)


# ---------------------------------------------------------------------- main
def main():
    global brain, llm
    ap = argparse.ArgumentParser(description="ResQBot AI Mission Control")
    ap.add_argument("--no-browser", action="store_true", help="do not open the browser")
    args = ap.parse_args()

    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    print("ResQBot AI Mission Control")
    print(f"  camera stream : {config.STREAM_URL}")
    print(f"  telemetry     : {config.DATA_URL}")
    print("  training the hazard model ...")
    brain = MissionBrain(cam, tel, vision)
    print(f"  {brain.hazard.description}")
    llm = RoverLLM()
    print(f"  LLM           : {llm.model if llm.available else 'offline answers (no API key)'}")
    for th in (cam, tel, vision, brain):
        th.start()
    url = f"http://127.0.0.1:{config.PORT}/"
    print(f"  dashboard     : {url}   (press Ctrl+C to stop)")
    if not args.no_browser:
        threading.Timer(2.0, webbrowser.open, args=(url,)).start()
    app.run(host=config.HOST, port=config.PORT, threaded=True, debug=False, use_reloader=False)


if __name__ == "__main__":
    main()
