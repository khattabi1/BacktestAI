"""
ARQ Distributed Job Queue Manager for BacktestAI.
Provides connection pooling, background job enqueueing, and status telemetry.
"""

from __future__ import annotations
import logging
import os
from typing import Any, Dict, Optional
from pydantic import BaseModel
from arq import create_pool
from arq.connections import ArqRedis, RedisSettings
from arq.jobs import JobStatus, Job

logger = logging.getLogger("backtest_ai.api.job_queue")

DEFAULT_REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")


class JobStatusResponse(BaseModel):
    job_id: str
    status: str  # "queued", "in_progress", "complete", "not_found"
    result: Optional[Any] = None
    enqueue_time: Optional[str] = None
    execution_duration: Optional[float] = None
    error: Optional[str] = None


class JobQueue:
    """
    Manages connection to Redis and job dispatching for distributed ARQ workers.
    """

    def __init__(self, redis_url: Optional[str] = None) -> None:
        self.redis_url = redis_url or DEFAULT_REDIS_URL
        self._pool: Optional[ArqRedis] = None
        self._loop: Optional[Any] = None

    async def get_pool(self) -> ArqRedis:
        """Returns or initializes the active ArqRedis connection pool for the current event loop."""
        import asyncio
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = None

        if self._pool is None or (current_loop is not None and self._loop != current_loop):
            if self._pool is not None:
                try:
                    if hasattr(self._pool, "aclose"):
                        await self._pool.aclose()
                    else:
                        await self._pool.close()
                except Exception:
                    pass
            settings = RedisSettings.from_dsn(self.redis_url)
            self._pool = await create_pool(settings)
            self._loop = current_loop
            logger.info(f"[ARQ] Connected to Redis queue at {self.redis_url}")
        return self._pool

    async def enqueue(self, function_name: str, *args: Any, **kwargs: Any) -> str:
        """Enqueues a background job and returns the unique job_id."""
        pool = await self.get_pool()
        job = await pool.enqueue_job(function_name, *args, **kwargs)
        if not job:
            raise RuntimeError(f"Failed to enqueue job '{function_name}'.")
        logger.info(f"[ARQ] Enqueued job '{job.job_id}' for function '{function_name}'")
        return job.job_id

    async def get_status(self, job_id: str) -> JobStatusResponse:
        """Queries the status and result of a job in Redis."""
        pool = await self.get_pool()
        job = Job(job_id=job_id, redis=pool)
        raw_status = await job.status()

        status_str = "not_found"
        if raw_status == JobStatus.queued:
            status_str = "queued"
        elif raw_status == JobStatus.in_progress:
            status_str = "in_progress"
        elif raw_status == JobStatus.complete:
            status_str = "complete"

        result = None
        error = None
        enqueue_time = None
        duration = None

        if raw_status == JobStatus.complete:
            try:
                result_info = await job.result_info()
                if result_info:
                    enqueue_time = result_info.enqueue_time.isoformat() if result_info.enqueue_time else None
                    if result_info.start_time and result_info.finish_time:
                        duration = round((result_info.finish_time - result_info.start_time).total_seconds(), 4)
                    if result_info.success:
                        result = result_info.result
                    else:
                        error = str(result_info.result)
            except Exception as e:
                error = str(e)

        return JobStatusResponse(
            job_id=job_id,
            status=status_str,
            result=result,
            enqueue_time=enqueue_time,
            execution_duration=duration,
            error=error,
        )

    async def close(self) -> None:
        """Closes the Redis connection pool."""
        if self._pool:
            try:
                if hasattr(self._pool, "aclose"):
                    await self._pool.aclose()
                else:
                    await self._pool.close()
            except Exception:
                pass
            self._pool = None
            self._loop = None


# Global singleton instance
job_queue = JobQueue()
