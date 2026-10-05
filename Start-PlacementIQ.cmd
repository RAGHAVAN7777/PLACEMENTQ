@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-placementiq.ps1" %*
if errorlevel 1 pause
endlocal
