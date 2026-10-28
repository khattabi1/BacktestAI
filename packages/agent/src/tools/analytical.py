"""
Quantitative Analytical Tools Plugin for BacktestAI Agent Harness (DSH).
Provides real market data inspection, volatility profiling, trend regime detection,
and localized chart context extraction.
"""

from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("backtest_ai.agent.tools.analytical")

_data_service = None


def _get_data_service():
    global _data_service
    if _data_service is None:
        try:
            from apps.api.src.services.data_service import MarketDataService
            _data_service = MarketDataService()
        except Exception as err:
            logger.warning(f"Could not initialize MarketDataService: {err}")
    return _data_service


async def query_market_data(
    symbol: str = "BTCUSDT",
    timeframe: str = "1h",
    limit: int = 100,
) -> Dict[str, Any]:
    """
    Retrieves recent market candles and computes statistical features
    including ATR volatility, trend regime, and volume distribution.
    """
    clean_symbol = symbol.replace("/", "").replace("-", "").replace("_", "").upper().strip()
    svc = _get_data_service()
    if not svc:
        return {"success": False, "error": "Market data service is not available."}

    try:
        df = svc.load_ohlcv(symbol=clean_symbol, timeframe=timeframe, limit=limit, limit_direction="tail")
        if df.is_empty():
            return {
                "success": False,
                "error": f"No data available for symbol '{symbol}' ({timeframe}). Available preloaded market feeds in platform storage: ['XAUUSD', 'BTCUSDT']. You can still build custom strategies for {symbol}.",
            }

        closes = df["close"].to_list()
        highs = df["high"].to_list()
        lows = df["low"].to_list()
        volumes = df["volume"].to_list() if "volume" in df.columns else []

        n_bars = len(closes)
        current_close = float(closes[-1])
        first_close = float(closes[0])
        period_high = float(max(highs))
        period_low = float(min(lows))
        return_pct = round(((current_close - first_close) / first_close) * 100.0, 2)

        # Compute ATR (14-period)
        tr_list: List[float] = []
        for i in range(1, n_bars):
            h, l, prev_c = highs[i], lows[i], closes[i - 1]
            tr = max(h - l, abs(h - prev_c), abs(l - prev_c))
            tr_list.append(tr)

        atr = sum(tr_list[-14:]) / min(14, len(tr_list)) if tr_list else (period_high - period_low) / max(1, n_bars)
        volatility_pct = round((atr / current_close) * 100.0, 3)

        # Compute moving averages for regime classification
        sma_20 = sum(closes[-20:]) / min(20, n_bars) if n_bars >= 10 else current_close
        sma_50 = sum(closes[-50:]) / min(50, n_bars) if n_bars >= 30 else current_close

        if current_close > sma_20 > sma_50:
            regime = "BULLISH_TREND"
        elif current_close < sma_20 < sma_50:
            regime = "BEARISH_TREND"
        elif abs(current_close - sma_20) / current_close < 0.005:
            regime = "CONSOLIDATION_RANGE"
        else:
            regime = "TRANSITIONAL_REGIME"

        avg_vol = sum(volumes) / len(volumes) if volumes else 0.0
        last_vol = volumes[-1] if volumes else 0.0
        volume_ratio = round(last_vol / avg_vol, 2) if avg_vol > 0 else 1.0

        return {
            "success": True,
            "symbol": symbol,
            "timeframe": timeframe,
            "bars_inspected": n_bars,
            "current_price": round(current_close, 5),
            "period_high": round(period_high, 5),
            "period_low": round(period_low, 5),
            "period_return_pct": return_pct,
            "atr": round(atr, 5),
            "volatility_pct": volatility_pct,
            "sma_20": round(sma_20, 5),
            "sma_50": round(sma_50, 5),
            "regime": regime,
            "volume_ratio": volume_ratio,
        }
    except Exception as err:
        logger.exception(f"Error querying market data: {err}")
        return {"success": False, "error": str(err)}


async def inspect_chart_context(
    symbol: str = "BTCUSDT",
    timeframe: str = "1h",
    timestamp: Optional[str] = None,
    window_bars: int = 25,
) -> Dict[str, Any]:
    """
    Performs localized technical chart analysis, identifying swing support/resistance,
    market structure, and recent candle formations.
    """
    svc = _get_data_service()
    if not svc:
        return {"success": False, "error": "Market data service is not available."}

    try:
        df = svc.load_ohlcv(symbol=symbol, timeframe=timeframe, limit=window_bars, limit_direction="tail")
        if df.is_empty():
            return {"success": False, "error": f"No chart data available for '{symbol}'."}

        rows = df.to_dicts()
        if not rows:
            return {"success": False, "error": "No bars returned."}

        highs = [float(r["high"]) for r in rows]
        lows = [float(r["low"]) for r in rows]
        closes = [float(r["close"]) for r in rows]
        opens = [float(r["open"]) for r in rows]

        res_level = round(max(highs), 5)
        supp_level = round(min(lows), 5)
        current_price = round(closes[-1], 5)
        channel_width_pct = round(((res_level - supp_level) / supp_level) * 100.0, 2)

        # Identify local swing highs and lows
        swing_highs = []
        swing_lows = []
        for i in range(1, len(rows) - 1):
            if highs[i] > highs[i - 1] and highs[i] > highs[i + 1]:
                swing_highs.append(round(highs[i], 5))
            if lows[i] < lows[i - 1] and lows[i] < lows[i + 1]:
                swing_lows.append(round(lows[i], 5))

        # Market structure determination
        if len(swing_highs) >= 2 and swing_highs[-1] > swing_highs[-2] and len(swing_lows) >= 2 and swing_lows[-1] > swing_lows[-2]:
            structure = "HIGHER_HIGHS_AND_HIGHER_LOWS"
        elif len(swing_highs) >= 2 and swing_highs[-1] < swing_highs[-2] and len(swing_lows) >= 2 and swing_lows[-1] < swing_lows[-2]:
            structure = "LOWER_HIGHS_AND_LOWER_LOWS"
        else:
            structure = "SIDEWAYS_COMPRESSION"

        # Format last 5 candles
        recent_candles = []
        for r in rows[-5:]:
            o, h, l, c = float(r["open"]), float(r["high"]), float(r["low"]), float(r["close"])
            candle_type = "BULLISH" if c > o else ("BEARISH" if c < o else "DOJI")
            recent_candles.append({
                "time": str(r.get("timestamp", ""))[:19],
                "open": round(o, 4),
                "high": round(h, 4),
                "low": round(l, 4),
                "close": round(c, 4),
                "type": candle_type,
            })

        return {
            "success": True,
            "symbol": symbol,
            "timeframe": timeframe,
            "current_price": current_price,
            "nearest_resistance": res_level,
            "nearest_support": supp_level,
            "channel_width_pct": channel_width_pct,
            "market_structure": structure,
            "recent_swing_highs": swing_highs[-3:],
            "recent_swing_lows": swing_lows[-3:],
            "recent_candles": recent_candles,
        }
    except Exception as err:
        logger.exception(f"Error inspecting chart context: {err}")
        return {"success": False, "error": str(err)}


def register_analytical_tools(harness: Any) -> None:
    """
    Registers the 2 analytical market inspection tools into an AgentHarness.
    """
    harness.register_tool(
        name="query_market_data",
        description="Queries market candles and computes quantitative volatility, ATR, moving average slopes, and trend regime.",
        parameters={
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "default": "BTCUSDT", "description": "Market ticker symbol."},
                "timeframe": {"type": "string", "default": "1h", "description": "Bar resolution (1m, 5m, 15m, 1h, 1d)."},
                "limit": {"type": "integer", "default": 100, "description": "Number of recent bars to inspect."},
            },
            "required": ["symbol"],
        },
        handler=query_market_data,
    )

    harness.register_tool(
        name="inspect_chart_context",
        description="Performs localized chart inspection around a specific price action point, extracting support/resistance levels, swing points, and candle formations.",
        parameters={
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "default": "BTCUSDT", "description": "Market ticker symbol."},
                "timeframe": {"type": "string", "default": "1h", "description": "Bar resolution."},
                "timestamp": {"type": "string", "description": "Optional ISO timestamp to center chart context around."},
                "window_bars": {"type": "integer", "default": 25, "description": "Number of bars in analysis window."},
            },
            "required": ["symbol"],
        },
        handler=inspect_chart_context,
    )
