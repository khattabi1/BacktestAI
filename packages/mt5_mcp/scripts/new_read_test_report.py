@mcp.tool()
def read_test_report(report_path: str) -> dict[str, Any]:
    """
    Read and parse a MetaTrader 5 Strategy Tester report.

    Prefers the HTML report if it exists; falls back to parsing the
    Tester log (UTF-16-LE) for key metrics when no HTML is available.

    Args:
        report_path: Path to the .html report or Tester .log file.

    Returns:
        Dict with success, metrics, and raw content.
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
                rf"<td[^>]*>([^<]*{re.escape(key)}[^<]*)</td>\s*<td[^>]*>(.*?)</td>",
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
