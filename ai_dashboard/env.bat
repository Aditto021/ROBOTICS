@echo off
rem ---------------------------------------------------------------------------
rem  ResQBot AI dashboard - shared environment.
rem  Everything (Python, packages, caches, temp files) lives on drive D:.
rem  Nothing is written to drive C:.
rem ---------------------------------------------------------------------------
set "RQ_ROOT=D:\Softwares\resqbot-ai"
set "RQ_VENV=%RQ_ROOT%\venv"
set "RQ_PY=%RQ_VENV%\Scripts\python.exe"

rem uv (package manager) and its managed Python
set "UV_CACHE_DIR=%RQ_ROOT%\cache\uv"
set "UV_PYTHON_INSTALL_DIR=%RQ_ROOT%\python"
set "UV_PYTHON_BIN_DIR=%RQ_ROOT%\python\bin"
set "UV_TOOL_DIR=%RQ_ROOT%\tools"
set "UV_TOOL_BIN_DIR=%RQ_ROOT%\tools\bin"
set "UV_PYTHON_INSTALL_REGISTRY=0"
set "UV_NO_MODIFY_PATH=1"
set "UV_LINK_MODE=copy"

rem Library caches and temp folders
set "PIP_CACHE_DIR=%RQ_ROOT%\cache\pip"
set "TORCH_HOME=%RQ_ROOT%\cache\torch"
set "HF_HOME=%RQ_ROOT%\cache\huggingface"
set "YOLO_CONFIG_DIR=%RQ_ROOT%\config\ultralytics"
set "MPLCONFIGDIR=%RQ_ROOT%\cache\matplotlib"
set "TEMP=%RQ_ROOT%\tmp"
set "TMP=%RQ_ROOT%\tmp"
set "PYTHONDONTWRITEBYTECODE="
set "PYTHONUTF8=1"

for %%D in ("%RQ_ROOT%" "%RQ_ROOT%\cache" "%RQ_ROOT%\tmp" "%RQ_ROOT%\config" "%UV_CACHE_DIR%" "%PIP_CACHE_DIR%" "%TORCH_HOME%" "%HF_HOME%" "%YOLO_CONFIG_DIR%" "%MPLCONFIGDIR%") do (
  if not exist "%%~D" mkdir "%%~D"
)
