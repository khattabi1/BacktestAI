from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Union
from datetime import datetime
from enum import Enum

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

class BacktestStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class BarModel(BaseModel):
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    spread: float = 0.0

class OrderModel(BaseModel):
    order_id: str
    symbol: str
    side: OrderSide
    order_type: OrderType
    quantity: float
    price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    created_at: Optional[datetime] = None
    tag: Optional[str] = ""

class TradeModel(BaseModel):
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
    commission: float = 0.0
    swap: float = 0.0
    slippage: float = 0.0
    exit_reason: str
    holding_period_bars: int = 0
    tag: Optional[str] = ""
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    initial_sl: Optional[float] = None
    initial_tp: Optional[float] = None

class PositionModel(BaseModel):
    symbol: str
    side: PositionSide
    entry_price: float
    quantity: float
    entry_time: datetime
    current_price: float = 0.0
    unrealized_pnl: float = 0.0
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None

class EquityPointModel(BaseModel):
    timestamp: datetime
    balance: float
    equity: float
    drawdown: float
    drawdown_pct: float

class PerformanceMetricsModel(BaseModel):
    initial_capital: float = 100_000.0
    ending_equity: float = 100_000.0
    net_profit: float = 0.0
    net_profit_pct: float = 0.0
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0
    profit_factor: float = 0.0
    expectancy: float = 0.0
    average_trade: float = 0.0
    average_win: float = 0.0
    average_loss: float = 0.0
    payoff_ratio: float = 0.0
    max_drawdown: float = 0.0
    max_drawdown_pct: float = 0.0
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    max_consecutive_wins: int = 0
    max_consecutive_losses: int = 0
    exposure_pct: float = 0.0

class SimulationConfigModel(BaseModel):
    initial_capital: float = 100_000.0
    leverage: float = 1.0
    commission_per_order: float = 0.0
    commission_pct: float = 0.0005
    slippage_points: float = 0.0
    spread_points: float = 0.0
    point_value: float = 1.0
    risk_free_rate: float = 0.02
    annualization_factor: int = 252
    use_mt5: bool = False
    engine: str = "vectorized"
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    start_date: Optional[Union[datetime, str]] = None
    end_date: Optional[Union[datetime, str]] = None
    version_num: Optional[int] = 1

class StrategyModel(BaseModel):
    id: str
    name: str
    description: str
    symbol: str
    timeframe: str
    version: str
    created_at: datetime
    updated_at: datetime
    parameters: Dict[str, Any] = Field(default_factory=dict)
    code_snippet: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

class BacktestRecordModel(BaseModel):
    id: str
    strategy_id: str
    strategy_name: str
    version_num: int = 1
    symbol: str
    timeframe: str
    start_date: datetime
    end_date: datetime
    status: BacktestStatus
    config: SimulationConfigModel
    metrics: Optional[PerformanceMetricsModel] = None
    engine_version: str = "1.0.0"
    data_checksum: str = ""
    created_at: datetime

class BacktestRunRequest(BaseModel):
    symbol: str
    timeframe: str = "1m"
    strategy_id: str
    strategy_name: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    config: SimulationConfigModel = Field(default_factory=SimulationConfigModel)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class BacktestRunResponse(BaseModel):
    id: str
    strategy_id: str
    strategy_name: str
    version_num: int = 1
    symbol: str
    timeframe: str
    status: BacktestStatus
    config: SimulationConfigModel
    metrics: PerformanceMetricsModel
    trades: List[TradeModel]
    equity_curve: List[EquityPointModel]
    bars_processed: int
    duration_seconds: float
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    created_at: datetime

class MarketSymbolInfo(BaseModel):
    market: str
    symbol: str
    timeframe: str
    file_count: int

class StrategyParameterDef(BaseModel):
    name: str
    type: str
    default: Any
    description: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None

class StrategyMetadata(BaseModel):
    id: str
    name: str
    description: str
    parameters: List[StrategyParameterDef]

