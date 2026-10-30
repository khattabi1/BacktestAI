"""
Integration and End-to-End Tests for ARQ Distributed Worker Architecture.
Validates real Redis connectivity, asynchronous job submission, worker burst execution,
and result extraction across backtest and matrix sweep tasks.
"""

import pytest
import asyncio
from fastapi.testclient import TestClient
from arq.worker import create_worker

from apps.api.src.main import app
from apps.api.src.job_queue import job_queue
from apps.api.src.worker import WorkerSettings


from backtest_si.strategy import BaseStrategy
from apps.api.src.services.strategy_registry import strategy_registry, StrategyMetadata


class MockTestStrategy(BaseStrategy):
    def on_bar(self, *args, **kwargs):
        return []


@pytest.fixture(autouse=True)
def setup_test_strategy():
    strategy_registry.register(
        "gold_sr_scalper",
        MockTestStrategy,
        StrategyMetadata(
            id="gold_sr_scalper",
            name="MockTestStrategy",
            description="Mock strategy for worker test",
            category="test",
            parameters=[],
        ),
    )


@pytest.fixture
def client():
    return TestClient(app)


def test_queue_stats_endpoint(client):
    """Verifies the /jobs/stats endpoint reports live Redis connection."""
    response = client.get("/api/v1/jobs/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["redis_connected"] is True
    assert data["status"] == "online"
    assert "redis_url" in data
    assert "active_queue_size" in data


def test_enqueue_ping_job_api(client):
    """Verifies submitting a ping job returns 202 Accepted and a valid job_id."""
    response = client.post("/api/v1/jobs/ping")
    assert response.status_code == 202
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "queued"
    assert data["function"] == "ping_job"

    # Status check before worker runs
    status_resp = client.get(f"/api/v1/jobs/{data['job_id']}")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["status"] in ["queued", "in_progress", "complete"]


def test_enqueue_backtest_job_api(client):
    """Verifies submitting a backtest job returns 202 and a valid job_id."""
    payload = {
        "strategy_id": "gold_sr_scalper",
        "symbol": "XAUUSD",
        "timeframe": "15m",
        "config": {
            "initial_capital": 100000.0,
            "slippage_points": 0.5,
            "commission_pct": 0.0002,
        },
        "parameters": {"ema_period": 32, "risk_percent": 1.0},
    }
    response = client.post("/api/v1/jobs/backtest", json=payload)
    assert response.status_code == 202
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "queued"
    assert data["function"] == "run_backtest_job"


def test_get_nonexistent_job_status(client):
    """Verifies polling an invalid job_id returns status 'not_found'."""
    response = client.get("/api/v1/jobs/non_existent_job_999999")
    assert response.status_code == 200
    data = response.json()
    assert data["job_id"] == "non_existent_job_999999"
    assert data["status"] == "not_found"
    assert data["result"] is None


@pytest.mark.asyncio
async def test_worker_executes_ping_job():
    """Directly verifies worker processes a ping job and returns result."""
    job_id = await job_queue.enqueue("ping_job")
    assert job_id is not None

    worker = create_worker(WorkerSettings, burst=True)
    completed = await worker.run_check()
    assert completed >= 1

    status = await job_queue.get_status(job_id)
    assert status.status == "complete"
    assert status.result == {"status": "pong", "worker": "backtest-si-worker"}
    assert status.error is None
    await worker.close()


@pytest.mark.asyncio
async def test_worker_executes_backtest_job():
    """Directly verifies worker processes a full backtest job using real Parquet data."""
    payload = {
        "strategy_id": "gold_sr_scalper",
        "symbol": "XAUUSD",
        "timeframe": "15m",
        "config": {
            "initial_capital": 100000.0,
            "slippage_points": 0.5,
            "commission_pct": 0.0002,
        },
        "parameters": {"ema_period": 32, "risk_percent": 1.0},
    }
    job_id = await job_queue.enqueue("run_backtest_job", payload)
    assert job_id is not None

    worker = create_worker(WorkerSettings, burst=True)
    completed = await worker.run_check()
    assert completed >= 1

    status = await job_queue.get_status(job_id)
    assert status.status == "complete"
    assert status.result is not None
    assert status.result["strategy_id"] == "gold_sr_scalper"
    assert status.result["symbol"] == "XAUUSD"
    assert "metrics" in status.result
    assert "trades" in status.result
    assert "equity_curve" in status.result
    assert status.result["metrics"]["initial_capital"] == 100000.0
    await worker.close()


@pytest.mark.asyncio
async def test_worker_executes_matrix_sweep_job():
    """Directly verifies worker processes a multi-parameter sweep job."""
    job_id = await job_queue.enqueue(
        "run_matrix_sweep_job",
        strategy_id="gold_sr_scalper",
        symbol="XAUUSD",
        timeframe="15m",
        parameter_grid={"ema_period": [30, 40]},
        max_combinations=2,
    )
    assert job_id is not None

    worker = create_worker(WorkerSettings, burst=True)
    completed = await worker.run_check()
    assert completed >= 1

    status = await job_queue.get_status(job_id)
    assert status.status == "complete"
    assert status.result is not None
    assert status.result["success"] is True
    assert "best_configuration" in status.result
    assert status.result["combinations_tested"] >= 1
    await worker.close()
