"""
End-to-end wiring test for the Backtest Studio AI suite against the configured database:
trade-card ingest -> DB row + card JSON -> Chart Vision (background) -> diagnose uses the
stored card -> session delete cascades trades and screenshots.
"""

import base64
import json
import os
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from apps.api.src.main import app
from apps.api.src.db.repository import db_repo
from packages.agent.src.core.types import ModelChunk
from packages.domain.domain.trade_card import TradeCard

SESSION_ID = "SES-TEST-WIRING-01"

# 1x1 transparent WebP
TINY_WEBP = base64.b64encode(
    bytes.fromhex("524946461a000000574542505650384c0d0000002f0000001007101111888808")
).decode()


@pytest.fixture
def client() -> TestClient:
    os.environ["TESTING"] = "1"
    db_repo.delete_replay_session(SESSION_ID)
    yield TestClient(app)
    db_repo.delete_replay_session(SESSION_ID)


def _vision_reply(*_args, **_kwargs):
    async def gen():
        yield ModelChunk(content_delta=json.dumps({
            "setup_archetype": "LIQUIDITY_SWEEP",
            "wick_rejection": "BULLISH_WICK",
            "sl_placement_quality": "STRUCTURAL_SWING",
            "chart_summary": "Sweep of Asian low then reclaim.",
        }))
        yield ModelChunk(is_finished=True)
    return gen()


def test_trade_card_is_persisted_tagged_used_and_deleted(client):
    trade = {
        "trade_id": "TRD-WIRE-1",
        "symbol": "XAUUSD",
        "timeframe": "15m",
        "direction": "BUY",
        "entry_price": 2650.0,
        "exit_price": 2660.0,
        "stop_loss": 2645.0,
        "take_profit": 2665.0,
        "lot_size": 0.5,
        "pnl": 500.0,
        "entry_time": "2025-03-04T10:00:00Z",
        "exit_time": "2025-03-04T11:00:00Z",
        "canvas_snapshot_base64": f"data:image/webp;base64,{TINY_WEBP}",
    }

    with patch(
        "apps.api.src.services.chart_vision_service.MetaModelAdapter.generate_turn",
        side_effect=_vision_reply,
    ):
        res = client.post("/api/v1/ai-watcher/trade-card", json={"session_id": SESSION_ID, "trade": trade})
    assert res.status_code == 200
    body = res.json()
    assert body["pnl_r_multiple"] == 2.0  # (2660 - 2650) / (2650 - 2645)
    assert body["vision"] == "queued"

    # Row exists in the database with the vision-tagged card (background task ran)
    rows = db_repo.get_session_trades(SESSION_ID)
    assert len(rows) == 1
    card = json.loads(rows[0]["trade_card_json"])
    assert card["status"] == "PROCESSED"
    assert card["visual_context"]["setup_archetype"] == "LIQUIDITY_SWEEP"
    assert card["canvas_snapshot_base64"] is None
    # screenshot_path is the public URL (/uploads/...); the file lives under data/uploads/
    disk_path = Path("data") / rows[0]["screenshot_path"].lstrip("/")
    assert disk_path.is_file()

    # Diagnose receives a bare card from the browser but must use the stored, tagged one
    from apps.api.src.services.ai_watcher_service import ai_watcher_service
    ai_watcher_service.clear_session(SESSION_ID)  # force the database path, as after a restart
    bare = {k: trade[k] for k in ("trade_id", "symbol", "direction", "entry_price", "exit_price", "stop_loss", "take_profit", "pnl")}
    enriched = ai_watcher_service.enrich_trades(SESSION_ID, [TradeCard(**bare)])
    assert enriched[0].visual_context.setup_archetype == "LIQUIDITY_SWEEP"
    assert enriched[0].pnl_r_multiple == 2.0

    # Delete cascades
    res = client.delete(f"/api/v1/ai-watcher/sessions/{SESSION_ID}")
    assert res.status_code == 200
    assert db_repo.get_session_trades(SESSION_ID) == []
    assert not disk_path.exists()
