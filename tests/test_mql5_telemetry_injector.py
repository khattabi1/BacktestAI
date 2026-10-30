import pytest
import re


@pytest.mark.asyncio
async def test_generate_mql5_ea_contains_telemetry():
    from packages.agent.src.tools.strategy import generate_mql5_ea

    res = await generate_mql5_ea(
        name="TelemetryGoldEA",
        symbol="XAUUSD",
        timeframe="PERIOD_M15",
    )
    assert res["success"] is True
    code = res["code"]

    # Must contain diagnostic counters
    assert "g_ticks_total" in code
    assert "g_blocked_by_time" in code
    assert "g_blocked_by_spread" in code
    assert "g_signals_found" in code

    # Must print formatted diagnostic in OnDeinit
    assert "[DIAGNOSTIC]" in code
    assert "PrintFormat" in code or "Print" in code


def test_standardize_mt5_results_extracts_zero_trade_diagnostic():
    from packages.agent.src.tools.mt5_mcp import _standardize_mt5_test_results

    mock_output = {
        "success": True,
        "deals": [],  # 0 trades
        "tester_log": (
            "2025.01.01 00:00:00  TelemetryGoldEA initialized\n"
            "2025.01.02 00:00:00  [DIAGNOSTIC] Ticks: 45000 | Blocked Time: 0 | Blocked Spread: 45000 | Signals: 0\n"
            "2025.01.02 00:00:00  TelemetryGoldEA deinitialized\n"
        ),
    }

    _standardize_mt5_test_results(mock_output, ea_name="TelemetryGoldEA.mq5", symbol="XAUUSD")

    assert mock_output["success"] is False
    assert mock_output["total_trades_count"] == 0
    assert "diagnostic_telemetry" in mock_output

    diag = mock_output["diagnostic_telemetry"]
    assert diag["ticks"] == 45000
    assert diag["blocked_spread"] == 45000
    assert diag["signals"] == 0
    assert "Spread" in diag["bottleneck"]
    assert "Spread" in mock_output["error"]
