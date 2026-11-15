@echo off
rem Stops the background ResQBot dashboard (it starts again at the next sign-in).
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-CimInstance Win32_Process -Filter \"name='cmd.exe'\" | Where-Object { $_.CommandLine -like '*server.bat*' } | ForEach-Object { taskkill /pid $_.ProcessId /t /f | Out-Null };" ^
  "Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo ResQBot dashboard stopped.
