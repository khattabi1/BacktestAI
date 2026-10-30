"""
Tests for Admin Telemetry, Strategy Audits & Reports Center Router.
100% PostgreSQL Unified Backend with MT5 execution telemetry.
"""

import pytest
from fastapi.testclient import TestClient
from apps.api.src.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_admin_get_real_users(client):
    response = client.get("/api/v1/admin/users")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    # Verify user object schema
    first_user = data[0]
    assert "id" in first_user
    assert "email" in first_user
    assert "full_name" in first_user
    assert "is_active" in first_user

def test_admin_get_stats(client):
    response = client.get("/api/v1/admin/stats")
    assert response.status_code == 200
    stats = response.json()
    assert "total_users" in stats
    assert "active_users" in stats
    assert "database_size_mb" in stats
    assert "total_strategies" in stats
    assert "total_backtest_runs" in stats
    assert "workers" in stats
    assert stats["total_users"] > 0
    assert "PostgreSQL" in stats["database_type"]

def test_admin_update_user_status(client):
    users_res = client.get("/api/v1/admin/users")
    users = users_res.json()
    target_user = users[0]
    user_id = target_user["id"]
    original_status = target_user["is_active"]

    # 1. Attempt status change WITHOUT admin password -> must be rejected (400)
    res_no_pw = client.post(f"/api/v1/admin/users/{user_id}/status", json={"is_active": False})
    assert res_no_pw.status_code == 400

    # 2. Attempt status change WITH invalid password -> must be rejected (401)
    res_bad_pw = client.post(f"/api/v1/admin/users/{user_id}/status", json={
        "is_active": False,
        "admin_password": "wrong_password_123"
    })
    assert res_bad_pw.status_code == 401

    # 3. Toggle with valid administrator password
    new_status = False if original_status == 1 else True
    res = client.post(f"/api/v1/admin/users/{user_id}/status", json={
        "is_active": new_status,
        "admin_password": "admin2026!"
    })
    assert res.status_code == 200
    assert res.json()["status"] == "success"

    # 4. Toggle back to restore original state
    res_restore = client.post(f"/api/v1/admin/users/{user_id}/status", json={
        "is_active": bool(original_status),
        "admin_password": "admin2026!"
    })
    assert res_restore.status_code == 200

def test_admin_update_user_role_and_tier(client):
    users_res = client.get("/api/v1/admin/users")
    users = users_res.json()
    target_user = users[0]
    user_id = target_user["id"]
    original_role = target_user["role"]
    original_tier = target_user["tier"]

    # 1. Attempt change without password -> must fail (400)
    fail_res = client.patch(
        f"/api/v1/admin/users/{user_id}",
        json={"role": "admin", "tier": "Enterprise"}
    )
    assert fail_res.status_code == 400

    # 2. Update role to 'admin' and tier to 'Enterprise' with valid admin password
    patch_res = client.patch(
        f"/api/v1/admin/users/{user_id}",
        json={"role": "admin", "tier": "Enterprise", "admin_password": "admin2026!"}
    )
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["role"] == "admin"
    assert data["tier"] == "Enterprise"

    # 3. Restore original role and tier with admin password
    restore_res = client.patch(
        f"/api/v1/admin/users/{user_id}",
        json={"role": original_role, "tier": original_tier, "admin_password": "admin2026!"}
    )
    assert restore_res.status_code == 200

def test_admin_live_runs_telemetry(client):
    res = client.get("/api/v1/admin/live-runs")
    assert res.status_code == 200
    data = res.json()
    assert "pool" in data
    assert "active_runs" in data
    assert "recent_runs" in data
    assert "workers" in data["pool"]
    assert len(data["pool"]["workers"]) == 5

def test_admin_get_strategies_and_runs(client):
    strat_res = client.get("/api/v1/admin/strategies")
    assert strat_res.status_code == 200
    strats = strat_res.json()
    assert isinstance(strats, list)

    runs_res = client.get("/api/v1/admin/runs")
    assert runs_res.status_code == 200
    runs = runs_res.json()
    assert isinstance(runs, list)

def test_admin_reports_lifecycle(client):
    # 1. Fetch initial reports
    res = client.get("/api/v1/admin/reports")
    assert res.status_code == 200
    initial_reports = res.json()
    assert isinstance(initial_reports, list)

    # 2. File a new incident report
    new_report_payload = {
        "title": "Automated Test Incident: MT5 compilation check",
        "category": "MT5 Strategy Tester",
        "severity": "Medium",
        "description": "Integration verification for bugs & reports center.",
        "error_trace": "Zero division error during tick replay simulation",
        "user_email": "khattabim116@gmail.com"
    }
    create_res = client.post("/api/v1/admin/reports", json=new_report_payload)
    assert create_res.status_code == 200
    created = create_res.json()
    assert created["status"] == "success"
    report_id = created["report_id"]

    # 3. Update report status to INVESTIGATING
    update_res = client.post(f"/api/v1/admin/reports/{report_id}/status", json={"status": "INVESTIGATING"})
    assert update_res.status_code == 200
    assert update_res.json()["new_status"] == "INVESTIGATING"

    # 4. Resolve report
    resolve_res = client.post(f"/api/v1/admin/reports/{report_id}/status", json={"status": "RESOLVED"})
    assert resolve_res.status_code == 200
    assert resolve_res.json()["new_status"] == "RESOLVED"

    # 5. Clean up test report from database to avoid leaving test artifacts
    from apps.api.src.db.connection import engine
    from sqlalchemy import text
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM audit_logs WHERE id = :id"), {"id": report_id})

def test_admin_users_tokens_used_field(client):
    res = client.get("/api/v1/admin/users")
    assert res.status_code == 200
    users = res.json()
    assert len(users) > 0
    for u in users:
        assert "tokens_used" in u
        assert isinstance(u["tokens_used"], int)
        assert u["tokens_used"] >= 0

def test_admin_users_analytics_timeframes(client):
    for tf in ["24h", "7d", "30d", "all"]:
        res = client.get(f"/api/v1/admin/users/analytics?timeframe={tf}")
        assert res.status_code == 200
        data = res.json()
        assert data["timeframe"] == tf
        assert "summary" in data
        summary = data["summary"]
        assert "daily_active_users" in summary
        assert "new_registered" in summary
        assert "account_upgrades" in summary
        assert "tokens_consumed" in summary
        assert "tier_breakdown" in summary
        assert isinstance(summary["tier_breakdown"], dict)
        assert "chart_data" in data
        assert isinstance(data["chart_data"], list)
        for bucket in data["chart_data"]:
            assert "date" in bucket
            assert "active_users" in bucket
            assert "new_users" in bucket
            assert "upgrades" in bucket
            assert "tokens" in bucket


