#!/usr/bin/env python3
"""Shortcut to run reset_fresh_slate.py directly."""
import sys
from pathlib import Path

# Run reset_fresh_slate.py in same directory
script = Path(__file__).resolve().parent / "reset_fresh_slate.py"
if script.exists():
    import importlib.util
    spec = importlib.util.spec_from_file_location("reset_fresh_slate", str(script))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.main()
else:
    print(f"Error: {script} not found")
    sys.exit(1)
