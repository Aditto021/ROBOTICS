"""ESP32-CAM simulator for testing the AI dashboard without the robot.

Serves the same endpoints as the real camera firmware on one port:
  /stream  MJPEG video  (laptop webcam, a video file, or a synthetic scene)
  /data    simulated telemetry JSON (temperature, gas spike every few minutes, sonar, ...)
  /set     accepts the same settings

    python mock_cam.py                  (webcam if present, else synthetic)
    python mock_cam.py --source my_video.mp4
Use start_mock.bat to run this together with the dashboard.
"""
import argparse
import math
import random
import threading
import time

import cv2
import numpy as np
from flask import Flask, Response, jsonify, request

app = Flask(__name__)
lock = threading.Lock()
latest = {"jpeg": None, "fps": 0.0}
S = {"link": 1, "t": 29.0, "h": 55.0, "gas": 600, "dist": 80, "son": 1, "trig": 20, "brk": 0,
     "spd": 6, "cmd": "S", "bt": 1, "shot": 0, "fs": 8, "q": 12, "flash": 0, "vf": 0, "hm": 0}
FPS = 30.0
FS_SIZE = {5: (320, 240), 6: (400, 296), 8: (640, 480), 9: (800, 600), 10: (1024, 768),
           11: (1280, 720), 12: (1280, 1024), 13: (1600, 1200)}


def synthetic(t):
    img = np.zeros((480, 640, 3), np.uint8)
    img[:] = (38, 34, 30)
    cv2.rectangle(img, (0, 300), (640, 480), (52, 50, 46), -1)                  # floor
    x = int(320 + 220 * math.sin(t / 4))
    cv2.rectangle(img, (x - 40, 220), (x + 40, 300), (70, 90, 120), -1)          # moving crate
    if int(t) % 30 < 8:                                                          # flickering "fire"
        for _ in range(40):
            px, py = random.randint(470, 560), random.randint(250, 300)
            cv2.circle(img, (px, py), random.randint(4, 12), (0, random.randint(90, 200), 255), -1)
    cv2.putText(img, "SIMULATED CAMERA", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
    cv2.putText(img, time.strftime("%H:%M:%S"), (20, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (160, 160, 160), 1)
    return img


def grabber(source):
    cap = None
    if source != "synthetic":
        cap = cv2.VideoCapture(int(source) if source.isdigit() else source)
        if not cap.isOpened():
            print(f"[mock] cannot open video source {source!r} - using the synthetic scene")
            cap = None
    times = []
    while True:
        t0 = time.time()
        frame = None
        if cap is not None:
            ok, frame = cap.read()
            if not ok:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)   # loop video files
                ok, frame = cap.read()
                frame = frame if ok else None
        if frame is None:
            frame = synthetic(t0)
        with lock:
            fs, q, vf, hm, flash = S["fs"], S["q"], S["vf"], S["hm"], S["flash"]
        frame = cv2.resize(frame, FS_SIZE.get(fs, (640, 480)))
        if vf:
            frame = cv2.flip(frame, 0)
        if hm:
            frame = cv2.flip(frame, 1)
        if flash:
            frame = cv2.convertScaleAbs(frame, alpha=1.0, beta=flash / 6)
        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, max(30, 100 - q * 2)])
        times = [x for x in times if t0 - x < 2] + [t0]
        with lock:
            latest["jpeg"] = buf.tobytes() if ok else latest["jpeg"]
            latest["fps"] = len(times) / 2.0
        time.sleep(max(0.0, 1 / FPS - (time.time() - t0)))


def simulator():
    start = time.time()
    cmds = ["S", "F", "F", "L", "F", "R", "S", "B", "F"]
    while True:
        el = time.time() - start
        with lock:
            cycle = el % 150
            S["t"] = round(29 + 0.6 * math.sin(el / 40) + random.gauss(0, 0.15) + (11 if 100 < cycle < 125 else 0), 1)
            S["h"] = round(55 + 3 * math.sin(el / 70) + random.gauss(0, 0.6))
            ramp = max(0.0, min(1.0, (cycle - 60) / 20)) if cycle < 95 else 0.0
            S["gas"] = int(600 + random.gauss(0, 25) + ramp * 2200)
            S["dist"] = int(max(5, min(180, S["dist"] + random.randint(-6, 6)))) if random.random() > 0.03 else -1
            if int(el) % 6 == 0:
                S["cmd"] = cmds[int(el / 6) % len(cmds)]
                S["spd"] = random.randint(4, 9)
            S["brk"] = int(S["son"] and S["cmd"] in "FGI" and 0 < S["dist"] <= S["trig"])
            S["shot"] = int(el % 80 < 10)
        time.sleep(0.25)


@app.get("/stream")
def stream():
    def gen():
        last = None
        while True:
            with lock:
                j = latest["jpeg"]
            if j is None or j is last:
                time.sleep(0.01)
                continue
            last = j
            yield (b"\r\n--resqbotframe\r\nContent-Type: image/jpeg\r\nContent-Length: "
                   + str(len(j)).encode() + b"\r\n\r\n" + j)
    return Response(gen(), mimetype="multipart/x-mixed-replace;boundary=resqbotframe")


@app.get("/data")
def data():
    with lock:
        d = dict(S)
        d.update(streaming=1, fps=round(latest["fps"], 1))
    return jsonify(d)


@app.get("/set")
def set_():
    with lock:
        for k, key in (("sonar", "son"), ("dist", "trig"), ("fs", "fs"), ("q", "q"),
                       ("flash", "flash"), ("vf", "vf"), ("hm", "hm")):
            if k in request.args:
                S[key] = int(request.args[k])
    return "OK"


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="0", help="webcam index, video file, or 'synthetic'")
    ap.add_argument("--port", type=int, default=8090)
    ap.add_argument("--fps", type=float, default=30, help="frames per second to send")
    a = ap.parse_args()
    FPS = max(1.0, a.fps)
    threading.Thread(target=grabber, args=(a.source,), daemon=True).start()
    threading.Thread(target=simulator, daemon=True).start()
    print(f"[mock] ESP32-CAM simulator on http://127.0.0.1:{a.port}  (source: {a.source})")
    app.run(host="127.0.0.1", port=a.port, threaded=True)
