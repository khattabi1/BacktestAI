"""
Unit Tests for ChartVisionService & Muse Spark 1.3 Contributor Multimodal Tagging.
Verifies:
1. Ingesting clean canvas snapshot (showing candles, entry, SL, TP lines).
2. Calling Muse Spark 1.3 Contributor with multimodal image payload + OHLCV numbers.
3. Extracting structured VisualContext (setup_archetype, wick_rejection, sl_placement_quality).
4. Merging VisualContext into TradeCard and transitioning status to PROCESSED.
5. Verification that heavy base64 snapshot is cleared once tagged.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Dict, Any

from packages.domain.domain.trade_card import (
    TradeCard,
    TradeStatus,
    MathContext,
    VisualContext,
)
from packages.agent.src.core.types import ModelChunk
from apps.api.src.services.chart_vision_service import ChartVisionService


@pytest.fixture
def sample_raw_trade() -> TradeCard:
    return TradeCard(
        trade_id="trd_test_vision_01",
        sequence_number=1,
        status=TradeStatus.RAW,
        symbol="XAUUSD",
        direction="BUY",
        entry_price=2755.0,
        exit_price=2765.0,
        stop_loss=2748.0,
        take_profit=2770.0,
        pnl=1000.0,
        pnl_r_multiple=1.43,
        canvas_snapshot_base64="data:image/webp;base64,UklGRkAAAABXRUJQVlA4ID...",
        math_context=MathContext(
            price_vs_ema50="ABOVE",
            price_vs_ema200="ABOVE",
            distance_to_sl_pips=70.0,
            rr_ratio=2.14,
        ),
    )


@pytest.mark.asyncio
async def test_chart_vision_service_mocked_tagging(sample_raw_trade: TradeCard):
    service = ChartVisionService()

    # Mock Meta Muse Spark streaming response yielding structured JSON
    spark_json_output = (
        '{"setup_archetype": "IMPULSE_BREAKOUT", '
        '"wick_rejection": "BULLISH_WICK", '
        '"sl_placement_quality": "STRUCTURAL_SWING", '
        '"chart_summary": "Strong bullish momentum breakout above London resistance."}'
    )

    async def mock_generate_turn(messages, tools):
        yield ModelChunk(thought_delta="Inspecting candle geometry at entry...")
        yield ModelChunk(content_delta=spark_json_output)
        yield ModelChunk(is_finished=True)

    with patch.object(service.adapter, "generate_turn", side_effect=mock_generate_turn):
        tagged_trade = await service.tag_trade_card(sample_raw_trade)

        assert tagged_trade.status == TradeStatus.PROCESSED
        assert tagged_trade.visual_context is not None
        assert tagged_trade.visual_context.setup_archetype == "IMPULSE_BREAKOUT"
        assert tagged_trade.visual_context.wick_rejection == "BULLISH_WICK"
        assert tagged_trade.visual_context.sl_placement_quality == "STRUCTURAL_SWING"
        assert "London resistance" in tagged_trade.visual_context.chart_summary
        # Memory safety: base64 snapshot must be purged
        assert tagged_trade.canvas_snapshot_base64 is None


@pytest.mark.asyncio
async def test_chart_vision_service_offline_fallback(sample_raw_trade: TradeCard):
    # Tests that when Meta API has network failure, service falls back gracefully
    service = ChartVisionService()

    async def mock_generate_turn_error(messages, tools):
        yield ModelChunk(content_delta="\n[Meta Connection Error: Network down]", is_finished=True)

    with patch.object(service.adapter, "generate_turn", side_effect=mock_generate_turn_error):
        fallback_trade = await service.tag_trade_card(sample_raw_trade)

        assert fallback_trade.status == TradeStatus.PROCESSED
        assert fallback_trade.visual_context is not None
        # Heuristic fallback archetype determined by math context
        assert fallback_trade.visual_context.setup_archetype in (
            "TREND_CONTINUATION",
            "MOMENTUM_BREAKOUT",
            "PRICE_ACTION",
        )
        assert fallback_trade.canvas_snapshot_base64 is None


@pytest.mark.asyncio
async def test_chart_vision_service_batch_processing(sample_raw_trade: TradeCard):
    service = ChartVisionService()

    # Trade 1 is RAW, Trade 2 is already PROCESSED
    t2 = TradeCard(
        trade_id="trd_already_done",
        sequence_number=2,
        status=TradeStatus.PROCESSED,
        symbol="XAUUSD",
        direction="SELL",
        entry_price=2760.0,
        exit_price=2750.0,
        pnl=1000.0,
        visual_context=VisualContext(setup_archetype="RANGE_FADE"),
    )

    trades = [sample_raw_trade, t2]

    with patch.object(service, "tag_trade_card", wraps=service.tag_trade_card) as mock_tag:
        processed_batch = await service.process_trade_batch(trades)

        assert len(processed_batch) == 2
        # Only the RAW trade should have invoked tag_trade_card!
        assert mock_tag.call_count == 1
        assert processed_batch[0].status == TradeStatus.PROCESSED
        assert processed_batch[1].status == TradeStatus.PROCESSED

