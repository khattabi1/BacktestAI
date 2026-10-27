@mcp.tool()
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
    1. MT5 ignores TestDateMode/TestFromDate/TestToDate in the config .ini.
       Date ranges MUST be set by editing terminal.ini's [Tester] section
       using Unix timestamps (DateFrom / DateTo).
    2. The config file MUST NOT contain a [Common] section.
    3. Model=0 (every tick) is the only model that produces a report.
       Model=3 silently triggers math mode with no data.
    4. Expert must NOT have the Experts\\ prefix (MT5 adds it automatically).
    5. After the test completes the terminal needs ~3-5s to flush the report.

    Args:
        ea_name: EA filename WITHOUT "Experts\\" prefix.
                 e.g. "Moving Average.ex5" or "Advisors\\MyEA.ex5"
        symbol: Trading symbol, e.g. "EURUSD", "XAUUSD"
        period: Timeframe: "M1", "M5", "H1", "D1", "W1", "MN1"
        model: 0=every tick (recommended), 2=control points. AVOID 3 (math mode).
        deposit: Initial deposit
        currency: Account currency
        leverage: e.g. 100 for 1:100
        from_date: "YYYY.MM.DD" start date (optional)
        to_date: "YYYY.MM.DD" end date (optional)
        report_path: Where to save HTML report. Auto-generated if None.
        timeout: Seconds to wait (default 600)

    Returns:
        Dict with success, metrics, config_file, report_path, tester_log.
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

    # Build the INI config file (simple [Tester] section, NO [Common])
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
    config_content = "\n".join(config_lines) + "\n"

    config_file = os.path.join(config_folder, "tester_config_mcp.ini")
    with open(config_file, "w") as f:
        f.write(config_content)

    logger.info(f"Config written to: {config_file}")
    logger.info(f"Report target: {report_path}")

    # Modify terminal.ini for date range (CRITICAL - config date params are ignored)
    date_changes = {}
    if from_date:
        try:
            dt = datetime.strptime(from_date, "%Y.%m.%d")
            date_changes["DateFrom"] = str(int(dt.timestamp()))
        except ValueError:
            logger.warning(f"Could not parse from_date '{from_date}'")
    if to_date:
        try:
            dt = datetime.strptime(to_date, "%Y.%m.%d") + timedelta(days=1)
            date_changes["DateTo"] = str(int(dt.timestamp()))
        except ValueError:
            logger.warning(f"Could not parse to_date '{to_date}'")
    if date_changes:
        changes = _modify_terminal_ini(terminal_ini, date_changes)
        logger.info(f"terminal.ini modifications: {changes}")

    # Kill any running MT5 processes
    _kill_mt5_processes()

    # Clean old Tester logs
    _clean_tester_logs(tester_log_dir)

    # Start terminal with config
    cmd = [terminal_path, f"/config:{config_file}"]
    logger.info(f"Launching: {cmd}")
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # Wait for report or timeout
    report_exists = False
    test_completed = False
    elapsed = 0
    poll_interval = 2
    max_wait = timeout

    while elapsed < max_wait:
        time.sleep(poll_interval)
        elapsed += poll_interval

        # Check for HTML report
        if os.path.exists(report_path):
            report_exists = True
            break

        # Check Tester log for completion
        log_result = _check_tester_log(tester_log_dir)
        if log_result["test_done"]:
            test_completed = True
            # Wait for report to flush
            time.sleep(5)
            if os.path.exists(report_path):
                report_exists = True
                break
            # Give it a bit more time, then fall back to log parsing
            time.sleep(5)
            break

    # Kill terminal
    _kill_mt5_processes()

    # Parse results from Tester log
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
