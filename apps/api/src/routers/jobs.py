"""
FastAPI Router for Distributed ARQ Background Jobs.
Provides asynchronous job submission, status polling, and cluster telemetry.
"""

from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from domain.models import BacktestRunRequest
from ..job_queue import job_queue, JobStatusResponse

logger = logging.getLogger("backtest_si.api.routers.jobs")

router = APIRouter(prefix="/jobs", tags=["Jobs & Background Workers"])


class MatrixSweepJobRequest(BaseModel):
    strategy_id: str = Field(default="rsi_mean_reversion", description="Strategy identifier")
    symbol: str = Field(default="BTCUSDT", description="Market symbol")
    timeframe: str = Field(default="1h", description="Candle timeframe")
    parameter_grid: Optional[Dict[str, List[Any]]] = Field(
        default=None,
        description="Dictionary mapping parameter keys to lists of values to test",
    )
    max_combinations: int = Field(default=6, ge=1, le=50, description="Max combinations to execute")


class EnqueueResponse(BaseModel):
    job_id: str
    status: str = "queued"
    function: str
    message: str


class QueueStatsResponse(BaseModel):
    redis_connected: bool
    redis_url: str
    active_queue_size: int
    status: str


@router.post("/backtest", response_model=EnqueueResponse, status_code=status.HTTP_202_ACCEPTED)
async def enqueue_backtest(req: BacktestRunRequest):
    """
    Submits a heavy backtest run to the distributed Redis queue.
    Returns immediately with a job_id for non-blocking execution.
    """
    try:
        payload = req.model_dump(mode="json")
        job_id = await job_queue.enqueue("run_backtest_job", payload)
        return EnqueueResponse(
            job_id=job_id,
            status="queued",
            function="run_backtest_job",
            message=f"Backtest for strategy '{req.strategy_id}' ({req.symbol}) dispatched to Redis queue.",
        )
    except Exception as e:
        logger.exception(f"Failed to enqueue backtest: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Queue submission failed: {str(e)}",
        )


@router.post("/matrix-sweep", response_model=EnqueueResponse, status_code=status.HTTP_202_ACCEPTED)
async def enqueue_matrix_sweep(req: MatrixSweepJobRequest):
    """
    Submits a multi-parameter sweep job to the distributed worker pool.
    """
    try:
        job_id = await job_queue.enqueue(
            "run_matrix_sweep_job",
            strategy_id=req.strategy_id,
            symbol=req.symbol,
            timeframe=req.timeframe,
            parameter_grid=req.parameter_grid,
            max_combinations=req.max_combinations,
        )
        return EnqueueResponse(
            job_id=job_id,
            status="queued",
            function="run_matrix_sweep_job",
            message=f"Parameter sweep for '{req.strategy_id}' dispatched to Redis queue.",
        )
    except Exception as e:
        logger.exception(f"Failed to enqueue matrix sweep: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Queue submission failed: {str(e)}",
        )


@router.post("/ping", response_model=EnqueueResponse, status_code=status.HTTP_202_ACCEPTED)
async def enqueue_ping():
    """
    Submits a lightweight ping job to verify Redis queue and worker liveliness.
    """
    try:
        job_id = await job_queue.enqueue("ping_job")
        return EnqueueResponse(
            job_id=job_id,
            status="queued",
            function="ping_job",
            message="Worker ping task enqueued.",
        )
    except Exception as e:
        logger.exception(f"Failed to enqueue ping: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Queue submission failed: {str(e)}",
        )


@router.get("/stats", response_model=QueueStatsResponse)
async def get_queue_stats():
    """
    Returns telemetry on Redis connection and current queue depth.
    """
    try:
        pool = await job_queue.get_pool()
        await pool.ping()
        # Redis sorted set 'arq:queue' contains pending jobs
        queue_size = await pool.zcard(b"arq:queue") or 0
        return QueueStatsResponse(
            redis_connected=True,
            redis_url=job_queue.redis_url,
            active_queue_size=queue_size,
            status="online",
        )
    except Exception as e:
        return QueueStatsResponse(
            redis_connected=False,
            redis_url=job_queue.redis_url,
            active_queue_size=0,
            status=f"offline: {str(e)}",
        )


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """
    Polls the current status, progress, or completed result of a background job.
    Status can be: 'queued', 'in_progress', 'complete', or 'not_found'.
    """
    try:
        status_info = await job_queue.get_status(job_id)
        return status_info
    except Exception as e:
        logger.exception(f"Error querying job '{job_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to inspect job '{job_id}': {str(e)}",
        )
