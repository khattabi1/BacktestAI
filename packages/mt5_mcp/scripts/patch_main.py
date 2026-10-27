"""Patch main.py with corrected strategy tester + report functions."""
import re

MAIN = r'C:\AA_Roan\AI\mt5-mcp-repo\src\mcp_mt5\main.py'

with open(MAIN, 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 1. Replace _get_mt5_paths with generic version ───
old_paths = '''def _get_mt5_paths() -> dict[str, str]:
    """Read MT5 paths from environment / .env, with Portable Broker defaults."""
    return {
        "terminal": os.getenv(
            "MT5_PATH",
            r"C:\\Program Files\\MetaTrader 5 Portable Broker Global\\terminal64.exe",
        ),
        "metaeditor": os.getenv(
            "MT5_METAEDITOR_PATH",
            r"C:\\Program Files\\MetaTrader 5 Portable Broker Global\\MetaEditor64.exe",
        ),
        "data_folder": os.getenv(
            "MT5_DATA_FOLDER",
            r"C:\\MetaTrader5_Portable",
        ),
        "config_folder": os.getenv(
            "MT5_CONFIG_FOLDER",
            r"C:\\MetaTrader5_Portable\\Config",
        ),
    }'''

new_paths = '''def _get_mt5_paths() -> dict[str, str]:
    """Read MT5 paths from environment / .env, with sensible defaults.

    The data_folder is the terminal data folder for the Portable Broker terminal.
    Override via environment variables for your own installation.
    """
    import uuid
    return {
        "terminal": os.getenv(
            "MT5_PATH",
            r"C:\\Program Files\\MetaTrader 5 Portable Broker Global\\terminal64.exe",
        ),
        "metaeditor": os.getenv(
            "MT5_METAEDITOR_PATH",
            r"C:\\Program Files\\MetaTrader 5 Portable Broker Global\\MetaEditor64.exe",
        ),
        "data_folder": os.getenv(
            "MT5_DATA_FOLDER",
            r"C:\\MetaTrader5_Portable",
        ),
        "config_folder": os.getenv(
            "MT5_CONFIG_FOLDER",
            r"C:\\MetaTrader5_Portable\\Config",
        ),
        "tester_log": os.getenv(
            "MT5_TESTER_LOG",
            r"C:\\MetaTrader5_Portable\\Tester\\logs",
        ),
        "terminal_ini": os.getenv(
            "MT5_TERMINAL_INI",
            r"C:\\MetaTrader5_Portable\\terminal.ini",
        ),
    }'''

content = content.replace(old_paths, new_paths)

# ─── 2. Replace run_strategy_tester ───
# Find the function and replace everything up to read_test_report
old_run_start = '@mcp.tool()\ndef run_strategy_tester('
old_read_start = '@mcp.tool()\ndef read_test_report('

old_run_end_idx = content.index(old_read_start)
old_run_section = content[content.index(old_run_start):old_run_end_idx]

new_run_section = '''@mcp.tool()
def run_strategy_tester(
    ea_name: str,
    symbol: str,
    period: str = "H1",
    model: int = 0,
    deposit: float = 10000.0,
    currency: str = "USD",
    leverage: int = 100,
    from_date: str | None = None,
    to_date: str | None = None,
    report_path: str | None = None,
    timeout: int = 600,
) -> dict[str, Any]:
    """
    Run the MetaTrader 5 Strategy Tester.

    CRITICAL WORKFLOW (learned through testing):
    1. MT5 ignores TestDateMode/TestFromDate/TestToDate in the config .ini
       file.  Date ranges MUST be set by directly editing terminal.ini's
       [Tester] section using Unix timestamps (DateFrom / DateTo).
    2. The config file MUST NOT contain a [Common] section — it prevents
       the test from triggering ("Tester automatic testing started"
       never appears in the log).
    3. Model=0 (every tick) is the only model that produces a report.
       Model=3 silently triggers "Mathematical calculations" mode.
    4. After the test completes the terminal must stay alive ~3‑5 s so it
       can flush the HTML report to disk.
    5. Tester logs are UTF-16-LE encoded.

    Args:
        ea_name: EA filename WITHOUT the "Experts\\\\" prefix.
                 e.g. "Moving Average.ex5" or "Advisors\\\\MyEA.ex5"
        symbol: e.g. "EURUSD", "XAUUSD"
        period: Timeframe string: "M1", "M5", "H1", "D1", "W1", "MN1"
        model: 0=every tick (default, recommended), 2=control points,
               3=open prices (AVOID — triggers math mode)
        deposit: Initial deposit
        currency: Account currency
        leverage: e.g. 100 for 1:100
        from_date: "YYYY.MM.DD" — start date (optional, uses terminal.ini default if omitted)
        to_date: "YYYY.MM.DD" — end date (optional)
        report_path: Where to save HTML report. Auto-generated if None.
        timeout: Seconds to wait for test completion (default 600)

    Returns:
        Dict with success status, report path, config file, and metrics
        parsed from the Tester log.
    """
    paths = _get_mt5_paths()
    terminal_path = paths["terminal"]
    config_folder = paths["config_folder"]
    data_folder = paths["data_folder"]
    tester_log_dir = paths["tester_log"]
    terminal_ini = paths["terminal_ini"]

    if not os.path.exists(terminal_path):
        raise FileNotFoundError(f"MT5 terminal not found at: {terminal_path}")

    os.makedirs(config_folder, exist_ok=True)

    # ── Build config file (simple [Tester] section, NO [Common]) ──
    period_num = _period_to_mt5_enum(period)
    config_lines = [
        "[Tester]",
        f"Expert={ea_name}",
        f"Symbol={symbol}",
        f"Period={period_num}",
        f"Model={model}",
        f"Deposit={deposit}",
        f"Currency={currency}",
        f"Leverage={leverage}",
        f"Optimization=0",
        "ExecutionMode=0",
    ]

    if report_path is None:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_path = str(Path(data_folder) / "MQL5" / "Files" / f"report_{ts}.html")
    Path(report_path).parent.mkdir(parents=True, exist_ok=True)

    config_lines.append(f"Report={report_path}")
    config_content = "\\n".join(config_lines) + "\\n"

    config_file = os.path.join(config_folder, "tester_config_mcp.ini")
    with open(config_file, "w") as f:
        f.write(config_content)

    logger.info(f"Config written to: {config_file}")
    logger.info(f"Report target: {report_path}")

    # ── Modify terminal.ini for date range (CRITICAL for date filtering) ──
    date_changes = {}
    if from_date:
        from datetime import time as _time_mod
        try:
            dt = datetime.strptime(from_date, "%Y.%m.%d")
            date_changes["DateFrom"] = str(int(dt.timestamp()))
        except ValueError:
            logger.warning(f"Could not parse from_date '{from_date}'")
    if to_date:
        try:
            dt = datetime.strptime(to_date, "%Y.%m.%d") + __import__("timedelta", from datetime import timedelta; timedelta(days=1)
        except ValueError:
            logger.warning(f"Could not parse to_date '{to_date}'")
    if from_date or to_date:
        changes = _modify_terminal_ini(terminal_ini, date_changes)
        logger.info(f"terminal.ini modifications: {changes}")

    # ── Kill any running MT5 processes ──
    _kill_mt5_processes()

    # ── Clean old Tester logs ──
    _clean_tester_logs(tester_log_dir)

    # ── Start terminal with config ──
    cmd = [terminal_path, f"/config:{config_file}"]
    logger.info(f"Launching: {cmd}")
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # ── Wait for report or timeout ──
    import time as _time
    report_exists = False
    test_completed = False
    elapsed = 0
    poll_interval = 2
    max_wait = timeout

    while elapsed < max_wait:
        _time.sleep(poll_interval)
        elapsed += poll_interval

        # Check for report file
        if os.path.exists(report_path):
            report_exists = True
            break

        # Check Tester log for completion
        log_result = _check_tester_log(tester_log_dir)
        if log_result["test_done"]:
            test_completed = True
            # Wait a bit for report to flush
            _time.sleep(5)
            if os.path.exists(report_path):
                report_exists = True
                break
            # If no report file, the test log itself is our data
            if _time.time() - log_result["done_time"] > 10:
                break

    # Kill terminal
    _kill_mt5_processes()

    # ── Parse results ──
    metrics = {}
    tester_log_content = ""
    log_file = _find_latest_tester_log(tester_log_dir)
    if log_file:
        tester_log_content = _read_utf16_log(log_file)
        metrics = _parse_tester_log(tester_log_content)

    return {
        "success": test_completed or report_exists,
        "config_file": config_file,
        "report_path": report_path,
        "report_exists": report_exists,
        "test_completed": test_completed,
        "tester_log": tester_log_content[:5000] if tester_log_content else "",
        "metrics": metrics,
        "elapsed_seconds": elapsed,
    }


'''

content = content.replace(old_run_section, new_run_section)

# ─── 3. Replace read_test_report ───
old_read_start = '@mcp.tool()\ndef read_test_report('
old_list_start = '@mcp.tool()\ndef list_strategies('

old_read_end_idx = content.index(old_list_start)
old_read_section = content[content.index(old_read_start):old_read_end_idx]

new_read_section = '''@mcp.tool()
def read_test_report(report_path: str) -> dict[str, Any]:
    """
    Read and parse a MetaTrader 5 Strategy Tester report.

    Prefers the HTML report if it exists; falls back to parsing the
    Tester log (UTF-16-LE) for key metrics when no HTML is available.

    Args:
        report_path: Path to the .html report file generated by
                     run_strategy_tester(), or a Tester log .log file.

    Returns:
        Dict with success, metrics, and raw content preview.
    """
    import re

    if not os.path.exists(report_path):
        raise FileNotFoundError(f"Report file not found: {report_path}")

    # If it's an HTML report
    if report_path.lower().endswith(".html"):
        with open(report_path, "r", encoding="utf-8", errors="replace") as f:
            html = f.read()

        metrics: dict[str, str] = {}
        target_keys = [
            "Total Trades", "Total Net Profit", "Maximum Drawdown",
            "Profit Factor", "Expected Payoff", "Sharpe Ratio",
            "Sortino Ratio", "Recovery Factor", "Balance", "Equity",
            "Margin", "Free Margin", "Initial Deposit", "Leverage",
            "Symbol", "Period", "Model", "Bars in test",
            "Bars modelled", "Ticks modelled", "Modeling quality",
        ]

        for key in target_keys:
            pattern = re.compile(
                rf"<td[^>]*>([^<]*{re.escape(key)}[^<]*)</td>\\s*<td[^>]*>(.*?)</td>",
                re.IGNORECASE | re.DOTALL,
            )
            m = pattern.search(html)
            if m:
                val = re.sub(r"<[^>]+>", "", m.group(2)).strip()
                if val:
                    metrics[key] = val

        return {
            "success": True,
            "report_path": report_path,
            "html_length": len(html),
            "html_head": html[:10000],
            "metrics": metrics,
        }

    # If it's a Tester log file (UTF-16-LE)
    else:
        log_content = _read_utf16_log(report_path)
        metrics = _parse_tester_log(log_content)
        return {
            "success": True,
            "report_path": report_path,
            "log_content": log_content[:5000],
            "metrics": metrics,
        }


'''

content = content.replace(old_read_section, new_read_section)

# ─── 4. Add helper functions before run_strategy_tester ───
helper_funcs = '''

# ──────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS FOR STRATEGY TESTING
# ──────────────────────────────────────────────────────────────────────────────

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

# Reverse lookup: some terminal.ini files use a slightly different numbering
_PERIOD_ENUM_ALT = {v: k for k, v in _PERIOD_ENUM.items()}


def _period_to_mt5_enum(period_str: str) -> int:
    """Convert a period string like 'H1' to MT5 numeric enum."""
    p = period_str.upper().strip()
    if p in _PERIOD_ENUM:
        return _PERIOD_ENUM[p]
    # If it's already a number, return as-is
    try:
        return int(p)
    except ValueError:
        pass
    raise ValueError(f"Unknown period: {period_str}. Use M1-M12, H1-H12, D1-D7, W1-W6, MN1")


def _kill_mt5_processes():
    """Kill all MT5-related processes."""
    import signal
    patterns = ["terminal64.exe", "metatester64.exe", "MetaEditor64.exe"]
    for pat in patterns:
        try:
            subprocess.run(["taskkill", "/IM", pat, "/F"],
                         capture_output=True, timeout=10)
        except Exception:
            pass
    import time as _time
    _time.sleep(2)


def _clean_tester_logs(log_dir: str):
    """Remove old Tester log files so we can detect fresh entries."""
    import time as _time
    if not os.path.exists(log_dir):
        return
    now = _time.time()
    for f in os.listdir(log_dir):
        fpath = os.path.join(log_dir, f)
        if f.endswith(".log") and (now - os.path.getmtime(fpath)) < 1:
            os.remove(fpath)
            logger.info(f"Removed stale Tester log: {f}")


def _read_utf16_log(path: str) -> str:
    """Read a UTF-16-LE encoded log file and return decoded text."""
    with open(path, 'rb') as f:
        raw = f.read()
    # Try UTF-16-LE first
    try:
        return raw.decode('utf-16-le', errors='replace')
    except Exception:
        return raw.decode('utf-8', errors='replace')


def _find_latest_tester_log(log_dir: str) -> str | None:
    """Find the most recent Tester log file."""
    if not os.path.exists(log_dir):
        return None
    logs = [f for f in os.listdir(log_dir) if f.endswith('.log')]
    if not logs:
        return None
    logs.sort(key=lambda f: os.path.getmtime(os.path.join(log_dir, f)),
              reverse=True)
    return os.path.join(log_dir, logs[0])


def _check_tester_log(log_dir: str) -> dict:
    """Check Tester log for test completion. Returns dict with status info."""
    import time as _time
    result = {"test_done": False, "done_time": None, "deals": 0,
              "final_balance": None, "bars": None, "log_text": ""}
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
                result["done_time"] = _time.time()
            if 'deal' in line.lower():
                result["deals"] += 1
            if 'balance' in line.lower():
                m = re.search(r'(\\d+\\.\\d+)', line)
                if m:
                    result["final_balance"] = float(m.group(1))
            if 'bars' in line.lower():
                m = re.search(r'(\\d+)', line)
                if m:
                    result["bars"] = int(m.group(1))
    except Exception as e:
        logger.warning(f"Error reading Tester log: {e}")
    return result


def _parse_tester_log(content: str) -> dict[str, Any]:
    """Parse Tester log content for key metrics."""
    metrics: dict[str, Any] = {}
    for line in content.split('\\n'):
        line = line.strip()
        # Deal count
        if 'deal' in line.lower() and ('buy' in line.lower() or 'sell' in line.lower() or 'done' in line.lower()):
            metrics.setdefault("total_deals", 0)
            metrics["total_deals"] = metrics.get("total_deals", 0) + 1
        # Test duration
        if 'Test passed' in line or 'Test completed' in line:
            m = re.search(r'(\\d+:\\d+,?\\d*)', line)
            if m:
                metrics["test_duration"] = m.group(1)
        # Balance
        if 'final balance' in line.lower() or 'balance:' in line.lower():
            m = re.search(r'([\\d.,]+)', line)
            if m:
                metrics["final_balance"] = m.group(1)
        # Bars
        if 'bar' in line.lower() and 'test' in line.lower():
            m = re.search(r'(\\d+)', line)
            if m:
                metrics["bars_in_test"] = int(m.group(1))
    return metrics


def _modify_terminal_ini(ini_path: str, changes: dict[str, str]) -> dict[str, bool]:
    """Safely modify terminal.ini (UTF-16-LE with BOM).

    Args:
        ini_path: Path to terminal.ini
        changes: dict of {key: new_value} to find-and-replace in [Tester] section

    Preserves the file's encoding (UTF-16-LE + BOM) and structure.
    Only modifies values within the [Tester] section.
    """
    if not os.path.exists(ini_path):
        logger.warning(f"terminal.ini not found at {ini_path}")
        return {}

    with open(ini_path, 'rb') as f:
        raw = f.read()

    # Detect and preserve BOM
    has_bom = raw[:2] == b'\\xff\\xfe'
    text = raw[2:].decode('utf-16-le', errors='replace') if has_bom else raw.decode('utf-16-le', errors='replace')

    lines = text.split('\\r\\n')
    modified = []
    in_tester = False
    changes_made = {}

    for line in lines:
        stripped = line.replace('\\x00', '').strip()

        if stripped == '[Tester]':
            in_tester = True
            modified.append(line)
            continue
        if stripped.startswith('[') and stripped != '[Tester]':
            in_tester = False

        if in_tester:
            for key, new_val in changes.items():
                # Match "key=<old_value>" and replace the value
                pattern = f'{key}='
                if pattern in stripped:
                    eq_idx = line.index('=')
                    new_line = line[:eq_idx+1] + new_val + '\\x00' * 0  # UTF-16-LE handled by encode
                    # Actually, rebuild the whole line properly
                    parts = stripped.split('=', 1)
                    if len(parts) == 2 and parts[0].strip() == key:
                        old_val = parts[1].strip()
                        new_line = line[:line.index('=')+1] + new_val
                        modified.append(new_line)
                        changes_made[key] = True
                        break
            else:
                modified.append(line)
                continue
            # If we broke out of the for loop (matched), skip the else
            continue
        else:
            modified.append(line)

    new_text = '\\r\\n'.join(modified)

    # Write back with original encoding
    if has_bom:
        new_raw = b'\\xff\\xfe' + new_text.encode('utf-16-le')
    else:
        new_raw = new_text.encode('utf-16-le')

    with open(ini_path, 'wb') as f:
        f.write(new_raw)

    return changes_made


'''

# Insert helper functions right before the old run_strategy_tester section
# (which we already replaced, so insert before the marker)
marker = '\n\n# ─'
# Find the MQL5 COMPILATION section and insert helpers before it
section_marker = '# ──────────────────────────────────────────────────────────────────────────────\n# MQL5 COMPILATION'
if section_marker in content:
    content = content.replace(section_marker, helper_funcs + section_marker)
else:
    # Fallback: insert before the compile tool
    content = content.replace(
        '@mcp.tool()\ndef compile_mql5',
        helper_funcs + '\n@mcp.tool()\ndef compile_mql5'
    )

with open(MAIN, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"main.py patched successfully!")
print(f"File size: {len(content)} chars")
print(f"Helper functions added: _period_to_mt5_enum, _kill_mt5_processes, _clean_tester_logs, _read_utf16_log, _find_latest_tester_log, _check_tester_log, _parse_tester_log, _modify_terminal_ini")
