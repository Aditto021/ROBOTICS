@echo off
rem ===========================================================================
rem  ResQBot AI dashboard - ONE-TIME SETUP (needs internet, ~1.5 GB download)
rem
rem  Installs into D:\Softwares\resqbot-ai  (nothing on drive C:):
rem    * uv package manager + Python 3.12
rem    * PyTorch (CPU), Ultralytics YOLO, ONNX Runtime, OpenCV, scikit-learn,
rem      Flask, Anthropic SDK
rem  Downloads the AI models into  ai_dashboard\models :
rem    * YOLO11n-pose            (people + body posture)
rem    * YOLO-World v2 small     (fire, smoke and hazard objects)
rem    * MiDaS v2.1 small (ONNX) (depth / free path)
rem ===========================================================================
setlocal
cd /d "%~dp0"
call "%~dp0env.bat"

rem The CLIP text model used once to build the YOLO-World vocabulary saves to
rem "~\.cache". Point the home folder at D: for the setup only.
set "HOME=%RQ_ROOT%\home"
set "USERPROFILE=%RQ_ROOT%\home"
if not exist "%HOME%" mkdir "%HOME%"

echo.
echo [1/5] uv package manager
set "UV="
for /r "%RQ_ROOT%\uv" %%F in (uv.exe) do if exist "%%F" set "UV=%%F"
if not defined UV (
  if not exist "%RQ_ROOT%\uv" mkdir "%RQ_ROOT%\uv"
  curl.exe -L --fail --retry 3 -o "%TEMP%\uv.zip" https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip || goto :fail
  tar -xf "%TEMP%\uv.zip" -C "%RQ_ROOT%\uv" || goto :fail
  del "%TEMP%\uv.zip"
  for /r "%RQ_ROOT%\uv" %%F in (uv.exe) do if exist "%%F" set "UV=%%F"
)
if not defined UV goto :fail
echo     using %UV%

echo.
echo [2/5] Python 3.12 virtual environment
if not exist "%RQ_PY%" (
  "%UV%" venv "%RQ_VENV%" --python 3.12 --seed || goto :fail
)

echo.
echo [3/5] PyTorch (CPU build)
"%UV%" pip install --python "%RQ_PY%" torch torchvision --index-url https://download.pytorch.org/whl/cpu || goto :fail

echo.
echo [4/5] AI and web packages
"%UV%" pip install --python "%RQ_PY%" -r requirements.txt || goto :fail
"%UV%" pip install --python "%RQ_PY%" "git+https://github.com/ultralytics/CLIP.git"
if errorlevel 1 (
  echo     git install of CLIP failed, trying the PyPI package instead
  "%UV%" pip install --python "%RQ_PY%" openai-clip ftfy regex || goto :fail
)

echo.
echo [5/5] AI models
"%RQ_PY%" download_models.py || goto :fail

echo.
echo ===========================================================================
echo  Setup finished. Start the dashboard with  start.bat
echo ===========================================================================
pause
exit /b 0

:fail
echo.
echo *** Setup failed - see the message above. Fix the problem (usually the
echo *** internet connection) and run setup.bat again; finished steps are skipped.
pause
exit /b 1
