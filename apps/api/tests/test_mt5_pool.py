"""
Unit Tests for MT5WorkerPool Service.
Tests sequential leasing fallback (1 -> 2 -> 3 -> 4 -> 5),
FIFO queue waiting and handoff, and exception resilience.
"""

import asyncio
import pytest
from pathlib import Path
from apps.api.src.services.mt5_pool_service import MT5WorkerPool, MT5WorkerInstance


@pytest.fixture
def temp_pool(tmp_path: Path) -> MT5WorkerPool:
    """Creates an isolated MT5WorkerPool with 5 workers in a temporary directory."""
    pool = MT5WorkerPool(workers_dir=tmp_path / "mt5_workers", num_workers=5)
    pool.ensure_all_worker_directories()
    return pool


@pytest.mark.asyncio
async def test_sequential_leasing(temp_pool: MT5WorkerPool):
    """
    Verifies sequential leasing fallback:
    First job gets Worker 1, second gets Worker 2, up to Worker 5.
    """
    w1 = await temp_pool.acquire_worker("job_1")
    assert w1.worker_id == 1
    assert w1.is_busy is True

    w2 = await temp_pool.acquire_worker("job_2")
    assert w2.worker_id == 2
    assert w2.is_busy is True

    w3 = await temp_pool.acquire_worker("job_3")
    assert w3.worker_id == 3

    w4 = await temp_pool.acquire_worker("job_4")
    assert w4.worker_id == 4

    w5 = await temp_pool.acquire_worker("job_5")
    assert w5.worker_id == 5

    status = temp_pool.get_status()
    assert status["busy_workers"] == 5
    assert status["idle_workers"] == 0
    assert status["queue_depth"] == 0

    # Release worker 1
    await temp_pool.release_worker(w1)
    assert w1.is_busy is False

    # Next job should immediately take worker 1 (lowest available index)
    w_next = await temp_pool.acquire_worker("job_next")
    assert w_next.worker_id == 1

    # Cleanup
    await temp_pool.release_worker(w2)
    await temp_pool.release_worker(w3)
    await temp_pool.release_worker(w4)
    await temp_pool.release_worker(w5)
    await temp_pool.release_worker(w_next)

    final_status = temp_pool.get_status()
    assert final_status["busy_workers"] == 0
    assert final_status["idle_workers"] == 5


@pytest.mark.asyncio
async def test_fifo_queue_when_all_busy(temp_pool: MT5WorkerPool):
    """
    Verifies that when all 5 workers are occupied:
    Job 6 enters the FIFO queue and gets immediately popped when a worker frees up.
    """
    acquired_workers = []
    for i in range(5):
        w = await temp_pool.acquire_worker(f"busy_job_{i+1}")
        acquired_workers.append(w)

    status = temp_pool.get_status()
    assert status["busy_workers"] == 5

    # Job 6 will queue
    job_6_worker = None

    async def run_job_6():
        nonlocal job_6_worker
        job_6_worker = await temp_pool.acquire_worker("job_6", timeout=5.0)

    task_6 = asyncio.create_task(run_job_6())
    await asyncio.sleep(0.05)  # Let job 6 enter queue

    # Release worker 3
    await temp_pool.release_worker(acquired_workers[2])

    # Wait for job 6 to acquire
    await task_6
    assert job_6_worker is not None
    assert job_6_worker.worker_id == 3  # Acquired the freed worker 3!
    assert job_6_worker.current_job_id == "job_6"

    # Clean up
    await temp_pool.release_worker(job_6_worker)
    for idx, w in enumerate(acquired_workers):
        if idx != 2:
            await temp_pool.release_worker(w)

    assert temp_pool.get_status()["idle_workers"] == 5


@pytest.mark.asyncio
async def test_context_manager_lease_exception_safety(temp_pool: MT5WorkerPool):
    """
    Verifies that async with temp_pool.lease() guarantees release
    even when an unhandled exception occurs inside the block.
    """
    with pytest.raises(ValueError, match="Simulated crash"):
        async with temp_pool.lease("failing_job") as worker:
            assert worker.worker_id == 1
            assert worker.is_busy is True
            raise ValueError("Simulated crash")

    # Worker 1 should be immediately free despite exception
    status = temp_pool.get_status()
    assert status["idle_workers"] == 5
    assert temp_pool.workers[0].is_busy is False


def test_worker_env_paths(temp_pool: MT5WorkerPool):
    """Verifies that environment paths are accurately constructed for portable mode."""
    w1 = temp_pool.workers[0]
    env = w1.get_env()
    assert "MT5_PATH" in env
    assert "MT5_DATA_FOLDER" in env
    assert str(w1.base_dir) == env["MT5_DATA_FOLDER"]
    assert str(w1.config_dir / "terminal.ini") == env["MT5_TERMINAL_INI"]
