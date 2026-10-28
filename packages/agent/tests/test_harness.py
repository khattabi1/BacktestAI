"""
Unit tests for DeepSeek Agent Harness (DSH) Core in packages/agent.
Verifies CoT preservation, streaming parser, multi-turn tool loops, and Human-in-the-Loop.
"""

from __future__ import annotations
import asyncio
from typing import AsyncGenerator, List
import pytest

from packages.agent.src.core.types import (
    AgentState,
    EventType,
    Message,
    Role,
    ToolCall,
    ToolDefinition,
)
from packages.agent.src.core.parser import StreamThoughtParser
from packages.agent.src.core.harness import AgentHarness, ModelChunk


class MockLLMAdapter:
    """Mock LLM adapter simulating Claude Opus / DeepSeek streaming output."""

    def __init__(self, turns: List[List[ModelChunk]]) -> None:
        self.turns = turns
        self.call_count = 0

    async def generate_turn(
        self,
        messages: List[Message],
        tools: List[ToolDefinition],
    ) -> AsyncGenerator[ModelChunk, None]:
        if self.call_count >= len(self.turns):
            yield ModelChunk(content_delta="No further turns scripted.")
            return

        chunks = self.turns[self.call_count]
        self.call_count += 1
        for chunk in chunks:
            await asyncio.sleep(0.001)
            yield chunk


def test_stream_thought_parser_basic():
    parser = StreamThoughtParser()
    chunks = ["<think>Analyzing ", "EURUSD volatility...", "</think> Here is ", "the result."]
    outputs = []
    for c in chunks:
        for kind, text in parser.feed(c):
            outputs.append((kind, text))

    for kind, text in parser.finalize():
        outputs.append((kind, text))

    assert parser.full_thought == "Analyzing EURUSD volatility..."
    assert parser.full_content == "Here is the result."
    assert ("thought_end", "") in outputs


def test_stream_thought_parser_split_boundary():
    parser = StreamThoughtParser()
    chunks = ["<th", "ink>Regime is high trend</th", "ink>Buy signal confirmed."]
    for c in chunks:
        list(parser.feed(c))
    list(parser.finalize())

    assert parser.full_thought == "Regime is high trend"
    assert parser.full_content == "Buy signal confirmed."


@pytest.mark.asyncio
async def test_agent_harness_direct_response_with_cot():
    # Turn 1: Model thinks, then gives direct advice without tools
    mock_llm = MockLLMAdapter([
        [
            ModelChunk(thought_delta="Considering 20-period moving average on EURUSD..."),
            ModelChunk(content_delta="I recommend using an EMA with period 21."),
        ]
    ])

    harness = AgentHarness(
        session_id="sess_001",
        user_id="usr_001",
        llm_adapter=mock_llm,
    )

    events = []
    async for event in harness.run("What MA should I use?"):
        events.append(event)

    assert harness.session.state == AgentState.DONE
    event_types = [e.event_type for e in events]
    assert EventType.THOUGHT_CHUNK in event_types
    assert EventType.THOUGHT_COMPLETE in event_types
    assert EventType.MESSAGE_COMPLETE in event_types
    assert EventType.AGENT_DONE in event_types

    # Invariant: Assistant message in history has CoT preserved!
    assistant_msgs = [m for m in harness.session.history if m.role == Role.ASSISTANT]
    assert len(assistant_msgs) == 1
    assert assistant_msgs[0].thought == "Considering 20-period moving average on EURUSD..."
    assert assistant_msgs[0].content == "I recommend using an EMA with period 21."


@pytest.mark.asyncio
async def test_agent_harness_multi_turn_tool_calling():
    # Turn 1: Thinks, invokes mock quant tool 'calculate_spread'
    # Turn 2: Receives tool result, thinks again, provides final conclusion
    mock_llm = MockLLMAdapter([
        [
            ModelChunk(thought_delta="Need to inspect instrument spread first..."),
            ModelChunk(tool_calls=[ToolCall(id="tc_1", name="calculate_spread", arguments={"symbol": "EURUSD"})]),
        ],
        [
            ModelChunk(thought_delta="Spread is 0.8 pips, low enough for scalping."),
            ModelChunk(content_delta="The spread is 0.8 pips. Your scalping strategy is viable."),
        ]
    ])

    harness = AgentHarness(
        session_id="sess_002",
        user_id="usr_001",
        llm_adapter=mock_llm,
    )

    async def mock_calculate_spread(symbol: str) -> dict:
        return {"symbol": symbol, "spread_pips": 0.8}

    harness.register_tool(
        name="calculate_spread",
        description="Calculates market spread for a symbol",
        parameters={"type": "object", "properties": {"symbol": {"type": "string"}}},
        handler=mock_calculate_spread,
    )

    events = []
    async for event in harness.run("Can I scalp EURUSD?"):
        events.append(event)

    assert harness.session.state == AgentState.DONE
    event_types = [e.event_type for e in events]
    assert EventType.TOOL_CALL_STARTED in event_types
    assert EventType.TOOL_CALL_FINISHED in event_types

    # Verify tool result was injected into history
    tool_msgs = [m for m in harness.session.history if m.role == Role.TOOL]
    assert len(tool_msgs) == 1
    assert "0.8" in tool_msgs[0].content


@pytest.mark.asyncio
async def test_agent_harness_human_in_the_loop_ask_user():
    # Turn 1: Model realizes it needs human clarification on stop loss
    # Invokes 'ask_user'
    # Turn 2 (after resume): Model receives user's answer and finishes
    mock_llm = MockLLMAdapter([
        [
            ModelChunk(thought_delta="User did not specify maximum drawdown or stop loss."),
            ModelChunk(
                tool_calls=[
                    ToolCall(
                        id="tc_ask_1",
                        name="ask_user",
                        arguments={
                            "question": "What is your desired stop loss percentage per trade?",
                            "options": ["1.0%", "1.5%", "2.0%"],
                        },
                    )
                ]
            ),
        ],
        [
            ModelChunk(thought_delta="User prefers 1.5% risk. Writing the position sizing rule..."),
            ModelChunk(content_delta="I have set the strategy risk to 1.5% per trade."),
        ]
    ])

    harness = AgentHarness(
        session_id="sess_003",
        user_id="usr_001",
        llm_adapter=mock_llm,
    )

    events_turn1 = []
    async for event in harness.run("Create a trend following strategy for me"):
        events_turn1.append(event)

    # Invariant: Agent MUST be paused waiting for user input
    assert harness.session.state == AgentState.WAITING_FOR_USER
    assert harness.session.pending_interaction is not None
    assert harness.session.pending_interaction["question"] == "What is your desired stop loss percentage per trade?"

    ask_events = [e for e in events_turn1 if e.event_type == EventType.ASK_USER]
    assert len(ask_events) == 1

    # Invariant: Resume agent with user's answer
    events_turn2 = []
    async for event in harness.resume("I want 1.5% stop loss"):
        events_turn2.append(event)

    assert harness.session.state == AgentState.DONE
    user_resp_events = [e for e in events_turn2 if e.event_type == EventType.USER_RESPONSE]
    assert len(user_resp_events) == 1

    # Verify final assistant message
    final_msg = harness.session.history[-1]
    assert final_msg.role == Role.ASSISTANT
    assert "1.5% per trade" in final_msg.content


@pytest.mark.asyncio
async def test_agent_harness_pseudo_tool_call_recovery():
    """
    Tests that if an LLM outputs a pseudo-tool call like `[Tool Call: name(args)]`
    as plain text instead of native tool calls, the harness intercepts and executes it.
    """
    rsi_called = False

    async def mock_rsi_handler(period: int = 14):
        nonlocal rsi_called
        rsi_called = True
        return {"rsi": 65.4, "period": period}

    mock_llm = MockLLMAdapter(turns=[
        [
            # Turn 1: LLM mistakenly outputs plain text pseudo-tool call instead of structured tool call
            ModelChunk(thought_delta="Let me calculate RSI using the tool..."),
            ModelChunk(content_delta='[Tool Call: calculate_rsi({"period": 14})]'),
        ],
        [
            # Turn 2: LLM receives tool result and provides final text answer
            ModelChunk(thought_delta="RSI is 65.4, market is moderately bullish."),
            ModelChunk(content_delta="The current 14-period RSI is 65.4, indicating bullish momentum."),
        ]
    ])

    harness = AgentHarness(
        session_id="sess_pseudo_001",
        user_id="usr_001",
        llm_adapter=mock_llm,
    )
    harness.register_tool(
        name="calculate_rsi",
        description="Calculates RSI for a given period",
        parameters={
            "type": "object",
            "properties": {"period": {"type": "integer"}},
            "required": ["period"],
        },
        handler=mock_rsi_handler,
    )

    events = []
    async for event in harness.run("Calculate the current RSI for me"):
        events.append(event)

    # Invariants:
    # 1. Handler was called
    assert rsi_called is True
    # 2. Tool call start and complete events were emitted
    tool_starts = [e for e in events if e.event_type == EventType.TOOL_CALL_STARTED]
    tool_finishes = [e for e in events if e.event_type == EventType.TOOL_CALL_FINISHED]
    assert len(tool_starts) == 1
    assert tool_starts[0].payload["tool_name"] == "calculate_rsi"
    assert tool_starts[0].payload["arguments"] == {"period": 14}
    assert len(tool_finishes) == 1
    # 3. Agent completed successfully
    assert harness.session.state == AgentState.DONE
    # 4. Final message contains result
    final_msg = harness.session.history[-1]
    assert "65.4" in final_msg.content


@pytest.mark.asyncio
async def test_agent_harness_executed_action_recovery():
    """
    Tests that if Gemini or any other LLM emits `(Executed action 'tool' with arguments {...})`
    as plain text, the harness recovers the tool call, strips the pseudo text from visible chat,
    and executes the tool.
    """
    compiled_file = ""

    async def mock_compile_mql5(filepath: str):
        nonlocal compiled_file
        compiled_file = filepath
        return {"success": True, "returncode": 0, "ex5_path": filepath.replace(".mq5", ".ex5")}

    mock_llm = MockLLMAdapter(turns=[
        [
            ModelChunk(thought_delta="I will compile the MQL5 expert advisor."),
            ModelChunk(content_delta='(Executed action \'compile_mql5\' with arguments {"filepath": "senior/gold.mq5"})'),
        ],
        [
            ModelChunk(thought_delta="Compilation succeeded. EA is ready."),
            ModelChunk(content_delta="The strategy gold.mq5 has been successfully compiled into gold.ex5."),
        ]
    ])

    harness = AgentHarness(
        session_id="sess_executed_001",
        user_id="usr_001",
        llm_adapter=mock_llm,
    )
    harness.register_tool(
        name="compile_mql5",
        description="Compiles an MQL5 Expert Advisor",
        parameters={
            "type": "object",
            "properties": {"filepath": {"type": "string"}},
            "required": ["filepath"],
        },
        handler=mock_compile_mql5,
    )

    events = []
    async for event in harness.run("Compile senior/gold.mq5"):
        events.append(event)

    assert compiled_file == "senior/gold.mq5"
    assert harness.session.state == AgentState.DONE

    # Verify that the pseudo text was stripped from the first assistant message
    asst_msg_1 = [m for m in harness.session.history if m.role == Role.ASSISTANT][0]
    assert "Executed action" not in asst_msg_1.content
    assert asst_msg_1.tool_calls is not None
    assert len(asst_msg_1.tool_calls) == 1
    assert asst_msg_1.tool_calls[0].name == "compile_mql5"
    assert asst_msg_1.tool_calls[0].arguments == {"filepath": "senior/gold.mq5"}


def test_tool_call_stream_delta_decoupling():
    """
    Tests that streaming tool call deltas with missing indices or repeated index 0
    do not concatenate tool names or JSON payloads.
    """
    from packages.agent.src.adapters.llm import (
        _accumulate_tool_delta,
        _parse_possibly_concatenated_json,
        _build_final_tool_calls,
    )

    accumulators = {}

    # Tool Call 1: launch_sandbox_runner
    _accumulate_tool_delta(accumulators, {"index": 0, "id": "call_1", "function": {"name": "launch_sandbox_runner", "arguments": ""}})
    _accumulate_tool_delta(accumulators, {"index": 0, "function": {"arguments": '{"view_mode": "sandbox_runner"}'}})

    # Tool Call 2: run_strategy_tester arrives on index 0 without index bump
    _accumulate_tool_delta(accumulators, {"index": 0, "id": "call_2", "function": {"name": "run_strategy_tester", "arguments": ""}})
    _accumulate_tool_delta(accumulators, {"index": 0, "function": {"arguments": '{"ea_name": "gold.ex5", "symbol": "XAUUSD"}'}})

    assert len(accumulators) == 2, f"Expected 2 separate accumulators, got {len(accumulators)}"
    assert accumulators[0]["name"] == "launch_sandbox_runner"
    assert accumulators[0]["arguments"] == '{"view_mode": "sandbox_runner"}'
    assert accumulators[1]["name"] == "run_strategy_tester"
    assert accumulators[1]["arguments"] == '{"ea_name": "gold.ex5", "symbol": "XAUUSD"}'

    final_calls = _build_final_tool_calls(accumulators)
    assert len(final_calls) == 2
    assert final_calls[0].name == "launch_sandbox_runner"
    assert final_calls[0].arguments == {"view_mode": "sandbox_runner"}
    assert final_calls[1].name == "run_strategy_tester"
    assert final_calls[1].arguments == {"ea_name": "gold.ex5", "symbol": "XAUUSD"}


def test_concatenated_json_parsing():
    """Tests _parse_possibly_concatenated_json parses multi-object JSON payloads."""
    from packages.agent.src.adapters.llm import _parse_possibly_concatenated_json

    raw = '{"view_mode": "sandbox_runner"}{"ea_name": "gold.ex5", "symbol": "XAUUSD"}'
    parsed = _parse_possibly_concatenated_json(raw)
    assert len(parsed) == 2
    assert parsed[0] == {"view_mode": "sandbox_runner"}
    assert parsed[1] == {"ea_name": "gold.ex5", "symbol": "XAUUSD"}


def test_agent_harness_decomposed_glued_tool_call():
    """
    Tests that AgentHarness._decompose_tool_call splits a glued tool name like
    'launch_sandbox_runnerrun_strategy_tester' into separate valid ToolCalls.
    """
    harness = AgentHarness(session_id="test_decomp", user_id="u1", llm_adapter=MockLLMAdapter([]))
    harness.register_tool(
        name="launch_sandbox_runner",
        description="launch",
        parameters={"type": "object", "properties": {}},
        handler=lambda **k: {},
    )
    harness.register_tool(
        name="run_strategy_tester",
        description="tester",
        parameters={"type": "object", "properties": {}},
        handler=lambda **k: {},
    )

    glued_call = ToolCall(
        id="call_glued",
        name="launch_sandbox_runnerrun_strategy_tester",
        arguments={"raw_arguments": '{"view_mode": "sandbox"}{"ea_name": "gold.ex5"}'},
    )

    decomposed = harness._decompose_tool_call(glued_call)
    assert len(decomposed) == 2
    assert decomposed[0].name == "launch_sandbox_runner"
    assert decomposed[0].arguments == {"view_mode": "sandbox"}
    assert decomposed[1].name == "run_strategy_tester"
    assert decomposed[1].arguments == {"ea_name": "gold.ex5"}


