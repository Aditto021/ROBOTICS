"""Download the AI models once (setup.bat runs this). Needs internet.

models/yolo11n-pose.pt          people + 17 body keypoints  (Ultralytics)
models/resqbot-world.pt         YOLO-World v2 small with the ResQBot vocabulary baked in
models/midas_v21_small_256.onnx monocular depth (Intel ISL MiDaS v2.1 small)
"""
import shutil
import sys
import urllib.request
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from resqbot_ai.config import DEPTH_MODEL, MODELS_DIR, POSE_MODEL, WORLD_MODEL  # noqa: E402
from resqbot_ai.vocab import CLASSES  # noqa: E402

ULTRA = "https://github.com/ultralytics/assets/releases/download/v8.3.0/"
MIDAS_URL = "https://github.com/isl-org/MiDaS/releases/download/v2_1/model-small.onnx"
WORLD_BASE = MODELS_DIR / "yolov8s-worldv2.pt"


def fetch(url: str, dest: Path, min_bytes: int) -> None:
    if dest.exists() and dest.stat().st_size >= min_bytes:
        print(f"  ok   {dest.name} (already downloaded)")
        return
    print(f"  get  {url}")
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": "resqbot-setup"})
    with urllib.request.urlopen(req, timeout=60) as r, open(tmp, "wb") as f:
        shutil.copyfileobj(r, f, length=1 << 20)
    if tmp.stat().st_size < min_bytes:
        tmp.unlink()
        raise RuntimeError(f"download of {url} looks incomplete")
    tmp.replace(dest)
    print(f"  ok   {dest.name} ({dest.stat().st_size / 1e6:.1f} MB)")


def main() -> int:
    from ultralytics import YOLO, settings

    settings.update({"sync": False})  # no usage analytics

    print("Pose model")
    fetch(ULTRA + "yolo11n-pose.pt", POSE_MODEL, 2_000_000)

    print("YOLO-World + ResQBot vocabulary")
    if not WORLD_MODEL.exists():
        fetch(ULTRA + "yolov8s-worldv2.pt", WORLD_BASE, 10_000_000)
        world = YOLO(str(WORLD_BASE))
        world.set_classes(CLASSES)          # uses CLIP once to encode the class names
        world.save(str(WORLD_MODEL))
        print(f"  ok   {WORLD_MODEL.name} ({len(CLASSES)} classes)")
    else:
        print(f"  ok   {WORLD_MODEL.name} (already built)")

    print("Depth model")
    fetch(MIDAS_URL, DEPTH_MODEL, 10_000_000)

    print("Checking the models")
    img = np.zeros((480, 640, 3), np.uint8)
    YOLO(str(POSE_MODEL)).predict(img, imgsz=320, verbose=False)
    w = YOLO(str(WORLD_MODEL))
    w.predict(img, imgsz=320, verbose=False)
    print(f"  ok   world classes: {', '.join(w.names.values())}")
    import onnxruntime as ort
    sess = ort.InferenceSession(str(DEPTH_MODEL), providers=["CPUExecutionProvider"])
    inp = sess.get_inputs()[0]
    out = sess.run(None, {inp.name: np.zeros((1, 3, 256, 256), np.float32)})[0]
    print(f"  ok   depth input {inp.shape} -> output {out.shape}")
    print("All models ready.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
