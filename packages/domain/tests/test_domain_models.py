from datetime import datetime, timezone
import pytest
from domain.models import (
    OrderType,
    OrderSide,
    PositionSide,
    BacktestStatus,
    BarModel,
    OrderModel,
    TradeModel,
    PositionModel,
    EquityPointModel,
    PerformanceMetricsModel,
    SimulationConfigModel,
    StrategyModel,
    BacktestRecordModel,
)

def test_bar_model_validation():
    now = datetime.now(timezone.utc)
    bar = BarModel(
        timestamp=now,
        open=1900.0,
        high=1910.0,
        low=1895.0,
        close=1905.0,
        volume=150.0,
        spread=1.5
    )
    assert bar.open == 1900.0
    assert bar.high == 1910.0
    assert bar.spread == 1.5
    data = bar.model_dump()
    assert data["close"] == 1905.0

def test_trade_model_pnl():
    now = datetime.now(timezone.utc)
    trade = TradeModel(
        trade_id="TR-001",
        symbol="XAUUSD",
        side=PositionSide.LONG,
        entry_time=now,
        exit_time=now,
        entry_price=1900.0,
        exit_price=1920.0,
        quantity=1.0,
        pnl=2000.0,
        pnl_percent=1.05,
        exit_reason="TP",
        tag="WonderEA"
    )
    assert trade.pnl == 2000.0
    assert trade.side == PositionSide.LONG

def test_simulation_config_defaults():
    cfg = SimulationConfigModel(initial_capital=50000.0)
    assert cfg.initial_capital == 50000.0
    assert cfg.leverage == 1.0
    assert cfg.use_mt5 is False
