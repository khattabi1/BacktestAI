"""
Unit tests for SQLite Session Storage and Persistence in packages/agent.
Verifies WAL concurrency, state serialization, CoT retrieval, artifact persistence,
and AgentHarness restore across runtime restarts.
"""

from __future__ import annotations
import asyncio
from pathlib import Path
import tempfile
import pytest

from packages.agent.src.core.types import (
    AgentSessionState,
    AgentState,
    EventType,
    Message,
    Role,
    ToolCall,
)
from packages.agent.src.core.harness import AgentHarness, ModelChunk
from packages.agent.src.storage.sqlite import SQLiteSessionStorage


@pytest.fixture
def temp_storage():
    """Provides an isolated SQLiteSessionStorage instance in a temporary file."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        db_path = Path(tmp_dir) / "test_agent_memory.db"
        storage = SQLiteSessionStorage(db_path=db_path)
        yield storage


def test_sqlite_storage_init_and_pragmas(temp_storage: SQLiteSessionStorage):
    with temp_storage._get_connection() as conn:
        journal_mode = conn.execute("PRAGMA journal_mode;").fetchone()[0]
        foreign_keys = conn.execute("PRAGMA foreign_keys;").fetchone()[0]

    assert journal_mode.lower() == "wal"
    assert foreign_keys == 1


def test_save_and_load_session_with_cot(temp_storage: SQLiteSessionStorage):
    session = AgentSessionState(
        session_id="sess_test_101",
        user_id="user_alpha",
        state=AgentState.DONE,
        context_meta={"strategy": "EMA Cross", "timeframe": "M15"},
    )

    # Add messages with CoT
    session.append_message(Message(role=Role.USER, content="Build an EMA cross strategy."))
    session.append_message(
        Message(
            role=Role.ASSISTANT,
            content="Here is the strategy outline.",
            thought="Testing 9/21 EMA crossover on M15 bars...",
            tool_calls=[ToolCall(id="tc_1", name="validate_syntax", arguments={"code": "pass"})],
        )
    )
    session.append_message(
        Message(
            role=Role.TOOL,
            content='{"valid": true}',
            tool_call_id="tc_1",
        )
    )

    # Add trajectory events
    session.append_event(EventType.THOUGHT_CHUNK, {"delta": "Testing 9/21 EMA..."})
    session.append_event(EventType.TOOL_CALL_STARTED, {"tool_name": "validate_syntax"})
    session.append_event(EventType.AGENT_DONE, {"turns": 1})

    # Save to SQLite
    temp_storage.save_session(session, title="EMA Crossover Research")

    # Load from SQLite
    loaded = temp_storage.load_session("sess_test_101")
    assert loaded is not None
    assert loaded.session_id == "sess_test_101"
    assert loaded.user_id == "user_alpha"
    assert loaded.state == AgentState.DONE
    assert loaded.context_meta.get("strategy") == "EMA Cross"

    # Verify messages
    assert len(loaded.history) == 3
    assert loaded.history[0].role == Role.USER
    assert loaded.history[0].content == "Build an EMA cross strategy."

    # Invariant: Assistant message preserves CoT thought
    assert loaded.history[1].role == Role.ASSISTANT
    assert loaded.history[1].thought == "Testing 9/21 EMA crossover on M15 bars..."
    assert len(loaded.history[1].tool_calls) == 1
    assert loaded.history[1].tool_calls[0].name == "validate_syntax"

    assert loaded.history[2].role == Role.TOOL
    assert loaded.history[2].tool_call_id == "tc_1"

    # Verify trajectory events
    assert len(loaded.trajectory) == 3
    assert loaded.trajectory[0].step_index == 1
    assert loaded.trajectory[0].event_type == EventType.THOUGHT_CHUNK
    assert loaded.trajectory[2].event_type == EventType.AGENT_DONE


def test_incremental_session_saves(temp_storage: SQLiteSessionStorage):
    session = AgentSessionState(session_id="sess_inc_01", user_id="user_beta")
    session.append_message(Message(role=Role.USER, content="Hello"))
    temp_storage.save_session(session)

    loaded1 = temp_storage.load_session("sess_inc_01")
    assert len(loaded1.history) == 1

    # Add second message and save again
    session.append_message(Message(role=Role.ASSISTANT, content="Hello trader!"))
    temp_storage.save_session(session)

    loaded2 = temp_storage.load_session("sess_inc_01")
    assert len(loaded2.history) == 2
    assert loaded2.history[1].content == "Hello trader!"


def test_list_and_delete_user_sessions(temp_storage: SQLiteSessionStorage):
    for i in range(3):
        sess = AgentSessionState(session_id=f"sess_list_{i}", user_id="user_gamma")
        sess.append_message(Message(role=Role.USER, content=f"Query {i}"))
        temp_storage.save_session(sess, title=f"Session {i}")

    sessions = temp_storage.list_user_sessions("user_gamma")
    assert len(sessions) == 3

    # Delete one
    deleted = temp_storage.delete_session("sess_list_1")
    assert deleted is True

    sessions_after = temp_storage.list_user_sessions("user_gamma")
    assert len(sessions_after) == 2
    ids = [s["session_id"] for s in sessions_after]
    assert "sess_list_1" not in ids


def test_artifacts_persistence(temp_storage: SQLiteSessionStorage):
    sess = AgentSessionState(session_id="sess_art_01", user_id="trader_x")
    temp_storage.save_session(sess)

    # Save Python strategy artifact
    art_id_py = temp_storage.save_artifact(
        session_id="sess_art_01",
        artifact_type="python_strategy",
        title="RSI Momentum Strategy",
        content="def on_bar(bar): pass",
        metadata={"symbol": "EURUSD", "timeframe": "M15"},
    )

    # Save MQL5 EA artifact
    art_id_mq5 = temp_storage.save_artifact(
        session_id="sess_art_01",
        artifact_type="mql5_ea",
        title="RSI Momentum EA",
        content="//+----------------------------------+\nvoid OnTick() {}",
        metadata={"symbol": "EURUSD", "platform": "MT5"},
    )

    artifacts = temp_storage.get_session_artifacts("sess_art_01")
    assert len(artifacts) == 2
    types = [a["artifact_type"] for a in artifacts]
    assert "python_strategy" in types
    assert "mql5_ea" in types


class MockAdapterWithPause:
    """Mock LLM adapter simulating ask_user pause and then completion."""
    def __init__(self) -> None:
        self.call_count = 0

    async def generate_turn(self, messages, tools):
        self.call_count += 1
        if self.call_count == 1:
            # Turn 1: ask user
            yield ModelChunk(thought_delta="Clarifying risk...")
            yield ModelChunk(
                tool_calls=[
                    ToolCall(
                        id="ask_call_1",
                        name="ask_user",
                        arguments={"question": "What is your target profit?"},
                    )
                ]
            )
        else:
            # Turn 2 (after resume): finish
            yield ModelChunk(thought_delta="Setting target profit...")
            yield ModelChunk(content_delta="Strategy configured with your target profit.")


@pytest.mark.asyncio
async def test_agent_harness_restore_across_restarts(temp_storage: SQLiteSessionStorage):
    mock_llm = MockAdapterWithPause()

    # Step 1: Initialize AgentHarness with storage
    harness1 = AgentHarness(
        session_id="sess_restore_test",
        user_id="trader_restore",
        llm_adapter=mock_llm,
        storage=temp_storage,
    )

    # Run turn 1 -> pauses at ask_user
    async for _ in harness1.run("Configure my scalper"):
        pass

    assert harness1.session.state == AgentState.WAITING_FOR_USER
    assert harness1.session.pending_interaction is not None

    # Step 2: Simulate complete process termination and restore into NEW harness instance
    del harness1

    harness2 = AgentHarness.restore(
        session_id="sess_restore_test",
        storage=temp_storage,
        llm_adapter=mock_llm,
    )

    # Invariant: Restored harness has identical state and pending interaction
    assert harness2.session.state == AgentState.WAITING_FOR_USER
    assert harness2.session.pending_interaction is not None
    assert harness2.session.pending_interaction["question"] == "What is your target profit?"

    # Step 3: Resume restored harness with user response
    events = []
    async for event in harness2.resume("Target is 20 pips"):
        events.append(event)

    assert harness2.session.state == AgentState.DONE
    final_msg = harness2.session.history[-1]
    assert "target profit" in final_msg.content

    # Step 4: Verify that SQLite database was also updated to DONE
    reloaded_sess = temp_storage.load_session("sess_restore_test")
    assert reloaded_sess.state == AgentState.DONE
