@echo off
rem Starts the emulators, refreshes seeded content and runs the web app, all in this window.
rem Press Ctrl+C here to stop everything (the emulators save their data first).
cd /d "%~dp0"
title Hearthtable
call pnpm start
echo.
pause
