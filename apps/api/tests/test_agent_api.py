"""
Unit tests for Backtest-SI Agent API router (apps/api/src/routers/agent.py).
Tests session lifecycle, tool inventory, and chat streaming endpoints.
"""

from typing import AsyncGenerator, List
import pytest
from fastapi.testclient import TestClient

from apps.api.src.main import app
from packages.agent.src.adapters.llm import BaseLLMAdapter
from packages.agent.src.core.harness import ModelChunk
from packages.agent.src.core.types import Message, ToolDefinition
import apps.api.src.routers.agent as agent_router


class MockLLMAdapter(BaseLLMAdapter):
    """Deterministic Mock LLM Adapter for API integration tests."""
    async def generate_turn(
        self,
        messages: List[Message],
        tools: List[ToolDefinition],
    ) -> AsyncGenerator[ModelChunk, None]:
        yield ModelChunk(thought_delta="Formulating quantitative alpha response...")
        yield ModelChunk(content_delta="Backtest simulation indicates high Sharpe.")
        yield ModelChunk(is_finished=True)


@pytest.fixture
def client():
    # Use mock LLM adapter in harness helper for deterministic tests
    original_fn = agent_router.create_llm_adapter
    agent_router.create_llm_adapter = lambda *args, **kwargs: MockLLMAdapter()
    test_client = TestClient(app)
    yield test_client
    agent_router.create_llm_adapter = original_fn


def test_list_tools_endpoint(client: TestClient):
    """Verifies that registered quant tools are listed with schemas."""
    response = client.get("/api/v1/agent/tools")
    assert response.status_code == 200
    data = response.json()
    assert "tools" in data
    tool_names = [t["name"] for t in data["tools"]]
    assert "run_backtest" in tool_names
    assert "read_strategy" in tool_names
    assert "query_market_data" in tool_names
    assert "ask_user" in tool_names


def test_session_lifecycle(client: TestClient):
    """Tests creating, fetching, listing, and deleting an agent session."""
    # 1. Create Session
    create_res = client.post(
        "/api/v1/agent/sessions",
        json={"title": "Test Quant Autopsy", "user_id": "test_trader_1"},
    )
    assert create_res.status_code == 201
    created = create_res.json()
    session_id = created["session_id"]
    assert session_id.startswith("sess_")
    assert created["title"] == "Test Quant Autopsy"

    # 2. Get Session Details
    get_res = client.get(f"/api/v1/agent/sessions/{session_id}")
    assert get_res.status_code == 200
    details = get_res.json()
    assert details["session_id"] == session_id
    assert details["state"].upper() == "IDLE"

    # 3. List Sessions
    list_res = client.get("/api/v1/agent/sessions?user_id=test_trader_1")
    assert list_res.status_code == 200
    sessions_list = list_res.json()
    assert any(s["session_id"] == session_id for s in sessions_list)

    # 4. Delete Session
    del_res = client.delete(f"/api/v1/agent/sessions/{session_id}")
    assert del_res.status_code == 204

    # 5. Verify deleted
    get_deleted = client.get(f"/api/v1/agent/sessions/{session_id}")
    assert get_deleted.status_code == 404


def test_chat_stream_sse(client: TestClient):
    """Verifies Server-Sent Events (SSE) streaming output from /api/v1/agent/chat."""
    # Create session
    create_res = client.post(
        "/api/v1/agent/sessions",
        json={"title": "SSE Stream Test", "user_id": "stream_user"},
    )
    session_id = create_res.json()["session_id"]

    # Stream Chat Turn
    with client.stream(
        "POST",
        "/api/v1/agent/chat",
        json={"session_id": session_id, "prompt": "Evaluate momentum strategy."},
    ) as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        lines = [line for line in response.iter_lines() if line.startswith("data:")]
        assert len(lines) > 0
        combined = " ".join(lines)
        assert "THOUGHT_CHUNK" in combined or "MESSAGE_CHUNK" in combined or "AGENT_DONE" in combined
