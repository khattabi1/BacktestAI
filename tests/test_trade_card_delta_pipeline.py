"""
Unit Tests for TradeCard Schema and Zero-Latency Delta Pipeline.
Verifies:
1. TradeCard, MathContext, VisualContext schema validation.
2. Local calculation of MathContext (EMA position, RSI, ATR, R-multiples, MAE/MFE).
3. Delta batching: only status == 'RAW' trades are flagged for visual processing.
4. Cached status == 'PROCESSED' cards are preserved and never re-queued for image vision.
5. Base64 canvas snapshot is cleared/purged upon processing to prevent memory bloat.
"""

import pytest
from datetime import datetime, timezone
from typing import List, Dict, Any

from packages.domain.domain.trade_card import (
    TradeCard,
    MathContext,
    VisualContext,
    TradeStatus,
    TradeCardDeltaBatch,
)
from apps.api.src.services.ai_watcher_service import AIWatcherService


def test_trade_card_schema_validation():
    math_ctx = MathContext(
        price_vs_ema50="ABOVE",
        price_vs_ema200="ABOVE",
        rsi_14=64.5,
        atr_14=12.4,
        atr_regime="NORMAL",
        distance_to_sl_pips=25.0,
        rr_ratio=2.5,
    )
    visual_ctx = VisualContext(
        setup_archetype="PULLBACK_RETEST",
        sl_placement_quality="STRUCTURAL_SWING",
        chart_summary="Clear retest of broken resistance on Gold 15m",
    )
    card = TradeCard(
        trade_id="trd_001",
        sequence_number=1,
        status=TradeStatus.PROCESSED,
        symbol="XAUUSD",
        direction="BUY",
        session="London",
        entry_price=2750.0,
        exit_price=2760.0,
        stop_loss=2745.0,
        take_profit=2765.0,
        lot_size=1.0,
        pnl=1000.0,
        pnl_r_multiple=2.0,
        mae_r=-0.3,
        mfe_r=2.2,
        hold_time_seconds=1800,
        math_context=math_ctx,
        visual_context=visual_ctx,
    )

    assert card.trade_id == "trd_001"
    assert card.status == TradeStatus.PROCESSED
    assert card.pnl_r_multiple == 2.0
    assert card.math_context.price_vs_ema50 == "ABOVE"
    assert card.visual_context.setup_archetype == "PULLBACK_RETEST"


def test_delta_batching_filters_only_raw_trades():
    # Trade 1 and 2 already processed; Trade 3 is newly closed (RAW)
    trades = [
        TradeCard(
            trade_id="trd_001",
            sequence_number=1,
            status=TradeStatus.PROCESSED,
            symbol="XAUUSD",
            direction="BUY",
            entry_price=2750.0,
            exit_price=2760.0,
            pnl=1000.0,
            pnl_r_multiple=2.0,
        ),
        TradeCard(
            trade_id="trd_002",
            sequence_number=2,
            status=TradeStatus.PROCESSED,
            symbol="XAUUSD",
            direction="SELL",
            entry_price=2765.0,
            exit_price=2770.0,
            pnl=-500.0,
            pnl_r_multiple=-1.0,
        ),
        TradeCard(
            trade_id="trd_003",
            sequence_number=3,
            status=TradeStatus.RAW,
            symbol="XAUUSD",
            direction="BUY",
            entry_price=2752.0,
            exit_price=2758.0,
            pnl=600.0,
            pnl_r_multiple=1.2,
            canvas_snapshot_base64="data:image/webp;base64,RAWIMAGEBYTES...",
        ),
    ]

    batch = TradeCardDeltaBatch(session_id="sess_replay_test", trades=trades)

    assert batch.total_trades == 3
    assert len(batch.unprocessed_trades) == 1
    assert batch.unprocessed_trades[0].trade_id == "trd_003"
    assert len(batch.processed_cards) == 2


def test_ai_watcher_service_computes_math_context_locally():
    service = AIWatcherService()

    raw_trade_data = {
        "trade_id": "trd_010",
        "symbol": "XAUUSD",
        "direction": "BUY",
        "entry_price": 2750.0,
        "exit_price": 2745.0,
        "stop_loss": 2745.0,
        "take_profit": 2765.0,
        "lot_size": 1.0,
        "pnl": -500.0,
        "mae_price": 2744.5,
        "mfe_price": 2753.0,
        "entry_time": "2026-10-30T10:00:00Z",
        "exit_time": "2026-10-30T10:25:00Z",
    }

    # Market context bars leading up to the trade
    market_bars = [
        {"close": 2740.0, "high": 2742.0, "low": 2738.0, "volume": 100},
        {"close": 2745.0, "high": 2748.0, "low": 2743.0, "volume": 150},
        {"close": 2750.0, "high": 2755.0, "low": 2748.0, "volume": 200},
    ]

    math_ctx = service.calculate_local_math_context(raw_trade_data, market_bars)

    assert isinstance(math_ctx, MathContext)
    # 3 bars are not enough for EMA50: report NEUTRAL instead of guessing
    assert math_ctx.price_vs_ema50 == "NEUTRAL"
    assert math_ctx.distance_to_sl_pips is not None
    assert math_ctx.distance_to_sl_pips > 0


def test_math_context_indicators_on_uptrend():
    service = AIWatcherService()
    # 250 rising bars: entry above both EMAs, RSI high, ATR populated
    market_bars = [
        {"close": 2500.0 + i, "high": 2501.0 + i, "low": 2499.0 + i}
        for i in range(250)
    ]
    raw_trade = {
        "symbol": "XAUUSD", "direction": "BUY",
        "entry_price": 2755.0, "stop_loss": 2750.0, "take_profit": 2770.0,
    }
    ctx = service.calculate_local_math_context(raw_trade, market_bars)
    assert ctx.price_vs_ema50 == "ABOVE"
    assert ctx.price_vs_ema200 == "ABOVE"
    assert ctx.rsi_14 is not None and ctx.rsi_14 > 70
    assert ctx.atr_14 is not None and ctx.atr_14 > 0
    assert ctx.rr_ratio == 3.0


def test_r_multiple_from_real_prices():
    assert AIWatcherService.calculate_r_multiple(
        {"direction": "BUY", "entry_price": 100.0, "exit_price": 104.0, "stop_loss": 98.0}
    ) == 2.0
    assert AIWatcherService.calculate_r_multiple(
        {"direction": "SELL", "entry_price": 100.0, "exit_price": 101.0, "stop_loss": 101.0}
    ) == -1.0
    assert AIWatcherService.calculate_r_multiple(
        {"direction": "BUY", "entry_price": 100.0, "exit_price": 104.0}
    ) is None


def test_ai_watcher_service_delta_caching_lifecycle():
    service = AIWatcherService()
    session_id = "sess_delta_cache_lifecycle"

    # User executes 2 trades
    t1 = TradeCard(
        trade_id="t1",
        sequence_number=1,
        status=TradeStatus.RAW,
        symbol="XAUUSD",
        direction="BUY",
        entry_price=2750.0,
        exit_price=2760.0,
        pnl=1000.0,
        pnl_r_multiple=2.0,
        canvas_snapshot_base64="data:image/webp;base64,RAW1...",
    )
    t2 = TradeCard(
        trade_id="t2",
        sequence_number=2,
        status=TradeStatus.RAW,
        symbol="XAUUSD",
        direction="BUY",
        entry_price=2755.0,
        exit_price=2765.0,
        pnl=1000.0,
        pnl_r_multiple=2.0,
        canvas_snapshot_base64="data:image/webp;base64,RAW2...",
    )

    # Cache them as processed with visual tags
    v_ctx = VisualContext(setup_archetype="MOMENTUM_BREAKOUT")
    processed_t1 = service.mark_trade_processed(t1, v_ctx)
    processed_t2 = service.mark_trade_processed(t2, v_ctx)

    service.save_to_session_cache(session_id, [processed_t1, processed_t2])

    # Now user executes Trade 3 (RAW) and clicks AI Watcher
    t3 = TradeCard(
        trade_id="t3",
        sequence_number=3,
        status=TradeStatus.RAW,
        symbol="XAUUSD",
        direction="SELL",
        entry_price=2760.0,
        exit_price=2750.0,
        pnl=1000.0,
        pnl_r_multiple=2.0,
        canvas_snapshot_base64="data:image/webp;base64,RAW3...",
    )

    incoming = [t1, t2, t3]
    merged_batch = service.resolve_delta_batch(session_id, incoming)

    # Trades 1 & 2 must be PROCESSED from cache, Trade 3 is RAW
    assert merged_batch.total_trades == 3
    assert len(merged_batch.unprocessed_trades) == 1
    assert merged_batch.unprocessed_trades[0].trade_id == "t3"
    assert merged_batch.processed_cards[0].status == TradeStatus.PROCESSED
    # Verify heavy base64 was cleared on processed cards to save memory
    assert merged_batch.processed_cards[0].canvas_snapshot_base64 is None

