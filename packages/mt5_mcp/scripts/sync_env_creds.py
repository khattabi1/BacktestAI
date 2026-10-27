#!/usr/bin/env python3
"""sync_env_creds.py - Synchronize credentials from JSON/worker config to .env"""
import json, re, sys
from pathlib import Path

def _find_project_root() -> Path:
    cur = Path(__file__).resolve()
    for parent in cur.parents:
        if (parent / "mt5_workers").exists() or (parent / "packages").exists():
            return parent
    return cur.parents[2]

PROJECT_ROOT = _find_project_root()
ENV = Path(__file__).resolve().parent.parent / ".env"
CREDS = PROJECT_ROOT / "mt5_workers" / "worker_1" / "Config" / "mt5-creds.json"

creds: dict = {}
if CREDS.exists():
    try:
        creds = json.loads(CREDS.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"WARN: could not parse {CREDS}: {e}")

mapping = {
    "MT5_LOGIN": creds.get("MT5_LOGIN", "12345678"),
    "MT5_PASSWORD": creds.get("MT5_PASSWORD", ""),
    "MT5_SERVER": creds.get("MT5_SERVER", "PortableBrokerSC-Demo"),
}

if ENV.exists():
    lines = ENV.read_text(encoding="utf-8").splitlines()
    new_lines = []
    for ln in lines:
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln)
        if m and m.group(1) in mapping and mapping[m.group(1)]:
            new_val = mapping[m.group(1)]
            new_lines.append(f"{m.group(1)}={new_val}")
        else:
            new_lines.append(ln)
    apply = "--apply" in sys.argv
    if apply:
        ENV.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
        print("--- .env updated with credentials ---")
    else:
        print("--- (dry-run; pass --apply to write) ---")
else:
    print(f"No .env found at {ENV}")
