#!/usr/bin/env python3
"""
Download upstream AI rule lists and build apple-rules/ai.list + windows-rules/ai.yaml.
No hand-written rules — only parse, classify, dedupe, emit.

Sources:
  - VPSDance/ai-proxy-rules (shadowrocket/*.list + all.list)
  - blackmatrix7/ios_rule_script (Shadowrocket OpenAI, Claude, Anthropic, Gemini, Copilot, BardAI)
"""
from __future__ import annotations

import json
import re
import urllib.request
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".ai-rules-cache"
LIST_OUT = ROOT / "apple-rules" / "ai.list"
YAML_OUT = ROOT / "windows-rules" / "ai.yaml"

RULE_RE = re.compile(
    r"^(DOMAIN(?:-SUFFIX|-KEYWORD)?|IP-CIDR6?|IP-ASN|USER-AGENT|PROCESS-NAME|GEOIP),"
)

VPS_PROVIDERS: list[tuple[str, str]] = [
    ("openai", "OpenAI"),
    ("anthropic", "Anthropic"),
    ("google-ai", "Google AI"),
    ("x-ai", "xAI"),
    ("meta-ai", "Meta AI"),
    ("mistral-ai", "Mistral AI"),
    ("cohere", "Cohere"),
    ("lmarena", "LMArena"),
    ("copilot", "Copilot"),
    ("cursor", "Cursor"),
    ("zed", "Zed"),
    ("windsurf", "Windsurf"),
    ("jetbrains-ai", "JetBrains AI"),
    ("augment-code", "Augment Code"),
    ("factory", "Factory"),
    ("sourcegraph", "Sourcegraph"),
    ("tabnine", "Tabnine"),
    ("replit", "Replit"),
    ("amazon-q", "Amazon Q Developer"),
    ("kiro", "Kiro"),
    ("bytedance-ai", "ByteDance AI"),
    ("devin", "Devin"),
    ("v0", "v0"),
    ("bolt", "Bolt.new"),
    ("lovable", "Lovable"),
    ("continue", "Continue"),
    ("coderabbit", "CodeRabbit"),
    ("phind", "Phind"),
    ("midjourney", "Midjourney"),
    ("stability-ai", "Stability AI"),
    ("black-forest-labs", "Black Forest Labs"),
    ("ideogram", "Ideogram"),
    ("adobe-firefly", "Adobe Firefly"),
    ("leonardo-ai", "Leonardo AI"),
    ("recraft", "Recraft"),
    ("lovart", "Lovart"),
    ("openart", "OpenArt"),
    ("clipdrop", "ClipDrop"),
    ("comfyui", "ComfyUI"),
    ("civitai", "Civitai"),
    ("suno", "Suno"),
    ("udio", "Udio"),
    ("runway", "Runway"),
    ("pika", "Pika"),
    ("luma-ai", "Luma AI"),
    ("heygen", "HeyGen"),
    ("synthesia", "Synthesia"),
    ("descript", "Descript"),
    ("gamma", "Gamma"),
    ("huggingface", "Hugging Face"),
    ("groq", "Groq"),
    ("openrouter", "OpenRouter"),
    ("together-ai", "Together AI"),
    ("fireworks-ai", "Fireworks AI"),
    ("replicate", "Replicate"),
    ("deepinfra", "DeepInfra"),
    ("cerebras", "Cerebras"),
    ("chutes", "Chutes"),
    ("cloudflare-ai", "Cloudflare AI"),
    ("perplexity", "Perplexity"),
    ("you", "You.com"),
    ("genspark", "Genspark"),
    ("poe", "Poe"),
    ("character-ai", "Character.AI"),
    ("inflection", "Inflection"),
    ("duck-ai", "DuckDuckGo AI"),
    ("dia-browser", "Dia Browser"),
    ("elevenlabs", "ElevenLabs"),
    ("otter-ai", "Otter.ai"),
    ("grammarly", "Grammarly"),
    ("jasper", "Jasper"),
    ("youmind", "YouMind"),
    ("openclaw", "OpenClaw"),
    ("hermes-agent", "Hermes Agent"),
    ("eigent", "Eigent"),
    ("manus", "Manus"),
    ("dify", "Dify"),
    ("langchain", "Langchain"),
    ("crewai", "CrewAI"),
    ("h2o-ai", "H2O.ai"),
    ("ollama", "Ollama"),
    ("lmstudio", "LM Studio"),
]

BM7_FILES: list[tuple[str, str]] = [
    ("bm7-OpenAI.list", "OpenAI"),
    ("bm7-OpenAI_Resolve.list", "OpenAI"),
    ("bm7-Claude.list", "Anthropic"),
    ("bm7-Anthropic.list", "Anthropic"),
    ("bm7-Gemini.list", "Google AI"),
    ("bm7-BardAI.list", "Google AI"),
    ("bm7-Copilot.list", "Copilot"),
]

VPS_ALL_URL = (
    "https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/shadowrocket/all.list"
)
VPS_BASE = (
    "https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/shadowrocket/{id}.list"
)
BM7_BASE = (
    "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Shadowrocket/{folder}/{file}"
)
BM7_MAP = {
    "bm7-OpenAI.list": ("OpenAI", "OpenAI", "OpenAI.list"),
    "bm7-OpenAI_Resolve.list": ("OpenAI", "OpenAI", "OpenAI_Resolve.list"),
    "bm7-Claude.list": ("Claude", "Claude", "Claude.list"),
    "bm7-Anthropic.list": ("Anthropic", "Anthropic", "Anthropic.list"),
    "bm7-Gemini.list": ("Gemini", "Gemini", "Gemini.list"),
    "bm7-BardAI.list": ("BardAI", "BardAI", "BardAI.list"),
    "bm7-Copilot.list": ("Copilot", "Copilot", "Copilot.list"),
}


def fetch(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "conf-build-ai-rules/1.0"})
    dest.write_bytes(urllib.request.urlopen(req, timeout=120).read())


def download_all() -> dict:
    CACHE.mkdir(parents=True, exist_ok=True)
    manifest: dict = {}

    jobs: list[tuple[str, str]] = [("vpsdance-all.list", VPS_ALL_URL)]
    for pid, _ in VPS_PROVIDERS:
        jobs.append((f"vpsdance-{pid}.list", VPS_BASE.format(id=pid)))
    for name, (folder, _, fname) in BM7_MAP.items():
        jobs.append(
            (
                name,
                BM7_BASE.format(folder=folder, file=fname),
            )
        )

    for name, url in jobs:
        dest = CACHE / name
        try:
            fetch(url, dest)
            manifest[name] = {"url": url, "bytes": dest.stat().st_size, "ok": True}
        except Exception as exc:
            manifest[name] = {"url": url, "ok": False, "error": str(exc)}

    (CACHE / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return manifest


def parse_rules(text: str) -> list[str]:
    rules: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if RULE_RE.match(s):
            rules.append(s)
    return rules


def dedupe_keep_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def build_sections() -> OrderedDict[str, list[str]]:
    sections: OrderedDict[str, list[str]] = OrderedDict()

    def add(vendor: str, rules: list[str]) -> None:
        if not rules:
            return
        sections.setdefault(vendor, [])
        sections[vendor].extend(rules)

    for pid, vendor in VPS_PROVIDERS:
        path = CACHE / f"vpsdance-{pid}.list"
        if path.is_file():
            add(vendor, parse_rules(path.read_text(encoding="utf-8", errors="replace")))

    for fname, vendor in BM7_FILES:
        path = CACHE / fname
        if path.is_file():
            add(vendor, parse_rules(path.read_text(encoding="utf-8", errors="replace")))

    for vendor in sections:
        sections[vendor] = dedupe_keep_order(sections[vendor])

    return sections


def write_list(sections: OrderedDict[str, list[str]]) -> int:
    lines = [
        "# Generated by scripts/build_ai_rules.py — do not edit by hand",
        "# Upstream: VPSDance/ai-proxy-rules (per-provider .list) + blackmatrix7 Shadowrocket lists",
        "# Cache: .ai-rules-cache/  |  Mirror: windows-rules/ai.yaml",
        "# Policy: apple.conf (HOME) / windows.js (AI) — not in this file",
        "",
    ]
    total = 0
    for vendor, rules in sections.items():
        if not rules:
            continue
        lines.append(f"# ===== {vendor} =====")
        lines.extend(rules)
        lines.append("")
        total += len(rules)

    LIST_OUT.parent.mkdir(parents=True, exist_ok=True)
    LIST_OUT.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8", newline="\n")
    return total


def write_yaml(sections: OrderedDict[str, list[str]]) -> int:
    lines = [
        "payload:",
        "  # Generated by scripts/build_ai_rules.py — mirror of apple-rules/ai.list",
        "  # windows.js: RULE-SET,ai,AI",
        "",
    ]
    total = 0
    for vendor, rules in sections.items():
        if not rules:
            continue
        lines.append(f"  # ===== {vendor} =====")
        for rule in rules:
            lines.append(f"  - {rule}")
            total += 1
        lines.append("")

    YAML_OUT.parent.mkdir(parents=True, exist_ok=True)
    YAML_OUT.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8", newline="\n")
    return total


def verify_coverage(sections: OrderedDict[str, list[str]]) -> dict:
    """Ensure every rule from downloaded files appears in output."""
    all_downloaded: set[str] = set()
    per_file: dict[str, set[str]] = {}

    for path in sorted(CACHE.glob("*.list")):
        rules = set(parse_rules(path.read_text(encoding="utf-8", errors="replace")))
        per_file[path.name] = rules
        all_downloaded |= rules

    output_rules: set[str] = set()
    for rules in sections.values():
        output_rules |= set(rules)

    missing = sorted(all_downloaded - output_rules)
    extra = sorted(output_rules - all_downloaded)

    # all.list vs union(per-provider)
    all_list_rules = per_file.get("vpsdance-all.list", set())
    union_vps = set()
    for pid, _ in VPS_PROVIDERS:
        union_vps |= per_file.get(f"vpsdance-{pid}.list", set())
    vps_only_in_all = sorted(all_list_rules - union_vps)
    vps_only_in_parts = sorted(union_vps - all_list_rules)

    return {
        "downloaded_files": len(per_file),
        "downloaded_rules_unique": len(all_downloaded),
        "output_rules_unique": len(output_rules),
        "missing_from_output": missing,
        "extra_in_output": extra,
        "vps_all_vs_parts_only_in_all": vps_only_in_all,
        "vps_all_vs_parts_only_in_parts": vps_only_in_parts[:20],
        "vps_all_vs_parts_only_in_parts_count": len(vps_only_in_parts),
    }


def main() -> None:
    print("Downloading upstream files to", CACHE)
    manifest = download_all()
    failed = [k for k, v in manifest.items() if not v.get("ok")]
    if failed:
        raise SystemExit(f"Download failed: {failed}")

    sections = build_sections()
    n_list = write_list(sections)
    n_yaml = write_yaml(sections)
    report = verify_coverage(sections)
    report_path = CACHE / "verify-report.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Vendors: {len(sections)}")
    print(f"Rules written: list={n_list} yaml={n_yaml}")
    print(f"Unique downloaded: {report['downloaded_rules_unique']}")
    print(f"Unique output: {report['output_rules_unique']}")
    print(f"Missing from output: {len(report['missing_from_output'])}")
    if report["missing_from_output"]:
        print("  First 10 missing:", report["missing_from_output"][:10])
    print(f"VPS all.list only (not in per-provider union): {len(report['vps_all_vs_parts_only_in_all'])}")
    print("Report:", report_path)


if __name__ == "__main__":
    main()
