@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  set "NODE_CMD=node"
) else if exist "E:\secondsoft\myclaudeenv\nodejs\node.exe" (
  set "NODE_CMD=E:\secondsoft\myclaudeenv\nodejs\node.exe"
) else (
  echo 未找到 Node.js。
  echo 请先安装 Node.js 18 或更高版本，然后再次运行此文件。
  pause
  exit /b 1
)
start "Jev Server" /min "%NODE_CMD%" server.cjs
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:8787/"
echo Jev 判断助手已启动：http://127.0.0.1:8787/
echo 关闭服务请在任务管理器中结束 node.exe，或关闭已打开的服务器窗口。
endlocal
