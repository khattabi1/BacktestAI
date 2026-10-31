"""
AI Watcher & Behavioral Coach Router.
Endpoint: POST /api/v1/ai-watcher/diagnose
Analyzes manual backtest replay sessions to tell the trader:
1. What to Respect (edge, discipline, winning setup patterns)
2. What to Remove (overtrading, revenge trading, lot size spikes, FOMO)
3. What to Adjust (stop loss placement, ATR breathing room, risk sizing)
Powered by Meta Muse Spark 1.3 Contributor.
"""

from __future__ import annotations
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, BackgroundTasks, HTTPException, status

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

logger = logging.getLogger("backtest_ai.routers.ai_watcher")

router = APIRouter(prefix="/ai-watcher", tags=["AI Watcher & Behavioral Coach"])


class CoachFeedbackItem(BaseModel):
    title: str
    detail: str


class SaveTradeCardRequest(BaseModel):
    session_id: str
    trade: Dict[str, Any]


@router.post("/trade-card")
async def save_trade_card_endpoint(req: SaveTradeCardRequest, background_tasks: BackgroundTasks):
    """
    Ingests a closed trade from Backtest Studio:
    1. Writes the canvas WebP snapshot to data/uploads/screenshots/{session_id}/{trade_id}.webp
    2. Computes the local MathContext (EMA50/200, RSI14, ATR14, SL distance, RR) and the R-multiple
    3. Persists the trade + card JSON to the database
    4. Runs Chart Vision (Muse Spark) on the snapshot in the background and updates the card
    """
    from apps.api.src.db.repository import db_repo
    from apps.api.src.services.ai_watcher_service import ai_watcher_service

    session_id = req.session_id
    trade_data = dict(req.trade)
    trade_id = str(trade_data.get("trade_id") or trade_data.get("id") or "trd")
    trade_data["trade_id"] = trade_id
    # Stable primary key so the background vision update overwrites the same row
    trade_data["id"] = f"{session_id}:{trade_id}"[:36]

    # 1. Screenshot to disk (kept in memory only for the vision call)
    b64 = trade_data.pop("canvas_snapshot_base64", None) or trade_data.pop("screenshot_base64", None)
    screenshot_path = None
    if b64:
        from apps.api.src.services.screenshot_storage import save_screenshot_file
        screenshot_path = save_screenshot_file(session_id, trade_id, b64)
        trade_data["screenshot_path"] = screenshot_path

    # 2. Local math context from the bars that closed before entry
    timeframe = str(trade_data.get("timeframe") or "1h")
    bars = ai_watcher_service.load_bars_before_entry(
        symbol=str(trade_data.get("symbol", "XAUUSD")),
        timeframe=timeframe,
        entry_time=trade_data.get("entry_time"),
    )
    card = TradeCard(
        trade_id=trade_id,
        sequence_number=int(trade_data.get("sequence_number", 1)),
        status=TradeStatus.RAW,
        symbol=str(trade_data.get("symbol", "XAUUSD")),
        direction=str(trade_data.get("direction", "BUY")).upper(),
        entry_price=float(trade_data.get("entry_price", 0.0)),
        exit_price=float(trade_data.get("exit_price", 0.0)),
        stop_loss=float(trade_data["stop_loss"]) if trade_data.get("stop_loss") is not None else None,
        take_profit=float(trade_data["take_profit"]) if trade_data.get("take_profit") is not None else None,
        lot_size=float(trade_data.get("lot_size", trade_data.get("quantity", 1.0))),
        pnl=float(trade_data.get("pnl", 0.0)),
        pnl_r_multiple=ai_watcher_service.calculate_r_multiple(trade_data) or 0.0,
        screenshot_path=screenshot_path,
        math_context=ai_watcher_service.calculate_local_math_context(trade_data, bars),
    )

    # 3. Persist trade + card (without base64) and cache it
    _persist_card(session_id, trade_data, card)

    # 4. Vision tagging runs after the response so the replay never waits on the model
    if b64:
        background_tasks.add_task(_tag_card_with_vision, session_id, trade_data, card, b64)
    else:
        ai_watcher_service.save_to_session_cache(session_id, [ai_watcher_service.mark_trade_processed(card)])

    return {
        "status": "success",
        "trade_id": trade_id,
        "screenshot_path": screenshot_path,
        "math_context": card.math_context.model_dump() if card.math_context else None,
        "pnl_r_multiple": card.pnl_r_multiple,
        "vision": "queued" if b64 else "skipped",
    }


def _persist_card(session_id: str, trade_data: Dict[str, Any], card: TradeCard) -> None:
    from apps.api.src.db.repository import db_repo
    from apps.api.src.services.ai_watcher_service import ai_watcher_service

    card_json = card.model_copy(update={"canvas_snapshot_base64": None}).model_dump_json()
    try:
        db_repo.save_session_trade(session_id, {**trade_data, "trade_card_json": card_json})
    except Exception as e:
        logger.error(f"[AI Watcher] Failed to persist trade {card.trade_id} to DB: {e}")
    ai_watcher_service.save_to_session_cache(session_id, [card.model_copy(update={"canvas_snapshot_base64": None})])


async def _tag_card_with_vision(session_id: str, trade_data: Dict[str, Any], card: TradeCard, b64: str) -> None:
    """Background task: Muse Spark reads the chart snapshot and fills VisualContext."""
    from apps.api.src.services.chart_vision_service import ChartVisionService

    try:
        tagged = await ChartVisionService().tag_trade_card(card.model_copy(update={"canvas_snapshot_base64": b64}))
    except Exception as e:
        logger.error(f"[AI Watcher] Vision tagging failed for {card.trade_id}: {e}")
        return
    _persist_card(session_id, trade_data, tagged)


@router.delete("/sessions/{session_id}")
async def delete_replay_session_endpoint(session_id: str):
    """
    Deletes a Replay Studio session with cascade cleanup:
    trades, journal entries, screenshots on disk, and the in-memory trade card cache.
    """
    from apps.api.src.db.repository import db_repo
    deleted = db_repo.delete_replay_session(session_id)
    return {"status": "deleted" if deleted else "not_found", "session_id": session_id}


class DiagnoseRequest(BaseModel):
    session_id: str
    trades: List[TradeCard]


class DiagnoseResponse(BaseModel):
    session_id: str
    total_trades_analyzed: int
    win_rate: float
    net_pnl_r: float
    what_to_respect: List[CoachFeedbackItem]
    what_to_remove: List[CoachFeedbackItem]
    what_to_adjust: List[CoachFeedbackItem]
    overall_coach_summary: str
    model_used: str


@router.post("/diagnose", response_model=DiagnoseResponse)
async def diagnose_session(req: DiagnoseRequest):
    """
    Analyzes closed replay trades and delivers the 3-part Behavioral Coach diagnostic.
    """
    if not req.trades:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 1 closed trade is required for behavioral coaching.",
        )

    # 1. Compute macro stats
    # Use the analyzed cards (vision + math context) instead of what the browser sent
    from apps.api.src.services.ai_watcher_service import ai_watcher_service
    trades = ai_watcher_service.enrich_trades(req.session_id, req.trades)

    total = len(trades)
    winning = sum(1 for t in trades if t.pnl > 0)
    win_rate = round((winning / total) * 100.0, 1) if total > 0 else 0.0
    net_pnl_r = round(sum(t.pnl_r_multiple for t in trades), 2)

    # 2. Format trades summary for Meta Muse Spark 1.3 Contributor
    trades_summary_lines: List[str] = []
    for i, t in enumerate(trades, 1):
        m_ctx = t.math_context
        v_ctx = t.visual_context
        line = (
            f"Trade #{i} [{t.direction} {t.symbol}]: PnL={t.pnl_r_multiple:+.2f}R, Lot={t.lot_size}, "
            f"SL={t.stop_loss}, TP={t.take_profit}. "
        )
        if m_ctx:
            line += (
                f"Math: vsEMA50={m_ctx.price_vs_ema50}, vsEMA200={m_ctx.price_vs_ema200}, RSI14={m_ctx.rsi_14}, "
                f"DistToSL={m_ctx.distance_to_sl_pips}pips, RR={m_ctx.rr_ratio}, Volatility={m_ctx.atr_regime}. "
            )
        if v_ctx:
            line += (
                f"Visual: Archetype={v_ctx.setup_archetype}, Wick={v_ctx.wick_rejection}, "
                f"SL_Quality={v_ctx.sl_placement_quality}, Chart='{v_ctx.chart_summary}'."
            )
        trades_summary_lines.append(line)

    prompt_text = (
        f"You are Meta Muse Spark 1.3 Contributor, an institutional trading coach and quantitative psychologist.\n"
        f"Review this trader's manual backtest session ({total} trades, Win Rate: {win_rate}%, Net PnL: {net_pnl_r}R):\n\n"
        + "\n".join(trades_summary_lines)
        + "\n\n"
        f"Diagnose the trader's edge and behavioral psychology into exactly 3 categories:\n"
        f"1. What to Respect (strengths, disciplined patience, well-executed setups)\n"
        f"2. What to Remove (toxic biases, revenge trading after losses, sudden lot size doubling, FOMO)\n"
        f"3. What to Adjust (stop loss breathing room, take profit targets, risk alignment)\n\n"
        f"Respond ONLY with a valid JSON object matching this schema:\n"
        f'{{\n'
        f'  "what_to_respect": [{{"title": "...", "detail": "..."}}],\n'
        f'  "what_to_remove": [{{"title": "...", "detail": "..."}}],\n'
        f'  "what_to_adjust": [{{"title": "...", "detail": "..."}}],\n'
        f'  "overall_coach_summary": "..."\n'
        f'}}'
    )

    model_name = os.environ.get("META_MODEL_ADVISER", os.environ.get("META_MODEL_EXECUTOR", "muse-spark-1.3-contributor"))
    adapter = MetaModelAdapter(default_model=model_name)
    msg = Message(role=Role.USER, content=prompt_text)

    # 3. Call model
    content_parts: List[str] = []
    model_used = model_name
    try:
        async for chunk in adapter.generate_turn([msg], []):
            if chunk.content_delta:
                content_parts.append(chunk.content_delta)

        raw_reply = "".join(content_parts).strip()
        data = _extract_coach_json(raw_reply)

    except Exception as exc:
        logger.warning(f"[AI WATCHER] Error calling Meta Model API: {exc}. Using heuristic fallback.")
        data = _generate_heuristic_coach_feedback(trades, win_rate, net_pnl_r)
        model_used = f"{model_name} (Local Heuristic Fallback)"

    if not data:
        data = _generate_heuristic_coach_feedback(trades, win_rate, net_pnl_r)
        model_used = f"{model_name} (Local Heuristic Fallback)"

    return DiagnoseResponse(
        session_id=req.session_id,
        total_trades_analyzed=total,
        win_rate=win_rate,
        net_pnl_r=net_pnl_r,
        what_to_respect=[CoachFeedbackItem(**item) for item in data.get("what_to_respect", [])],
        what_to_remove=[CoachFeedbackItem(**item) for item in data.get("what_to_remove", [])],
        what_to_adjust=[CoachFeedbackItem(**item) for item in data.get("what_to_adjust", [])],
        overall_coach_summary=data.get(
            "overall_coach_summary",
            f"Analyzed {total} trades with {win_rate}% win rate and {net_pnl_r}R net profitability."
        ),
        model_used=model_used,
    )


def _extract_coach_json(raw_text: str) -> Optional[Dict[str, Any]]:
    """Extracts JSON block from model response."""
    match = re.search(r"\{.*\}", raw_text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return None


def _generate_heuristic_coach_feedback(
    trades: List[TradeCard],
    win_rate: float,
    net_pnl: float,
) -> Dict[str, Any]:
    """Deterministic rule-based behavioral coach fallback."""
    respect: List[Dict[str, str]] = []
    remove: List[Dict[str, str]] = []
    adjust: List[Dict[str, str]] = []

    # Check for winning discipline
    winning_trades = [t for t in trades if t.pnl_r_multiple > 0]
    if winning_trades:
        best = max(winning_trades, key=lambda t: t.pnl_r_multiple)
        respect.append({
            "title": f"Disciplined {best.direction} executions",
            "detail": f"Best trade yielded +{best.pnl_r_multiple:.2f}R following trend structure.",
        })
    else:
        respect.append({
            "title": "Risk containment",
            "detail": "Adhered to stop-loss parameters without blowing trading capital.",
        })

    # Check for lot size spikes (revenge sizing)
    lot_sizes = [t.lot_size for t in trades]
    if lot_sizes and max(lot_sizes) > (min(lot_sizes) * 1.5):
        remove.append({
            "title": "Inconsistent lot size spiking",
            "detail": f"Lot sizes ranged from {min(lot_sizes)} to {max(lot_sizes)}. Maintain flat 1% risk per trade.",
        })
    else:
        remove.append({
            "title": "Chasing extended candles",
            "detail": "Avoid opening market orders after 3 consecutive impulse candles without a pullback.",
        })

    # Check for tight stop loss
    tight_sl_count = sum(
        1 for t in trades
        if t.math_context and t.math_context.distance_to_sl_pips and t.math_context.distance_to_sl_pips < 25.0
    )
    if tight_sl_count > 0:
        adjust.append({
            "title": "Stop loss inside market noise",
            "detail": f"{tight_sl_count} trades placed stop losses <25 pips on Gold, causing premature wick stops.",
        })
    else:
        adjust.append({
            "title": "Take profit extension",
            "detail": "Target 2.0R to 2.5R to maximize positive asymmetry during trending sessions.",
        })

    return {
        "what_to_respect": respect,
        "what_to_remove": remove,
        "what_to_adjust": adjust,
        "overall_coach_summary": (
            f"Session yielded {win_rate}% win rate with {net_pnl}R net outcome. "
            "Eliminate lot size variance and give stop losses structural breathing room."
        ),
    }

