#!/usr/bin/env python
"""
run_backtest.py — One-shot strategy backtester entry point.

Compiles an EA (optional), modifies terminal.ini for the date range,
writes a tester config, launches MT5, parses the Tester log, and
returns structured results with HTML + CSV report saving.

Works standalone (no MCP server needed).
Also importable from the MCP server's run_strategy_tester tool.

Usage:
    python run_backtest.py \
        --ea "Moving Average.ex5" \
        --symbol EURUSD \
        --period H1 \
        --from-date 2026.09.14 \
        --to-date 2026.09.16 \
        --deposit 10000 \
        --save-html outputs/html_reports/ \
        --save-excel outputs/excel_reports/
"""
import argparse, os, re, subprocess, sys, time, csv, calendar
from datetime import datetime, timedelta
from pathlib import Path

# ── MT5 paths (override via env vars) ──
MT5_PATH = os.getenv("MT5_PATH",
    r"C:\Program Files\MetaTrader 5 Portable Broker Global\terminal64.exe")
MT5_METAEDITOR = os.getenv("MT5_METAEDITOR_PATH",
    r"C:\Program Files\MetaTrader 5 Portable Broker Global\MetaEditor64.exe")
MT5_DATA_FOLDER = os.getenv("MT5_DATA_FOLDER",
    r"C:\MetaTrader5_Portable")

CONFIG_FOLDER = os.path.join(MT5_DATA_FOLDER, "Config")
TESTER_LOG_DIR = os.path.join(MT5_DATA_FOLDER, "Tester", "logs")
TERMINAL_INI = os.path.join(MT5_DATA_FOLDER, "Config", "terminal.ini")
EXPERTS_FOLDER = os.path.join(MT5_DATA_FOLDER, "MQL5", "Experts")

# MT5 timeframe → numeric enum
PERIOD_MAP = {
    "M1": 16385, "M5": 16389, "M15": 16393, "H1": 16397, "H4": 16400,
    "D1": 16409, "W1": 16416, "MN1": 16422,
}


def log(msg: str):
    """Print a timestamped log message."""
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"  [{ts}] {msg}")
    sys.stdout.flush()


def kill_mt5():
    """Kill all MT5-related processes."""
    for proc in ["terminal64.exe", "metatester64.exe", "MetaEditor64.exe"]:
        try:
            subprocess.run(["taskkill", "/IM", proc, "/F"],
                           capture_output=True, timeout=10)
        except Exception:
            pass
    time.sleep(2)


def compile_ea(ea_source: str, metaeditor: str = MT5_METAEDITOR) -> dict:
    """Compile a .mq5 file into .ex5 using MetaEditor CLI."""
    if not os.path.exists(ea_source):
        return {"success": False, "error": f"Source file not found: {ea_source}"}
    if not os.path.exists(metaeditor):
        return {"success": False, "error": f"MetaEditor not found: {metaeditor}"}

    log_path = ea_source.rsplit(".", 1)[0] + ".log"
    if os.path.exists(log_path):
        os.remove(log_path)

    cmd = [metaeditor, "/compile", ea_source, "/log"]
    log(f"Compiling: {os.path.basename(ea_source)}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

    ex5_path = ea_source.rsplit(".", 1)[0] + ".ex5"
    ex5_exists = os.path.exists(ex5_path)

    log_content = ""
    if os.path.exists(log_path):
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            log_content = f.read()

    has_errors = "error" in log_content.lower() if log_content else False
    success = ex5_exists and not has_errors and result.returncode == 0

    return {
        "success": success,
        "returncode": result.returncode,
        "ex5_path": ex5_path,
        "ex5_exists": ex5_exists,
        "log": log_content[:3000],
    }


def modify_terminal_ini(date_from_unix: int, date_to_unix: int) -> dict:
    """Modify terminal.ini [Tester] section for date range.

    CRITICAL: MT5 ignores TestDateMode/TestFromDate/TestToDate in the config
    .ini file. Date ranges can ONLY be set by editing terminal.ini's
    [Tester] section using Unix timestamps.

    The file is UTF-16-LE encoded with a BOM.
    """
    if not os.path.exists(TERMINAL_INI):
        return {"error": f"terminal.ini not found at {TERMINAL_INI}"}

    with open(TERMINAL_INI, "rb") as f:
        raw = f.read()

    has_bom = raw[:2] == b"\xff\xfe"
    text = raw[2:].decode("utf-16-le", errors="replace") if has_bom \
           else raw.decode("utf-16-le", errors="replace")

    lines = text.split("\r\n")
    modified = []
    in_tester = False
    changes = {}

    for line in lines:
        stripped = line.replace("\x00", "").strip()

        if stripped == "[Tester]":
            in_tester = True
            modified.append(line)
            continue
        if stripped.startswith("[") and stripped != "[Tester]":
            in_tester = False
            modified.append(line)
            continue

        if in_tester:
            for key, val in [("DateFrom", str(date_from_unix)),
                             ("DateTo", str(date_to_unix))]:
                eq = line.find("=")
                if eq > 0 and line[:eq].replace("\x00", "").strip() == key:
                    new_line = line[:eq + 1] + val
                    modified.append(new_line)
                    changes[key] = val
                    break
            else:
                modified.append(line)
        else:
            modified.append(line)

    new_text = "\r\n".join(modified)
    if has_bom:
        new_raw = b"\xff\xfe" + new_text.encode("utf-16-le")
    else:
        new_raw = new_text.encode("utf-16-le")

    with open(TERMINAL_INI, "wb") as f:
        f.write(new_raw)

    return changes


def read_utf16_log(path: str) -> str:
    """Read a UTF-16-LE log file."""
    with open(path, "rb") as f:
        raw = f.read()
    text = raw[2:].decode("utf-16-le", errors="replace") if raw[:2] == b"\xff\xfe" \
           else raw.decode("utf-16-le", errors="replace")
    return text


def find_latest_tester_log() -> str | None:
    if not os.path.exists(TESTER_LOG_DIR):
        return None
    logs = [f for f in os.listdir(TESTER_LOG_DIR) if f.endswith(".log")]
    if not logs:
        return None
    logs.sort(key=lambda f: os.path.getmtime(os.path.join(TESTER_LOG_DIR, f)),
              reverse=True)
    return os.path.join(TESTER_LOG_DIR, logs[0])


def clean_tester_logs():
    """Remove ALL old Tester log files so we start fresh."""
    if not os.path.exists(TESTER_LOG_DIR):
        return
    for f in os.listdir(TESTER_LOG_DIR):
        if f.endswith(".log"):
            fp = os.path.join(TESTER_LOG_DIR, f)
            try:
                os.remove(fp)
                log(f"  Removed Tester log: {f}")
            except Exception as e:
                log(f"  WARN: Could not remove {f}: {e}")


def parse_tester_log(content: str) -> dict:
    """Extract key metrics from Tester log content."""
    metrics = {}
    deals = 0
    for line in content.split("\n"):
        s = line.strip()
        # Deal count: count "deal #N" lines (not "deal performed")
        if re.match(r'^.*\s+deal\s+#?\d+', s, re.IGNORECASE):
            if 'buy' in s.lower() or 'sell' in s.lower():
                deals += 1
        if "Test passed" in s or "Test completed" in s:
            m = re.search(r"(\d+:\d+:\d+)", s)
            if m:
                metrics["test_duration"] = m.group(1)
        if "final balance" in s.lower():
            m = re.search(r"([\d.,]+)", s)
            if m:
                metrics["final_balance"] = m.group(1)
        if "bars in test" in s.lower():
            m = re.search(r"(\d+)", s)
            if m:
                metrics["bars_in_test"] = int(m.group(1))
        # Only match date ranges that look like "from YYYY.MM.DD ... to YYYY.MM.DD"
        if 'from' in s.lower() and 'to' in s.lower() and 'testing' in s.lower():
            # Must have date-like pattern
            dm = re.search(r'from\s+(\d{4}\.\d{2}\.\d{2})\s+.*?to\s+(\d{4}\.\d{2}\.\d{2})', line, re.IGNORECASE)
            if dm:
                metrics["date_range"] = f"{dm.group(1)} to {dm.group(2)}"
        if "modelled" in s.lower():
            m = re.search(r"(\d+)", s)
            if m:
                metrics["bars_modelled"] = int(m.group(1))
    metrics["total_deals"] = deals
    return metrics


def run_backtest(ea_name: str, symbol: str, period: str = "H1",
                 model: int = 0, deposit: float = 10000,
                 currency: str = "USD", leverage: int = 100,
                 from_date: str | None = None,
                 to_date: str | None = None,
                 compile_source: str | None = None,
                 save_html: str | None = None,
                 save_excel: str | None = None,
                 timeout: int = 600) -> dict:
    """
    Full pipeline: compile → test → parse → save reports.

    Args:
        ea_name: EA filename WITHOUT "Experts\\" prefix
                 e.g. "Moving Average.ex5" or "Advisors\\MyEA.ex5"
        symbol: "EURUSD", "XAUUSD", etc.
        period: "M1", "M5", "H1", "D1", "W1", "MN1"
        model: 0 = every tick (ONLY reliable mode; 3 triggers math mode)
        deposit: Initial deposit
        from_date: "YYYY.MM.DD"
        to_date: "YYYY.MM.DD"
        compile_source: .mq5 source path (optional, auto-compile before test)
        save_html: directory for HTML report
        save_excel: directory for CSV report
        timeout: Max seconds
    """
    log(f"=== MT5 Strategy Backtest Pipeline ===")

    # ── 1. Optional compile ──
    if compile_source:
        log(f"Compiling {compile_source} ...")
        result = compile_ea(compile_source)
        if result["success"]:
            log(f"Compile OK: {result['ex5_path']}")
        else:
            log(f"Compile FAILED: {result.get('error', '')}")
            return result

    # ── 2. Modify terminal.ini for date range ──
    date_changes = {}
    if from_date:
        try:
            dt = datetime.strptime(from_date, "%Y.%m.%d")
            date_changes["DateFrom"] = str(calendar.timegm(dt.timetuple()))
        except ValueError:
            log(f"  WARN: Could not parse from_date '{from_date}'")
    if to_date:
        try:
            dt = datetime.strptime(to_date, "%Y.%m.%d")
            date_changes["DateTo"] = str(calendar.timegm(dt.timetuple()))
        except ValueError:
            log(f"  WARN: Could not parse to_date '{to_date}'")

    if date_changes:
        log("Modifying terminal.ini for date range ...")
        changes = modify_terminal_ini(
            int(date_changes.get("DateFrom", 0)),
            int(date_changes.get("DateTo", 0))
        )
        log(f"  terminal.ini updated: {changes}")
    else:
        log("  No date range specified — using terminal.ini defaults")

    # ── 3. Write config ──
    os.makedirs(CONFIG_FOLDER, exist_ok=True)
    period_num = PERIOD_MAP.get(period.upper(), 16397)  # default H1

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = os.path.join(MT5_DATA_FOLDER, "MQL5", "Files",
                               f"report_{ts}.html")
    os.makedirs(os.path.dirname(report_path), exist_ok=True)

    config_content = "\n".join([
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
        f"Report={report_path}",
    ]) + "\n"

    config_file = os.path.join(CONFIG_FOLDER, "tester_config_run.ini")
    with open(config_file, "w") as f:
        f.write(config_content)
    log(f"Config written: {config_file}")

    # ── 4. Kill MT5, clean logs, start ──
    log("Killing existing MT5 processes ...")
    kill_mt5()

    clean_tester_logs()

    # Remove old report if exists
    if os.path.exists(report_path):
        os.remove(report_path)

    log(f"Launching terminal with config ...")
    cmd = [MT5_PATH, f"/config:{config_file}"]
    log(f"  Command: {cmd[0]} {cmd[1]}")
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    pid = proc.pid
    log(f"  PID: {pid}")

    # ── 5. Monitor ──
    test_completed = False
    report_exists = False
    elapsed = 0
    poll_interval = 3

    # Read Tester log BEFORE killing terminal (terminal deletes it on kill)
    saved_tester_log = ""
    saved_metrics = {}
    saved_log_path = None

    log(f"Monitoring test (timeout={timeout}s) ...")
    while elapsed < timeout:
        time.sleep(poll_interval)
        elapsed += poll_interval

        if os.path.exists(report_path) and os.path.getsize(report_path) > 0:
            report_exists = True
            log(f"  Report file found! ({os.path.getsize(report_path)} bytes)")
            break

        log_file = find_latest_tester_log()
        if log_file:
            content = read_utf16_log(log_file)
            if "Test passed" in content or "Test completed" in content:
                test_completed = True
                # CRITICAL: Save log content before kill
                saved_tester_log = content
                saved_metrics = parse_tester_log(content)
                saved_log_path = log_file
                log(f"  Test completed! Deals: {saved_metrics.get('total_deals', '?')}")
                time.sleep(15)
                if os.path.exists(report_path) and os.path.getsize(report_path) > 0:
                    report_exists = True
                    break
                # Also check default report location
                default_report = os.path.join(MT5_DATA_FOLDER, "TestReport.html")
                if os.path.exists(default_report) and os.path.getsize(default_report) > 0:
                    report_path = default_report
                    report_exists = True
                    break
                else:
                    log(f"  No HTML report generated — will use Tester log data")
                    break
            # Progress: show last log line
            last_lines = content.strip().split("\n")
            if last_lines:
                snippet = last_lines[-1].strip()[:100]
                if elapsed % 15 == 0 and snippet:
                    log(f"  Progress (T+{elapsed}s): {snippet}")

    # ── 6. Kill terminal ──
    log("Killing MT5 terminal ...")
    kill_mt5()

    # ── 7. Results (use saved data from before kill) ──
    tester_log = saved_tester_log
    metrics = saved_metrics
    if metrics:
        log(f"  Deals: {metrics.get('total_deals', 0)}")
        log(f"  Balance: {metrics.get('final_balance', 'N/A')}")
        log(f"  Bars: {metrics.get('bars_in_test', 'N/A')}")
        log(f"  Date range: {metrics.get('date_range', 'N/A')}")
    else:
        # Fallback: re-read from file (may be lost after kill)
        log_file = find_latest_tester_log()
        if log_file:
            tester_log = read_utf16_log(log_file)
            metrics = parse_tester_log(tester_log)
            log(f"  Deals (recovered): {metrics.get('total_deals', 0)}")
        else:
            log("  No Tester log found!")

    # ── 8. Save reports ──
    reports = {}
    if save_html:
        os.makedirs(save_html, exist_ok=True)
        html_path = os.path.join(save_html, f"backtest_{ts}.html")
        # Try to copy the HTML report; if not available, generate from log
        if report_exists and os.path.exists(report_path):
            import shutil
            shutil.copy2(report_path, html_path)
            reports["html"] = html_path
        else:
            # Generate a simple HTML report from Tester log
            html_content = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Backtest Report</title></head>
<body>
<h1>MT5 Backtest Report</h1>
<p>EA: {ea_name}</p>
<p>Symbol: {symbol}</p>
<p>Period: {period}</p>
<p>Model: {model}</p>
<p>Date range: {from_date or 'N/A'} to {to_date or 'N/A'}</p>
<p>Deposit: {deposit} {currency}</p>
<p>Leverage: 1:{leverage}</p>
<hr>
<h2>Metrics</h2>
<table border="1">
"""
            for k, v in metrics.items():
                html_content += f"<tr><td>{k}</td><td>{v}</td></tr>\n"
            html_content += "</table>\n<hr>\n<pre>"
            html_content += tester_log[:5000].replace("<", "&lt;").replace(">", "&gt;")
            html_content += "\n</pre></body></html>"
            with open(html_path, "w") as f:
                f.write(html_content)
            reports["html"] = html_path
        log(f"  HTML saved: {reports['html']}")

    if save_excel:
        os.makedirs(save_excel, exist_ok=True)
        csv_path = os.path.join(save_excel, f"backtest_{ts}.csv")
        with open(csv_path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["Metric", "Value"])
            for k, v in metrics.items():
                writer.writerow([k, v])
        reports["excel"] = csv_path
        log(f"  CSV saved: {reports['excel']}")

    # ── Summary ──
    log(f"\n=== Results ===")
    log(f"  Test completed: {test_completed}")
    log(f"  Report exists: {report_exists}")
    log(f"  Metrics: {metrics}")
    log(f"  Elapsed: {elapsed}s")

    return {
        "success": test_completed or report_exists,
        "ea_name": ea_name,
        "symbol": symbol,
        "period": period,
        "test_completed": test_completed,
        "model": model,
        "date_range": f"{from_date} to {to_date}" if from_date else "default",
        "metrics": metrics,
        "tester_log_path": saved_log_path or (find_latest_tester_log() if os.path.exists(TESTER_LOG_DIR) else None),
        "tester_log": tester_log[-3000:] if tester_log else "",
        "reports": reports,
        "elapsed_seconds": elapsed,
    }


def main():
    parser = argparse.ArgumentParser(
        description="MT5 Strategy Backtest Kit — compile, test, report")
    parser.add_argument("--ea", required=True,
                        help="EA filename (e.g. 'Moving Average.ex5')")
    parser.add_argument("--symbol", default="EURUSD")
    parser.add_argument("--period", default="H1",
                        choices=["M1", "M5", "H1", "D1", "W1", "MN1"])
    parser.add_argument("--model", type=int, default=0,
                        help="0=every tick (recommended), 3=open prices (AVOID)")
    parser.add_argument("--deposit", type=float, default=10000)
    parser.add_argument("--currency", default="USD")
    parser.add_argument("--leverage", type=int, default=100)
    parser.add_argument("--from-date", default=None, help="YYYY.MM.DD")
    parser.add_argument("--to-date", default=None, help="YYYY.MM.DD")
    parser.add_argument("--compile", default=None,
                        help="Compile .mq5 source before testing")
    parser.add_argument("--save-html", default=None,
                        help="Directory for HTML report")
    parser.add_argument("--save-excel", default=None,
                        help="Directory for CSV report")
    parser.add_argument("--timeout", type=int, default=600)
    parser.add_argument("--compile-only", action="store_true",
                        help="Only compile, don't run test")

    args = parser.parse_args()

    if args.compile_only:
        result = compile_ea(args.compile or args.ea)
        print(f"\nCompile result: {result}")
        return

    result = run_backtest(
        ea_name=args.ea,
        symbol=args.symbol,
        period=args.period,
        model=args.model,
        deposit=args.deposit,
        currency=args.currency,
        leverage=args.leverage,
        from_date=args.from_date,
        to_date=args.to_date,
        compile_source=args.compile,
        save_html=args.save_html,
        save_excel=args.save_excel,
        timeout=args.timeout,
    )
    print(f"\n=== Final Result ===")
    print(f"Success: {result['success']}")
    print(f"Metrics: {result['metrics']}")
    if result.get("reports"):
        print(f"Reports: {result['reports']}")


if __name__ == "__main__":
    main()
