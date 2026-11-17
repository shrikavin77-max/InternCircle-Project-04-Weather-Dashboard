@echo off
title SKYCAST - Live Weather Dashboard Server
cd /d "%~dp0"

echo ========================================================
echo   SKYCAST - Live Weather Dashboard
echo   InternCircle Project 04 Local Server
echo ========================================================
echo.
echo Launching your default web browser...
start http://localhost:5500

echo Starting Python HTTP server on port 5500...
echo.
echo [INFO] Server running at: http://localhost:5500
echo [INFO] Press Ctrl+C in this window to stop the server.
echo.

python -m http.server 5500

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [WARNING] Python server could not be started on port 5500.
    echo Opening index.html directly in your web browser instead...
    start "" "%~dp0index.html"
)

pause
