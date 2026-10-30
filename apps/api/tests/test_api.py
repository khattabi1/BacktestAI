import pytest
from fastapi.testclient import TestClient
from apps.api.src.main import app
from apps.api.src.db.jwt_auth import create_access_token

from backtest_si.strategy import BaseStrategy
from apps.api.src.services.strategy_registry import strategy_registry, StrategyMetadata


class MockTestStrategy(BaseStrategy):
    def on_bar(self, *args, **kwargs):
        return []


@pytest.fixture(autouse=True)
def setup_test_strategy():
    strategy_registry.register(
        "gold_sr_scalper",
        MockTestStrategy,
        StrategyMetadata(
            id="gold_sr_scalper",
            name="MockTestStrategy",
            description="Mock strategy for API test",
            category="test",
            parameters=[],
        ),
    )


@pytest.fixture
def client():
    token = create_access_token({
        "sub": "test_user_id",
        "email": "quant@backtestai.io",
        "role": "admin",
        "tier": "pro"
    })
    c = TestClient(app)
    c.headers.update({"Authorization": f"Bearer {token}"})
    return c

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] in ["backtest-ai-api", "backtest-si-api"]
    assert "timestamp" in data

def test_get_symbols(client):
    response = client.get("/api/v1/market-data/symbols")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    symbols = [item["symbol"] for item in data]
    assert "XAUUSD" in symbols

def test_get_bars(client):
    response = client.get("/api/v1/market-data/bars?symbol=XAUUSD&timeframe=1m&limit=50")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 50
    first_bar = data[0]
    assert "timestamp" in first_bar
    assert "open" in first_bar
    assert "high" in first_bar
    assert "low" in first_bar
    assert "close" in first_bar
    assert "volume" in first_bar

def test_get_strategies(client):
    response = client.get("/api/v1/strategies")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_get_strategy_detail(client):
    create_res = client.post("/api/v1/strategies", json={
        "name": "Integration Test Strategy",
        "description": "A test strategy",
        "code": "from backtest_si.strategy import BaseStrategy\nclass IntegrationTestStrategy(BaseStrategy):\n    def on_bar(self, bar, positions, equity): pass\n",
        "language": "python",
        "parameters": [{"name": "period", "type": "int", "default": 10}]
    })
    assert create_res.status_code == 201
    strat_id = create_res.json()["id"]
    detail_res = client.get(f"/api/v1/strategies/{strat_id}")
    assert detail_res.status_code == 200
    data = detail_res.json()
    assert data["id"] == strat_id
    assert len(data["parameters"]) > 0
    client.delete(f"/api/v1/strategies/{strat_id}")

def test_run_backtest_end_to_end(client):
    payload = {
        "symbol": "XAUUSD",
        "timeframe": "15m",
        "strategy_id": "gold_sr_scalper",
        "parameters": {
            "ema_period": 32,
            "risk_percent": 1.0,
            "atr_multiplier_sl": 1.5,
        },
        "config": {
            "initial_capital": 100000.0,
            "leverage": 1.0,
            "commission_pct": 0.0005,
            "slippage_points": 0.5
        }
    }
    response = client.post("/api/v1/backtests/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "COMPLETED"
    assert data["symbol"] == "XAUUSD"
    assert data["bars_processed"] >= 1000
    assert "metrics" in data
    assert "net_profit" in data["metrics"]
    assert "win_rate" in data["metrics"]
    assert "sharpe_ratio" in data["metrics"]
    assert isinstance(data["trades"], list)
    assert isinstance(data["equity_curve"], list)
    assert len(data["equity_curve"]) >= 1000
    
    run_id = data["id"]

    # Verify retrieval by ID
    get_res = client.get(f"/api/v1/backtests/{run_id}")
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["id"] == run_id

    # Verify list records
    list_res = client.get("/api/v1/backtests")
    assert list_res.status_code == 200
    records = list_res.json()
    assert any(r["id"] == run_id for r in records)

def test_run_backtest_invalid_symbol(client):
    payload = {
        "symbol": "NONEXISTENT",
        "timeframe": "15m",
        "strategy_id": "gold_sr_scalper"
    }
    response = client.post("/api/v1/backtests/run", json=payload)
    assert response.status_code == 400

def test_run_backtest_invalid_strategy(client):
    payload = {
        "symbol": "BTCUSDT",
        "timeframe": "1m",
        "strategy_id": "unknown_strategy"
    }
    response = client.post("/api/v1/backtests/run", json=payload)
    assert response.status_code in [400, 404]

def test_get_nonexistent_backtest(client):
    response = client.get("/api/v1/backtests/BT_NONEXISTENT")
    assert response.status_code == 404

