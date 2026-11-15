@echo off
rem ResQBot AI dashboard - background server (started hidden by autostart.vbs).
rem Runs fully offline and restarts itself if it ever stops. Log: mission_data\server.log
setlocal
cd /d "%~dp0"
call "%~dp0env.bat"
set "YOLO_OFFLINE=true"
set "YOLO_AUTOINSTALL=false"
set "PYTHONDONTWRITEBYTECODE=1"
if not exist "%~dp0mission_data" mkdir "%~dp0mission_data"
:loop
echo [%date% %time%] starting dashboard >> "%~dp0mission_data\server.log"
"%RQ_PY%" app.py --no-browser >> "%~dp0mission_data\server.log" 2>&1
echo [%date% %time%] dashboard stopped - restarting in 5 s >> "%~dp0mission_data\server.log"
timeout /t 5 /nobreak > nul
goto loop
