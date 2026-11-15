"""Vision AI running on the laptop CPU.

  * YOLO11n-pose      -> people (victim candidates) + "person down" posture
  * YOLO-World v2     -> fire, smoke, hazard objects, rescue resources
  * MiDaS v2.1 small  -> relative depth -> free-path left / centre / right
  * OpenCV            -> low-light enhancement (CLAHE + gamma), flame colour index,
                         brightness / sharpness image-quality metrics

Every model is optional: a missing model only switches that feature off.
"""
import collections
import math
import os
import threading
import time
import traceback

import cv2
import numpy as np

from . import config
from .vocab import THRESHOLDS, category

SKELETON = [(5, 7), (7, 9), (6, 8), (8, 10), (5, 6), (5, 11), (6, 12), (11, 12),
            (11, 13), (13, 15), (12, 14), (14, 16), (0, 1), (0, 2), (1, 3), (2, 4)]

# BGR colours for saved snapshots (same roles as the dashboard)
BGR = {
    "person": (229, 135, 57),
    "down": (59, 59, 208),
    "critical": (59, 59, 208),
    "hazard": (90, 131, 236),
    "resource": (12, 163, 12),
    "obstacle": (129, 135, 137),
    "animal": (233, 133, 144),
    "object": (129, 135, 137),
}

_MEAN = np.array([0.485, 0.456, 0.406], np.float32)
_STD = np.array([0.229, 0.224, 0.225], np.float32)
_CLAHE = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))


def encode(img, quality=80):
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buf.tobytes() if ok else None


def enhance(img, brightness):
    """Low-light enhancement: CLAHE on luminance, gamma lift when dark, light sharpening."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)
    l_ch = _CLAHE.apply(l_ch)
    out = cv2.cvtColor(cv2.merge((l_ch, a_ch, b_ch)), cv2.COLOR_LAB2BGR)
    if brightness < 90:
        gamma = float(np.interp(brightness, [20, 90], [0.5, 0.85]))
        lut = (np.power(np.arange(256) / 255.0, gamma) * 255.0).clip(0, 255).astype(np.uint8)
        out = cv2.LUT(out, lut)
    blur = cv2.GaussianBlur(out, (0, 0), 1.2)
    return cv2.addWeighted(out, 1.35, blur, -0.35, 0)


def flame_ratio(img):
    """Share of pixels with flame colours (bright, saturated red-orange-yellow)."""
    hsv = cv2.cvtColor(cv2.resize(img, (160, 120)), cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    mask = ((h <= 30) | (h >= 170)) & (s >= 110) & (v >= 190)
    return float(mask.mean())


def classify_posture(box, kp):
    """Return ("upright" | "down" | "unclear", torso angle from vertical in degrees or None)."""
    x1, y1, x2, y2 = box
    w = max(x2 - x1, 1.0)
    h = max(y2 - y1, 1.0)
    ar = w / h
    angle = None
    if kp is not None and len(kp) >= 13:
        sh = [kp[i] for i in (5, 6) if kp[i][2] > 0.4]
        hp = [kp[i] for i in (11, 12) if kp[i][2] > 0.4]
        if sh and hp:
            sx = float(np.mean([p[0] for p in sh]))
            sy = float(np.mean([p[1] for p in sh]))
            hx = float(np.mean([p[0] for p in hp]))
            hy = float(np.mean([p[1] for p in hp]))
            angle = math.degrees(math.atan2(abs(sx - hx), abs(sy - hy) + 1e-6))
            if angle > 60:
                return "down", angle
            if kp[0][2] > 0.4 and kp[0][1] > hy + 0.1 * h:   # head below the hips
                return "down", angle
            if angle < 30 and ar < 1.0:
                return "upright", angle
    if ar > 1.4:
        return "down", angle
    if ar < 0.8:
        return "upright", angle
    return "unclear", angle


def annotate(img, res, header=""):
    """Draw detections on a frame (used for saved snapshots)."""
    h, w = img.shape[:2]
    for o in res.get("objects", []):
        x1, y1, x2, y2 = [int(v * s) for v, s in zip(o["box"], (w, h, w, h))]
        col = BGR.get(o["cat"], BGR["object"])
        cv2.rectangle(img, (x1, y1), (x2, y2), col, 2)
        _label(img, f'{o["label"]} {o["conf"]:.0%}', x1, y1, col)
    for p in res.get("persons", []):
        x1, y1, x2, y2 = [int(v * s) for v, s in zip(p["box"], (w, h, w, h))]
        col = BGR["down"] if p["posture"] == "down" else BGR["person"]
        kps = p.get("kps") or []
        for a, b in SKELETON:
            if a < len(kps) and b < len(kps) and kps[a][2] > 0.4 and kps[b][2] > 0.4:
                cv2.line(img, (int(kps[a][0] * w), int(kps[a][1] * h)),
                         (int(kps[b][0] * w), int(kps[b][1] * h)), col, 2, cv2.LINE_AA)
        cv2.rectangle(img, (x1, y1), (x2, y2), col, 2)
        tag = "PERSON DOWN" if p["posture"] == "down" else "person"
        _label(img, f'{tag} {p["conf"]:.0%}', x1, y1, col)
    stamp = time.strftime("%Y-%m-%d %H:%M:%S")
    cv2.rectangle(img, (0, 0), (w, 24), (20, 20, 20), -1)
    cv2.putText(img, f"ResQBot  {stamp}  {header}", (8, 17), cv2.FONT_HERSHEY_SIMPLEX,
                0.5, (240, 239, 236), 1, cv2.LINE_AA)
    return img


def _label(img, text, x, y, col):
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
    y0 = max(y - th - 6, 0)
    cv2.rectangle(img, (x, y0), (x + tw + 6, y0 + th + 6), col, -1)
    cv2.putText(img, text, (x + 3, y0 + th + 2), cv2.FONT_HERSHEY_SIMPLEX, 0.45,
                (255, 255, 255), 1, cv2.LINE_AA)


def _empty():
    return {"ts": 0.0, "w": 0, "h": 0, "infer_ms": 0, "persons": [], "objects": [],
            "flame_ratio": 0.0, "light": None, "depth": None}


class VisionEngine(threading.Thread):
    def __init__(self, hub):
        super().__init__(daemon=True, name="vision")
        self.hub = hub
        self.lock = threading.Lock()
        self.state = "loading"
        self.message = "Loading AI models..."
        self.models = {"pose": False, "world": False, "depth": False}
        self.settings = {"enabled": True, "objects": True, "depth": True, "enhance": True}
        self.pose = None
        self.world = None
        self.depth = None
        self.depth_input = None
        self.depth_size = 256
        self._result = _empty()
        self._frame = None
        self._times = collections.deque(maxlen=12)

    # ---------------------------------------------------------------- public
    @property
    def fps(self):
        t = list(self._times)
        if len(t) < 2 or time.time() - t[-1] > 3.0:
            return 0.0
        return (len(t) - 1) / max(t[-1] - t[0], 1e-6)

    def get_result(self):
        with self.lock:
            return self._result

    def snapshot_image(self, header=""):
        with self.lock:
            frame, res = self._frame, self._result
        if frame is None:
            return None
        return annotate(frame.copy(), res, header)

    # ---------------------------------------------------------------- models
    def _load(self):
        # half the CPU threads: the other half keeps the 30 fps video (relay + browser) smooth
        threads = config.AI_THREADS or max(1, (os.cpu_count() or 2) // 2)
        problems = []
        try:
            cv2.setNumThreads(threads)
        except Exception:
            pass
        try:
            import torch
            torch.set_num_threads(threads)
        except Exception as e:
            problems.append(f"PyTorch: {e}")
        YOLO = None
        try:
            from ultralytics import YOLO
        except Exception as e:
            problems.append(f"Ultralytics: {e}")
        blank = np.zeros((240, 320, 3), np.uint8)

        if YOLO is not None and config.POSE_MODEL.exists():
            try:
                self.pose = YOLO(str(config.POSE_MODEL), task="pose")
                self.pose.predict(blank, imgsz=config.AI_IMGSZ, verbose=False)
                self.models["pose"] = True
            except Exception as e:
                self.pose = None
                problems.append(f"pose model: {e}")
        elif YOLO is not None:
            problems.append("pose model file missing (run setup.bat)")

        if YOLO is not None and config.WORLD_MODEL.exists():
            try:
                self.world = YOLO(str(config.WORLD_MODEL))
                self.world.predict(blank, imgsz=config.AI_IMGSZ, verbose=False)
                self.models["world"] = True
            except Exception as e:
                self.world = None
                problems.append(f"object model: {e}")
        elif YOLO is not None:
            problems.append("object model file missing (run setup.bat)")

        if config.DEPTH_MODEL.exists():
            try:
                import onnxruntime as ort
                so = ort.SessionOptions()
                so.intra_op_num_threads = threads
                self.depth = ort.InferenceSession(str(config.DEPTH_MODEL), so,
                                                  providers=["CPUExecutionProvider"])
                inp = self.depth.get_inputs()[0]
                self.depth_input = inp.name
                if len(inp.shape) == 4 and isinstance(inp.shape[2], int):
                    self.depth_size = inp.shape[2]
                self.models["depth"] = True
            except Exception as e:
                self.depth = None
                problems.append(f"depth model: {e}")
        else:
            problems.append("depth model file missing (run setup.bat)")

        if any(self.models.values()):
            self.state = "running"
            self.message = "; ".join(problems)
        else:
            self.state = "unavailable"
            self.message = "; ".join(problems) or "no AI models"

    # ---------------------------------------------------------------- loop
    def run(self):
        try:
            self._load()
        except Exception as e:
            self.state = "unavailable"
            self.message = f"model loading failed: {e}"
        last_id = 0
        n = 0
        while True:
            if not self.settings["enabled"]:
                if self.state == "running":
                    self.state = "paused"
                time.sleep(0.2)
                continue
            if self.state == "paused":
                self.state = "running"
            fid, jpeg, ts = self.hub.get("raw")
            if jpeg is None or fid == last_id or time.time() - ts > 2.0:
                time.sleep(0.02)
                continue
            last_id = fid
            img = cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)
            if img is None:
                continue
            try:
                res = self._analyse(img, n)
            except Exception as e:
                traceback.print_exc()
                self.message = f"analysis error: {e}"
                time.sleep(0.5)
                continue
            n += 1
            time.sleep(0.1)         # breather so the video threads always get CPU time
            self._times.append(time.time())
            with self.lock:
                self._result = res
                self._frame = img

    def _analyse(self, img, n):
        t0 = time.perf_counter()
        h, w = img.shape[:2]
        gray = cv2.resize(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (160, 120))
        brightness = float(gray.mean())
        light = {
            "brightness": round(brightness, 1),
            "contrast": round(float(gray.std()), 1),
            "sharpness": round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 1),
            "lowlight": brightness < 70,
        }
        # (the live "Enhanced" video view is made at full frame rate in app.py)
        use_enh = light["lowlight"] and self.settings["enhance"]
        light["ai_on_enhanced"] = use_enh
        src = enhance(img, brightness) if use_enh else img

        # Laptop-CPU schedule: people every analysis, fire/hazards every 2nd, depth every 3rd.
        # Results carry over in between, so the overlay never blinks.
        persons = self._run_pose(src, w, h) if self.pose is not None else []
        objects = []
        if self.world is not None and self.settings["objects"]:
            if n % 2 == 0 or not self._result.get("ts"):
                objects = self._run_world(src, w, h)
            else:
                objects = self._result.get("objects", [])

        prev = self._result.get("depth")
        depth = None
        if self.depth is not None and self.settings["depth"]:
            if n % 3 == 0 or prev is None:
                depth, vis = self._run_depth(img)
                j = encode(vis, 80)
                if j:
                    self.hub.publish("depth", j)
            else:
                depth = prev

        return {
            "ts": time.time(), "w": w, "h": h,
            "infer_ms": int((time.perf_counter() - t0) * 1000),
            "persons": persons, "objects": objects,
            "flame_ratio": round(flame_ratio(img), 4),
            "light": light, "depth": depth,
        }

    def _run_pose(self, src, w, h):
        r = self.pose.predict(src, imgsz=config.AI_IMGSZ, conf=0.35, verbose=False)[0]
        if r.boxes is None or len(r.boxes) == 0:
            return []
        xyxy = r.boxes.xyxy.cpu().numpy()
        conf = r.boxes.conf.cpu().numpy()
        kps = r.keypoints.data.cpu().numpy() if r.keypoints is not None else None
        out = []
        for i in range(len(xyxy)):
            k = kps[i] if kps is not None and i < len(kps) else None
            posture, angle = classify_posture(xyxy[i], k)
            out.append({
                "box": _norm(xyxy[i], w, h),
                "conf": round(float(conf[i]), 2),
                "posture": posture,
                "angle": None if angle is None else round(angle),
                "kps": [] if k is None else
                [[round(float(x) / w, 4), round(float(y) / h, 4), round(float(c), 2)] for x, y, c in k],
            })
        return out

    def _run_world(self, src, w, h):
        r = self.world.predict(src, imgsz=config.AI_IMGSZ, conf=0.15, verbose=False)[0]
        if r.boxes is None or len(r.boxes) == 0:
            return []
        xyxy = r.boxes.xyxy.cpu().numpy()
        conf = r.boxes.conf.cpu().numpy()
        cls = r.boxes.cls.cpu().numpy().astype(int)
        out = []
        for i in range(len(xyxy)):
            label = str(r.names.get(int(cls[i]), cls[i])) if isinstance(r.names, dict) else str(r.names[int(cls[i])])
            cat = category(label)
            c = float(conf[i])
            if c < THRESHOLDS.get(cat, 0.35):
                continue
            out.append({"label": label, "cat": cat, "conf": round(c, 2), "box": _norm(xyxy[i], w, h)})
        out.sort(key=lambda o: -o["conf"])
        return out[:20]

    def _run_depth(self, img):
        size = self.depth_size
        x = cv2.resize(img, (size, size), interpolation=cv2.INTER_AREA)
        x = cv2.cvtColor(x, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        x = ((x - _MEAN) / _STD).transpose(2, 0, 1)[None].astype(np.float32)
        out = self.depth.run(None, {self.depth_input: x})[0]
        d = np.squeeze(out).astype(np.float32)
        if d.ndim != 2:
            d = d.reshape(size, size)
        lo, hi = np.percentile(d, 2), np.percentile(d, 98)
        d = np.clip((d - lo) / max(float(hi - lo), 1e-6), 0.0, 1.0)  # 1 = nearest
        hh = d.shape[0]
        band = d[int(hh * 0.35):int(hh * 0.92)]
        sectors = np.array_split(band, 3, axis=1)
        near = [round(float(np.percentile(s, 85)), 3) for s in sectors]

        vis = cv2.applyColorMap((d * 255).astype(np.uint8), cv2.COLORMAP_INFERNO)
        vis = cv2.resize(vis, (img.shape[1], img.shape[0]))
        H, W = vis.shape[:2]
        y1, y2 = int(H * 0.35), int(H * 0.92)
        for k in (1, 2):
            cv2.line(vis, (W * k // 3, y1), (W * k // 3, y2), (240, 239, 236), 1, cv2.LINE_AA)
        cv2.rectangle(vis, (0, y1), (W - 1, y2), (240, 239, 236), 1)
        for k, name in enumerate(("LEFT", "CENTRE", "RIGHT")):
            cv2.putText(vis, f"{name} {near[k]:.2f}", (W * k // 3 + 8, y2 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
        return {"left": near[0], "center": near[1], "right": near[2]}, vis


def _norm(b, w, h):
    return [round(float(b[0]) / w, 4), round(float(b[1]) / h, 4),
            round(float(b[2]) / w, 4), round(float(b[3]) / h, 4)]
