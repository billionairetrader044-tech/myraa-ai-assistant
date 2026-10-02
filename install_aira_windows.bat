@echo off
title AIRA — Windows Desktop + Browser AI Agent Installer
echo ==========================================================
echo   AIRA — Ultimate Multimodal Windows + Browser AI Agent
echo ==========================================================
echo.
echo [1/4] Installing Node.js dependencies...
call npm install
echo.
echo [2/4] Installing Python Windows Agent & Playwright packages...
pip install pywin32 pyautogui pillow playwright
playwright install chromium firefox msedge
echo.
echo [3/4] Starting AIRA Native Windows Companion Agent (127.0.0.1:4578)...
start "AIRA Windows Companion" python desktop-agent\aira_windows_agent.py
echo.
echo [4/4] Starting AIRA Unified Voice + Multimodal Server (http://localhost:3000)...
call npm run dev
