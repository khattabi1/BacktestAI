from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
from .types import Bar, Order, Trade, EquityPoint, PerformanceMetrics, SimulationConfig, PositionSide, OrderSide
from .accounting import AccountState
from .execution import ExecutionModel
from .metrics import calculate_metrics
from .strategy import BaseStrategy

@dataclass
class BacktestResult:
    config: SimulationConfig
    trades: List[Trade]
    equity_curve: List[EquityPoint]
    metrics: PerformanceMetrics
    bars_processed: int
    duration_seconds: float = 0.0

class BacktestEngine:
    def __init__(self, config: Optional[SimulationConfig] = None):
        self.config = config or SimulationConfig()
        self.account = AccountState(self.config)
        self.execution_model = ExecutionModel(self.config)
        self.pending_orders: List[Order] = []
        self.holding_bars_tracker: Dict[str, int] = {}

    def run(self, bars: List[Bar], strategy: BaseStrategy) -> BacktestResult:
        start_time = datetime.now()
        total_bars = len(bars)

        strategy._active_positions = self.account.positions

        for bar_idx, bar in enumerate(bars):
            # 1. Update holding bars for active positions
            for sym in list(self.account.positions.keys()):
                self.holding_bars_tracker[sym] = self.holding_bars_tracker.get(sym, 0) + 1

            # 2. Check Stop-Loss and Take-Profit for existing open positions
            for sym in list(self.account.positions.keys()):
                pos = self.account.positions[sym]
                holding_bars = self.holding_bars_tracker.get(sym, 0)

                # Check SL
                if pos.stop_loss is not None:
                    if pos.side == PositionSide.LONG and bar.low <= pos.stop_loss:
                        exit_price = min(bar.open, pos.stop_loss)
                        exit_fill, slip = self.execution_model.calculate_slippage(exit_price, OrderSide.SELL)
                        comm = self.execution_model.calculate_commission(exit_fill, pos.quantity)
                        self.account.close_position(sym, exit_fill, bar.timestamp, "SL", comm, slip, holding_bars)
                        self.holding_bars_tracker.pop(sym, None)
                        continue
                    elif pos.side == PositionSide.SHORT and bar.high >= pos.stop_loss:
                        exit_price = max(bar.open, pos.stop_loss)
                        exit_fill, slip = self.execution_model.calculate_slippage(exit_price, OrderSide.BUY)
                        comm = self.execution_model.calculate_commission(exit_fill, pos.quantity)
                        self.account.close_position(sym, exit_fill, bar.timestamp, "SL", comm, slip, holding_bars)
                        self.holding_bars_tracker.pop(sym, None)
                        continue

                # Check TP
                if pos.take_profit is not None:
                    if pos.side == PositionSide.LONG and bar.high >= pos.take_profit:
                        exit_price = max(bar.open, pos.take_profit)
                        exit_fill, slip = self.execution_model.calculate_slippage(exit_price, OrderSide.SELL)
                        comm = self.execution_model.calculate_commission(exit_fill, pos.quantity)
                        self.account.close_position(sym, exit_fill, bar.timestamp, "TP", comm, slip, holding_bars)
                        self.holding_bars_tracker.pop(sym, None)
                        continue
                    elif pos.side == PositionSide.SHORT and bar.low <= pos.take_profit:
                        exit_price = min(bar.open, pos.take_profit)
                        exit_fill, slip = self.execution_model.calculate_slippage(exit_price, OrderSide.BUY)
                        comm = self.execution_model.calculate_commission(exit_fill, pos.quantity)
                        self.account.close_position(sym, exit_fill, bar.timestamp, "TP", comm, slip, holding_bars)
                        self.holding_bars_tracker.pop(sym, None)
                        continue

            # 3. Process Pending Orders
            unfilled_orders: List[Order] = []
            for order in self.pending_orders:
                fill_res = self.execution_model.evaluate_order(order, bar)
                if fill_res is not None:
                    fill_price, commission, slippage = fill_res
                    side = PositionSide.LONG if order.side == OrderSide.BUY else PositionSide.SHORT
                    is_close_order = getattr(order, "is_close", False)

                    if order.symbol in self.account.positions:
                        existing = self.account.positions[order.symbol]
                        if existing.side != side or is_close_order:
                            h_bars = self.holding_bars_tracker.get(order.symbol, 0)
                            exit_reason = order.tag if (order.tag and is_close_order) else "SIGNAL"
                            close_qty = order.quantity if (is_close_order and order.quantity < existing.quantity) else None
                            self.account.close_position(
                                order.symbol,
                                fill_price,
                                bar.timestamp,
                                exit_reason,
                                commission,
                                slippage,
                                h_bars,
                                quantity=close_qty,
                            )
                            if order.symbol not in self.account.positions:
                                self.holding_bars_tracker.pop(order.symbol, None)

                    if not is_close_order:
                        self.account.open_position(
                            symbol=order.symbol,
                            side=side,
                            price=fill_price,
                            quantity=order.quantity,
                            timestamp=bar.timestamp,
                            stop_loss=order.stop_loss,
                            take_profit=order.take_profit,
                            commission=commission,
                            slippage=slippage,
                            tag=order.tag
                        )
                        self.holding_bars_tracker[order.symbol] = 0
                else:
                    unfilled_orders.append(order)
            self.pending_orders = unfilled_orders

            # 4. Mark to market at current bar close
            self.account.mark_to_market({bar.symbol: bar.close}, bar.timestamp)

            # 5. Let Strategy observe the completed bar (chronological, no lookahead)
            strategy.orders_to_submit.clear()
            strategy._active_positions = self.account.positions
            strategy._current_bar = bar
            strategy._default_symbol = bar.symbol
            strategy.on_bar(bar, self.account.positions, self.account.equity)

            # 6. Queue any new orders emitted by strategy for next bar execution
            for ord_req in strategy.orders_to_submit:
                self.pending_orders.append(ord_req)

        # Finalize: Close open positions at final bar close
        if bars:
            final_bar = bars[-1]
            for sym in list(self.account.positions.keys()):
                pos = self.account.positions[sym]
                h_bars = self.holding_bars_tracker.get(sym, 0)
                exit_fill, slip = self.execution_model.calculate_slippage(
                    final_bar.close,
                    OrderSide.SELL if pos.side == PositionSide.LONG else OrderSide.BUY
                )
                comm = self.execution_model.calculate_commission(exit_fill, pos.quantity)
                self.account.close_position(sym, exit_fill, final_bar.timestamp, "CLOSE_END", comm, slip, h_bars)
            self.account.mark_to_market({final_bar.symbol: final_bar.close}, final_bar.timestamp)

        duration = (datetime.now() - start_time).total_seconds()
        metrics = calculate_metrics(self.account.closed_trades, self.account.equity_history, self.config, total_bars)

        return BacktestResult(
            config=self.config,
            trades=self.account.closed_trades,
            equity_curve=self.account.equity_history,
            metrics=metrics,
            bars_processed=total_bars,
            duration_seconds=round(duration, 4)
        )
