from typing import Optional, Tuple
from .types import Bar, Order, OrderType, OrderSide, SimulationConfig

class ExecutionModel:
    def __init__(self, config: SimulationConfig):
        self.config = config

    def calculate_commission(self, price: float, quantity: float) -> float:
        notional = price * quantity * self.config.point_value
        return self.config.commission_per_order + (notional * self.config.commission_pct)

    def calculate_slippage(self, price: float, side: OrderSide) -> Tuple[float, float]:
        slippage_val = self.config.slippage_points
        if side == OrderSide.BUY:
            fill_price = price + slippage_val
        else:
            fill_price = price - slippage_val
        return fill_price, slippage_val

    def evaluate_order(self, order: Order, bar: Bar) -> Optional[Tuple[float, float, float]]:
        """
        Returns (fill_price, commission, slippage) if order is filled, else None
        """
        fill_price = None

        if order.order_type == OrderType.MARKET:
            fill_price = bar.open

        elif order.order_type == OrderType.LIMIT:
            if order.side == OrderSide.BUY:
                if bar.low <= order.price:
                    fill_price = min(bar.open, order.price)
            else:
                if bar.high >= order.price:
                    fill_price = max(bar.open, order.price)

        elif order.order_type == OrderType.STOP:
            if order.side == OrderSide.BUY:
                if bar.high >= order.price:
                    fill_price = max(bar.open, order.price)
            else:
                if bar.low <= order.price:
                    fill_price = min(bar.open, order.price)

        if fill_price is not None:
            if order.side == OrderSide.BUY and self.config.spread_points > 0:
                fill_price += self.config.spread_points

            adjusted_fill, slippage = self.calculate_slippage(fill_price, order.side)
            commission = self.calculate_commission(adjusted_fill, order.quantity)
            return adjusted_fill, commission, slippage

        return None
