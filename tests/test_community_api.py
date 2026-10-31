"""
Comprehensive Test Suite for Social Quant Community & Strategy Distribution Engine.
Tests feed retrieval, 5Y cloud benchmark, AI Anti-Cheat detector, star ratings,
forking, zero-leak cloud sandbox, and direct messaging.
"""

import uuid
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from apps.api.src.main import app

client = TestClient(app)


def _delete_benchmark_cache(strategy_name: str) -> None:
    from sqlalchemy import delete
    from apps.api.src.db.connection import SessionLocal
    from apps.api.src.db.models import CommunityBenchmarkCache
    with SessionLocal() as db:
        db.execute(delete(CommunityBenchmarkCache).where(CommunityBenchmarkCache.strategy_name == strategy_name))
        db.commit()


def test_get_community_posts():
    """Verify community feed returns institutional seed posts."""
    response = client.get("/api/v1/community/posts")
    assert response.status_code == 200
    data = response.json()
    assert "posts" in data
    assert data["count"] >= 3
    
    first_post = data["posts"][0]
    assert "author" in first_post
    assert "content" in first_post
    assert "likesCount" in first_post


def test_verify_5y_benchmark_clean_code():
    """Verify clean algorithmic code passes 5-year verification with valid metrics."""
    clean_code = """
    //+------------------------------------------------------------------+
    //| Clean Trend Strategy                                            |
    //+------------------------------------------------------------------+
    input double InpRisk = 1.0;
    input int    InpPeriod = 20;

    void OnTick() {
        if (Hour() >= 8 && Hour() <= 17) {
            // Causal indicator execution
            double ma = iMA(_Symbol, _Period, InpPeriod, 0, MODE_SMA, PRICE_CLOSE, 0);
            if (Close[0] > ma) OpenBuy();
        }
    }
    """
    fake_result = SimpleNamespace(metrics=SimpleNamespace(
        net_profit=4200.0, max_drawdown_pct=7.3, win_rate=0.58,
        profit_factor=1.6, total_trades=310, sharpe_ratio=1.2,
    ))
    payload = {
        # unique name so the benchmark cache never short-circuits this test
        "strategy_name": f"clean_trend_{uuid.uuid4().hex[:8]}",
        "version_num": 1,
        "code": clean_code,
        "symbols": ["XAUUSD"],
        "initial_metrics": {"netProfit": 4000, "winRate": 0.60, "maxDrawdown": 5.5}
    }
    with patch("apps.api.src.routers.community.get_backtest_service") as svc:
        svc.return_value.run_backtest.return_value = fake_result
        response = client.post("/api/v1/community/verify-5y", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "VERIFIED"
    assert data["metrics"]["totalTrades"] == 310  # metrics come from the backtest, not constants
    _delete_benchmark_cache(payload["strategy_name"])
    assert data["security_passed"] is True
    assert data["cheat_signals_detected"] == 0
    assert "metrics" in data
    assert data["metrics"]["netProfit"] > 0
    assert data["metrics"]["winRate"] >= 50.0


def test_verify_5y_benchmark_anti_cheat_rejection():
    """Verify fraudulent code with hardcoded past trades is rejected by AI Anti-Cheat."""
    scam_code = """
    void OnTick() {
        // Scam strategy hardcoding historical winning trade times
        if (TimeCurrent() == D'2022.03.15 10:00:00') OrderSend(_Symbol, OP_BUY, 1.0, Ask, 3, 0, 0);
        if (TimeCurrent() == D'2023.08.10 14:00:00') OrderSend(_Symbol, OP_SELL, 1.0, Bid, 3, 0, 0);
        if (TimeCurrent() == D'2024.01.20 09:30:00') OrderSend(_Symbol, OP_BUY, 1.0, Ask, 3, 0, 0);
    }
    """
    payload = {
        "strategy_name": "fake_holy_grail",
        "version_num": 1,
        "code": scam_code,
        "symbols": ["XAUUSD"]
    }
    response = client.post("/api/v1/community/verify-5y", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "REJECTED"
    assert data["security_passed"] is False
    assert data["cheat_signals_detected"] >= 2
    assert "SECURITY ALERT" in data["ai_report"]


def test_create_community_post_and_social_interactions():
    """Verify creating a post, liking, commenting, rating, and forking."""
    # 1. Create a post
    post_payload = {
        "author_username": "TestQuant",
        "author_display_name": "Test Quant Analyst",
        "content": "Analyzing London session liquidity sweeps on GBPUSD. New strategy published!",
        "strategy": {
            "name": "gbp_sweep_algo",
            "version": "v1",
            "type": "open_source",
            "price": 0,
            "category": "Scalping / SMC",
            "supportedSymbols": ["GBPUSD"],
            "metrics": {
                "netProfit": 14200,
                "maxDrawdown": 6.2,
                "winRate": 61.5,
                "profitFactor": 2.05,
                "totalTrades": 380,
                "sharpeRatio": 1.78,
                "period": "2021-01-01 → 2026-01-01 (5 Years)",
                "verifiedAt": "2026-10-15T20:00:00Z"
            },
            "codeSnippet": "// GBP Sweep Algo\ninput double Risk = 1.0;"
        }
    }
    create_res = client.post("/api/v1/community/posts", json=post_payload)
    assert create_res.status_code == 200
    post_id = create_res.json()["post_id"]

    # 2. Toggle like
    like_res = client.post(f"/api/v1/community/posts/{post_id}/like", json={"username": "TestQuant"})
    assert like_res.status_code == 200
    assert like_res.json()["isLiked"] is True

    # 3. Add comment
    comment_payload = {
        "author_username": "ReviewerQuant",
        "author_display_name": "Reviewer Quant",
        "content": "Great metrics! What is the average holding time?"
    }
    comment_res = client.post(f"/api/v1/community/posts/{post_id}/comments", json=comment_payload)
    assert comment_res.status_code == 200
    assert comment_res.json()["commentsCount"] >= 1

    # 4. Rate strategy
    rate_res = client.post("/api/v1/community/strategies/strat_1/star", json={"username": "TestQuant", "rating": 5})
    assert rate_res.status_code == 200
    assert rate_res.json()["userRating"] == 5

    # 5. Fork strategy
    fork_res = client.post("/api/v1/community/strategies/strat_1/fork")
    assert fork_res.status_code == 200
    assert fork_res.json()["forksCount"] >= 1


def test_pro_ea_cloud_sandbox_preview():
    """Verify zero-leak cloud sandbox preview returns executive scorecard."""
    payload = {
        "strategy_id": "strat_2",
        "symbol": "EURUSD",
        "timeframe": "M15",
        "start_date": "2024-01-01",
        "end_date": "2024-12-31",
        "initial_balance": 10000.0
    }
    response = client.post("/api/v1/community/sandbox-preview", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "netProfit" in data
    assert "winRate" in data
    assert "maxDrawdown" in data
    assert data["testedSymbol"] == "EURUSD"


def test_direct_messaging():
    """Verify sending and retrieving peer-to-peer direct messages."""
    send_payload = {
        "sender_username": "UserAlpha",
        "receiver_username": "UserBeta",
        "content": "Hello Beta, did you review the London breakout model?"
    }
    send_res = client.post("/api/v1/community/messages", json=send_payload)
    assert send_res.status_code == 200
    assert send_res.json()["success"] is True

    get_res = client.get("/api/v1/community/messages?user1=UserAlpha&user2=UserBeta")
    assert get_res.status_code == 200
    messages = get_res.json()["messages"]
    assert len(messages) >= 1
    assert any(m["content"] == send_payload["content"] for m in messages)


def test_verify_5y_failed_backtest_is_never_verified():
    """If the real backtest cannot run, the endpoint must return FAILED with no metrics."""
    payload = {
        "strategy_name": f"broken_strategy_{uuid.uuid4().hex[:8]}",
        "version_num": 1,
        "code": "input int InpPeriod = 20; void OnTick() {}",
        "symbols": ["XAUUSD"],
    }
    with patch("apps.api.src.routers.community.get_backtest_service") as svc:
        svc.return_value.run_backtest.side_effect = RuntimeError("MT5 worker unavailable")
        response = client.post("/api/v1/community/verify-5y", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "FAILED"
    assert data["metrics"] == {}
    assert "MT5 worker unavailable" in data["ai_report"]
