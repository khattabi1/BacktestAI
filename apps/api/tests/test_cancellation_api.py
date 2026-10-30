import pytest
from httpx import AsyncClient, ASGITransport
from apps.api.src.main import app
from apps.api.src.routers.agent import _active_harnesses, _get_or_create_harness
from packages.agent.src.core.types import AgentState


@pytest.mark.asyncio
async def test_cancel_session_api_active_harness():
    """Verifies that POST /api/v1/agent/sessions/{session_id}/cancel cancels an active harness."""
    test_session_id = "sess_cancel_api_test_1"
    harness = _get_or_create_harness(test_session_id)
    assert harness._is_cancelled is False

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Test path-based cancel
        resp = await client.post(f"/api/v1/agent/sessions/{test_session_id}/cancel")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "cancelled"
        assert data["session_id"] == test_session_id

        # Verify harness cancelled state
        assert harness._is_cancelled is True
        assert harness.session.state == AgentState.DONE


@pytest.mark.asyncio
async def test_cancel_session_api_body_request():
    """Verifies that POST /api/v1/agent/cancel with JSON body cancels an active harness."""
    test_session_id = "sess_cancel_api_test_2"
    harness = _get_or_create_harness(test_session_id)
    assert harness._is_cancelled is False

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/agent/cancel", json={"session_id": test_session_id})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "cancelled"
        assert data["session_id"] == test_session_id

        assert harness._is_cancelled is True
        assert harness.session.state == AgentState.DONE
