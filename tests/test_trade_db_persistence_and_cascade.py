"""
Test Suite for Trade DB Persistence, File-on-Disk Storage, and Session Cascade Deletion.
Verifies that:
1. Chart screenshots are written as actual .webp files under data/uploads/screenshots/{session_id}/{trade_id}.webp.
2. The database stores the clean relative file path `screenshot_path` and `trade_card_json`.
3. Deleting a replay session cascades and completely purges:
   - All trade rows from database.
   - The screenshot directory from disk.
   - All in-memory AI Watcher cache entries.
"""

import base64
import uuid
from pathlib import Path
import pytest
from apps.api.src.db.init_db import init_database
from apps.api.src.db.repository import DatabaseRepository
from apps.api.src.services.ai_watcher_service import ai_watcher_service
from apps.api.src.services.screenshot_storage import BASE_UPLOAD_DIR
from packages.domain.domain.trade_card import TradeCard, TradeStatus


def test_trade_db_persistence_and_cascade_deletion(tmp_path):
    # Use isolated test database
    db_file = tmp_path / "test_trades_cascade.db"
    init_database(db_file)
    repo = DatabaseRepository(db_path=str(db_file))

    session_id = f"SES-{uuid.uuid4().hex[:8]}"
    trade_id = "TRD-101"

    # 1. Create a replay session
    repo.save_replay_session(
        session_id=session_id,
        user_id=None,
        name="Gold Scalp Replay",
        symbol="XAUUSD",
        timeframe="15m",
        initial_capital=10000.0,
    )

    # 2. Add in-memory TradeCard to AI Watcher cache
    card = TradeCard(
        trade_id=trade_id,
        sequence_number=1,
        status=TradeStatus.PROCESSED,
        symbol="XAUUSD",
        direction="BUY",
        entry_price=2750.0,
        exit_price=2765.0,
        pnl=1500.0,
    )
    ai_watcher_service.save_to_session_cache(session_id, [card])
    assert ai_watcher_service.get_cached_trade(session_id, trade_id) is not None

    # 3. Create dummy WebP image base64
    fake_webp_bytes = b"RIFF\x1a\x00\x00\x00WEBPVP8 \x0e\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
    fake_base64 = f"data:image/webp;base64,{base64.b64encode(fake_webp_bytes).decode()}"

    # 4. Save trade with base64 canvas snapshot to DB
    trade_record = {
        "id": "trd_uuid_001",
        "trade_id": trade_id,
        "symbol": "XAUUSD",
        "direction": "BUY",
        "entry_price": 2750.0,
        "exit_price": 2765.0,
        "quantity": 1.0,
        "pnl": 1500.0,
        "stop_loss": 2740.0,
        "take_profit": 2770.0,
        "exit_reason": "TP",
        "screenshot_base64": fake_base64,
        "trade_card_json": '{"setup_archetype": "IMPULSE_BREAKOUT", "sl_quality": "STRUCTURAL_SWING"}',
    }

    saved = repo.save_session_trade(session_id, trade_record)
    assert saved["id"] == "trd_uuid_001"
    assert saved["session_id"] == session_id

    # Verify screenshot was saved as a file on disk
    expected_path = f"/uploads/screenshots/{session_id}/{trade_id}.webp"
    assert saved["screenshot_path"] == expected_path
    disk_file = BASE_UPLOAD_DIR / session_id / f"{trade_id}.webp"
    assert disk_file.exists(), f"Expected file {disk_file} to exist on disk"
    assert disk_file.read_bytes() == fake_webp_bytes

    # 5. Verify trade retrieval from DB
    session_trades = repo.get_session_trades(session_id)
    assert len(session_trades) == 1
    assert session_trades[0]["trade_id"] == trade_id
    assert session_trades[0]["screenshot_path"] == expected_path

    # 6. Delete session and verify CASCADE deletion across DB, disk, and RAM
    deleted = repo.delete_replay_session(session_id)
    assert deleted is True

    # DB cascade verification
    assert repo.get_replay_session(session_id) is None
    assert len(repo.get_session_trades(session_id)) == 0

    # Disk cleanup cascade verification
    session_folder = BASE_UPLOAD_DIR / session_id
    assert not session_folder.exists(), "Session screenshot directory must be completely purged from disk"

    # In-memory RAM cleanup verification
    assert ai_watcher_service.get_cached_trade(session_id, trade_id) is None
