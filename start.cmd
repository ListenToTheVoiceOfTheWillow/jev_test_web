@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if not errorlevel 1 (
  set "NODE_CMD=node"
) else if exist "E:\secondsoft\myclaudeenv\nodejs\node.exe" (
  set "NODE_CMD=E:\secondsoft\myclaudeenv\nodejs\node.exe"
) else (
  echo Node.js was not found.
  echo Please install Node.js 18 or newer, then run this file again.
  pause
  exit /b 1
)

start "Jev Server" /min "%NODE_CMD%" "%~dp0server.cjs"
ping 127.0.0.1 -n 2 >nul
start "" "http://127.0.0.1:8787/"
echo Jev server started: http://127.0.0.1:8787/
echo If the browser did not open, copy the address above into your browser.
endlocal
