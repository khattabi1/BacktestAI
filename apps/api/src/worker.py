"""
ARQ Distributed Worker for Backtest-SI.
Executes compute-heavy quantitative backtests, parameter sweeps, and agent turns
in isolated background worker processes connected via Redis.
"""

from __future__ import annotations
import logging
import os
from typing import Any, Dict, Optional
from arq.connections import RedisSettings

logger = logging.getLogger("backtest_si.api.worker")

DEFAULT_REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")


async def startup(ctx: Dict[Any, Any]) -> None:
    """Worker startup hook: initializes services and logs status."""
    logger.info("[ARQ Worker] Background worker starting up...")
    os.environ["INSIDE_ARQ_WORKER"] = "1"
    # Initialize SQLite database if needed
    try:
        from apps.api.src.db import init_database
        init_database()
        logger.info("[ARQ Worker] SQLite database verified.")
    except Exception as e:
        logger.warning(f"[ARQ Worker] Database init warning: {e}")


async def shutdown(ctx: Dict[Any, Any]) -> None:
    """Worker shutdown hook: cleanup resources."""
    logger.info("[ARQ Worker] Background worker shutting down gracefully.")


async def ping_job(ctx: Dict[Any, Any]) -> Dict[str, Any]:
    """Health check ping job for verifying worker liveliness."""
    logger.info("[ARQ Worker] Ping job executed.")
    return {
        "status": "pong",
        "worker": "backtest-si-worker",
    }


async def run_backtest_job(ctx: Dict[Any, Any], req_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes a quantitative backtest job asynchronously.
    Saves results to the store and returns serialized performance metrics.
    """
    logger.info(f"[ARQ Worker] Starting backtest job for strategy: {req_data.get('strategy_id')}")
    from domain.models import BacktestRunRequest
    from apps.api.src.services.backtest_service import backtest_service

    req = BacktestRunRequest(**req_data)
    response = backtest_service.run_backtest(req)
    logger.info(f"[ARQ Worker] Backtest job completed successfully. Run ID: {response.id}")
    return response.model_dump(mode="json")


async def run_matrix_sweep_job(
    ctx: Dict[Any, Any],
    strategy_id: str = "rsi_mean_reversion",
    symbol: str = "BTCUSDT",
    timeframe: str = "1h",
    parameter_grid: Optional[Dict[str, Any]] = None,
    max_combinations: int = 6,
) -> Dict[str, Any]:
    """
    Executes a parameter matrix sweep across multiple hyperparameter values.
    """
    logger.info(f"[ARQ Worker] Starting matrix sweep job for strategy: {strategy_id}")
    from packages.agent.src.tools.execution import run_parameter_matrix_sweep

    result = await run_parameter_matrix_sweep(
        strategy_id=strategy_id,
        symbol=symbol,
        timeframe=timeframe,
        parameter_grid=parameter_grid,
        max_combinations=max_combinations,
    )
    logger.info(f"[ARQ Worker] Matrix sweep job completed. Best Sharpe: {result.get('best_configuration', {}).get('sharpe_ratio')}")
    return result


async def run_agent_turn_job(
    ctx: Dict[Any, Any],
    session_id: str,
    prompt: str,
    user_id: Optional[str] = "default_user",
    provider: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes an autonomous agent research step in the background.
    """
    logger.info(f"[ARQ Worker] Starting agent turn job for session: {session_id}")
    from apps.api.src.routers.agent import _get_or_create_harness
    from packages.agent.src.core.types import AgentState

    harness = _get_or_create_harness(session_id, user_id=user_id or "default_user", provider=provider)
    event_types: list[str] = []

    async for event in harness.run(user_prompt=prompt):
        event_types.append(event.event_type.value)

    logger.info(f"[ARQ Worker] Agent turn job completed for session: {session_id} (events: {len(event_types)})")
    return {
        "session_id": session_id,
        "state": harness.session.state.value,
        "is_waiting_for_user": harness.session.state == AgentState.WAITING_FOR_USER,
        "pending_interaction": harness.session.pending_interaction,
        "events_count": len(event_types),
        "history_count": len(harness.session.history),
    }


async def sync_market_data_job(
    ctx: Dict[Any, Any],
    symbol: str,
    start_date_str: str,
    end_date_str: str,
    terminal_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes a high-performance market data sync in the background ARQ worker.
    Pulls native MT5 candles and regenerates multi-timeframe pyramids without blocking FastAPI.
    """
    from datetime import datetime
    logger.info(f"[ARQ Worker] Starting background Market Data Sync for {symbol} ({start_date_str} -> {end_date_str})")
    
    from apps.api.src.routers.market_data import data_service
    
    s_dt = datetime.fromisoformat(start_date_str.replace("Z", "+00:00")).replace(tzinfo=None)
    e_dt = datetime.fromisoformat(end_date_str.replace("Z", "+00:00")).replace(tzinfo=None)
    
    synced_years = data_service.ensure_parquet_coverage(
        symbol=symbol,
        start_date=s_dt,
        end_date=e_dt,
        terminal_path=terminal_path,
    )
    logger.info(f"[ARQ Worker] Market Data Sync complete for {symbol}. Synced years: {synced_years}")
    return {
        "symbol": symbol,
        "start_date": start_date_str,
        "end_date": end_date_str,
        "synced_years": synced_years,
        "status": "success",
    }


class WorkerSettings:
    """ARQ Worker configuration settings."""
    functions = [
        ping_job,
        run_backtest_job,
        run_matrix_sweep_job,
        run_agent_turn_job,
        sync_market_data_job,
    ]
    redis_settings = RedisSettings.from_dsn(DEFAULT_REDIS_URL)
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 10
    job_timeout = 600  # 10 minutes for large multi-year data extractions
    keep_result = 3600  # Keep results in Redis for 1 hour
