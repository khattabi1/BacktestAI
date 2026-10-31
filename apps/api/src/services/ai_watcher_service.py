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


def _ema(values: List[float], period: int) -> Optional[float]:
    """Exponential moving average seeded with the SMA of the first `period` values."""
    if len(values) < period:
        return None
    k = 2.0 / (period + 1)
    ema_val = sum(values[:period]) / period
    for v in values[period:]:
        ema_val = v * k + ema_val * (1 - k)
    return ema_val


def _wilder_series(values: List[float], period: int) -> List[float]:
    """Wilder's smoothing (used by RSI and ATR). Returns the smoothed series after warm-up."""
    if len(values) < period:
        return []
    avg = sum(values[:period]) / period
    series = [avg]
    for v in values[period:]:
        avg = (avg * (period - 1) + v) / period
        series.append(avg)
    return series


def _rsi(closes: List[float], period: int = 14) -> Optional[float]:
    if len(closes) <= period:
        return None
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = _wilder_series([max(d, 0.0) for d in deltas], period)
    losses = _wilder_series([max(-d, 0.0) for d in deltas], period)
    if not gains or not losses:
        return None
    if losses[-1] == 0:
        return 100.0
    rs = gains[-1] / losses[-1]
    return round(100.0 - 100.0 / (1.0 + rs), 2)


def _position_vs(price: float, reference: Optional[float], tolerance: float = 0.001) -> str:
    """ABOVE / BELOW / NEAR relative to a reference level, NEUTRAL when it cannot be computed."""
    if reference is None or reference <= 0:
        return "NEUTRAL"
    if price > reference * (1 + tolerance):
        return "ABOVE"
    if price < reference * (1 - tolerance):
        return "BELOW"
    return "NEAR"


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

        # Indicators from the bars that closed before entry (no look-ahead)
        price_vs_ema50 = "NEUTRAL"
        price_vs_ema200 = "NEUTRAL"
        rsi_14: Optional[float] = None
        atr_14: Optional[float] = None
        atr_regime = "NORMAL"

        if market_bars and len(market_bars) >= 2:
            closes = [float(b.get("close", entry_price)) for b in market_bars]
            highs = [float(b.get("high", c)) for b, c in zip(market_bars, closes)]
            lows = [float(b.get("low", c)) for b, c in zip(market_bars, closes)]

            price_vs_ema50 = _position_vs(entry_price, _ema(closes, 50))
            price_vs_ema200 = _position_vs(entry_price, _ema(closes, 200))
            rsi_14 = _rsi(closes, 14)

            true_ranges = [highs[0] - lows[0]] + [
                max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1]))
                for i in range(1, len(closes))
            ]
            atr_series = _wilder_series(true_ranges, 14)
            if atr_series:
                atr_14 = round(atr_series[-1], 5)
                # Regime: current ATR vs. its own median over the lookback window
                median_atr = sorted(atr_series)[len(atr_series) // 2]
                if median_atr > 0:
                    if atr_14 > median_atr * 1.5:
                        atr_regime = "HIGH_VOLATILITY"
                    elif atr_14 < median_atr * 0.67:
                        atr_regime = "LOW_VOLATILITY"

        return MathContext(
            price_vs_ema50=price_vs_ema50,
            price_vs_ema200=price_vs_ema200,
            rsi_14=rsi_14,
            distance_to_sl_pips=distance_to_sl_pips,
            rr_ratio=rr_ratio,
            atr_14=atr_14,
            atr_regime=atr_regime,
        )

    @staticmethod
    def calculate_r_multiple(raw_trade: Dict[str, Any]) -> Optional[float]:
        """Realized R-multiple: profit in price units divided by the initial risk (entry to SL)."""
        try:
            entry = float(raw_trade.get("entry_price", 0.0))
            exit_price = float(raw_trade.get("exit_price", 0.0))
            stop_loss = raw_trade.get("stop_loss")
        except (TypeError, ValueError):
            return None
        if stop_loss is None or entry <= 0 or exit_price <= 0:
            return None
        risk = abs(entry - float(stop_loss))
        if risk <= 0:
            return None
        direction = 1.0 if str(raw_trade.get("direction", "BUY")).upper() in ("BUY", "LONG") else -1.0
        return round((exit_price - entry) * direction / risk, 2)

    def load_bars_before_entry(
        self,
        symbol: str,
        timeframe: str,
        entry_time: Optional[str],
        lookback: int = 250,
    ) -> List[Dict[str, Any]]:
        """Loads up to `lookback` bars that closed before entry from the local Parquet store."""
        if not entry_time:
            return []
        try:
            from datetime import datetime
            from apps.api.src.services.data_service import MarketDataService

            end_dt = datetime.fromisoformat(str(entry_time).replace("Z", "+00:00"))
            df = MarketDataService().load_ohlcv(
                symbol=symbol,
                timeframe=timeframe,
                end_date=end_dt,
                limit=lookback,
                limit_direction="tail",
            )
            return df.to_dicts() if not df.is_empty() else []
        except Exception as exc:
            logger.warning(f"[AI Watcher] Could not load bars for {symbol} {timeframe}: {exc}")
            return []

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

    def enrich_trades(self, session_id: str, incoming_trades: List[TradeCard]) -> List[TradeCard]:
        """
        Returns the best available card for each trade, in this order:
        1. Processed card from the in-memory session cache (has vision + math context)
        2. Card stored in the database (trade_card_json), e.g. after a server restart
        3. The incoming card, with R-multiple and math context computed locally if missing
        """
        stored: Dict[str, TradeCard] = {}
        try:
            from apps.api.src.db.repository import db_repo
            for row in db_repo.get_session_trades(session_id):
                raw = row.get("trade_card_json")
                if raw:
                    card = TradeCard.model_validate_json(raw)
                    stored[card.trade_id] = card
        except Exception as exc:
            logger.warning(f"[AI Watcher] Could not load stored cards for {session_id}: {exc}")

        cached = self._session_cache.get(session_id, {})
        enriched: List[TradeCard] = []
        for trade in incoming_trades:
            card = cached.get(trade.trade_id) or stored.get(trade.trade_id)
            if card is None:
                raw_trade = trade.model_dump()
                updates: Dict[str, Any] = {}
                r_multiple = self.calculate_r_multiple(raw_trade)
                if r_multiple is not None:
                    updates["pnl_r_multiple"] = r_multiple
                if trade.math_context is None:
                    updates["math_context"] = self.calculate_local_math_context(raw_trade)
                card = trade.model_copy(update=updates)
            enriched.append(card.model_copy(update={"sequence_number": trade.sequence_number}))
        return enriched

    def clear_session(self, session_id: str) -> None:
        """Purges a session and all its trade cards from memory."""
        self._session_cache.pop(session_id, None)


ai_watcher_service = AIWatcherService()

