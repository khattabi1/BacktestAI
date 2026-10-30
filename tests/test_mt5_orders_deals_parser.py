import pytest
from pathlib import Path
from mcp_mt5.main import read_test_report

SAMPLE_HTML_REPORT = """<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html>
<head><title>Strategy Tester Report</title></head>
<body>
<table>
  <tr><td><b>Strategy Tester Report</b></td></tr>
  <tr><td>Deposit:</td><td><b>10 000.00</b></td></tr>
  <tr><td>Total Net Profit:</td><td><b>150.00</b></td></tr>
  <tr><td>Total Trades:</td><td><b>2</b></td></tr>
</table>

<table>
<tr><th colspan="11"><div><b>Orders</b></div></th></tr>
<tr>
  <td>Open Time</td><td>Order</td><td>Symbol</td><td>Type</td><td>Volume</td><td>Price</td><td>S / L</td><td>T / P</td><td>Time</td><td>State</td><td>Comment</td>
</tr>
<tr>
  <td>2024.01.10 10:00:00</td><td>101</td><td>XAUUSD</td><td>buy</td><td>0.10 / 0.10</td><td>2050.00</td><td>2040.00</td><td>2070.00</td><td>2024.01.10 10:00:00</td><td>filled</td><td>Trend Pullback</td>
</tr>
<tr>
  <td>2024.01.11 14:00:00</td><td>102</td><td>XAUUSD</td><td>sell</td><td>0.10 / 0.10</td><td>2060.00</td><td>2070.00</td><td>2040.00</td><td>2024.01.11 14:00:00</td><td>filled</td><td>Resistance Fade</td>
</tr>
</table>

<table>
<tr><th colspan="13"><div><b>Deals</b></div></th></tr>
<tr>
  <td>Time</td><td>Deal</td><td>Symbol</td><td>Type</td><td>Direction</td><td>Volume</td><td>Price</td><td>Order</td><td>Commission</td><td>Swap</td><td>Profit</td><td>Balance</td><td>Comment</td>
</tr>
<tr>
  <td>2024.01.10 10:00:00</td><td>1</td><td>XAUUSD</td><td>buy</td><td>in</td><td>0.10</td><td>2050.00</td><td>101</td><td>-3.00</td><td>0.00</td><td>0.00</td><td>10 000.00</td><td>Trend Pullback</td>
</tr>
<tr>
  <td>2024.01.10 12:30:00</td><td>2</td><td>XAUUSD</td><td>sell</td><td>out</td><td>0.10</td><td>2070.00</td><td>101</td><td>-3.00</td><td>0.00</td><td>200.00</td><td>10 200.00</td><td>tp 2070.00</td>
</tr>
<tr>
  <td>2024.01.11 14:00:00</td><td>3</td><td>XAUUSD</td><td>sell</td><td>in</td><td>0.10</td><td>2060.00</td><td>102</td><td>-3.00</td><td>0.00</td><td>0.00</td><td>10 200.00</td><td>Resistance Fade</td>
</tr>
<tr>
  <td>2024.01.11 15:45:00</td><td>4</td><td>XAUUSD</td><td>buy</td><td>out</td><td>0.10</td><td>2070.00</td><td>102</td><td>-3.00</td><td>0.00</td><td>-100.00</td><td>10 100.00</td><td>sl 2070.00</td>
</tr>
</table>
</body>
</html>
"""

def test_read_test_report_extracts_orders_and_deals(tmp_path):
    report_file = tmp_path / "test_report.htm"
    report_file.write_text(SAMPLE_HTML_REPORT, encoding="utf-8")

    result = read_test_report(str(report_file))

    assert result["success"] is True
    assert "orders" in result, "Result dictionary must include extracted 'orders'"
    assert len(result["orders"]) == 2

    # Check order 101 extraction
    order_101 = next(o for o in result["orders"] if o["order"] == "101")
    assert order_101["symbol"] == "XAUUSD"
    assert order_101["initial_sl"] == 2040.0
    assert order_101["initial_tp"] == 2070.0
    assert order_101["comment"] == "Trend Pullback"

    # Check deals extraction & correlation
    assert len(result["deals"]) == 4
    exit_deal_101 = next(d for d in result["deals"] if d["deal"] == "2")
    assert exit_deal_101["order"] == "101"
    assert exit_deal_101.get("initial_sl") == 2040.0
    assert exit_deal_101.get("initial_tp") == 2070.0
    assert exit_deal_101.get("exit_reason") == "TP_HIT"

    exit_deal_102 = next(d for d in result["deals"] if d["deal"] == "4")
    assert exit_deal_102["order"] == "102"
    assert exit_deal_102.get("initial_sl") == 2070.0
    assert exit_deal_102.get("initial_tp") == 2040.0
    assert exit_deal_102.get("exit_reason") == "SL_HIT"
