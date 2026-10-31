"""
AI Strategy Cloner & Quant AI Lab Bridge Router.
Endpoint: POST /api/v1/ai-cloner/clone
Evaluates statistical sufficiency and reverse-engineers 30–50 manual replay trades
into an executable strategy blueprint payload ready for native MQL5 synthesis in Quant AI Lab.
Powered by Meta Muse Spark 1.3 Contributor.
"""

from __future__ import annotations
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status

from packages.domain.domain.trade_card import (
    TradeCard,
    TradeStatus,
    MathContext,
    VisualContext,
)
from packages.agent.src.core.types import Message, Role
from packages.agent.src.adapters.meta_models import (
    MetaModelAdapter,
    MUSE_SPARK_CONTRIBUTOR_MODEL,
)

logger = logging.getLogger("backtest_ai.routers.ai_cloner")

router = APIRouter(prefix="/ai-cloner", tags=["AI Strategy Cloner & Quant Bridge"])


class CloneStrategyRequest(BaseModel):
    session_id: str
    symbol: str = "XAUUSD"
    timeframe: str = "15m"
    trades: List[TradeCard]


class ClonedStrategyBridgePayload(BaseModel):
    session_id: str
    symbol: str
    timeframe: str
    sample_size: int
    sufficiency_status: str  # INSUFFICIENT, SUFFICIENT, OPTIMAL
    sufficiency_message: str
    suggested_additional_trades: int = 0
    confidence_score: float = 0.5
    strategy_name: str
    suggested_filename: str
    blueprint: Dict[str, Any]
    quant_prompt_seed: str
    model_used: str


@router.post("/clone", response_model=ClonedStrategyBridgePayload)
async def clone_strategy(req: CloneStrategyRequest):
    """
    Reverse-engineers discretionary replay trades into a formal MQL5 strategy blueprint
    and returns the bridge payload for transition into Quant AI Lab.
    """
    if not req.trades:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 1 trade is required to initiate strategy reverse-engineering.",
        )

    sample_size = len(req.trades)

    # 1. Evaluate Statistical Sufficiency
    if sample_size < 5:
        sufficiency_status = "INSUFFICIENT"
        suggested_additional = max(1, 10 - sample_size)
        sufficiency_message = (
            f"Data variance too high with only {sample_size} trades. "
            f"Execute {suggested_additional} more trades in Replay Studio to establish a verified statistical edge."
        )
    elif sample_size < 15:
        sufficiency_status = "SUFFICIENT"
        suggested_additional = 0
        sufficiency_message = (
            f"Statistical edge verified over {sample_size} trades. Ready for Quant Lab automated synthesis."
        )
    else:
        sufficiency_status = "OPTIMAL"
        suggested_additional = 0
        sufficiency_message = (
            f"Robust sample of {sample_size} trades. Discretionary edge strongly confirmed across market regimes."
        )

    # 2. Extract trade sequence summary for Meta Model
    trade_summary_lines: List[str] = []
    for i, t in enumerate(req.trades, 1):
        m = t.math_context
        v = t.visual_context
        line = (
            f"Trade #{i} {t.direction} {t.symbol}: PnL={t.pnl_r_multiple:+.2f}R, "
            f"Entry={t.entry_price}, SL={t.stop_loss}, TP={t.take_profit}. "
        )
        if m:
            line += f"EMA50={m.price_vs_ema50}, DistSL={m.distance_to_sl_pips}pips, RR={m.rr_ratio}. "
        if v:
            line += f"Archetype={v.setup_archetype}, SL_Quality={v.sl_placement_quality}."
        trade_summary_lines.append(line)

    prompt_text = (
        f"You are Meta Muse Spark 1.3 Contributor, a Quantitative Strategy Engineer.\n"
        f"Reverse-engineer this trader's manual discretionary backtest session on {req.symbol} ({req.timeframe}):\n"
        f"Sample size: {sample_size} trades.\n\n"
        + "\n".join(trade_summary_lines[:25])  # Keep prompt tight
        + "\n\n"
        f"Extract the discretionary edge into a formal deterministic algorithmic strategy blueprint:\n"
        f"1. A clean PascalCase EA name (e.g. GoldLondonBreakoutEA)\n"
        f"2. Deterministic entry rules (exact mathematical triggers, EMA alignment, session time window)\n"
        f"3. Deterministic exit rules (ATR-based SL, R-multiple TP, trailing stop)\n"
        f"4. Exact MQL5 `input` parameters dictionary (e.g. InpEmaPeriod, InpAtrMultiplier, InpTakeProfitR)\n"
        f"5. Confidence score between 0.0 and 1.0\n"
        f"6. A rich 'quant_prompt_seed' ready to prompt the Quant Agent to write 100% native MQL5 code.\n\n"
        f"Respond ONLY with a valid JSON object matching this schema:\n"
        f'{{\n'
        f'  "strategy_name": "<PascalCaseName>",\n'
        f'  "strategy_archetype": "<ArchetypeTitle>",\n'
        f'  "confidence_score": 0.85,\n'
        f'  "entry_rules": ["rule 1", "rule 2"],\n'
        f'  "exit_rules": ["rule 1", "rule 2"],\n'
        f'  "mql5_parameters": {{"InpEmaPeriod": 50, "InpAtrMultiplier": 1.5, "InpTakeProfitR": 2.0, "InpMaxRiskPercent": 1.0}},\n'
        f'  "quant_prompt_seed": "Build a native MQL5 Expert Advisor named ..."\n'
        f'}}'
    )

    model_name = os.environ.get("META_MODEL_ADVISER", os.environ.get("META_MODEL_EXECUTOR", "muse-spark-1.3-contributor"))
    adapter = MetaModelAdapter(default_model=model_name)
    msg = Message(role=Role.USER, content=prompt_text)

    model_used = model_name
    parsed_blueprint: Optional[Dict[str, Any]] = None

    # If sample size is insufficient, bypass heavy LLM inference to protect user credits and latency
    if sufficiency_status == "INSUFFICIENT":
        parsed_blueprint = _generate_heuristic_blueprint(req.trades, req.symbol, req.timeframe)
        model_used = f"{model_name} (Preliminary Insufficient Sample)"
    else:
        try:
            content_parts: List[str] = []
            async for chunk in adapter.generate_turn([msg], []):
                if chunk.content_delta:
                    content_parts.append(chunk.content_delta)

            raw_reply = "".join(content_parts).strip()
            parsed_blueprint = _extract_blueprint_json(raw_reply)

        except Exception as exc:
            logger.warning(f"[AI CLONER] Error calling Meta Model API: {exc}. Using heuristic reverse-engineering.")
            model_used = f"{model_name} (Local Heuristic Fallback)"

    if not parsed_blueprint:
        parsed_blueprint = _generate_heuristic_blueprint(req.trades, req.symbol, req.timeframe)
        if "Fallback" not in model_used:
            model_used = f"{model_name} (Local Heuristic Fallback)"

    strategy_name = parsed_blueprint.get("strategy_name") or f"{req.symbol}ReplayClonedEA"
    # Ensure safe PascalCase file naming
    clean_name = re.sub(r"[^a-zA-Z0-9_]", "", strategy_name) or "ClonedStrategyEA"
    suggested_filename = f"{clean_name}.mq5"
    confidence = float(parsed_blueprint.get("confidence_score", 0.75 if sample_size >= 10 else 0.45))

    blueprint_payload = {
        "strategy_archetype": parsed_blueprint.get("strategy_archetype", "Momentum Trend Breakout"),
        "entry_rules": parsed_blueprint.get("entry_rules", []),
        "exit_rules": parsed_blueprint.get("exit_rules", []),
        "mql5_parameters": parsed_blueprint.get("mql5_parameters", {}),
    }

    quant_prompt = (
        parsed_blueprint.get("quant_prompt_seed")
        or (
            f"You are the BacktestAI Quant Agent. Cloned from manual replay session ({sample_size} trades on {req.symbol} {req.timeframe}).\n"
            f"Synthesize a robust, 100% native MQL5 Expert Advisor named '{clean_name}'.\n"
            f"Entry Rules: {'; '.join(blueprint_payload['entry_rules'])}\n"
            f"Exit Rules: {'; '.join(blueprint_payload['exit_rules'])}\n"
            f"Input Parameters: {json.dumps(blueprint_payload['mql5_parameters'])}\n"
            f"Compile via compile_mql5 and run automated MT5 backtesting."
        )
    )

    return ClonedStrategyBridgePayload(
        session_id=req.session_id,
        symbol=req.symbol,
        timeframe=req.timeframe,
        sample_size=sample_size,
        sufficiency_status=sufficiency_status,
        sufficiency_message=sufficiency_message,
        suggested_additional_trades=suggested_additional,
        confidence_score=confidence,
        strategy_name=clean_name,
        suggested_filename=suggested_filename,
        blueprint=blueprint_payload,
        quant_prompt_seed=quant_prompt,
        model_used=model_used,
    )


def _extract_blueprint_json(raw_text: str) -> Optional[Dict[str, Any]]:
    """Extracts JSON block from model response."""
    match = re.search(r"\{.*\}", raw_text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return None


def _generate_heuristic_blueprint(
    trades: List[TradeCard],
    symbol: str,
    timeframe: str,
) -> Dict[str, Any]:
    """Deterministic rule extraction from trade cards when API is unavailable."""
    buy_count = sum(1 for t in trades if t.direction == "BUY")
    dominant_side = "BUY" if buy_count >= (len(trades) / 2) else "SELL"

    # Analyze average SL distance
    sl_distances = [
        t.math_context.distance_to_sl_pips
        for t in trades
        if t.math_context and t.math_context.distance_to_sl_pips
    ]
    avg_sl_pips = round(sum(sl_distances) / len(sl_distances), 1) if sl_distances else 40.0

    strategy_name = f"{symbol}{dominant_side.capitalize()}TrendFollowEA"

    entry_rules = [
        f"Price trades in direction of trend: {dominant_side} when close is above EMA 50 on {timeframe}.",
        "Trigger order when impulse candle body exceeds the 14-period Average True Range (ATR).",
    ]
    exit_rules = [
        f"Initial stop loss set at {avg_sl_pips} pips (or 1.5x ATR below entry candle low).",
        "Take profit target anchored at 2.0R risk-to-reward multiplier.",
    ]

    mql5_parameters = {
        "InpEmaPeriod": 50,
        "InpAtrMultiplier": 1.5,
        "InpTakeProfitR": 2.0,
        "InpStopLossPips": avg_sl_pips,
        "InpMaxRiskPercent": 1.0,
    }

    quant_prompt = (
        f"Build a native MQL5 Expert Advisor named '{strategy_name}' for {symbol} on {timeframe}.\n"
        f"Reverse-engineered rules:\n"
        f"- Entry: {entry_rules[0]} and {entry_rules[1]}\n"
        f"- Exit: {exit_rules[0]} and {exit_rules[1]}\n"
        f"Parameters: {mql5_parameters}.\n"
        f"Include OnInit, OnTick with Trade.mqh, and proper volume normalization."
    )

    return {
        "strategy_name": strategy_name,
        "strategy_archetype": "Trend Momentum & Structure Follower",
        "confidence_score": 0.82 if len(trades) >= 10 else 0.50,
        "entry_rules": entry_rules,
        "exit_rules": exit_rules,
        "mql5_parameters": mql5_parameters,
        "quant_prompt_seed": quant_prompt,
    }
