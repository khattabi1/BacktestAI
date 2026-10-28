import pytest
from datetime import datetime, timedelta
from backtest_si.types import Bar, SimulationConfig, PositionSide, OrderSide
from backtest_si.engine import BacktestEngine
from backtest_si.strategy import BaseStrategy

def generate_sample_bars(n: int = 50, start_price: float = 100.0, trend: float = 0.5):
    bars = []
    base_time = datetime(2026, 1, 1, 9, 30)
    current_price = start_price

    for i in range(n):
        open_p = current_price
        high_p = open_p + 1.0 + abs(trend)
        low_p = max(open_p - 0.8, 1.0)
        close_p = open_p + trend
        current_price = close_p
        
        bars.append(
            Bar(
                timestamp=base_time + timedelta(minutes=i),
                open=round(open_p, 2),
                high=round(high_p, 2),
                low=round(low_p, 2),
                close=round(close_p, 2),
                volume=100.0,
                symbol="TEST"
            )
        )
    return bars

class SimpleBuyAndHold(BaseStrategy):
    def on_bar(self, bar: Bar, positions: dict, equity: float):
        if "TEST" not in positions and len(self.orders_to_submit) == 0:
            self.buy_market(symbol="TEST", quantity=10.0)

class StopLossStrategy(BaseStrategy):
    def on_bar(self, bar: Bar, positions: dict, equity: float):
        if "TEST" not in positions and self.order_counter == 0:
            # Buy with tight SL at 95
            self.buy_market(symbol="TEST", quantity=10.0, stop_loss=95.0)

class TakeProfitStrategy(BaseStrategy):
    def on_bar(self, bar: Bar, positions: dict, equity: float):
        if "TEST" not in positions and self.order_counter == 0:
            # Buy with TP at 105
            self.buy_market(symbol="TEST", quantity=10.0, take_profit=105.0)

@pytest.mark.unit
def test_market_order_fill():
    config = SimulationConfig(initial_capital=10_000.0, commission_pct=0.001)
    engine = BacktestEngine(config)
    bars = generate_sample_bars(n=20, start_price=100.0, trend=1.0)
    
    result = engine.run(bars, SimpleBuyAndHold())
    
    assert len(result.trades) >= 1
    trade = result.trades[0]
    assert trade.symbol == "TEST"
    assert trade.side == PositionSide.LONG
    assert trade.quantity == 10.0
    assert trade.commission > 0
    assert result.metrics.total_trades >= 1
    assert result.metrics.ending_equity > config.initial_capital

@pytest.mark.unit
def test_stop_loss_trigger():
    config = SimulationConfig(initial_capital=10_000.0)
    engine = BacktestEngine(config)
    # Downward trending market to hit SL
    bars = generate_sample_bars(n=20, start_price=100.0, trend=-1.5)
    
    result = engine.run(bars, StopLossStrategy())
    
    sl_trades = [t for t in result.trades if t.exit_reason == "SL"]
    assert len(sl_trades) == 1
    assert sl_trades[0].pnl < 0

@pytest.mark.unit
def test_take_profit_trigger():
    config = SimulationConfig(initial_capital=10_000.0)
    engine = BacktestEngine(config)
    # Upward trending market to hit TP
    bars = generate_sample_bars(n=20, start_price=100.0, trend=2.0)
    
    result = engine.run(bars, TakeProfitStrategy())
    
    tp_trades = [t for t in result.trades if t.exit_reason == "TP"]
    assert len(tp_trades) == 1
    assert tp_trades[0].pnl > 0

@pytest.mark.invariant
def test_zero_lookahead_invariant():
    """
    Modifying future bars at t > T MUST produce identical trade executions for t <= T.
    """
    bars_normal = generate_sample_bars(n=30, start_price=100.0, trend=0.5)
    bars_mutated = list(bars_normal)
    
    # Mutate future bars from bar 15 onwards drastically
    for i in range(15, 30):
        old = bars_normal[i]
        bars_mutated[i] = Bar(
            timestamp=old.timestamp,
            open=old.open + 500.0,
            high=old.high + 1000.0,
            low=old.low,
            close=old.close + 800.0,
            volume=9999.0,
            symbol="TEST"
        )
        
    engine_1 = BacktestEngine(SimulationConfig(initial_capital=10_000.0))
    engine_2 = BacktestEngine(SimulationConfig(initial_capital=10_000.0))
    
    res_1 = engine_1.run(bars_normal[:15], SimpleBuyAndHold())
    res_2 = engine_2.run(bars_mutated[:15], SimpleBuyAndHold())
    
    # Decisions at t <= 15 must be 100% byte-for-byte identical
    assert len(res_1.trades) == len(res_2.trades)
    if res_1.trades:
        assert res_1.trades[0].entry_price == res_2.trades[0].entry_price
        assert res_1.trades[0].entry_time == res_2.trades[0].entry_time

@pytest.mark.unit
def test_metrics_calculation():
    from backtest_si.types import Trade, EquityPoint
    from backtest_si.metrics import calculate_metrics

    t1 = Trade("T1", "TEST", PositionSide.LONG, datetime(2026,1,1), datetime(2026,1,2), 100, 110, 10, 100.0, 10.0, 0, 0, "TP", 1)
    t2 = Trade("T2", "TEST", PositionSide.LONG, datetime(2026,1,3), datetime(2026,1,4), 100, 95, 10, -50.0, -5.0, 0, 0, "SL", 1)
    
    eq_pts = [
        EquityPoint(datetime(2026,1,1), 10000, 10000, 0, 0),
        EquityPoint(datetime(2026,1,2), 10100, 10100, 0, 0),
        EquityPoint(datetime(2026,1,4), 10050, 10050, 50, 0.495),
    ]
    cfg = SimulationConfig(initial_capital=10_000.0)
    metrics = calculate_metrics([t1, t2], eq_pts, cfg, total_bars=2)
    
    assert metrics.total_trades == 2
    assert metrics.winning_trades == 1
    assert metrics.losing_trades == 1
    assert metrics.win_rate == 50.0
    assert metrics.profit_factor == 2.0  # 100 gross win / 50 gross loss = 2.0
    assert metrics.net_profit == 50.0
    assert metrics.max_drawdown == 50.0

class ModifyPositionStrategy(BaseStrategy):
    def on_bar(self, bar: Bar, positions: dict, equity: float):
        if "TEST" not in positions and self.order_counter == 0:
            self.buy_market(symbol="TEST", quantity=10.0, stop_loss=90.0)
        elif "TEST" in positions:
            # Move stop loss up to break-even (100.0) on the next bar
            self.modify_position(symbol="TEST", stop_loss=100.0, tag="BE")

@pytest.mark.unit
def test_modify_position_trigger():
    config = SimulationConfig(initial_capital=10_000.0)
    engine = BacktestEngine(config)
    # Starts at 100, bar 1 goes up to 102, bar 2 drops to 99 (hits 100 SL)
    bars = [
        Bar(timestamp=datetime(2026, 1, 1, 9, 30), open=100.0, high=101.0, low=99.5, close=100.5, volume=100.0, symbol="TEST"),
        Bar(timestamp=datetime(2026, 1, 1, 9, 31), open=101.0, high=103.0, low=100.5, close=102.0, volume=100.0, symbol="TEST"),
        Bar(timestamp=datetime(2026, 1, 1, 9, 32), open=101.5, high=102.0, low=98.0, close=99.0, volume=100.0, symbol="TEST"),
    ]
    result = engine.run(bars, ModifyPositionStrategy())
    assert len(result.trades) == 1
    trade = result.trades[0]
    assert trade.exit_reason == "SL"
    # Should exit around 100 (the modified SL), not the original 90
    assert trade.exit_price >= 100.0

class ClosePositionStrategy(BaseStrategy):
    def on_bar(self, bar: Bar, positions: dict, equity: float):
        if "TEST" not in positions and self.order_counter == 0:
            self.buy_market(symbol="TEST", quantity=5.0)
        elif "TEST" in positions:
            self.close_position(symbol="TEST", tag="MANUAL_CLOSE")

@pytest.mark.unit
def test_close_position():
    config = SimulationConfig(initial_capital=10_000.0)
    engine = BacktestEngine(config)
    bars = [
        Bar(timestamp=datetime(2026, 1, 1, 9, 30), open=100.0, high=101.0, low=99.5, close=100.5, volume=100.0, symbol="TEST"),
        Bar(timestamp=datetime(2026, 1, 1, 9, 31), open=101.0, high=103.0, low=100.5, close=102.0, volume=100.0, symbol="TEST"),
        Bar(timestamp=datetime(2026, 1, 1, 9, 32), open=102.0, high=103.0, low=101.0, close=102.5, volume=100.0, symbol="TEST"),
    ]
    result = engine.run(bars, ClosePositionStrategy())
    assert len(result.trades) == 1
    trade = result.trades[0]
    assert trade.exit_reason == "MANUAL_CLOSE"
    assert len(engine.account.positions) == 0
