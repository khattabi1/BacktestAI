"""
Unit Tests for QuantSessionDigest Rolling Conversation Compactor.
Verifies context window protection, milestone retention, and harness event emission.
"""

import pytest
import asyncio
import json
from typing import AsyncGenerator, List

from packages.agent.src.core.compaction import QuantSessionDigest
from packages.agent.src.core.types import EventType, Message, Role, AgentState
from packages.agent.src.core.harness import AgentHarness, ModelChunk


class MockAdapter:
    async def generate_turn(self, messages, tools):
        yield ModelChunk(content_delta="Understood your strategy rules.", is_finished=True)


def test_should_compact_threshold():
    """Verifies compaction threshold triggers only when history exceeds limit."""
    history = [
        Message(role=Role.SYSTEM, content="System prompt"),
        Message(role=Role.USER, content="Hello"),
        Message(role=Role.ASSISTANT, content="Hi"),
    ]
    assert QuantSessionDigest.should_compact(history, threshold=12) is False

    long_history = [
        Message(role=Role.SYSTEM, content="System prompt")
    ] + [
        Message(role=Role.USER if i % 2 == 0 else Role.ASSISTANT, content=f"Turn {i}")
        for i in range(14)
    ]
    assert QuantSessionDigest.should_compact(long_history, threshold=12) is True


def test_distill_messages_retains_quant_milestones():
    """Verifies that key metrics, backtest results, and hypotheses are preserved."""
    messages = [
        Message(role=Role.USER, content="Test SMA crossover on BTCUSDT with 50 and 200 periods"),
        Message(
            role=Role.TOOL,
            content='{"strategy_id": "sma_crossover", "net_profit_pct": 24.5, "sharpe_ratio": 1.82, "max_drawdown_pct": 8.3}',
        ),
        Message(
            role=Role.ASSISTANT,
            content="Based on the backtest:\n- Sharpe ratio of 1.82 demonstrates strong risk-adjusted returns.\n- Max drawdown is 8.3%.",
        ),
    ]

    digest = QuantSessionDigest.distill_messages(messages)
    assert "[QUANT RESEARCH DIGEST" in digest
    assert "Backtest 'sma_crossover'" in digest
    assert "Sharpe 1.82" in digest
    assert "Return 24.5%" in digest
    assert "BTCUSDT" in digest


def test_compact_history_structure():
    """Verifies that compact_history preserves root system prompt and recent turns."""
    root_system = Message(role=Role.SYSTEM, content="Master System Prompt")
    turns = [
        Message(role=Role.USER if i % 2 == 0 else Role.ASSISTANT, content=f"Message {i}")
        for i in range(15)
    ]
    history = [root_system] + turns

    compacted = QuantSessionDigest.compact_history(history, keep_recent=4)
    assert len(compacted) == 6  # root system + digest message + 4 recent messages
    assert compacted[0].content == "Master System Prompt"
    assert "[QUANT RESEARCH DIGEST" in compacted[1].content
    assert compacted[-1].content == "Message 14"
    assert compacted[-2].content == "Message 13"


@pytest.mark.asyncio
async def test_harness_emits_compaction_announcement():
    """Verifies that AgentHarness emits STATUS_ANNOUNCEMENT when compaction occurs."""
    harness = AgentHarness(
        session_id="test_compaction_sess",
        user_id="test_user",
        llm_adapter=MockAdapter(),
    )

    # Seed long history
    for i in range(15):
        harness.session.append_message(
            Message(role=Role.USER if i % 2 == 0 else Role.ASSISTANT, content=f"Turn message {i}")
        )

    events: List[EventType] = []
    async for event in harness.run(user_prompt="Run next turn"):
        events.append(event.event_type)

    assert EventType.STATUS_ANNOUNCEMENT in events
    assert EventType.MESSAGE_COMPLETE in events


def test_should_compact_character_budget():
    """Verifies that compaction triggers on character budget even with few messages."""
    short_history = [
        Message(role=Role.SYSTEM, content="System prompt"),
        Message(role=Role.USER, content="A" * 16000),
        Message(role=Role.ASSISTANT, content="B" * 16000),
    ]
    # Total chars = 32000 > max_chars 30000 -> should trigger compaction
    assert QuantSessionDigest.should_compact(short_history, threshold=12, max_chars=30000) is True


def test_format_tool_output_for_session_slims_massive_backtests():
    """Verifies that thousands of trades are compacted into a high-density summary."""
    from packages.agent.src.core.harness import _format_tool_output_for_session

    fake_trades = [
        {
            "trade_id": str(i),
            "symbol": "XAUUSD",
            "side": "BUY",
            "pnl": 100.0 if i % 2 == 0 else -50.0,
            "entry_price": 2650.0,
            "exit_price": 2660.0,
        }
        for i in range(2500)
    ]
    raw_output = {
        "success": True,
        "strategy_id": "ict_gold_scalper",
        "symbol": "XAUUSD",
        "timeframe": "M15",
        "metrics": {"net_profit": 5200.0, "sharpe_ratio": 2.15, "max_drawdown_pct": 4.2},
        "trades": fake_trades,
    }

    formatted = _format_tool_output_for_session("run_strategy_tester", raw_output)
    # The formatted output must be small and token-efficient (< 3000 chars)
    assert len(formatted) < 3000
    import json
    parsed = json.loads(formatted)
    assert parsed["success"] is True
    assert parsed["strategy_id"] == "ict_gold_scalper"
    assert parsed["metrics"]["sharpe_ratio"] == 2.15
    assert parsed["total_trades_count"] == 2500
    assert len(parsed["sample_trades"]) <= 6


def test_sanitize_message_content_prevents_overflow():
    """Verifies that _sanitize_message_content prunes oversized arrays and strings."""
    from packages.agent.src.adapters.llm import _sanitize_message_content

    # 1. Prunes oversized JSON tool arrays
    tool_payload = json.dumps({"trades": [{"id": i} for i in range(100)], "metrics": {"sharpe": 1.5}})
    sanitized = _sanitize_message_content("tool", tool_payload)
    data = json.loads(sanitized)
    assert len(data["trades"]) == 6  # first 3 + last 3
    assert data["metrics"]["sharpe"] == 1.5

    # 2. Hard caps strings exceeding max_chars
    giant_string = "x" * 25000
    capped = _sanitize_message_content("user", giant_string, max_chars=10000)
    assert len(capped) <= 10500
    assert "OMITTED" in capped
