from typing import Dict, List, Optional
from datetime import datetime
from .types import Position, PositionSide, Trade, EquityPoint, SimulationConfig

class AccountState:
    def __init__(self, config: SimulationConfig):
        self.config = config
        self.initial_capital = config.initial_capital
        self.cash = config.initial_capital
        self.equity = config.initial_capital
        self.peak_equity = config.initial_capital
        self.positions: Dict[str, Position] = {}
        self.closed_trades: List[Trade] = []
        self.equity_history: List[EquityPoint] = []
        self.total_commission_paid = 0.0

    def open_position(
        self,
        symbol: str,
        side: PositionSide,
        price: float,
        quantity: float,
        timestamp: datetime,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        commission: float = 0.0,
        slippage: float = 0.0,
        tag: str = ""
    ) -> Position:
        self.cash -= commission
        self.total_commission_paid += commission

        position = Position(
            symbol=symbol,
            side=side,
            entry_price=price,
            quantity=quantity,
            entry_time=timestamp,
            stop_loss=stop_loss,
            take_profit=take_profit,
            current_price=price
        )
        self.positions[symbol] = position
        return position

    def close_position(
        self,
        symbol: str,
        exit_price: float,
        timestamp: datetime,
        exit_reason: str,
        commission: float = 0.0,
        slippage: float = 0.0,
        holding_bars: int = 0,
        quantity: Optional[float] = None,
    ) -> Optional[Trade]:
        if symbol not in self.positions:
            return None

        pos = self.positions[symbol]
        close_qty = pos.quantity if quantity is None or quantity >= pos.quantity else quantity
        remaining_qty = pos.quantity - close_qty

        if pos.side == PositionSide.LONG:
            raw_pnl = (exit_price - pos.entry_price) * close_qty * self.config.point_value
        else:
            raw_pnl = (pos.entry_price - exit_price) * close_qty * self.config.point_value

        net_pnl = raw_pnl - commission
        cost_basis = pos.entry_price * close_qty * self.config.point_value
        pnl_pct = (net_pnl / cost_basis) * 100.0 if cost_basis > 0 else 0.0

        self.cash += net_pnl
        self.total_commission_paid += commission

        trade = Trade(
            trade_id=f"TRD_{len(self.closed_trades) + 1}",
            symbol=symbol,
            side=pos.side,
            entry_time=pos.entry_time,
            exit_time=timestamp,
            entry_price=pos.entry_price,
            exit_price=exit_price,
            quantity=close_qty,
            pnl=round(net_pnl, 2),
            pnl_percent=round(pnl_pct, 2),
            commission=round(commission, 2),
            slippage=round(slippage, 4),
            exit_reason=exit_reason,
            holding_period_bars=holding_bars
        )
        self.closed_trades.append(trade)

        if remaining_qty <= 1e-6:
            self.positions.pop(symbol)
        else:
            pos.quantity = remaining_qty

        return trade

    def mark_to_market(self, current_prices: Dict[str, float], timestamp: datetime) -> EquityPoint:
        unrealized = 0.0
        for symbol, pos in self.positions.items():
            if symbol in current_prices:
                price = current_prices[symbol]
                unrealized += pos.calculate_unrealized_pnl(price) * self.config.point_value

        self.equity = self.cash + unrealized
        if self.equity > self.peak_equity:
            self.peak_equity = self.equity

        drawdown = self.peak_equity - self.equity
        drawdown_pct = (drawdown / self.peak_equity) * 100.0 if self.peak_equity > 0 else 0.0

        point = EquityPoint(
            timestamp=timestamp,
            balance=round(self.cash, 2),
            equity=round(self.equity, 2),
            drawdown=round(drawdown, 2),
            drawdown_pct=round(drawdown_pct, 2)
        )
        self.equity_history.append(point)
        return point
