import pytest
from fastapi.testclient import TestClient
from apps.api.src.main import app
from apps.api.src.db.repository import db_repo

client = TestClient(app)

def test_journal_crud_flow():
    # 1. Create a journal entry
    payload = {
        "title": "H-TEST: Asian Range Breakout on Gold",
        "symbol": "XAUUSD",
        "timeframe": "1h",
        "strategy_name": "RSI Volatility Breakout",
        "hypothesis": "Gold compresses in Asian session, leading to London expansion.",
        "setup_type": "Breakout",
        "setup_notes": "RSI 14 breakout of 70/30 bands.",
        "status": "TESTING",
        "tags": ["Gold", "Breakout", "London"],
        "session_id": "SES-TEST-GOLD-01"
    }

    create_res = client.post("/api/v1/journal", json=payload)
    assert create_res.status_code in [200, 201], create_res.text
    created = create_res.json()
    assert created["title"] == payload["title"]
    assert created["symbol"] == "XAUUSD"
    assert created["status"] == "TESTING"
    entry_id = created["id"]

    # 2. Retrieve entry by ID
    get_res = client.get(f"/api/v1/journal/{entry_id}")
    assert get_res.status_code == 200
    retrieved = get_res.json()
    assert retrieved["id"] == entry_id
    assert retrieved["session_id"] == "SES-TEST-GOLD-01"

    # 3. List entries (with filter)
    list_res = client.get("/api/v1/journal?symbol=XAUUSD")
    assert list_res.status_code == 200
    entries = list_res.json()
    assert any(e["id"] == entry_id for e in entries)

    # 4. Update entry status and empirical metrics
    update_payload = {
        "status": "CONFIRMED",
        "conclusion": "Sharpe reached 2.41 with 65% win rate over 120 trades.",
        "sharpe_recorded": 2.41,
        "win_rate_recorded": 65.0
    }
    put_res = client.put(f"/api/v1/journal/{entry_id}", json=update_payload)
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["status"] == "CONFIRMED"
    assert updated["sharpe_recorded"] == 2.41

    # 5. Delete entry
    del_res = client.delete(f"/api/v1/journal/{entry_id}")
    assert del_res.status_code == 200

    # 6. Verify deleted
    get_again = client.get(f"/api/v1/journal/{entry_id}")
    assert get_again.status_code == 404
