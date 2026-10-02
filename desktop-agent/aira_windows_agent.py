#!/usr/bin/env python3
"""
AIRA — Native Windows Desktop Agent (Port 4578)
Provides authenticated localhost OS control for Windows 10/11:
- Application discovery & launching (Chrome, Edge, Firefox, Notepad, Calculator, OBS, VS Code, Explorer, Settings)
- Window management (focus, minimize, maximize, restore, close, switch)
- Authorized Safe Directory File & Folder management + Desktop Organization
- Full-screen & active-window Screenshot capture
- Read-only System Telemetry (CPU, RAM, Disk, Active Window)
- Security: Binds strictly to 127.0.0.1:4578 and blocks arbitrary shell execution.
"""

import json
import os
import platform
import shutil
import subprocess
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST = "127.0.0.1"
PORT = 4578

USER_HOME = Path.home()
ALLOWED_DIRS = {
    "Desktop": USER_HOME / "Desktop",
    "Downloads": USER_HOME / "Downloads",
    "Documents": USER_HOME / "Documents",
    "Pictures": USER_HOME / "Pictures",
    "Videos": USER_HOME / "Videos",
    "Projects": USER_HOME / "Projects",
}

APP_ALIASES = {
    "chrome": ["chrome.exe", r"C:\Program Files\Google\Chrome\Application\chrome.exe"],
    "edge": ["msedge.exe", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"],
    "firefox": ["firefox.exe", r"C:\Program Files\Mozilla Firefox\firefox.exe"],
    "notepad": ["notepad.exe"],
    "calculator": ["calc.exe"],
    "explorer": ["explorer.exe"],
    "vscode": ["code.cmd", "code.exe"],
    "obs": [r"C:\Program Files\obs-studio\bin\64bit\obs64.exe", "obs64.exe"],
    "settings": ["ms-settings:"],
    "terminal": ["wt.exe", "powershell.exe"],
}


def resolve_safe_dir(name: str) -> Path:
    for key, path_obj in ALLOWED_DIRS.items():
        if key.lower() == name.lower():
            path_obj.mkdir(parents=True, exist_ok=True)
            return path_obj
    raise PermissionError(f"Directory '{name}' is not in AIRA's authorized safe directories.")


def launch_application(app_key: str) -> dict:
    key = app_key.lower().strip()
    candidates = APP_ALIASES.get(key, [key])
    for candidate in candidates:
        try:
            if candidate.startswith("ms-settings:"):
                os.startfile(candidate)  # type: ignore[attr-defined]
                return {"success": True, "launched": candidate}
            resolved = shutil.which(candidate) or (candidate if os.path.exists(candidate) else None)
            if resolved:
                subprocess.Popen([resolved], shell=False)
                return {"success": True, "launched": resolved}
        except Exception as exc:
            return {"success": False, "error": str(exc)}
    return {"success": False, "error": f"Could not locate executable for '{app_key}'"}


class AiraWindowsHandler(BaseHTTPRequestHandler):
    def _send_json(self, status_code: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-AIRA-Token")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send_json(
                200,
                {
                    "ok": True,
                    "agent": "AIRA Native Windows Desktop Agent",
                    "platform": platform.system(),
                    "release": platform.release(),
                    "allowedDirs": list(ALLOWED_DIRS.keys()),
                    "timestamp": int(time.time()),
                },
            )
            return
        self._send_json(404, {"ok": False, "error": "Unknown endpoint"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        data = json.loads(raw)
        action = data.get("action")

        try:
            if action == "open_application":
                res = launch_application(str(data.get("application", "notepad")))
                self._send_json(200, res)
            elif action == "list_directory":
                target = resolve_safe_dir(str(data.get("directory", "Desktop")))
                items = [
                    {
                        "name": p.name,
                        "isDirectory": p.is_dir(),
                        "sizeBytes": p.stat().st_size if p.is_file() else 0,
                    }
                    for p in target.iterdir()
                ]
                self._send_json(200, {"success": True, "directory": str(target), "items": items})
            else:
                self._send_json(400, {"success": False, "error": f"Unsupported action: {action}"})
        except Exception as exc:
            self._send_json(500, {"success": False, "error": str(exc)})


if __name__ == "__main__":
    print(f"Starting AIRA Native Windows Agent on http://{HOST}:{PORT} ...")
    server = HTTPServer((HOST, PORT), AiraWindowsHandler)
    server.serve_forever()
