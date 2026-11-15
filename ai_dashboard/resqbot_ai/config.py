"""Settings. Override any of them with environment variables (see README)."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = ROOT / "static"
MODELS_DIR = ROOT / "models"
DATA_DIR = ROOT / "mission_data"
SNAP_DIR = DATA_DIR / "snapshots"
REPORT_DIR = DATA_DIR / "reports"


def _env(name, default):
    v = os.environ.get(name)
    return v if v not in (None, "") else default


# ESP32-CAM endpoints (firmware unchanged: video on port 81, data/settings on port 80)
CAM_HOST = _env("RESQBOT_CAM", "192.168.4.1")
STREAM_URL = _env("RESQBOT_STREAM_URL", f"http://{CAM_HOST}:81/stream")
DATA_URL = _env("RESQBOT_DATA_URL", f"http://{CAM_HOST}/data")
SET_URL = _env("RESQBOT_SET_URL", f"http://{CAM_HOST}/set")

# Local web server
HOST = _env("RESQBOT_HOST", "127.0.0.1")
PORT = int(_env("RESQBOT_PORT", "5000"))

# AI
AI_IMGSZ = int(_env("RESQBOT_AI_IMGSZ", "320"))      # 320 = fast on a laptop CPU, 416/480 = more accurate
AI_THREADS = int(_env("RESQBOT_AI_THREADS", "0"))     # 0 = half the CPU threads (the rest keeps the video smooth)
POSE_MODEL = MODELS_DIR / "yolo11n-pose.pt"
WORLD_MODEL = MODELS_DIR / "resqbot-world.pt"
DEPTH_MODEL = MODELS_DIR / "midas_v21_small_256.onnx"

# Sensor thresholds (same as the ESP32-CAM dashboard)
GAS_WARN = int(_env("RESQBOT_GAS_WARN", "1500"))
GAS_ALARM = int(_env("RESQBOT_GAS_ALARM", "2500"))
TEMP_WARN = float(_env("RESQBOT_TEMP_WARN", "38"))
TEMP_ALARM = float(_env("RESQBOT_TEMP_ALARM", "45"))

# Sonar safety brake: when the dashboard connects it switches the brake on and sets this
# stop distance (the car stops moving forward when an object is closer). The car keeps it
# in its flash memory. You can still change it from the dashboard afterwards. 0 = don't touch.
BRAKE_CM = int(_env("RESQBOT_BRAKE_CM", "40"))

# Video: on connect the dashboard sets the camera to this size/quality once (firmware unchanged).
# fs 6 = CIF 400x296 - the largest size the OV2640 sensor delivers at 30+ fps (VGA tops out ~20-25).
# q 10 = sharp JPEG (8 = best .. 40 = worst). CAM_FS=0 leaves the camera settings alone.
CAM_FS = int(_env("RESQBOT_CAM_FS", "6"))
CAM_Q = int(_env("RESQBOT_CAM_Q", "10"))
VIDEO_FPS = float(_env("RESQBOT_VIDEO_FPS", "30"))   # steady frame rate sent to the browser

# Claude (LLM) - key from the ANTHROPIC_API_KEY variable or the file api_key.txt
LLM_MODEL = _env("RESQBOT_LLM_MODEL", "claude-opus-5-5")
API_KEY_FILE = ROOT / "api_key.txt"

for _d in (DATA_DIR, SNAP_DIR, REPORT_DIR, MODELS_DIR):
    _d.mkdir(parents=True, exist_ok=True)
