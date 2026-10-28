from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from typing import Optional, Dict, Any, List

class OrderType(str, Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    STOP = "STOP"

class OrderSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"

class PositionSide(str, Enum):
    LONG = "LONG"
    SHORT = "SHORT"

@dataclass(frozen=True)
class Bar:
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    spread: float = 0.0
    symbol: str = "DEFAULT"

@dataclass
class Order:
    order_id: str
    symbol: str
    side: OrderSide
    order_type: OrderType
    quantity: float
    price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    created_at: Optional[datetime] = None
    tag: str = ""
    is_close: bool = False

@dataclass
class Position:
    symbol: str
    side: PositionSide
    entry_price: float
    quantity: float
    entry_time: datetime
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    current_price: float = field(default=0.0)

    def calculate_unrealized_pnl(self, current_price: float) -> float:
        self.current_price = current_price
        if self.side == PositionSide.LONG:
            return (current_price - self.entry_price) * self.quantity
        else:
            return (self.entry_price - current_price) * self.quantity

@dataclass
class Trade:
    trade_id: str
    symbol: str
    side: PositionSide
    entry_time: datetime
    exit_time: datetime
    entry_price: float
    exit_price: float
    quantity: float
    pnl: float
    pnl_percent: float
    commission: float
    slippage: float
    exit_reason: str  # "TP", "SL", "SIGNAL", "CLOSE_END"
    holding_period_bars: int = 0
    tag: str = ""

@dataclass
class EquityPoint:
    timestamp: datetime
    balance: float
    equity: float
    drawdown: float
    drawdown_pct: float

@dataclass
class PerformanceMetrics:
    initial_capital: float
    ending_equity: float
    net_profit: float
    net_profit_pct: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    profit_factor: float
    expectancy: float
    average_trade: float
    average_win: float
    average_loss: float
    payoff_ratio: float
    max_drawdown: float
    max_drawdown_pct: float
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    max_consecutive_wins: int
    max_consecutive_losses: int
    exposure_pct: float

@dataclass
class SimulationConfig:
    initial_capital: float = 100_000.0
    leverage: float = 1.0
    commission_per_order: float = 0.0
    commission_pct: float = 0.0005  # 0.05%
    slippage_points: float = 0.0
    spread_points: float = 0.0
    point_value: float = 1.0
    risk_free_rate: float = 0.02
    annualization_factor: int = 252  # daily bars = 252, hourly = 252*7, min = 252*7*60
