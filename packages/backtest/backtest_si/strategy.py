from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Union
from collections import deque
from .types import Bar, Order, OrderSide, OrderType, PositionSide

class IndicatorBuffer:
    """Fixed-window historical buffer guaranteeing zero look-ahead bias."""
    def __init__(self, size: int):
        self.size = size
        self.buffer = deque(maxlen=size)

    def append(self, val: float) -> None:
        self.buffer.append(float(val))

    def __len__(self) -> int:
        return len(self.buffer)

    def __getitem__(self, idx: Union[int, slice]) -> Union[float, List[float]]:
        if isinstance(idx, slice):
            return list(self.buffer)[idx]
        return self.buffer[idx]

    def __iter__(self):
        return iter(self.buffer)

    def __bool__(self) -> bool:
        return len(self.buffer) > 0

    def is_ready(self) -> bool:
        return len(self.buffer) == self.size

    def values(self) -> List[float]:
        return list(self.buffer)

    def get_last_n(self, n: int) -> List[float]:
        if not self.buffer:
            return []
        buf = list(self.buffer)
        return buf[-n:]

    def get_value(self, default: Optional[float] = None) -> Optional[float]:
        if not self.buffer:
            return default
        return self.buffer[-1]

    def ema(self) -> Optional[float]:
        if not self.buffer:
            return None
        vals = list(self.buffer)
        k = 2.0 / (len(vals) + 1)
        ema_val = vals[0]
        for v in vals[1:]:
            ema_val = v * k + ema_val * (1 - k)
        return ema_val

    def sma(self) -> Optional[float]:
        if not self.buffer:
            return None
        return sum(self.buffer) / len(self.buffer)

    def std(self) -> Optional[float]:
        if len(self.buffer) < 2:
            return 0.0
        mean = sum(self.buffer) / len(self.buffer)
        variance = sum((x - mean) ** 2 for x in self.buffer) / (len(self.buffer) - 1)
        return variance ** 0.5

    def highest(self, n: Optional[int] = None) -> Optional[float]:
        if not self.buffer:
            return None
        vals = self.get_last_n(n) if n else list(self.buffer)
        return max(vals) if vals else None

    def lowest(self, n: Optional[int] = None) -> Optional[float]:
        if not self.buffer:
            return None
        vals = self.get_last_n(n) if n else list(self.buffer)
        return min(vals) if vals else None


class BaseStrategy(ABC):
    def __init__(self, parameters: Optional[Dict[str, Any]] = None):
        self.parameters = parameters or {}
        self.orders_to_submit: List[Order] = []
        self.order_counter = 0
        self._active_positions: Dict[str, Any] = {}
        self._current_bar: Optional[Bar] = None
        self._default_symbol: str = "DEFAULT"

    def _resolve_symbol(self, symbol: Optional[str] = None) -> str:
        """Resolves target symbol defaulting to current active position, current bar, or default."""
        if symbol and isinstance(symbol, str):
            return symbol
        if self._active_positions:
            return next(iter(self._active_positions.keys()))
        if self._current_bar and getattr(self._current_bar, "symbol", None):
            return self._current_bar.symbol
        return getattr(self, "_default_symbol", "DEFAULT")

    # ==========================================
    # 1. POSITION QUERIES & TELEMETRY
    # ==========================================

    def has_position(self, symbol: Optional[str] = None) -> bool:
        """Checks if a position currently exists for the specified symbol, or any symbol if omitted."""
        if symbol:
            return symbol in self._active_positions
        return len(self._active_positions) > 0

    def get_position(self, symbol: Optional[str] = None) -> Optional[Any]:
        """Retrieves active Position object for the specified symbol, or first active position if omitted."""
        if symbol:
            return self._active_positions.get(symbol)
        if self._active_positions:
            return next(iter(self._active_positions.values()), None)
        return None

    def get_positions(self) -> Dict[str, Any]:
        """Returns all currently active positions."""
        return dict(self._active_positions)

    def is_long(self, symbol: Optional[str] = None) -> bool:
        """Returns True if open position is LONG."""
        pos = self.get_position(symbol)
        return pos is not None and getattr(pos, "side", None) == PositionSide.LONG

    def is_short(self, symbol: Optional[str] = None) -> bool:
        """Returns True if open position is SHORT."""
        pos = self.get_position(symbol)
        return pos is not None and getattr(pos, "side", None) == PositionSide.SHORT

    def position_size(self, symbol: Optional[str] = None) -> float:
        """Returns active position quantity, or 0.0 if flat."""
        pos = self.get_position(symbol)
        return getattr(pos, "quantity", 0.0) if pos else 0.0

    def entry_price(self, symbol: Optional[str] = None) -> Optional[float]:
        """Returns entry price for active position, or None if flat."""
        pos = self.get_position(symbol)
        return getattr(pos, "entry_price", None) if pos else None

    def unrealized_pnl(self, symbol: Optional[str] = None, current_price: Optional[float] = None) -> float:
        """Calculates unrealized PnL for active position."""
        pos = self.get_position(symbol)
        if not pos:
            return 0.0
        price = current_price or (self._current_bar.close if self._current_bar else getattr(pos, "current_price", 0.0))
        if hasattr(pos, "calculate_unrealized_pnl"):
            return pos.calculate_unrealized_pnl(price)
        return 0.0

    # ==========================================
    # 2. ORDER SUBMISSION
    # ==========================================

    def buy_market(
        self,
        symbol: Optional[str] = None,
        quantity: float = 1.0,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        tag: str = ""
    ) -> None:
        """Submits a market BUY order to execute on next bar open."""
        sym = self._resolve_symbol(symbol)
        self.order_counter += 1
        self.orders_to_submit.append(
            Order(
                order_id=f"ORD_{self.order_counter}",
                symbol=sym,
                side=OrderSide.BUY,
                order_type=OrderType.MARKET,
                quantity=quantity,
                stop_loss=stop_loss,
                take_profit=take_profit,
                tag=tag
            )
        )

    def sell_market(
        self,
        symbol: Optional[str] = None,
        quantity: float = 1.0,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        tag: str = ""
    ) -> None:
        """Submits a market SELL order to execute on next bar open."""
        sym = self._resolve_symbol(symbol)
        self.order_counter += 1
        self.orders_to_submit.append(
            Order(
                order_id=f"ORD_{self.order_counter}",
                symbol=sym,
                side=OrderSide.SELL,
                order_type=OrderType.MARKET,
                quantity=quantity,
                stop_loss=stop_loss,
                take_profit=take_profit,
                tag=tag
            )
        )

    def buy(
        self,
        symbol: Optional[str] = None,
        quantity: float = 1.0,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        tag: str = ""
    ) -> None:
        """Convenience alias for buy_market."""
        self.buy_market(symbol=symbol, quantity=quantity, stop_loss=stop_loss, take_profit=take_profit, tag=tag)

    def sell(
        self,
        symbol: Optional[str] = None,
        quantity: float = 1.0,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        tag: str = ""
    ) -> None:
        """Convenience alias for sell_market."""
        self.sell_market(symbol=symbol, quantity=quantity, stop_loss=stop_loss, take_profit=take_profit, tag=tag)

    def buy_limit(
        self,
        symbol: Optional[str] = None,
        quantity: float = 1.0,
        price: float = 0.0,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        tag: str = ""
    ) -> None:
        """Submits a pending LIMIT BUY order."""
        sym = self._resolve_symbol(symbol)
        self.order_counter += 1
        self.orders_to_submit.append(
            Order(
                order_id=f"ORD_{self.order_counter}",
                symbol=sym,
                side=OrderSide.BUY,
                order_type=OrderType.LIMIT,
                price=price,
                quantity=quantity,
                stop_loss=stop_loss,
                take_profit=take_profit,
                tag=tag
            )
        )

    def sell_limit(
        self,
        symbol: Optional[str] = None,
        quantity: float = 1.0,
        price: float = 0.0,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        tag: str = ""
    ) -> None:
        """Submits a pending LIMIT SELL order."""
        sym = self._resolve_symbol(symbol)
        self.order_counter += 1
        self.orders_to_submit.append(
            Order(
                order_id=f"ORD_{self.order_counter}",
                symbol=sym,
                side=OrderSide.SELL,
                order_type=OrderType.LIMIT,
                price=price,
                quantity=quantity,
                stop_loss=stop_loss,
                take_profit=take_profit,
                tag=tag
            )
        )

    def buy_stop(
        self,
        symbol: Optional[str] = None,
        quantity: float = 1.0,
        price: float = 0.0,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        tag: str = ""
    ) -> None:
        """Submits a pending STOP BUY order."""
        sym = self._resolve_symbol(symbol)
        self.order_counter += 1
        self.orders_to_submit.append(
            Order(
                order_id=f"ORD_{self.order_counter}",
                symbol=sym,
                side=OrderSide.BUY,
                order_type=OrderType.STOP,
                price=price,
                quantity=quantity,
                stop_loss=stop_loss,
                take_profit=take_profit,
                tag=tag
            )
        )

    def sell_stop(
        self,
        symbol: Optional[str] = None,
        quantity: float = 1.0,
        price: float = 0.0,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        tag: str = ""
    ) -> None:
        """Submits a pending STOP SELL order."""
        sym = self._resolve_symbol(symbol)
        self.order_counter += 1
        self.orders_to_submit.append(
            Order(
                order_id=f"ORD_{self.order_counter}",
                symbol=sym,
                side=OrderSide.SELL,
                order_type=OrderType.STOP,
                price=price,
                quantity=quantity,
                stop_loss=stop_loss,
                take_profit=take_profit,
                tag=tag
            )
        )

    # ==========================================
    # 3. POSITION MODIFICATION & RISK MANAGEMENT
    # ==========================================

    def modify_position(
        self,
        symbol: Optional[str] = None,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        tag: str = ""
    ) -> bool:
        """Modifies stop loss and/or take profit for an existing open position in real-time."""
        pos = self.get_position(symbol)
        if pos is not None:
            if stop_loss is not None:
                pos.stop_loss = stop_loss
            if take_profit is not None:
                pos.take_profit = take_profit
            return True
        return False

    def modify_stop_loss(
        self,
        symbol: Optional[str] = None,
        stop_loss: Optional[float] = None
    ) -> bool:
        """Updates stop loss level on active position."""
        return self.modify_position(symbol=symbol, stop_loss=stop_loss)

    def modify_take_profit(
        self,
        symbol: Optional[str] = None,
        take_profit: Optional[float] = None
    ) -> bool:
        """Updates take profit level on active position."""
        return self.modify_position(symbol=symbol, take_profit=take_profit)

    def set_stop_loss(
        self,
        symbol: Optional[str] = None,
        stop_loss: Optional[float] = None,
        price: Optional[float] = None
    ) -> bool:
        """Alias for setting stop loss."""
        sl = stop_loss if stop_loss is not None else price
        return self.modify_stop_loss(symbol=symbol, stop_loss=sl)

    def set_take_profit(
        self,
        symbol: Optional[str] = None,
        take_profit: Optional[float] = None,
        price: Optional[float] = None
    ) -> bool:
        """Alias for setting take profit."""
        tp = take_profit if take_profit is not None else price
        return self.modify_take_profit(symbol=symbol, take_profit=tp)

    def move_to_breakeven(
        self,
        symbol: Optional[str] = None,
        offset_ticks: float = 0.0,
        offset: float = 0.0
    ) -> bool:
        """Moves stop loss of active position to entry price + offset ticks."""
        pos = self.get_position(symbol)
        if pos is None:
            return False
        off = offset or offset_ticks
        if pos.side == PositionSide.LONG:
            new_sl = pos.entry_price + off
            if pos.stop_loss is None or new_sl > pos.stop_loss:
                pos.stop_loss = new_sl
                return True
        else:
            new_sl = pos.entry_price - off
            if pos.stop_loss is None or new_sl < pos.stop_loss:
                pos.stop_loss = new_sl
                return True
        return False

    def trail_stop(
        self,
        symbol: Optional[str] = None,
        current_price: Optional[float] = None,
        distance: Optional[float] = None,
        atr: Optional[float] = None,
        atr_multiplier: float = 2.0
    ) -> bool:
        """
        Dynamically trails stop loss behind price.
        For LONG: ratchets SL higher if current_price - distance > current_SL.
        For SHORT: ratchets SL lower if current_price + distance < current_SL.
        """
        pos = self.get_position(symbol)
        if pos is None:
            return False

        dist = distance
        if dist is None and atr is not None:
            dist = atr * atr_multiplier
        if dist is None or dist <= 0:
            return False

        curr = current_price or (self._current_bar.close if self._current_bar else getattr(pos, "current_price", 0.0))
        if curr <= 0:
            return False

        if pos.side == PositionSide.LONG:
            new_sl = curr - dist
            if pos.stop_loss is None or new_sl > pos.stop_loss:
                pos.stop_loss = new_sl
                return True
        else:
            new_sl = curr + dist
            if pos.stop_loss is None or new_sl < pos.stop_loss:
                pos.stop_loss = new_sl
                return True
        return False

    # ==========================================
    # 4. EXITS & PARTIAL CLOSES
    # ==========================================

    def close_position(
        self,
        symbol: Optional[str] = None,
        tag: str = "CLOSE"
    ) -> bool:
        """Submits an order to fully close an existing open position at next bar open."""
        pos = self.get_position(symbol)
        if pos is not None:
            self.order_counter += 1
            close_side = OrderSide.SELL if pos.side == PositionSide.LONG else OrderSide.BUY
            self.orders_to_submit.append(
                Order(
                    order_id=f"ORD_{self.order_counter}",
                    symbol=pos.symbol,
                    side=close_side,
                    order_type=OrderType.MARKET,
                    quantity=pos.quantity,
                    tag=tag or "CLOSE",
                    is_close=True
                )
            )
            return True
        return False

    def close_all_positions(self, tag: str = "CLOSE_ALL") -> None:
        """Submits orders to close all currently open positions."""
        for sym in list(self._active_positions.keys()):
            self.close_position(sym, tag=tag)

    def close_partial(
        self,
        symbol: Optional[str] = None,
        ratio: float = 0.5,
        quantity: Optional[float] = None,
        tag: str = "CLOSE_PARTIAL",
        *args: Any,
        **kwargs: Any
    ) -> bool:
        """
        Submits an order to partially close an active position.
        Accepts ratio (e.g. 0.5 for 50%) or specific quantity.
        Supports flexible call signatures (e.g. close_partial(0.5) or close_partial(ratio=0.5)).
        """
        # Handle positional ratio: close_partial(0.5)
        if isinstance(symbol, (int, float)) and quantity is None and ratio == 0.5:
            ratio = float(symbol)
            symbol = None

        pos = self.get_position(symbol)
        if pos is None:
            return False

        if quantity is not None and quantity > 0:
            close_qty = min(quantity, pos.quantity)
        else:
            clamped_ratio = max(0.01, min(0.99, ratio))
            close_qty = round(pos.quantity * clamped_ratio, 4)

        if close_qty <= 0:
            return False

        self.order_counter += 1
        close_side = OrderSide.SELL if pos.side == PositionSide.LONG else OrderSide.BUY
        self.orders_to_submit.append(
            Order(
                order_id=f"ORD_{self.order_counter}",
                symbol=pos.symbol,
                side=close_side,
                order_type=OrderType.MARKET,
                quantity=close_qty,
                tag=tag or "CLOSE_PARTIAL",
                is_close=True
            )
        )
        return True

    def cancel_all_orders(self) -> None:
        """Clears all unsubmitted pending orders queued for the next bar."""
        self.orders_to_submit.clear()

    def modify_order(
        self,
        order_id: str,
        quantity: Optional[float] = None,
        price: Optional[float] = None,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None
    ) -> bool:
        """Modifies a queued pending order by order_id."""
        for ord_req in self.orders_to_submit:
            if ord_req.order_id == order_id:
                if quantity is not None:
                    ord_req.quantity = quantity
                if price is not None:
                    ord_req.price = price
                if stop_loss is not None:
                    ord_req.stop_loss = stop_loss
                if take_profit is not None:
                    ord_req.take_profit = take_profit
                return True
        return False

    # ==========================================
    # 5. QUANT & RISK CALCULATIONS
    # ==========================================

    def calculate_risk_quantity(
        self,
        equity: float,
        risk_pct: float,
        entry_price: float,
        stop_loss_price: float,
        min_qty: float = 0.01,
        max_qty: float = 100.0,
        point_value: float = 1.0
    ) -> float:
        """
        Calculates position sizing based on account equity, risk percentage, and stop loss distance.
        Formula: (equity * risk_pct) / (stop_loss_distance * point_value)
        """
        sl_distance = abs(entry_price - stop_loss_price)
        if sl_distance <= 0:
            return min_qty
        pct = (risk_pct / 100.0) if risk_pct > 1.0 else risk_pct
        risk_dollars = equity * pct
        qty = risk_dollars / (sl_distance * point_value)
        return max(min_qty, min(max_qty, round(qty, 2)))

    def round_lot(self, quantity: float, step: float = 0.01) -> float:
        """Rounds lot size to nearest valid step size."""
        if step <= 0:
            return round(quantity, 2)
        return round(round(quantity / step) * step, 4)

    @abstractmethod
    def on_bar(self, bar: Bar, positions: Dict[str, Any], equity: float) -> None:
        """Called chronologically on every single bar with state up to t."""
        pass
