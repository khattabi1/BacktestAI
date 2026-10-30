import pytest
import json
from datetime import datetime


def test_generate_dynamic_forensic_autopsy_directional_and_hourly():
    from packages.agent.src.tools.execution import generate_dynamic_forensic_autopsy

    sample_trades = [
        # 5 Long trades: 4 wins, 1 loss (80% win rate, net +$1200)
        {"trade_id": "T1", "side": "buy", "pnl": 500.0, "entry_price": 2600.0, "exit_price": 2650.0, "entry_time": "2025-01-02 10:00:00", "exit_reason": "TP_HIT"},
        {"trade_id": "T2", "side": "buy", "pnl": 400.0, "entry_price": 2610.0, "exit_price": 2650.0, "entry_time": "2025-01-02 10:30:00", "exit_reason": "TP_HIT"},
        {"trade_id": "T3", "side": "buy", "pnl": 450.0, "entry_price": 2620.0, "exit_price": 2665.0, "entry_time": "2025-01-03 11:00:00", "exit_reason": "TP_HIT"},
        {"trade_id": "T4", "side": "buy", "pnl": -150.0, "entry_price": 2630.0, "exit_price": 2615.0, "entry_time": "2025-01-03 12:00:00", "exit_reason": "SL_HIT"},
        {"trade_id": "T5", "side": "buy", "pnl": 0.0, "entry_price": 2640.0, "exit_price": 2640.0, "entry_time": "2025-01-04 10:00:00", "exit_reason": "BE_HIT"},

        # 5 Short trades: 1 win, 4 losses (20% win rate, net -$850)
        {"trade_id": "T6", "side": "sell", "pnl": 150.0, "entry_price": 2680.0, "exit_price": 2665.0, "entry_time": "2025-01-05 08:00:00", "exit_reason": "TP_HIT"},
        {"trade_id": "T7", "side": "sell", "pnl": -300.0, "entry_price": 2670.0, "exit_price": 2700.0, "entry_time": "2025-01-05 14:00:00", "exit_reason": "SL_HIT"},
        {"trade_id": "T8", "side": "sell", "pnl": -250.0, "entry_price": 2675.0, "exit_price": 2700.0, "entry_time": "2025-01-06 14:15:00", "exit_reason": "SL_HIT"},
        {"trade_id": "T9", "side": "sell", "pnl": -200.0, "entry_price": 2680.0, "exit_price": 2700.0, "entry_time": "2025-01-06 14:45:00", "exit_reason": "SL_HIT"},
        {"trade_id": "T10", "side": "sell", "pnl": -250.0, "entry_price": 2685.0, "exit_price": 2710.0, "entry_time": "2025-01-07 18:00:00", "exit_reason": "SL_HIT"},
    ]

    metrics = {
        "net_profit": 350.0,
        "profit_factor": 1.30,
        "total_trades": 10,
        "win_rate": 0.50,
    }

    autopsy = generate_dynamic_forensic_autopsy(
        metrics=metrics,
        trades=sample_trades,
        strategy_name="gold_trend_breakout",
        symbol="XAUUSD",
        timeframe="M15",
    )

    # 1. Structure verification
    assert "directional_breakdown" in autopsy
    assert "hourly_breakdown" in autopsy
    assert "markdown_report" in autopsy
    assert "exit_reasons" in autopsy

    # 2. Long vs Short Asymmetry verification
    db = autopsy["directional_breakdown"]
    assert db["long"]["count"] == 5
    assert db["long"]["win_rate"] == 0.6  # 3 wins out of 5 (since 1 win, 1 loss, 1 BE) or winning trades calculation
    assert db["long"]["net_pnl"] == 1200.0
    assert db["short"]["count"] == 5
    assert db["short"]["win_rate"] == 0.2
    assert db["short"]["net_pnl"] == -850.0
    assert db["directional_asymmetry_detected"] is True

    # 3. Hourly loss clustering verification
    hb = autopsy["hourly_breakdown"]
    # Hour 14 had 3 losing trades totaling -$750
    assert 14 in hb["worst_losing_hours"]

    # 4. Report size constraint (< 1200 chars)
    md = autopsy["markdown_report"]
    assert len(md) <= 1200
    assert "Directional Edge & Asymmetry" in md
    assert "XAUUSD" in md


def test_generate_dynamic_forensic_autopsy_zero_trades():
    from packages.agent.src.tools.execution import generate_dynamic_forensic_autopsy

    autopsy = generate_dynamic_forensic_autopsy(
        metrics={},
        trades=[],
        strategy_name="empty_strategy",
        symbol="XAUUSD",
        timeframe="H1",
    )
    assert autopsy["total_trades"] == 0
    assert "No trades executed" in autopsy["markdown_report"]


def test_harness_session_formatter_integration():
    from packages.agent.src.core.harness import _format_tool_output_for_session

    raw_output = {
        "success": True,
        "strategy_id": "gold_scalper",
        "symbol": "XAUUSD",
        "timeframe": "M15",
        "metrics": {"net_profit": 500.0, "profit_factor": 1.5, "win_rate": 0.6},
        "trades": [
            {"trade_id": "1", "side": "buy", "pnl": 200.0, "entry_time": "2025-01-01 10:00:00"},
            {"trade_id": "2", "side": "buy", "pnl": 300.0, "entry_time": "2025-01-01 11:00:00"},
        ],
    }

    formatted_str = _format_tool_output_for_session("run_strategy_tester", raw_output)
    formatted = json.loads(formatted_str)
    assert "forensic_autopsy" in formatted
    assert "gold_scalper" in formatted["forensic_autopsy"]
