@echo off
title Hindi Novel Audio Hub - Creator Server
cd /d "%~dp0"

echo ==========================================================
echo    🎧 Hindi Novel Audio Hub - Starting Server...
echo ==========================================================

REM Check if agy-node exists, else use node
set NODE_EXE="C:\Users\Dell\AppData\Roaming\Antigravity\bin\agy-node.cmd"

if exist %NODE_EXE% (
    echo Using Antigravity Node Runtime...
    start "" http://localhost:3000
    %NODE_EXE% server.js
) else (
    echo Using System Node...
    start "" http://localhost:3000
    node server.js
)

pause
