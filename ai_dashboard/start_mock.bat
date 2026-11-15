@echo off
rem Test the AI dashboard WITHOUT the robot: a simulated ESP32-CAM (laptop webcam
rem or synthetic scene + simulated sensors) runs on port 8090.
rem Optional: start_mock.bat path\to\video.mp4   to use a video file instead.
setlocal
cd /d "%~dp0"
call "%~dp0env.bat"
if not exist "%RQ_PY%" (
  echo Python environment not found. Run setup.bat once first.
  pause
  exit /b 1
)
set "SRC=%~1"
if "%SRC%"=="" set "SRC=0"
start "ResQBot CAM simulator" "%RQ_PY%" mock_cam.py --source "%SRC%"
set "RESQBOT_STREAM_URL=http://127.0.0.1:8090/stream"
set "RESQBOT_DATA_URL=http://127.0.0.1:8090/data"
set "RESQBOT_SET_URL=http://127.0.0.1:8090/set"
set "YOLO_OFFLINE=true"
set "YOLO_AUTOINSTALL=false"
"%RQ_PY%" app.py
pause
