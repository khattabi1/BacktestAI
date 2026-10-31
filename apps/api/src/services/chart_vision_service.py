"""
Chart Vision Service powered by Meta Muse Spark 1.3 Contributor.
Extracts price action visual context from clean canvas snapshots (candles, entry, SL, TP lines)
and merges the resulting VisualContext into the TradeCard, clearing heavy base64 strings.
"""

from __future__ import annotations
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

from packages.domain.domain.trade_card import (
    TradeCard,
    TradeStatus,
    VisualContext,
    MathContext,
)
from packages.agent.src.core.types import Message, Role
from packages.agent.src.adapters.meta_models import (
    MetaModelAdapter,
    MUSE_SPARK_CONTRIBUTOR_MODEL,
)

logger = logging.getLogger("backtest_ai.services.chart_vision")


class ChartVisionService:
    """
    Multimodal vision tagger using Meta Muse Spark 1.3 Contributor.
    """

    def __init__(self, adapter: Optional[MetaModelAdapter] = None) -> None:
        model_name = os.environ.get("META_MODEL_EXECUTOR", "muse-spark-1.3-contributor")
        self.adapter = adapter or MetaModelAdapter(default_model=model_name)

    async def tag_trade_card(self, trade: TradeCard) -> TradeCard:
        """
        Analyzes a single TradeCard's chart canvas snapshot via Muse Spark 1.3 Contributor,
        extracts structured VisualContext, marks status as PROCESSED, and frees base64 memory.
        """
        if trade.status == TradeStatus.PROCESSED:
            return trade

        # 1. Build prompt context
        math_desc = ""
        if trade.math_context:
            m = trade.math_context
            math_desc = (
                f"Math Context: price_vs_ema50={m.price_vs_ema50}, "
                f"price_vs_ema200={m.price_vs_ema200}, "
                f"distance_to_sl_pips={m.distance_to_sl_pips}, "
                f"rr_ratio={m.rr_ratio}, atr_regime={m.atr_regime}."
            )

        prompt_text = (
            f"You are Meta Muse Spark 1.3 Contributor, an expert quant and technical chart analyst.\n"
            f"Inspect the attached chart canvas snapshot for trade {trade.trade_id}:\n"
            f"- Symbol: {trade.symbol}\n"
            f"- Direction: {trade.direction}\n"
            f"- Entry Price: {trade.entry_price}\n"
            f"- Stop Loss: {trade.stop_loss}\n"
            f"- Take Profit: {trade.take_profit}\n"
            f"- PnL (R-multiple): {trade.pnl_r_multiple}R\n"
            f"{math_desc}\n\n"
            f"Respond ONLY with a valid JSON object with these exact keys:\n"
            f'{{\n'
            f'  "setup_archetype": "IMPULSE_BREAKOUT" | "PULLBACK_RETEST" | "LIQUIDITY_SWEEP" | "RANGE_FADE",\n'
            f'  "wick_rejection": "BULLISH_WICK" | "BEARISH_WICK" | "NONE",\n'
            f'  "sl_placement_quality": "STRUCTURAL_SWING" | "TIGHT_INSIDE_NOISE" | "ARBITRARY",\n'
            f'  "chart_summary": "<one sentence describing the visual price action and level reaction>"\n'
            f'}}'
        )

        media_payload = None
        if trade.canvas_snapshot_base64:
            media_payload = [{"mime_type": "image/webp", "data": trade.canvas_snapshot_base64}]

        message = Message(
            role=Role.USER,
            content=prompt_text,
            media=media_payload,
        )

        # 2. Call Meta Model Adapter
        content_parts: List[str] = []
        try:
            async for chunk in self.adapter.generate_turn([message], []):
                if chunk.content_delta:
                    content_parts.append(chunk.content_delta)

            raw_reply = "".join(content_parts).strip()
            visual_ctx = self._parse_spark_json(raw_reply, trade)

        except Exception as exc:
            logger.warning(f"[CHART VISION] Error calling Muse Spark: {exc}. Using heuristic fallback.")
            visual_ctx = self._generate_heuristic_visual_context(trade)

        # 3. Transition to PROCESSED and clear heavy base64 to preserve memory
        updated_data = trade.model_dump()
        updated_data["status"] = TradeStatus.PROCESSED
        updated_data["visual_context"] = visual_ctx
        updated_data["canvas_snapshot_base64"] = None  # Crucial memory purge

        return TradeCard(**updated_data)

    async def process_trade_batch(self, trades: List[TradeCard]) -> List[TradeCard]:
        """
        Processes a sequence of trades, filtering only RAW items to respect Delta Caching.
        """
        results: List[TradeCard] = []
        for trade in trades:
            if trade.status == TradeStatus.RAW:
                processed = await self.tag_trade_card(trade)
                results.append(processed)
            else:
                results.append(trade)
        return results

    def _parse_spark_json(self, raw_reply: str, trade: TradeCard) -> VisualContext:
        """
        Extracts JSON block from model response or falls back to heuristic context.
        """
        # Look for JSON between code fences or curly braces
        json_match = re.search(r"\{.*\}", raw_reply, re.DOTALL)
        if json_match:
            try:
                parsed = json.loads(json_match.group(0))
                return VisualContext(
                    setup_archetype=parsed.get("setup_archetype", "IMPULSE_BREAKOUT"),
                    wick_rejection=parsed.get("wick_rejection", "NONE"),
                    sl_placement_quality=parsed.get("sl_placement_quality", "STRUCTURAL_SWING"),
                    chart_summary=parsed.get("chart_summary", "Chart analyzed by Meta Muse Spark 1.3 Contributor."),
                )
            except Exception as e:
                logger.warning(f"[CHART VISION] JSON parse error: {e}")

        return self._generate_heuristic_visual_context(trade)

    def _generate_heuristic_visual_context(self, trade: TradeCard) -> VisualContext:
        """
        Deterministic heuristic fallback when API response is unavailable.
        """
        math = trade.math_context
        archetype = "PRICE_ACTION"
        sl_quality = "STRUCTURAL_SWING"

        if math:
            if math.price_vs_ema50 == "ABOVE" and trade.direction == "BUY":
                archetype = "TREND_CONTINUATION"
            elif math.price_vs_ema50 == "BELOW" and trade.direction == "SELL":
                archetype = "TREND_CONTINUATION"
            elif math.atr_regime == "HIGH_VOLATILITY":
                archetype = "MOMENTUM_BREAKOUT"

            if math.distance_to_sl_pips is not None and math.distance_to_sl_pips < 15.0:
                sl_quality = "TIGHT_INSIDE_NOISE"

        return VisualContext(
            setup_archetype=archetype,
            wick_rejection="NONE",
            sl_placement_quality=sl_quality,
            chart_summary=f"Automated price action classification for {trade.symbol} {trade.direction}.",
        )

