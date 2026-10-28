import asyncio
import pytest
from packages.agent.src.core.harness import AgentHarness, ModelChunk
from packages.agent.src.core.types import AgentState, EventType, ToolCall
from packages.agent.src.storage.sqlite import SQLiteSessionStorage


class CancellableMockLLM:
    """Mock LLM adapter that yields chunks with slight delay to test cancellation."""
    def __init__(self):
        self.chunks_yielded = 0

    async def generate_turn(self, history, tools):
        for i in range(50):
            self.chunks_yielded += 1
            yield ModelChunk(
                thought_delta=f"Reasoning step {i}... ",
                content_delta=None,
            )
            await asyncio.sleep(0.01)
        yield ModelChunk(
            thought_delta=None,
            content_delta="Done reasoning.",
        )


class ToolCallingMockLLM:
    """Mock LLM that emits tool calls."""
    def __init__(self):
        self.turn = 0

    async def generate_turn(self, history, tools):
        self.turn += 1
        if self.turn == 1:
            yield ModelChunk(
                thought_delta="Preparing tool...",
                tool_calls=[
                    ToolCall(id="call_slow_1", name="slow_tool", arguments={})
                ],
            )
        else:
            yield ModelChunk(content_delta="All tools executed.")


@pytest.mark.asyncio
async def test_agent_harness_cancel_halts_streaming_generator(tmp_path):
    """Verifies that calling harness.cancel() halts streaming mid-turn."""
    storage = SQLiteSessionStorage(db_path=str(tmp_path / "cancel_test.db"))
    mock_llm = CancellableMockLLM()
    harness = AgentHarness(
        session_id="sess_cancel_stream",
        user_id="test_trader",
        llm_adapter=mock_llm,
        storage=storage,
    )

    events_received = []

    async def run_and_collect():
        async for ev in harness.run(user_prompt="Analyze gold trends"):
            events_received.append(ev)

    task = asyncio.create_task(run_and_collect())

    # Wait until a few chunks arrive, then invoke cancel()
    await asyncio.sleep(0.04)
    harness.cancel()

    await task

    # Assertions
    assert harness._is_cancelled is True
    assert harness.session.state == AgentState.DONE
    # Verify that stream was stopped early without running all 50 chunks
    assert mock_llm.chunks_yielded < 40


@pytest.mark.asyncio
async def test_agent_harness_cancel_prevents_subsequent_tool_execution(tmp_path):
    """Verifies that calling harness.cancel() prevents executing pending tools."""
    storage = SQLiteSessionStorage(db_path=str(tmp_path / "cancel_tool_test.db"))
    mock_llm = ToolCallingMockLLM()
    harness = AgentHarness(
        session_id="sess_cancel_tool",
        user_id="test_trader",
        llm_adapter=mock_llm,
        storage=storage,
    )

    tool_executed = False

    async def fake_slow_tool():
        nonlocal tool_executed
        tool_executed = True
        return {"result": "slow done"}

    harness.register_tool(
        name="slow_tool",
        description="A tool to be cancelled",
        parameters={"type": "object", "properties": {}},
        handler=fake_slow_tool,
    )

    # Pre-cancel before running
    harness.cancel()

    events = []
    async for ev in harness.run(user_prompt="Run slow tool"):
        events.append(ev)

    assert tool_executed is False
    assert harness.session.state == AgentState.DONE
