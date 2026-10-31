"""
Unit and Integration Tests for AI Watcher & Behavioral Coach Router.
Endpoint: POST /api/v1/ai-watcher/diagnose
Verifies:
1. Ingesting session trades + cached TradeCards.
2. Generating 3-part diagnostic:
   - What to Respect (strengths & disciplined rules)
   - What to Remove (toxic biases, revenge trading, FOMO)
   - What to Adjust (SL placement, risk sizing)
3. Integration with Meta Muse Spark 1.3 Contributor model.
4. Robust local fallback if Meta API is unreachable.
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
def sample_session_trades():
    return [
        {
            "trade_id": "trd_01",
            "sequence_number": 1,
            "status": "PROCESSED",
            "symbol": "XAUUSD",
            "direction": "BUY",
            "session": "London",
            "entry_price": 2750.0,
            "exit_price": 2760.0,
            "stop_loss": 2745.0,
            "take_profit": 2765.0,
            "lot_size": 1.0,
            "pnl": 1000.0,
            "pnl_r_multiple": 2.0,
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
                "chart_summary": "Clean trend breakout above Asian high",
            },
        },
        {
            "trade_id": "trd_02",
            "sequence_number": 2,
            "status": "PROCESSED",
            "symbol": "XAUUSD",
            "direction": "SELL",
            "session": "London",
            "entry_price": 2758.0,
            "exit_price": 2763.0,
            "stop_loss": 2760.0,
            "take_profit": 2750.0,
            "lot_size": 2.0,  # Sudden doubled lot size (Overleveraging)
            "pnl": -1000.0,
            "pnl_r_multiple": -1.0,
            "math_context": {
                "price_vs_ema50": "ABOVE",
                "price_vs_ema200": "ABOVE",
                "distance_to_sl_pips": 20.0,
                "rr_ratio": 4.0,
                "atr_regime": "HIGH_VOLATILITY",
            },
            "visual_context": {
                "setup_archetype": "PRICE_ACTION",
                "sl_placement_quality": "TIGHT_INSIDE_NOISE",
                "chart_summary": "Counter-trend short into strong momentum with tight SL",
            },
        },
    ]


def test_ai_watcher_diagnose_endpoint_mocked_model(test_client: TestClient, sample_session_trades):
    mock_coach_json = (
        '{\n'
        '  "what_to_respect": [\n'
        '    {"title": "Breakout discipline in London", "detail": "Trade #1 waited for the structure break and yielded +2.0R."}\n'
        '  ],\n'
        '  "what_to_remove": [\n'
        '    {"title": "Revenge overleveraging", "detail": "Trade #2 doubled lot size from 1.0 to 2.0 lots after a pullback."}\n'
        '  ],\n'
        '  "what_to_adjust": [\n'
        '    {"title": "Stop loss inside market noise", "detail": "Trade #2 placed stop loss at only 20 pips inside high volatility."}\n'
        '  ],\n'
        '  "overall_coach_summary": "Strong edge on London trend breakouts. Eliminate counter-trend revenge sizing to achieve profitability."\n'
        '}'
    )

    async def mock_generate_turn(messages, tools):
        yield ModelChunk(thought_delta="Analyzing trade sequencing, lot deviations, and SL noise...")
        yield ModelChunk(content_delta=mock_coach_json)
        yield ModelChunk(is_finished=True)

    with patch("apps.api.src.routers.ai_watcher.MetaModelAdapter.generate_turn", side_effect=mock_generate_turn):
        response = test_client.post(
            "/api/v1/ai-watcher/diagnose",
            json={
                "session_id": "sess_test_watcher_01",
                "trades": sample_session_trades,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "sess_test_watcher_01"
        assert data["total_trades_analyzed"] == 2
        assert len(data["what_to_respect"]) >= 1
        assert len(data["what_to_remove"]) >= 1
        assert len(data["what_to_adjust"]) >= 1
        assert "Breakout discipline" in data["what_to_respect"][0]["title"]
        assert "Revenge overleveraging" in data["what_to_remove"][0]["title"]
        assert "Stop loss inside market noise" in data["what_to_adjust"][0]["title"]
        assert "muse-spark-1.3" in data["model_used"]


def test_ai_watcher_diagnose_endpoint_fallback_resilience(test_client: TestClient, sample_session_trades):
    async def mock_generate_turn_fail(messages, tools):
        yield ModelChunk(content_delta="\n[Meta API Offline]", is_finished=True)

    with patch("apps.api.src.routers.ai_watcher.MetaModelAdapter.generate_turn", side_effect=mock_generate_turn_fail):
        response = test_client.post(
            "/api/v1/ai-watcher/diagnose",
            json={
                "session_id": "sess_test_fallback",
                "trades": sample_session_trades,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "sess_test_fallback"
        assert len(data["what_to_respect"]) > 0
        assert len(data["what_to_remove"]) > 0
        assert len(data["what_to_adjust"]) > 0
        assert "Fallback" in data["model_used"] or "muse" in data["model_used"]



def test_save_trade_card_writes_screenshot_to_disk(test_client):
    """Verifies POST /api/v1/ai-watcher/trade-card writes .webp file to disk."""
    import base64
    from pathlib import Path
    from apps.api.src.services.screenshot_storage import BASE_UPLOAD_DIR

    sess_id = "test_sess_live_upload"
    trd_id = "TRD-LIVE-999"

    fake_webp_bytes = b"RIFF\x1a\x00\x00\x00WEBPVP8 \x0e\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
    fake_b64 = f"data:image/webp;base64,{base64.b64encode(fake_webp_bytes).decode()}"

    resp = test_client.post(
        "/api/v1/ai-watcher/trade-card",
        json={
            "session_id": sess_id,
            "trade": {
                "id": trd_id,
                "trade_id": trd_id,
                "symbol": "XAUUSD",
                "direction": "BUY",
                "entry_price": 2750.0,
                "exit_price": 2765.0,
                "stop_loss": 2740.0,
                "take_profit": 2770.0,
                "quantity": 1.0,
                "pnl": 1500.0,
                "canvas_snapshot_base64": fake_b64,
            },
        },
    )

    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["status"] == "success"
    assert res_data["screenshot_path"] == f"/uploads/screenshots/{sess_id}/{trd_id}.webp"

    # Verify file actually created on disk
    expected_file = BASE_UPLOAD_DIR / sess_id / f"{trd_id}.webp"
    assert expected_file.exists()
    assert expected_file.read_bytes() == fake_webp_bytes

    # Cleanup
    from apps.api.src.services.screenshot_storage import delete_session_screenshots
    delete_session_screenshots(sess_id)
    assert not (BASE_UPLOAD_DIR / sess_id).exists()
