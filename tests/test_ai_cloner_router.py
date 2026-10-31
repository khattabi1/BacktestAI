"""
Unit and Integration Tests for AI Strategy Cloner Router.
Endpoint: POST /api/v1/ai-cloner/clone
Verifies:
1. Statistical sufficiency evaluation (checks sample size, win rate consistency, variance).
2. Handling of insufficient data gracefully (advisory to execute more trades rather than arbitrary hallucination).
3. Reverse-engineering discretionary trades into a formal QuantStrategyBlueprint with MQL5 parameters.
4. Structuring of the ClonedStrategyBridgePayload ready to redirect into Quant AI Lab.
"""

import pytest
import os
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from apps.api.src.main import app
from packages.domain.domain.trade_card import (
    TradeCard,
    TradeStatus,
    MathContext,
    VisualContext,
)
from packages.agent.src.core.types import ModelChunk


@pytest.fixture
def test_client() -> TestClient:
    os.environ["TESTING"] = "1"
    return TestClient(app)


@pytest.fixture
def sample_cloner_trades():
    trades = []
    # 10 consistent winning/disciplined trades on Gold London Breakout
    for i in range(1, 11):
        is_win = i not in (3, 7)
        trades.append({
            "trade_id": f"trd_clone_{i:02d}",
            "sequence_number": i,
            "status": "PROCESSED",
            "symbol": "XAUUSD",
            "direction": "BUY",
            "session": "London",
            "entry_price": 2750.0 + i,
            "exit_price": 2760.0 + i if is_win else 2746.0 + i,
            "stop_loss": 2745.0 + i,
            "take_profit": 2765.0 + i,
            "lot_size": 1.0,
            "pnl": 1000.0 if is_win else -500.0,
            "pnl_r_multiple": 2.0 if is_win else -1.0,
            "math_context": {
                "price_vs_ema50": "ABOVE",
                "price_vs_ema200": "ABOVE",
                "distance_to_sl_pips": 50.0,
                "rr_ratio": 3.0,
                "atr_regime": "NORMAL",
            },
            "visual_context": {
                "setup_archetype": "IMPULSE_BREAKOUT",
                "sl_placement_quality": "STRUCTURAL_SWING",
                "chart_summary": f"Trade {i}: London impulse breakout retest",
            },
        })
    return trades


def test_ai_cloner_insufficient_sample(test_client: TestClient):
    # Test with only 2 trades -> Statistical insufficiency
    response = test_client.post(
        "/api/v1/ai-cloner/clone",
        json={
            "session_id": "sess_small_sample",
            "symbol": "XAUUSD",
            "timeframe": "15m",
            "trades": [
                {
                    "trade_id": "t1",
                    "sequence_number": 1,
                    "status": "PROCESSED",
                    "symbol": "XAUUSD",
                    "direction": "BUY",
                    "entry_price": 2750.0,
                    "exit_price": 2760.0,
                    "pnl_r_multiple": 2.0,
                },
                {
                    "trade_id": "t2",
                    "sequence_number": 2,
                    "status": "PROCESSED",
                    "symbol": "XAUUSD",
                    "direction": "SELL",
                    "entry_price": 2755.0,
                    "exit_price": 2750.0,
                    "pnl_r_multiple": 1.0,
                },
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["sufficiency_status"] == "INSUFFICIENT"
    assert "Data variance too high" in data["sufficiency_message"] or "Execute" in data["sufficiency_message"]
    assert data["sample_size"] == 2
    assert "suggested_additional_trades" in data


def test_ai_cloner_endpoint_mocked_model(test_client: TestClient, sample_cloner_trades):
    mock_cloner_json = (
        '{\n'
        '  "strategy_name": "GoldLondonMomentumBreakout",\n'
        '  "strategy_archetype": "Momentum Breakout & EMA Trend Alignment",\n'
        '  "confidence_score": 0.88,\n'
        '  "entry_rules": [\n'
        '    "Price closes above EMA 50 during London trading session (08:00 - 11:30 UTC)",\n'
        '    "Breakout candle exceeds previous 5-bar high with above-average volume"\n'
        '  ],\n'
        '  "exit_rules": [\n'
        '    "Stop loss anchored at 1.5x ATR below entry structural swing",\n'
        '    "Take profit fixed at 2.0R target multiplier"\n'
        '  ],\n'
        '  "mql5_parameters": {\n'
        '    "InpEmaPeriod": 50,\n'
        '    "InpAtrMultiplier": 1.5,\n'
        '    "InpTakeProfitR": 2.0,\n'
        '    "InpMaxRiskPercent": 1.0,\n'
        '    "InpStartHour": 8,\n'
        '    "InpEndHour": 11\n'
        '  },\n'
        '  "quant_prompt_seed": "Build a native MQL5 Expert Advisor named GoldLondonMomentumBreakout..."\n'
        '}'
    )

    async def mock_generate_turn(messages, tools):
        yield ModelChunk(thought_delta="Reverse-engineering 10 manual replay trades into MQL5 blueprint...")
        yield ModelChunk(content_delta=mock_cloner_json)
        yield ModelChunk(is_finished=True)

    with patch("apps.api.src.routers.ai_cloner.MetaModelAdapter.generate_turn", side_effect=mock_generate_turn):
        response = test_client.post(
            "/api/v1/ai-cloner/clone",
            json={
                "session_id": "sess_cloner_01",
                "symbol": "XAUUSD",
                "timeframe": "15m",
                "trades": sample_cloner_trades,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "sess_cloner_01"
        assert data["sufficiency_status"] in ("SUFFICIENT", "OPTIMAL")
        assert data["strategy_name"] == "GoldLondonMomentumBreakout"
        assert data["confidence_score"] >= 0.8
        assert len(data["blueprint"]["entry_rules"]) >= 1
        assert len(data["blueprint"]["exit_rules"]) >= 1
        assert "InpEmaPeriod" in data["blueprint"]["mql5_parameters"]
        assert "GoldLondonMomentumBreakout.mq5" in data["suggested_filename"]
        assert "muse-spark-1.3" in data["model_used"]


def test_ai_cloner_endpoint_fallback_resilience(test_client: TestClient, sample_cloner_trades):
    async def mock_generate_turn_fail(messages, tools):
        yield ModelChunk(content_delta="\n[Meta API Offline]", is_finished=True)

    with patch("apps.api.src.routers.ai_cloner.MetaModelAdapter.generate_turn", side_effect=mock_generate_turn_fail):
        response = test_client.post(
            "/api/v1/ai-cloner/clone",
            json={
                "session_id": "sess_cloner_fallback",
                "symbol": "XAUUSD",
                "timeframe": "15m",
                "trades": sample_cloner_trades,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "sess_cloner_fallback"
        assert data["sufficiency_status"] in ("SUFFICIENT", "OPTIMAL")
        assert len(data["blueprint"]["entry_rules"]) > 0
        assert "Inp" in str(data["blueprint"]["mql5_parameters"])
        assert data["suggested_filename"].endswith(".mq5")

