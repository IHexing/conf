#!/usr/bin/env python3
"""
将本地脱敏的 apple.conf / windows.js 自动注入本地 Clash Verge (Script.js) 中的真实住宅代理凭据，
并一键同步至私密 GitHub Secret Gist，实现小火箭与新电脑免手动填密码直接拉取。
（本脚本本身不含任何密码，可安全提交至公开仓库）
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APPLE_CONF_PATH = ROOT / "apple.conf"
SCRIPT_JS_PATH = (
    Path(os.environ.get("APPDATA", ""))
    / "io.github.clash-verge-rev.clash-verge-rev"
    / "profiles"
    / "Script.js"
)


def find_secret_gist_id(token: str) -> str:
    req = urllib.request.Request(
        "https://api.github.com/gists",
        headers={
            "Authorization": f"token {token}",
            "User-Agent": "conf-sync-gist",
        },
    )
    gists = json.loads(urllib.request.urlopen(req, timeout=15).read().decode("utf-8"))
    for g in gists:
        if not g.get("public") and "apple.conf" in g.get("files", {}):
            return g["id"]
    raise RuntimeError("未找到包含 apple.conf 的私密 Gist")


def get_github_token() -> str:
    p = subprocess.run(
        ["git", "credential", "fill"],
        input=b"protocol=https\nhost=github.com\n\n",
        capture_output=True,
        check=True,
    )
    for line in p.stdout.decode("utf-8", "ignore").splitlines():
        if line.startswith("password="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("未在 git credential 中找到 GitHub Token")


def extract_creds_from_script_js(script_text: str) -> tuple[str, int, str, str]:
    server = re.search(r'"server":\s*"([^"]+)"', script_text)
    port = re.search(r'"port":\s*(\d+)', script_text)
    cipher = re.search(r'"cipher":\s*"([^"]+)"', script_text)
    password = re.search(r'"password":\s*"([^"]+)"', script_text)
    if not (server and port and cipher and password):
        raise RuntimeError("未能从本地 Script.js 中提取完整的住宅代理凭据")
    return server.group(1), int(port.group(1)), cipher.group(1), password.group(1)


def main() -> None:
    if not SCRIPT_JS_PATH.is_file():
        raise SystemExit(f"未找到本地 Script.js: {SCRIPT_JS_PATH}")

    script_js = SCRIPT_JS_PATH.read_text("utf-8")
    server, port, cipher, password = extract_creds_from_script_js(script_js)

    apple_conf = APPLE_CONF_PATH.read_text("utf-8")
    ss_line = f"ss, {server}, {port}, encrypt-method={cipher}, password={password}, udp-relay=true"
    apple_conf_full = re.sub(
        r"serverA\s*=.*\nserverB\s*=.*\nserverC\s*=.*",
        f"serverA = {ss_line}\nserverB = {ss_line}\nserverC = {ss_line}",
        apple_conf,
    )

    token = get_github_token()
    gist_id = find_secret_gist_id(token)
    payload = json.dumps(
        {
            "description": "Private Clash Verge & Shadowrocket Config (with credentials)",
            "files": {
                "apple.conf": {"content": apple_conf_full},
                "windows.js": {"content": script_js},
            },
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        f"https://api.github.com/gists/{gist_id}",
        data=payload,
        method="PATCH",
        headers={
            "Authorization": f"token {token}",
            "User-Agent": "conf-sync-gist",
            "Content-Type": "application/json",
        },
    )
    resp = json.loads(urllib.request.urlopen(req, timeout=15).read().decode("utf-8"))
    print("已成功同步带真实凭据的配置至私密 Gist:", list(resp["files"].keys()))


if __name__ == "__main__":
    main()
