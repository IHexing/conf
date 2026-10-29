#!/usr/bin/env python3
"""
将两份个人规则转换为 Windows 格式；通用规则由客户端直接订阅社区。
默认执行还会注入本地住宅代理凭据，并同步本地 Script.js 与 GitHub Secret Gist。
--prepare-only / --check 仅操作或检查仓库规则，不读取凭据、不发布配置。
（本脚本本身不含任何密码，可安全提交至公开仓库）
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APPLE_CONF_PATH = ROOT / "apple.conf"
WINDOWS_JS_PATH = ROOT / "windows.js"
APPLE_RULES_DIR = ROOT / "apple-rules"
WINDOWS_RULES_DIR = ROOT / "windows-rules"
SCRIPT_JS_PATH = (
    Path(os.environ.get("APPDATA", ""))
    / "io.github.clash-verge-rev.clash-verge-rev"
    / "profiles"
    / "Script.js"
)


RULE_FILES = ("custom", "direct-custom")
RULES_CDN = "https://fastly.jsdelivr.net/gh/IHexing/conf@main"


def read_rules(text: str, *, yaml: bool = False) -> list[str]:
    """读取本仓库的平面规则列表，拒绝损坏的条目而不是静默丢弃。"""
    rules: list[str] = []
    for number, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#") or (yaml and line in ("payload:", "payload: []")):
            continue
        if yaml:
            if not line.startswith("- "):
                raise ValueError(f"第 {number} 行不是规则列表项")
            line = line[2:].strip()
            if line.startswith('"'):
                line = json.loads(line)
            elif line.startswith("'") and line.endswith("'"):
                line = line[1:-1].replace("''", "'")
        kind, separator, value = line.partition(",")
        if not separator or not value.strip() or not re.fullmatch(r"[A-Z][A-Z0-9-]*", kind):
            raise ValueError(f"第 {number} 行规则格式无效")
        if line not in rules:
            rules.append(line)
    return rules


def sync_apple_rules_to_windows(*, check: bool = False) -> list[str]:
    """只转换两份个人规则；社区数据由客户端直接订阅。"""
    pending: dict[Path, str] = {}
    for stem in RULE_FILES:
        src = APPLE_RULES_DIR / f"{stem}.list"
        dst = WINDOWS_RULES_DIR / f"{stem}.yaml"
        rules = read_rules(src.read_text("utf-8-sig"))
        lines = ["payload:" if rules else "payload: []", f"  # Generated from apple-rules/{src.name}; do not edit by hand."]
        lines.extend(f"  - {json.dumps(rule, ensure_ascii=False)}" for rule in rules)
        new_text = "\n".join(lines) + "\n"
        if not dst.is_file() or dst.read_text("utf-8") != new_text:
            pending[dst] = new_text
    # 两个源文件都通过校验后才写入，避免后一个文件损坏时只更新一半。
    if check and pending:
        raise RuntimeError("Windows 规则待重新生成: " + ", ".join(p.name for p in pending))
    if not check:
        WINDOWS_RULES_DIR.mkdir(parents=True, exist_ok=True)
        for dst, content in pending.items():
            dst.write_text(content, "utf-8", newline="\n")
    return [p.name for p in pending]


def ensure_rules_published() -> None:
    """主配置发布前确认所引用的四份个人规则已发布，避免只同步 Gist。"""
    for directory, suffix in ((APPLE_RULES_DIR, "list"), (WINDOWS_RULES_DIR, "yaml")):
        for stem in RULE_FILES:
            path = directory / f"{stem}.{suffix}"
            url = f"{RULES_CDN}/{directory.name}/{path.name}"
            request = urllib.request.Request(url, headers={"User-Agent": "conf-sync-gist"})
            with urllib.request.urlopen(request, timeout=15) as response:
                remote = response.read().decode("utf-8-sig")
            if read_rules(remote, yaml=suffix == "yaml") != read_rules(
                path.read_text("utf-8-sig"), yaml=suffix == "yaml"
            ):
                raise RuntimeError(
                    f"{directory.name}/{path.name} 尚未发布或 CDN 未更新；"
                    "请先发布个人规则，再同步主配置"
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


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="维护两份个人规则并同步主配置")
    parser.add_argument("--prepare-only", action="store_true", help="只生成本地规则，不读取凭据或发布")
    parser.add_argument("--check", action="store_true", help="只检查两端规则是否同步，不写入文件")
    args = parser.parse_args(argv)
    synced_yaml = sync_apple_rules_to_windows(check=args.check)
    if synced_yaml:
        print("已生成 Windows 个人规则:", synced_yaml)
    if args.prepare_only or args.check:
        print("两端个人规则检查通过；客户端生效验证另行进行")
        return

    ensure_rules_published()

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

    windows_js = WINDOWS_JS_PATH.read_text("utf-8")
    windows_js_full = re.sub(
        r'("server":\s*)"[^"]*",\s*\n(\s*"port":\s*)\d+,\s*\n(\s*"cipher":\s*)"[^"]*",\s*\n(\s*"password":\s*)"[^"]*"',
        rf'\g<1>"{server}",\n\g<2>{port},\n\g<3>"{cipher}",\n\g<4>"{password}"',
        windows_js,
    )
    if windows_js_full != script_js:
        SCRIPT_JS_PATH.write_text(windows_js_full, "utf-8")

    token = get_github_token()
    gist_id = find_secret_gist_id(token)
    payload = json.dumps(
        {
            "description": "Private Clash Verge & Shadowrocket Config (with credentials)",
            "files": {
                "apple.conf": {"content": apple_conf_full},
                "windows.js": {"content": windows_js_full},
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
