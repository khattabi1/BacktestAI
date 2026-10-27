#!/usr/bin/env python
"""Standalone EA compiler — MetaEditor CLI wrapper."""
import os, subprocess, sys
from pathlib import Path

DEFAULT_METAEDITOR = r"C:\Program Files\MetaTrader 5 Portable Broker Global\MetaEditor64.exe"

def compile_ea(source_path: str, metaeditor_path: str = None) -> dict:
    me = metaeditor_path or os.getenv("MT5_METAEDITOR_PATH", DEFAULT_METAEDITOR)

    if not os.path.exists(source_path):
        return {"success": False, "error": f"Source not found: {source_path}"}
    if not os.path.exists(me):
        return {"success": False, "error": f"MetaEditor not found: {me}"}

    log_path = source_path.rsplit(".", 1)[0] + ".log"
    if os.path.exists(log_path):
        os.remove(log_path)

    cmd = [me, "/compile", source_path, "/log"]
    print(f"Compiling: {os.path.basename(source_path)}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

    ex5_path = source_path.rsplit(".", 1)[0] + ".ex5"
    ex5_exists = os.path.exists(ex5_path)
    log_content = ""
    if os.path.exists(log_path):
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            log_content = f.read()

    has_errors = "error" in log_content.lower() if log_content else False
    return {
        "success": ex5_exists and not has_errors and result.returncode == 0,
        "returncode": result.returncode,
        "ex5_path": ex5_path,
        "ex5_exists": ex5_exists,
        "log": log_content[:3000],
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python compile_ea.py <path-to-mq5>")
        sys.exit(1)
    result = compile_ea(sys.argv[1])
    print(f"\nSuccess: {result['success']}")
    if result.get("ex5_path"):
        print(f"EX5: {result['ex5_path']}")
    if result.get("log"):
        print(f"Log:\n{result['log']}")