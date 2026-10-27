"""Helper functions for MT5 strategy testing - spliced into main.py via patch script."""
import os, re, subprocess, time, uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
import logging

logger = logging.getLogger(__name__)

# MT5 period enum values (numeric)
_PERIOD_ENUM = {
    "M1": 16385, "M2": 16386, "M3": 16387, "M4": 16388, "M5": 16389,
    "M6": 16390, "M7": 16391, "M8": 16392, "M9": 16393, "M10": 16394,
    "M11": 16395, "M12": 16396,
    "H1": 16397, "H2": 16398, "H3": 16399, "H4": 16400, "H5": 16401,
    "H6": 16402, "H7": 16403, "H8": 16404, "H9": 16405, "H10": 16406,
    "H11": 16407, "H12": 16408,
    "D1": 16409, "D2": 16410, "D3": 16411, "D4": 16412, "D5": 16413,
    "D6": 16414, "D7": 16415,
    "W1": 16416, "W2": 16417, "W3": 16418, "W4": 16419, "W5": 16420,
    "W6": 16421,
    "MN1": 16422,
}


def _period_to_mt5_enum(period_str):
    """Convert a period string like 'H1' to MT5 numeric enum."""
    p = period_str.upper().strip()
    if p in _PERIOD_ENUM:
        return _PERIOD_ENUM[p]
    try:
        return int(p)
    except ValueError:
        pass
    raise ValueError(f"Unknown period: {period_str}. Use M1-M12, H1-H12, D1-D7, W1-W6, MN1")


def _kill_mt5_processes():
    """Kill all MT5-related processes."""
    patterns = ["terminal64.exe", "metatester64.exe", "MetaEditor64.exe"]
    for pat in patterns:
        try:
            subprocess.run(["taskkill", "/IM", pat, "/F"],
                           capture_output=True, timeout=10)
        except Exception:
            pass
    time.sleep(2)


def _clean_tester_logs(log_dir):
    """Remove old Tester log files so we can detect fresh entries."""
    if not os.path.exists(log_dir):
        return
    now = time.time()
    for f in os.listdir(log_dir):
        fpath = os.path.join(log_dir, f)
        if f.endswith(".log"):
            ftime = os.path.getmtime(fpath)
            # Only remove recent logs (within last 5 minutes)
            if now - ftime < 300:
                os.remove(fpath)
                logger.info(f"Removed stale Tester log: {f}")


def _read_utf16_log(path):
    """Read a UTF-16-LE encoded log file and return decoded text."""
    with open(path, 'rb') as f:
        raw = f.read()
    has_bom = raw[:2] == b'\xff\xfe'
    if has_bom:
        return raw[2:].decode('utf-16-le', errors='replace')
    return raw.decode('utf-16-le', errors='replace')


def _find_latest_tester_log(log_dir):
    """Find the most recent Tester log file."""
    if not os.path.exists(log_dir):
        return None
    logs = [f for f in os.listdir(log_dir) if f.endswith('.log')]
    if not logs:
        return None
    logs.sort(key=lambda f: os.path.getmtime(os.path.join(log_dir, f)),
              reverse=True)
    return os.path.join(log_dir, logs[0])


def _check_tester_log(log_dir):
    """Check Tester log for test completion."""
    result = {"test_done": False, "done_time": None, "log_text": ""}
    log_file = _find_latest_tester_log(log_dir)
    if not log_file:
        return result
    try:
        content = _read_utf16_log(log_file)
        result["log_text"] = content[-3000:]
        for line in content.split('\n'):
            line = line.strip()
            if 'Test passed' in line or 'Test completed' in line:
                result["test_done"] = True
                result["done_time"] = time.time()
    except Exception as e:
        logger.warning(f"Error reading Tester log: {e}")
    return result


def _parse_tester_log(content):
    """Parse Tester log content for key metrics."""
    metrics = {}
    deals = 0
    for line in content.split('\n'):
        s = line.strip()
        # Deal count: count "deal #N" lines (not "deal performed")
        if re.match(r'^.*\s+deal\s+#?\d+', s, re.IGNORECASE):
            if 'buy' in s.lower() or 'sell' in s.lower():
                deals += 1
        if 'Test passed' in line or 'Test completed' in line:
            m = re.search(r'(\d+:\d+:\d+)', line)
            if m:
                metrics["test_duration"] = m.group(1)
        if 'final balance' in line.lower():
            m = re.search(r'([\d.,]+)', line)
            if m:
                metrics["final_balance"] = m.group(1)
        if 'bars in test' in line.lower():
            m = re.search(r'(\d+)', line)
            if m:
                metrics["bars_in_test"] = int(m.group(1))
        if 'testing of' in line.lower() and 'from' in line.lower() and 'to' in line.lower():
            dm = re.search(r'from\s+(\d{4}\.\d{2}\.\d{2})\s+.*?to\s+(\d{4}\.\d{2}\.\d{2})', line, re.IGNORECASE)
            if dm:
                metrics["date_range"] = f"{dm.group(1)} to {dm.group(2)}"
    metrics["total_deals"] = deals
    return metrics


def _modify_terminal_ini(ini_path, changes):
    """Safely modify terminal.ini (UTF-16-LE with BOM).

    Only modifies values within the [Tester] section.
    Preserves the file's UTF-16-LE encoding and BOM.
    """
    if not os.path.exists(ini_path):
        logger.warning(f"terminal.ini not found at {ini_path}")
        return {}

    with open(ini_path, 'rb') as f:
        raw = f.read()

    has_bom = raw[:2] == b'\xff\xfe'
    if has_bom:
        text = raw[2:].decode('utf-16-le', errors='replace')
    else:
        text = raw.decode('utf-16-le', errors='replace')

    lines = text.split('\r\n')
    modified = []
    in_tester = False
    changes_made = {}

    for line in lines:
        stripped = line.replace('\x00', '').strip()

        if stripped == '[Tester]':
            in_tester = True
            modified.append(line)
            continue
        if stripped.startswith('[') and stripped != '[Tester]':
            in_tester = False

        if in_tester:
            matched = False
            for key, new_val in changes.items():
                eq_idx = line.find('=')
                if eq_idx > 0 and line[:eq_idx].replace('\x00', '').strip() == key:
                    new_line = line[:eq_idx+1] + new_val
                    modified.append(new_line)
                    changes_made[key] = True
                    matched = True
                    break
            if not matched:
                modified.append(line)
        else:
            modified.append(line)

    new_text = '\r\n'.join(modified)

    if has_bom:
        new_raw = b'\xff\xfe' + new_text.encode('utf-16-le')
    else:
        new_raw = new_text.encode('utf-16-le')

    with open(ini_path, 'wb') as f:
        f.write(new_raw)

    return changes_made
