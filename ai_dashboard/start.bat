@echo off
rem ResQBot AI Mission Control - connect the laptop Wi-Fi to "ResQBot-CAM" first.
setlocal
cd /d "%~dp0"
call "%~dp0env.bat"
if not exist "%RQ_PY%" (
  echo Python environment not found. Run setup.bat once first.
  pause
  exit /b 1
)
set "YOLO_OFFLINE=true"
set "YOLO_AUTOINSTALL=false"
"%RQ_PY%" app.py %*
pause
