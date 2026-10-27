"""start_mt5_portable.py - Headless and portable MT5 worker manager for BacktestAI."""
import os, subprocess, sys, time
from pathlib import Path

def _find_project_root() -> Path:
    cur = Path(__file__).resolve()
    for parent in cur.parents:
        if (parent / "mt5_workers").exists() or (parent / "packages").exists():
            return parent
    return cur.parents[2]

PROJECT_ROOT = _find_project_root()
MT5_EXE = PROJECT_ROOT / "mt5_workers" / "worker_1" / "terminal64.exe"
MT5_DIR = PROJECT_ROOT / "mt5_workers" / "worker_1"
PORTABLE = "/portable"

def mt5_running() -> list[int]:
    out = subprocess.run(
        ["cmd.exe", "/c", "tasklist /FI \"imagename eq terminal64.exe\" /FO CSV"],
        capture_output=True, text=True
    ).stdout
    pids = []
    for line in out.splitlines()[1:]:
        pid = line.split(',')[-2].strip('"') if ',' in line else ""
        if pid.isdigit():
            pids.append(int(pid))
    return pids

def start_mt5():
    if not MT5_EXE.exists():
        print(f"Warning: {MT5_EXE} not found. MT5 worker may not be provisioned yet.")
        return
    subprocess.Popen(
        [str(MT5_EXE), PORTABLE, "/config", str(MT5_DIR / "Config" / "terminal.ini")],
        cwd=str(MT5_DIR),
        creationflags=subprocess.CREATE_NEW_CONSOLE,
    )

def main():
    pids = mt5_running()
    report = {"running": bool(pids), "pids": pids}
    if not pids:
        try:
            start_mt5()
            time.sleep(5)
            report["attempted_start"] = True
            report["running_after"] = bool(mt5_running())
        except Exception as e:
            report["start_error"] = str(e)
    print("MT5 status:", report)

if __name__ == "__main__":
    main()
