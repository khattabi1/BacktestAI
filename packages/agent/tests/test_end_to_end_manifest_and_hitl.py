"""
End-to-End System Verification Test Suite:
Validates StrategyManifest Governance, Static Code Introspection,
Pre-Flight Invariant Gate Protection, Interactive Human-in-the-Loop Pause/Resume,
and Cooperative Session Lifecycle Cancellation.
"""

from __future__ import annotations
import asyncio
import os
import shutil
import pytest
from pathlib import Path

from packages.agent.src.core.types import (
    AgentSessionState,
    AgentState,
    EventType,
    StrategyManifest,
    ToolCall,
)
from packages.agent.src.core.harness import AgentHarness, ModelChunk
from packages.agent.src.core.introspector import introspect_strategy_code
from packages.agent.src.storage.sqlite import SQLiteSessionStorage
from packages.agent.src.tools.workspace import (
    USERS_STORAGE_DIR,
    create_folder,
    create_file,
    register_workspace_tools,
)
from packages.agent.src.tools.mt5_mcp import (
    _preflight_check_tester_args,
    register_mt5_mcp_tools,
)


TEST_USER = "e2e_gov_trader"
STRATEGY_NAME = "sk_gold_sequencer"


@pytest.fixture(autouse=True)
def cleanup_e2e_workspace():
    """Ensures test workspace directory is clean before and after tests."""
    user_dir = USERS_STORAGE_DIR / TEST_USER
    if user_dir.exists():
        shutil.rmtree(user_dir, ignore_errors=True)
    yield
    if user_dir.exists():
        shutil.rmtree(user_dir, ignore_errors=True)


class MultiTurnMockLLM:
    """Mock LLM adapter simulating multi-turn reasoning with ask_user and MT5 testing."""
    def __init__(self):
        self.turn = 0

    async def generate_turn(self, history, tools):
        self.turn += 1
        if self.turn == 1:
            # Turn 1: Questions the trader using ask_user (Human in the Loop)
            yield ModelChunk(
                thought_delta="Strategy has multiple risk configurations. Clarifying with trader...",
                tool_calls=[
                    ToolCall(
                        id="call_ask_risk",
                        name="ask_user",
                        arguments={
                            "question": "What maximum drawdown threshold should be enforced?",
                            "options": ["5% Hard Equity Stop", "10% Trailing Stop"],
                            "context": "M5 gold sequencer risk limit",
                        },
                    )
                ],
            )
        elif self.turn == 2:
            # Turn 2: After user resumes with answer, completes analysis
            yield ModelChunk(
                thought_delta="Trader chose custom limit. Finalizing strategy configuration.",
                content_delta="Configured sk_gold_sequencer on XAUUSD M5 with trader-selected risk threshold.",
            )


@pytest.mark.asyncio
async def test_end_to_end_manifest_preflight_and_hitl_lifecycle(tmp_path):
    """
    Comprehensive End-to-End Test verifying all 5 pillars:
    1. Static Introspection: Extracts manifest without LLM hallucinations.
    2. Prompt Injection: Injects [STRATEGY MANIFEST] at index 0 of system prompt.
    3. Pre-Flight Invariant Gate: Blocks H1 tester calls and missing arguments.
    4. Human-in-the-Loop State Machine: Pauses at ask_user, appends 'Other', and resumes cleanly.
    5. Cooperative Cancellation: Halts session cleanly on demand.
    """
    storage = SQLiteSessionStorage(db_path=str(tmp_path / "e2e_governance.db"))

    # -------------------------------------------------------------------------
    # Pillar 1: Code Introspection
    # -------------------------------------------------------------------------
    mql5_code = """//+------------------------------------------------------------------+
//|                                          sk_gold_sequencer.mq5   |
//|                                  Copyright 2026, Quant Studio   |
//+------------------------------------------------------------------+
#property version   "2.00"
#property description "Gold Liquidity Sweeper M5"
input string InpSymbol = "XAUUSD";
input ENUM_TIMEFRAMES InpTimeframe = PERIOD_M5;

int OnInit() { return INIT_SUCCEEDED; }
void OnTick() {}
"""
    manifest = introspect_strategy_code(f"{STRATEGY_NAME}.mq5", code_content=mql5_code)
    assert manifest.strategy_name == STRATEGY_NAME
    assert manifest.version == 2
    assert manifest.target_symbol == "XAUUSD"
    assert manifest.native_timeframe == "M5"

    # -------------------------------------------------------------------------
    # Pillar 2: Session Anchoring & System Prompt Injection
    # -------------------------------------------------------------------------
    mock_llm = MultiTurnMockLLM()
    harness = AgentHarness(
        session_id="sess_e2e_manifest_hitl",
        user_id=TEST_USER,
        llm_adapter=mock_llm,
        storage=storage,
    )
    register_workspace_tools(harness, user_id=TEST_USER)
    register_mt5_mcp_tools(harness)

    # Set manifest and sync
    harness.session.strategy_manifest = manifest
    assert harness.session.strategy_manifest is not None
    assert harness.session.strategy_manifest.target_symbol == "XAUUSD"

    # Verify top-of-context system prompt injection
    effective_prompt = harness._build_effective_system_prompt()
    assert effective_prompt.startswith("[STRATEGY MANIFEST:")
    assert "Strategy='sk_gold_sequencer'" in effective_prompt
    assert "Symbol='XAUUSD'" in effective_prompt
    assert "TF='M5'" in effective_prompt

    # -------------------------------------------------------------------------
    # Pillar 3: Pre-Flight Invariant Gate Protection
    # -------------------------------------------------------------------------
    # A) Mismatched timeframe (H1 instead of M5) is intercepted and rejected
    valid, err, fixed = _preflight_check_tester_args(
        ea_name="sk_gold_sequencer.ex5",
        symbol="XAUUSD",
        period="H1",
        manifest=manifest,
    )
    assert not valid
    assert "PRE-FLIGHT VALIDATION REJECTED" in err
    assert "M5" in err and "H1" in err

    # B) Omitted period inherits verified dimensions from manifest
    valid, err, fixed = _preflight_check_tester_args(
        ea_name="sk_gold_sequencer.ex5",
        symbol="XAUUSD",
        period=None,
        manifest=manifest,
    )
    assert valid
    assert fixed["period"] == "M5"
    assert fixed["symbol"] == "XAUUSD"

    # C) Pending manifest with missing args is rejected
    pending_manifest = StrategyManifest(
        strategy_name="unverified_ea",
        target_symbol="PENDING",
        native_timeframe="PENDING",
    )
    valid, err, fixed = _preflight_check_tester_args(
        ea_name="unverified_ea.ex5",
        symbol=None,
        period=None,
        manifest=pending_manifest,
    )
    assert not valid
    assert "PRE-FLIGHT VALIDATION REJECTED" in err

    # -------------------------------------------------------------------------
    # Pillar 4: Human-in-the-Loop Interaction Loop (ask_user -> resume)
    # -------------------------------------------------------------------------
    turn1_events = []
    async for ev in harness.run(user_prompt="Initialize and optimize the gold sequencer strategy"):
        turn1_events.append(ev)

    # Agent paused at ask_user
    assert harness.session.state == AgentState.WAITING_FOR_USER
    assert harness.session.pending_interaction is not None
    assert harness.session.pending_interaction["question"] == "What maximum drawdown threshold should be enforced?"

    # Verify mandatory "Other" option was automatically added to choices
    options = harness.session.pending_interaction["options"]
    assert "Other" in options
    assert len(options) == 3

    # Trader responds via resume
    turn2_events = []
    async for ev in harness.resume(user_response="Other: 3.5% Conservative Limit"):
        turn2_events.append(ev)

    # Agent completed the turn
    assert harness.session.state == AgentState.DONE
    assert harness.session.pending_interaction is None
    last_msg = harness.session.history[-1]
    assert "Configured sk_gold_sequencer on XAUUSD M5" in last_msg.content

    # -------------------------------------------------------------------------
    # Pillar 5: Cooperative Cancellation
    # -------------------------------------------------------------------------
    # Cancel the harness and verify clean abortion
    harness.cancel()
    assert harness._is_cancelled is True
    assert harness.session.state == AgentState.DONE

    # Re-running while cancelled halts immediately
    post_cancel_events = []
    async for ev in harness.run(user_prompt="Run more tests"):
        post_cancel_events.append(ev)
    assert len(post_cancel_events) == 0
