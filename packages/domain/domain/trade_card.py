"""
TradeCard Domain Schema and Delta Batching Models.
Defines lightweight ~200-token structured representations of closed replay trades
for the AI Watcher behavioral coach and AI Strategy Cloner.
"""

from __future__ import annotations
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TradeStatus(str, Enum):
    RAW = "RAW"
    PROCESSED = "PROCESSED"


class MathContext(BaseModel):
    """Local mathematical context computed without API overhead."""
    price_vs_ema50: str = "NEUTRAL"  # ABOVE, BELOW, NEAR
    price_vs_ema200: str = "NEUTRAL"  # ABOVE, BELOW, NEAR
    rsi_14: Optional[float] = None
    atr_14: Optional[float] = None
    atr_regime: Optional[str] = "NORMAL"  # LOW_VOLATILITY, NORMAL, HIGH_VOLATILITY
    distance_to_sl_pips: Optional[float] = None
    rr_ratio: Optional[float] = None


class VisualContext(BaseModel):
    """Multimodal visual price action context extracted via Muse Spark 1.3 Contributor."""
    setup_archetype: Optional[str] = None  # IMPULSE_BREAKOUT, PULLBACK_RETEST, LIQUIDITY_SWEEP, RANGE_FADE
    wick_rejection: Optional[str] = None  # BULLISH_WICK, BEARISH_WICK, NONE
    sl_placement_quality: Optional[str] = None  # STRUCTURAL_SWING, TIGHT_INSIDE_NOISE, ARBITRARY
    chart_summary: Optional[str] = None


class TradeCard(BaseModel):
    """
    Lightweight structured card representing a single replay trade.
    Once processed, heavy base64 canvas snapshot is cleared to maintain zero-latency memory.
    """
    trade_id: str
    sequence_number: int = 1
    status: TradeStatus = TradeStatus.RAW
    symbol: str = "XAUUSD"
    direction: str = "BUY"  # BUY, SELL
    session: Optional[str] = None  # London, New York, Asian
    entry_price: float
    exit_price: float
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    lot_size: float = 1.0
    pnl: float = 0.0
    pnl_r_multiple: float = 0.0
    mae_r: Optional[float] = None
    mfe_r: Optional[float] = None
    hold_time_seconds: Optional[int] = None
    canvas_snapshot_base64: Optional[str] = None
    screenshot_path: Optional[str] = None
    math_context: Optional[MathContext] = None
    visual_context: Optional[VisualContext] = None
    voice_note: Optional[str] = None


class TradeCardDeltaBatch(BaseModel):
    """
    Delta batch isolating newly closed (RAW) trades from previously cached (PROCESSED) cards.
    """
    session_id: str
    trades: List[TradeCard] = Field(default_factory=list)

    @property
    def total_trades(self) -> int:
        return len(self.trades)

    @property
    def unprocessed_trades(self) -> List[TradeCard]:
        return [t for t in self.trades if t.status == TradeStatus.RAW]

    @property
    def processed_cards(self) -> List[TradeCard]:
        return [t for t in self.trades if t.status == TradeStatus.PROCESSED]

