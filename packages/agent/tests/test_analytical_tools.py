"""
Unit tests for Analytical Market Inspection Tools in packages/agent.
Verifies market data querying, ATR volatility, trend regime classification,
chart support/resistance detection, and AgentHarness dispatch.
"""

from __future__ import annotations
import pytest

from packages.agent.src.core.harness import AgentHarness, ModelChunk
from packages.agent.src.core.types import AgentState, EventType, ToolCall
from packages.agent.src.tools.analytical import (
    inspect_chart_context,
    query_market_data,
    register_analytical_tools,
)


@pytest.mark.asyncio
async def test_query_market_data_btcusdt():
    res = await query_market_data(symbol="XAUUSD", timeframe="1h", limit=50)
    assert res["success"] is True
    assert res["symbol"] == "XAUUSD"
    assert res["bars_inspected"] > 0
    assert "current_price" in res
    assert "atr" in res
    assert "volatility_pct" in res
    assert res["period_high"] >= res["period_low"]
    assert res["regime"] in ("BULLISH_TREND", "BEARISH_TREND", "CONSOLIDATION_RANGE", "TRANSITIONAL_REGIME")


@pytest.mark.asyncio
async def test_query_market_data_invalid_symbol():
    res = await query_market_data(symbol="UNKNOWN_XYZ", timeframe="1h", limit=20)
    assert res["success"] is False
    assert "error" in res


@pytest.mark.asyncio
async def test_inspect_chart_context_structure():
    chart = await inspect_chart_context(symbol="XAUUSD", timeframe="1h", window_bars=25)
    assert chart["success"] is True
    assert chart["nearest_resistance"] >= chart["nearest_support"]
    assert "market_structure" in chart
    assert len(chart["recent_candles"]) <= 5
    # Verify candle fields
    for c in chart["recent_candles"]:
        assert "open" in c
        assert "close" in c
        assert "type" in c
        assert c["type"] in ("BULLISH", "BEARISH", "DOJI")


class MockLLMForAnalyticalTool:
    def __init__(self, tool_call: ToolCall, final_answer: str) -> None:
        self.tool_call = tool_call
        self.final_answer = final_answer
        self.turn = 0

    async def generate_turn(self, messages, tools):
        self.turn += 1
        if self.turn == 1:
            yield ModelChunk(
                thought_delta="Inspecting current market volatility...",
                tool_calls=[self.tool_call],
            )
        else:
            yield ModelChunk(
                thought_delta="Regime analysis complete.",
                content_delta=self.final_answer,
            )


@pytest.mark.asyncio
async def test_harness_dispatches_analytical_tool():
    tool_call = ToolCall(
        id="tc_anal_1",
        name="query_market_data",
        arguments={"symbol": "XAUUSD", "timeframe": "1h", "limit": 40},
    )
    mock_llm = MockLLMForAnalyticalTool(tool_call, "The market is currently exhibiting moderate volatility.")

    harness = AgentHarness(
        session_id="sess_anal_tool_test",
        user_id="usr_quant_anal",
        llm_adapter=mock_llm,
    )
    register_analytical_tools(harness)

    assert "query_market_data" in harness._tools
    assert "inspect_chart_context" in harness._tools

    events = []
    async for event in harness.run("What is current volatility on XAUUSD?"):
        events.append(event)

    assert harness.session.state == AgentState.DONE
    types = [e.event_type for e in events]
    assert EventType.TOOL_CALL_STARTED in types
    assert EventType.TOOL_CALL_FINISHED in types

    tool_msg = [m for m in harness.session.history if m.role.value == "tool"][0]
    assert "volatility_pct" in tool_msg.content
