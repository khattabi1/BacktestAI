"""
Integration tests for Human-in-the-Loop (HITL) Resume API.
Tests POST /api/v1/agent/resume and interactive pause/resume flow.
"""

from typing import AsyncGenerator, List
import json
import pytest
from fastapi.testclient import TestClient

from apps.api.src.main import app
from packages.agent.src.adapters.llm import BaseLLMAdapter
from packages.agent.src.core.harness import ModelChunk
from packages.agent.src.core.types import Message, ToolCall, ToolDefinition
import apps.api.src.routers.agent as agent_router


class MockHITLLMAdapter(BaseLLMAdapter):
    """
    Mock LLM adapter that:
    - On turn 1 (initial chat): invokes 'ask_user' tool to pause for user input.
    - On turn 2 (resume): detects tool response and generates final completion.
    """
    async def generate_turn(
        self,
        messages: List[Message],
        tools: List[ToolDefinition],
    ) -> AsyncGenerator[ModelChunk, None]:
        # Check if the last message is a TOOL message containing the user response
        has_tool_response = any(m.role.value == "tool" for m in messages)

        if not has_tool_response:
            # Turn 1: Emit thought and call 'ask_user'
            yield ModelChunk(thought_delta="Need clarification from trader on timeframe.")
            yield ModelChunk(
                tool_calls=[
                    ToolCall(
                        id="call_ask_tf_001",
                        name="ask_user",
                        arguments={
                            "question": "Which timeframe should we use for the backtest?",
                            "options": ["M5", "M15", "H1"],
                            "context": "ActiveStrategy: trend_pulse_v1",
                        },
                    )
                ],
                is_finished=True,
            )
        else:
            # Turn 2: Received trader's selection, complete the reasoning turn
            yield ModelChunk(thought_delta="User selected M5. Proceeding with configuration.")
            yield ModelChunk(content_delta="Backtest configured for M5 timeframe.")
            yield ModelChunk(is_finished=True)


@pytest.fixture
def hitl_client():
    original_fn = agent_router.create_llm_adapter
    agent_router.create_llm_adapter = lambda *args, **kwargs: MockHITLLMAdapter()
    test_client = TestClient(app)
    yield test_client
    agent_router.create_llm_adapter = original_fn


def test_hitl_resume_nonexistent_session_returns_404(hitl_client: TestClient):
    """Attempting to resume a nonexistent session should return HTTP 404."""
    import uuid
    rand_id = f"sess_missing_{uuid.uuid4().hex[:10]}"
    res = hitl_client.post(
        "/api/v1/agent/resume",
        json={"session_id": rand_id, "user_response": "M5"},
    )
    assert res.status_code == 404
    data = res.json()
    assert "not found" in data["detail"].lower()


def test_hitl_resume_empty_response_returns_400(hitl_client: TestClient):
    """Attempting to resume with an empty response string should return HTTP 400."""
    # Create valid session
    create_res = hitl_client.post("/api/v1/agent/sessions", json={"title": "Empty Resume Test"})
    assert create_res.status_code == 201
    session_id = create_res.json()["session_id"]

    res = hitl_client.post(
        "/api/v1/agent/resume",
        json={"session_id": session_id, "user_response": "   "},
    )
    assert res.status_code == 400
    data = res.json()
    assert "empty" in data["detail"].lower()


def test_hitl_resume_when_session_not_waiting_returns_400(hitl_client: TestClient):
    """Resuming an idle session that is NOT in WAITING_FOR_USER state returns HTTP 400."""
    create_res = hitl_client.post("/api/v1/agent/sessions", json={"title": "Not Waiting Test"})
    assert create_res.status_code == 201
    session_id = create_res.json()["session_id"]

    res = hitl_client.post(
        "/api/v1/agent/resume",
        json={"session_id": session_id, "user_response": "M5"},
    )
    assert res.status_code == 400
    data = res.json()
    assert "not waiting for user" in data["detail"].lower()


def test_hitl_interactive_flow_ask_user_and_resume_stream(hitl_client: TestClient):
    """
    Full end-to-end Human-in-the-Loop interaction:
    1. /chat stream triggers ask_user, enters WAITING_FOR_USER, emits ASK_USER event.
    2. /resume streams USER_RESPONSE and finishes agent loop with user's selected choice.
    """
    # 1. Create Session
    create_res = hitl_client.post("/api/v1/agent/sessions", json={"title": "Interactive HITL Test"})
    assert create_res.status_code == 201
    session_id = create_res.json()["session_id"]

    # 2. Trigger Turn 1 via /chat
    chat_events = []
    with hitl_client.stream(
        "POST",
        "/api/v1/agent/chat",
        json={"session_id": session_id, "prompt": "Run optimization on trend_pulse."},
    ) as response:
        assert response.status_code == 200
        for line in response.iter_lines():
            if line.startswith("data: "):
                payload = json.loads(line[6:])
                chat_events.append(payload)

    # Verify Turn 1 paused at ASK_USER
    ask_user_events = [e for e in chat_events if e.get("event_type") == "ASK_USER"]
    assert len(ask_user_events) >= 1, f"Expected ASK_USER event, got {chat_events}"
    ask_payload = ask_user_events[0]["payload"]
    assert ask_payload["question"] == "Which timeframe should we use for the backtest?"
    assert ask_payload["options"] == ["M5", "M15", "H1", "Other"]

    # Verify session state is WAITING_FOR_USER
    get_res = hitl_client.get(f"/api/v1/agent/sessions/{session_id}")
    assert get_res.status_code == 200
    details = get_res.json()
    assert details["state"] == "WAITING_FOR_USER"
    assert details["pending_interaction"] is not None

    # 3. Resume the session with user choice "M5" via /resume
    resume_events = []
    with hitl_client.stream(
        "POST",
        "/api/v1/agent/resume",
        json={"session_id": session_id, "user_response": "M5"},
    ) as response:
        assert response.status_code == 200
        for line in response.iter_lines():
            if line.startswith("data: "):
                payload = json.loads(line[6:])
                resume_events.append(payload)

    # Verify resume stream contains USER_RESPONSE event
    user_resp_events = [e for e in resume_events if e.get("event_type") == "USER_RESPONSE"]
    assert len(user_resp_events) >= 1, f"Expected USER_RESPONSE event, got {resume_events}"
    assert user_resp_events[0]["payload"]["response"] == "M5"

    # Verify assistant completion content contains the answer
    msg_complete_events = [e for e in resume_events if e.get("event_type") == "MESSAGE_COMPLETE"]
    assert any("M5 timeframe" in str(e.get("payload", {})) for e in msg_complete_events)

    # 4. Verify session state is now DONE/IDLE and pending_interaction is cleared
    final_res = hitl_client.get(f"/api/v1/agent/sessions/{session_id}")
    assert final_res.status_code == 200
    final_details = final_res.json()
    assert final_details["state"] in ("DONE", "IDLE")
    assert final_details["pending_interaction"] is None
