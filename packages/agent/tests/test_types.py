"""
Unit tests for packages/agent/src/core/types.py
Validates AgentState, StrategyInceptionState, StrategyManifest, validate_strategy_name,
format_strategy_filename, and AgentSessionState.
"""

import pytest
from packages.agent.src.core.types import (
    AgentState,
    StrategyInceptionState,
    EventType,
    Role,
    ToolCall,
    ToolResult,
    Message,
    TrajectoryEvent,
    StrategyManifest,
    AgentSessionState,
    validate_strategy_name,
    format_strategy_filename,
)


def test_agent_and_inception_states_enums():
    # Verify AgentState values
    assert AgentState.IDLE.value == "IDLE"
    assert AgentState.THINKING.value == "THINKING"
    assert AgentState.EXECUTING_TOOL.value == "EXECUTING_TOOL"
    assert AgentState.WAITING_FOR_USER.value == "WAITING_FOR_USER"
    assert AgentState.DONE.value == "DONE"
    assert AgentState.ERROR.value == "ERROR"

    # Verify StrategyInceptionState values
    assert StrategyInceptionState.DISCUSSING.value == "DISCUSSING"
    assert StrategyInceptionState.PRESET_REVIEW.value == "PRESET_REVIEW"
    assert StrategyInceptionState.CODE_PROPOSED.value == "CODE_PROPOSED"
    assert StrategyInceptionState.COMPILED.value == "COMPILED"
    assert StrategyInceptionState.READY_FOR_TEST.value == "READY_FOR_TEST"
    assert StrategyInceptionState.TESTED.value == "TESTED"
    assert StrategyInceptionState.VERSIONED.value == "VERSIONED"


def test_validate_strategy_name():
    # Valid 2-word names
    ok, norm, err = validate_strategy_name("gold_scalper")
    assert ok is True
    assert norm == "gold_scalper"
    assert err == ""

    # Valid 3-word names
    ok, norm, err = validate_strategy_name("ict_gold_scalper")
    assert ok is True
    assert norm == "ict_gold_scalper"
    assert err == ""

    # Valid with file extension and version suffix
    ok, norm, err = validate_strategy_name("ict_gold_scalper_v1.py")
    assert ok is True
    assert norm == "ict_gold_scalper"

    # Valid with spaces and dashes normalized
    ok, norm, err = validate_strategy_name("ICT-Gold Scalper")
    assert ok is True
    assert norm == "ict_gold_scalper"

    # Valid 4-word names
    ok, norm, err = validate_strategy_name("gold_m1_liquidity_scalper")
    assert ok is True
    assert norm == "gold_m1_liquidity_scalper"
    assert err == ""

    # Valid 6-word names
    ok, norm, err = validate_strategy_name("gold_m1_liquidity_sweep_scalper_pro")
    assert ok is True
    assert norm == "gold_m1_liquidity_sweep_scalper_pro"
    assert err == ""

    # Invalid: 1 word
    ok, norm, err = validate_strategy_name("scalper")
    assert ok is False
    assert "between 2 and 6 words" in err

    # Invalid: > 6 words (7 words)
    ok, norm, err = validate_strategy_name("too_many_words_in_this_strategy_name_here")
    assert ok is False
    assert "between 2 and 6 words" in err

    # Invalid: empty string
    ok, norm, err = validate_strategy_name("")
    assert ok is False

    # Invalid: special characters
    ok, norm, err = validate_strategy_name("ict$gold@scalper")
    assert ok is False


def test_format_strategy_filename():
    fn1 = format_strategy_filename("ict_gold_scalper", version=1)
    assert fn1 == "ict_gold_scalper_v1.py"

    fn2 = format_strategy_filename("ict_gold_scalper", version=2)
    assert fn2 == "ict_gold_scalper_v2.py"

    fn_mq5 = format_strategy_filename("ict_gold_scalper", version=1, ext="mq5")
    assert fn_mq5 == "ict_gold_scalper_v1.mq5"


def test_strategy_manifest_compact_header():
    manifest = StrategyManifest(
        strategy_name="ict_gold_scalper",
        version=1,
        target_symbol="XAUUSD",
        native_timeframe="M5",
        engine="MT5",
        core_rules_summary="FVG + Liquidity Sweep",
        test_status="TESTED_PASSED",
        last_test_metrics={"win_rate": 65.5, "sharpe": 2.45, "total_trades": 128},
    )

    header = manifest.to_compact_header()
    assert "Strategy='ict_gold_scalper'" in header
    assert "v1" in header
    assert "Symbol='XAUUSD'" in header
    assert "TF='M5'" in header
    assert "Engine='MT5'" in header
    assert "Status='TESTED_PASSED'" in header
    assert "Rules='FVG + Liquidity Sweep'" in header
    assert "WR:65.5%" in header
    assert "Sharpe:2.45" in header
    assert "Trades:128" in header


def test_agent_session_state_events_and_messages():
    session = AgentSessionState(
        session_id="sess_123",
        user_id="user_quant",
        title="Gold Scalping Research",
    )

    assert session.state == AgentState.IDLE
    assert session.inception_state == StrategyInceptionState.DISCUSSING
    assert len(session.trajectory) == 0
    assert len(session.history) == 0

    # Append event
    evt = session.append_event(
        event_type=EventType.SESSION_STARTED,
        payload={"started": True},
    )
    assert evt.step_index == 1
    assert evt.event_type == EventType.SESSION_STARTED
    assert len(session.trajectory) == 1

    # Append message
    msg = Message(
        role=Role.USER,
        content="I want to build a Gold scalper on M5",
    )
    session.append_message(msg)
    assert len(session.history) == 1
    assert session.history[0].content == "I want to build a Gold scalper on M5"

    # ToolCall and ToolResult models
    call = ToolCall(id="call_1", name="get_market_data", arguments={"symbol": "XAUUSD"})
    res = ToolResult(call_id="call_1", tool_name="get_market_data", output={"bars": 100})
    assert call.name == "get_market_data"
    assert res.output["bars"] == 100
    assert res.is_error is False
