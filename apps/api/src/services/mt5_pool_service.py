"""
MT5 Worker Pool Orchestration Service for BacktestAI.
Manages a pool of 5 isolated MetaTrader 5 portable instances.
Implements sequential leasing fallback (1 ➔ 2 ➔ 3 ➔ 4 ➔ 5) and an Async FIFO queue.
"""

from __future__ import annotations
import asyncio
from contextlib import asynccontextmanager
import logging
import os
from pathlib import Path
import time
from typing import Any, AsyncGenerator, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("backtest_ai.api.mt5_pool")

# Default project root: BacktestAI/
DEFAULT_PROJECT_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_WORKERS_DIR = DEFAULT_PROJECT_ROOT / "mt5_workers"


class WorkerTelemetry(BaseModel):
    """Telemetry status of an individual MT5 worker instance."""
    worker_id: int
    base_dir: str
    is_installed: bool
    is_busy: bool
    current_job_id: Optional[str] = None
    last_leased_at: Optional[float] = None
    completed_jobs_count: int = 0


class MT5WorkerInstance:
    """
    Represents an isolated, self-contained MetaTrader 5 portable instance.
    Runs with the `/portable` flag so all data, configs, and logs are strictly
    local to this worker's directory, preventing AppData collisions.
    """

    def __init__(self, worker_id: int, base_dir: Path) -> None:
        self.worker_id = worker_id
        self.base_dir = base_dir
        self.terminal_path = base_dir / "terminal64.exe"
        self.metaeditor_path = base_dir / "metaeditor64.exe"
        self.config_dir = base_dir / "Config"
        self.terminal_ini = self.config_dir / "terminal.ini"
        self.tester_logs_dir = base_dir / "Tester" / "logs"
        self.mql5_dir = base_dir / "MQL5"
        self.experts_dir = self.mql5_dir / "Experts"
        self.bases_dir = base_dir / "bases"

        self.is_busy: bool = False
        self.current_job_id: Optional[str] = None
        self.last_leased_at: Optional[float] = None
        self.completed_jobs_count: int = 0

    def is_installed(self) -> bool:
        """Returns True if the MT5 terminal binary exists in this worker folder."""
        return self.terminal_path.is_file()

    def ensure_directories(self) -> None:
        """Ensures that required subdirectories exist in this worker directory."""
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.tester_logs_dir.mkdir(parents=True, exist_ok=True)
        self.experts_dir.mkdir(parents=True, exist_ok=True)

    def get_env(self) -> Dict[str, str]:
        """
        Returns environment variables configured specifically for this worker.
        These are passed to MT5-MCP or subprocess execution.
        """
        return {
            "MT5_PATH": str(self.terminal_path),
            "MT5_METAEDITOR_PATH": str(self.metaeditor_path),
            "MT5_DATA_FOLDER": str(self.base_dir),
            "MT5_CONFIG_FOLDER": str(self.config_dir),
            "MT5_TESTER_LOG": str(self.tester_logs_dir),
            "MT5_TERMINAL_INI": str(self.terminal_ini),
        }

    def get_telemetry(self) -> WorkerTelemetry:
        """Returns snapshot telemetry for monitoring and status dashboards."""
        return WorkerTelemetry(
            worker_id=self.worker_id,
            base_dir=str(self.base_dir),
            is_installed=self.is_installed(),
            is_busy=self.is_busy,
            current_job_id=self.current_job_id,
            last_leased_at=self.last_leased_at,
            completed_jobs_count=self.completed_jobs_count,
        )


class MT5WorkerPool:
    """
    Manages a pool of N isolated MT5 worker instances (default: 5).
    Guarantees:
    1. Sequential leasing: checks worker 1 ➔ 2 ➔ 3 ➔ 4 ➔ 5.
    2. Zero locking conflicts: only one backtest runs on a given MT5 instance at a time.
    3. Concurrency FIFO queue: when all 5 instances are occupied, incoming jobs
       wait asynchronously and are popped the instant any worker completes.
    """

    def __init__(
        self,
        workers_dir: Optional[Path] = None,
        num_workers: int = 5,
    ) -> None:
        self.workers_dir = Path(workers_dir or DEFAULT_WORKERS_DIR)
        self.num_workers = num_workers
        self.workers: List[MT5WorkerInstance] = [
            MT5WorkerInstance(i + 1, self.workers_dir / f"worker_{i + 1}")
            for i in range(num_workers)
        ]
        self._lock = asyncio.Lock()
        self._queue: asyncio.Queue[asyncio.Future[MT5WorkerInstance]] = asyncio.Queue()
        self.total_jobs_processed: int = 0

    def ensure_all_worker_directories(self) -> None:
        """Creates the worker directory structure if not yet present."""
        for worker in self.workers:
            worker.ensure_directories()

    async def acquire_worker(
        self,
        job_id: str,
        timeout: float = 600.0,
    ) -> MT5WorkerInstance:
        """
        Acquires an idle MT5 worker instance.
        Follows sequential fallback: checks 1, then 2, 3, 4, 5.
        If all are busy, enqueues the request in a FIFO queue until a worker is released.
        """
        chosen_worker: Optional[MT5WorkerInstance] = None

        async with self._lock:
            # Sequential search: try worker 1, then 2, then 3, then 4, then 5
            for w in self.workers:
                if not w.is_busy:
                    w.is_busy = True
                    w.current_job_id = job_id
                    w.last_leased_at = time.time()
                    chosen_worker = w
                    logger.info(f"[MT5WorkerPool] Leased Worker #{w.worker_id} for job '{job_id}'")
                    break

        if chosen_worker is not None:
            return chosen_worker

        # All 5 workers occupied: enqueue request
        logger.info(
            f"[MT5WorkerPool] All {self.num_workers} workers busy. Enqueueing job '{job_id}' (Queue depth: {self._queue.qsize() + 1})"
        )
        loop = asyncio.get_running_loop()
        future: asyncio.Future[MT5WorkerInstance] = loop.create_future()
        await self._queue.put(future)

        try:
            chosen_worker = await asyncio.wait_for(future, timeout=timeout)
            async with self._lock:
                chosen_worker.current_job_id = job_id
                chosen_worker.last_leased_at = time.time()
            logger.info(f"[MT5WorkerPool] Enqueued job '{job_id}' acquired freed Worker #{chosen_worker.worker_id}")
            return chosen_worker
        except asyncio.TimeoutError:
            logger.error(f"[MT5WorkerPool] Job '{job_id}' timed out waiting in worker queue after {timeout}s")
            # If the future is still in queue, cancel it
            if not future.done():
                future.cancel()
            raise TimeoutError(f"Timed out waiting for an available MT5 worker after {timeout}s")

    async def release_worker(self, worker: MT5WorkerInstance) -> None:
        """
        Releases an acquired worker instance.
        If any jobs are queued, immediately hands off the worker to the next in line.
        Otherwise marks the worker as idle.
        """
        async with self._lock:
            worker.completed_jobs_count += 1
            self.total_jobs_processed += 1

            # Check if any waiters are in the FIFO queue
            while not self._queue.empty():
                next_waiter = self._queue.get_nowait()
                if not next_waiter.cancelled() and not next_waiter.done():
                    logger.info(f"[MT5WorkerPool] Passing freed Worker #{worker.worker_id} to next queued waiter")
                    next_waiter.set_result(worker)
                    return

            # No waiters in queue: mark free
            worker.is_busy = False
            worker.current_job_id = None
            logger.info(f"[MT5WorkerPool] Worker #{worker.worker_id} is now idle and ready")

    @asynccontextmanager
    async def lease(
        self,
        job_id: str,
        timeout: float = 600.0,
    ) -> AsyncGenerator[MT5WorkerInstance, None]:
        """
        Context manager for leasing a worker.
        Guarantees that the worker is always released even upon exceptions or timeouts.

        Example:
            async with mt5_pool.lease(job_id="run_123") as worker:
                env = worker.get_env()
                # Run backtest with worker...
        """
        worker = await self.acquire_worker(job_id=job_id, timeout=timeout)
        try:
            yield worker
        finally:
            await self.release_worker(worker)

    def get_status(self) -> Dict[str, Any]:
        """Returns overall health and status summary of the pool."""
        installed_count = sum(1 for w in self.workers if w.is_installed())
        busy_count = sum(1 for w in self.workers if w.is_busy)
        idle_count = self.num_workers - busy_count

        return {
            "total_workers": self.num_workers,
            "installed_workers": installed_count,
            "idle_workers": idle_count,
            "busy_workers": busy_count,
            "queue_depth": self._queue.qsize(),
            "total_jobs_processed": self.total_jobs_processed,
            "workers_dir": str(self.workers_dir),
            "workers": [w.get_telemetry().model_dump() for w in self.workers],
        }


# Singleton pool instance
mt5_pool = MT5WorkerPool()
