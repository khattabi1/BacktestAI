import pytest
from fastapi.testclient import TestClient
from apps.api.src.main import app
from apps.api.src.services.ai_copilot_service import ai_copilot_service

@pytest.fixture
def client():
    return TestClient(app)

def test_generate_trend_strategy_python(client):
    response = client.post(
        "/api/v1/strategies/ai/generate",
        json={"prompt": "Generate a Dual Moving Average Crossover with fast 20 and slow 60", "language": "python"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "python"
    assert "BaseStrategy" in data["code"]
    assert "fast_period: int = 20" in data["code"]
    assert "slow_period: int = 60" in data["code"]
    assert len(data["parameters"]) >= 3

def test_generate_rsi_strategy_mql5(client):
    response = client.post(
        "/api/v1/strategies/ai/generate",
        json={"prompt": "Generate an RSI Mean Reversion strategy with rsi 14 and atr 2.5", "language": "mql5"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "mql5"
    assert "InpRsiPeriod" in data["code"]
    assert "OnTick()" in data["code"]
    assert "iRSI" in data["code"]

def test_translate_python_to_mql5(client):
    py_code = """
class MyStrategy(BaseStrategy):
    def __init__(self, fast_period: int = 21, slow_period: int = 55, atr_multiplier: float = 2.5):
        pass
    """
    response = client.post(
        "/api/v1/strategies/ai/translate",
        json={"code": py_code, "source_language": "python", "target_language": "mql5"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["target_language"] == "mql5"
    assert "InpFastPeriod    = 21" in data["code"]
    assert "InpSlowPeriod    = 55" in data["code"]
    assert "InpAtrMultiplier = 2.5" in data["code"]
    assert "OnInit()" in data["code"]
    assert "OnTick()" in data["code"]

def test_translate_mql5_to_python(client):
    mql5_code = """
input int InpFastPeriod = 15;
input int InpSlowPeriod = 45;
input double InpAtrMultiplier = 3.0;
    """
    response = client.post(
        "/api/v1/strategies/ai/translate",
        json={"code": mql5_code, "source_language": "mql5", "target_language": "python"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["target_language"] == "python"
    assert "fast_period: int = 15" in data["code"]
    assert "slow_period: int = 45" in data["code"]
    assert "atr_multiplier: float = 3.0" in data["code"]
    assert "BaseStrategy" in data["code"]

def test_auto_fix_syntax(client):
    broken_code = """
def on_bar(self, bar, indicators)
    if bar.close > 100
        return orders
    """
    response = client.post(
        "/api/v1/strategies/ai/fix",
        json={"code": broken_code, "language": "python", "errors": ["Missing colon"]}
    )
    assert response.status_code == 200
    data = response.json()
    assert "def on_bar(self, bar, indicators):" in data["code"]
    assert "if bar.close > 100:" in data["code"]
