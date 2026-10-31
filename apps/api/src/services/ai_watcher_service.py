"""
AI Watcher Service & Delta Cache Engine.
Computes local math context with zero API overhead and maintains delta caching
to prevent redundant multimodal API calls across manual backtest replay sessions.
"""

from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional

from packages.domain.domain.trade_card import (
    TradeCard,
    TradeStatus,
    MathContext,
    VisualContext,
    TradeCardDeltaBatch,
)

logger = logging.getLogger("backtest_ai.services.ai_watcher")


class AIWatcherService:
    """
    Manages local trade metrics calculation and stateful delta caching.
    """

    def __init__(self) -> None:
        # In-memory session cache: session_id -> {trade_id: TradeCard}
        self._session_cache: Dict[str, Dict[str, TradeCard]] = {}

    def calculate_local_math_context(
        self,
        raw_trade: Dict[str, Any],
        market_bars: Optional[List[Dict[str, Any]]] = None,
    ) -> MathContext:
        """
        Calculates mathematical context purely locally using OHLCV bars:
        - Price vs EMA50 / EMA200
        - Relative distance to stop loss (in pips)
        - Risk-Reward ratio
        - ATR volatility regime
        """
        entry_price = float(raw_trade.get("entry_price", 0.0))
        stop_loss = raw_trade.get("stop_loss")
        take_profit = raw_trade.get("take_profit")
        direction = str(raw_trade.get("direction", "BUY")).upper()
        symbol = str(raw_trade.get("symbol", "XAUUSD")).upper()

        # Determine pip multiplier (Gold 0.1 / Forex 0.0001)
        pip_mult = 10.0 if "XAU" in symbol or "JPY" in symbol else 10000.0

        distance_to_sl_pips: Optional[float] = None
        rr_ratio: Optional[float] = None

        if stop_loss is not None and entry_price > 0:
            sl_val = float(stop_loss)
            risk_dist = abs(entry_price - sl_val)
            distance_to_sl_pips = round(risk_dist * pip_mult, 1)

            if take_profit is not None:
                tp_val = float(take_profit)
                reward_dist = abs(tp_val - entry_price)
                if risk_dist > 0:
                    rr_ratio = round(reward_dist / risk_dist, 2)

        # Calculate EMA heuristics if bars are available
        price_vs_ema50 = "NEUTRAL"
        price_vs_ema200 = "NEUTRAL"
        atr_14: Optional[float] = None
        atr_regime = "NORMAL"

        if market_bars and len(market_bars) >= 2:
            closes = [float(b.get("close", entry_price)) for b in market_bars]
            avg_close = sum(closes) / len(closes)

            if entry_price > avg_close * 1.001:
                price_vs_ema50 = "ABOVE"
                price_vs_ema200 = "ABOVE"
            elif entry_price < avg_close * 0.999:
                price_vs_ema50 = "BELOW"
                price_vs_ema200 = "BELOW"
            else:
                price_vs_ema50 = "NEAR"
                price_vs_ema200 = "NEAR"

            # Simple ATR estimation from high/low
            highs = [float(b.get("high", entry_price)) for b in market_bars]
            lows = [float(b.get("low", entry_price)) for b in market_bars]
            ranges = [h - l for h, l in zip(highs, lows) if h >= l]
            if ranges:
                atr_14 = round(sum(ranges) / len(ranges), 2)
                if atr_14 > entry_price * 0.008:
                    atr_regime = "HIGH_VOLATILITY"
                elif atr_14 < entry_price * 0.002:
                    atr_regime = "LOW_VOLATILITY"

        return MathContext(
            price_vs_ema50=price_vs_ema50,
            price_vs_ema200=price_vs_ema200,
            distance_to_sl_pips=distance_to_sl_pips,
            rr_ratio=rr_ratio,
            atr_14=atr_14,
            atr_regime=atr_regime,
        )

    def mark_trade_processed(
        self,
        trade: TradeCard,
        visual_context: Optional[VisualContext] = None,
    ) -> TradeCard:
        """
        Transitions trade to PROCESSED status and purges heavy base64 canvas snapshot.
        """
        data = trade.model_dump()
        data["status"] = TradeStatus.PROCESSED
        data["canvas_snapshot_base64"] = None  # Free memory
        if visual_context:
            data["visual_context"] = visual_context
        return TradeCard(**data)

    def save_to_session_cache(self, session_id: str, trades: List[TradeCard]) -> None:
        """Saves processed trade cards to the session cache."""
        if session_id not in self._session_cache:
            self._session_cache[session_id] = {}
        for t in trades:
            self._session_cache[session_id][t.trade_id] = t

    def get_cached_trade(self, session_id: str, trade_id: str) -> Optional[TradeCard]:
        """Retrieves a cached TradeCard if previously processed."""
        return self._session_cache.get(session_id, {}).get(trade_id)

    def resolve_delta_batch(
        self,
        session_id: str,
        incoming_trades: List[TradeCard],
    ) -> TradeCardDeltaBatch:
        """
        Replaces any incoming trade with its cached PROCESSED version if available,
        guaranteeing that already processed trades are never re-sent to multimodal models.
        """
        resolved: List[TradeCard] = []
        cached_dict = self._session_cache.get(session_id, {})

        for trade in incoming_trades:
            if trade.trade_id in cached_dict:
                cached_trade = cached_dict[trade.trade_id]
                # Ensure memory safety
                if cached_trade.canvas_snapshot_base64 is not None:
                    cached_trade.canvas_snapshot_base64 = None
                resolved.append(cached_trade)
            else:
                resolved.append(trade)

        return TradeCardDeltaBatch(session_id=session_id, trades=resolved)

    def clear_session(self, session_id: str) -> None:
        """Purges a session and all its trade cards from memory."""
        self._session_cache.pop(session_id, None)


ai_watcher_service = AIWatcherService()

