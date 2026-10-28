"""
Unit tests for Strategy Tools Plugin in packages/agent.
Verifies validation, MQL5 EA generation, database CRUD, and tool dispatch via AgentHarness.
"""

from __future__ import annotations
import pytest

from packages.agent.src.core.harness import AgentHarness, ModelChunk
from packages.agent.src.core.types import AgentState, EventType, ToolCall
from packages.agent.src.tools.strategy import (
    create_strategy,
    edit_strategy,
    generate_mql5_ea,
    read_strategy,
    register_strategy_tools,
    transpile_python_to_mql5,
    validate_strategy,
)


@pytest.mark.asyncio
async def test_validate_strategy_python_success():
    valid_code = """
class TrendFollower:
    def __init__(self, period: int = 20):
        self.period = period

    def on_bar(self, bar):
        return True
"""
    result = await validate_strategy(valid_code, "python")
    assert result["is_valid"] is True
    assert len(result["errors"]) == 0


@pytest.mark.asyncio
async def test_validate_strategy_python_syntax_error():
    invalid_code = "def broken_syntax(bar:\n    return True"
    result = await validate_strategy(invalid_code, "python")
    assert result["is_valid"] is False
    assert len(result["errors"]) > 0
    assert "Syntax Error" in result["errors"][0]


@pytest.mark.asyncio
async def test_validate_strategy_python_dangerous_calls():
    malicious_code = "def execute():\n    eval('2 + 2')"
    result = await validate_strategy(malicious_code, "python")
    assert result["is_valid"] is False
    assert any("Dangerous call" in e for e in result["errors"])


@pytest.mark.asyncio
async def test_validate_strategy_mql5():
    valid_mql5 = """
int OnInit() { return(INIT_SUCCEEDED); }
void OnTick() { Print("Tick"); }
"""
    result = await validate_strategy(valid_mql5, "mql5")
    assert result["is_valid"] is True

    unbalanced_mql5 = "int OnInit() { return 0;"
    result_bad = await validate_strategy(unbalanced_mql5, "mql5")
    assert result_bad["is_valid"] is False
    assert any("Unbalanced curly braces" in e for e in result_bad["errors"])


@pytest.mark.asyncio
async def test_generate_mql5_ea():
    ea = await generate_mql5_ea(
        name="BreakoutBot",
        symbol="GBPUSD",
        timeframe="PERIOD_H1",
        entry_rule="High breakout of previous bar",
        sl_pips=25.0,
        tp_pips=50.0,
        risk_percent=1.5,
    )
    assert ea["success"] is True
    code = ea["mql5_code"]
    assert "BreakoutBot.mq5" in code
    assert "InpRiskPercent     = 1.5" in code
    assert "InpStopLossPips    = 25.0" in code
    assert "InpTakeProfitPips  = 50.0" in code
    assert "InpSymbol          = \"GBPUSD\"" in code
    assert "CalculateLotSize" in code
    assert "OnTick()" in code


@pytest.mark.asyncio
async def test_transpile_python_to_mql5():
    py_code = """
class MyStrategy:
    def __init__(self, fast_period: int = 14, slow_period: int = 50):
        pass
"""
    result = await transpile_python_to_mql5(py_code, symbol="EURUSD")
    assert result["success"] is True
    assert "mql5" in result["target_language"]
    assert "OnInit()" in result["mql5_code"]
    assert "OnTick()" in result["mql5_code"]


@pytest.mark.asyncio
async def test_strategy_crud_lifecycle():
    sample_code = """
class TestRsiScalp:
    def __init__(self, rsi_period: int = 14):
        self.rsi_period = rsi_period
"""
    # 1. Create
    created = await create_strategy(
        name="Auto Test RSI Strategy",
        code=sample_code,
        description="Created via automated test",
        default_parameters={"rsi_period": 14},
    )
    assert created["success"] is True
    strat_id = created["strategy"]["id"]

    # 2. Read
    read = await read_strategy(strat_id)
    assert read["found"] is True
    assert read["name"] == "Auto Test RSI Strategy"
    assert "TestRsiScalp" in read["code"]

    # 3. Edit
    updated_code = """
class TestRsiScalp:
    def __init__(self, rsi_period: int = 21):
        self.rsi_period = rsi_period
"""
    edited = await edit_strategy(
        strategy_id=strat_id,
        updated_code=updated_code,
        updated_parameters={"rsi_period": 21},
    )
    assert edited["success"] is True
    assert edited["strategy"]["default_parameters"] == '{"rsi_period": 21}' or edited["strategy"]["default_parameters"] == {"rsi_period": 21}


class MockLLMForToolCall:
    def __init__(self, tool_call: ToolCall, final_answer: str) -> None:
        self.tool_call = tool_call
        self.final_answer = final_answer
        self.turn = 0

    async def generate_turn(self, messages, tools):
        self.turn += 1
        if self.turn == 1:
            yield ModelChunk(
                thought_delta="Inspecting strategy...",
                tool_calls=[self.tool_call],
            )
        else:
            yield ModelChunk(
                thought_delta="Strategy verified.",
                content_delta=self.final_answer,
            )


@pytest.mark.asyncio
async def test_harness_dispatches_strategy_tool():
    # Setup harness with strategy tools registered
    tool_call = ToolCall(
        id="tc_strat_1",
        name="validate_strategy",
        arguments={"code": "class ValidStrat: pass", "language": "python"},
    )
    mock_llm = MockLLMForToolCall(tool_call, "The code is completely valid.")

    harness = AgentHarness(
        session_id="sess_strat_tool_test",
        user_id="usr_quant_1",
        llm_adapter=mock_llm,
    )
    register_strategy_tools(harness, user_id="usr_quant_1")

    # Verify tools registered in harness
    assert "validate_strategy" in harness._tools
    assert "create_strategy" in harness._tools
    assert "read_strategy" in harness._tools
    assert "generate_mql5_ea" in harness._tools

    events = []
    async for event in harness.run("Can you validate my strategy code?"):
        events.append(event)

    assert harness.session.state == AgentState.DONE
    # Check that tool call started and finished
    types = [e.event_type for e in events]
    assert EventType.TOOL_CALL_STARTED in types
    assert EventType.TOOL_CALL_FINISHED in types

    # Check tool result was captured in history
    tool_msg = [m for m in harness.session.history if m.role.value == "tool"][0]
    assert "is_valid" in tool_msg.content
