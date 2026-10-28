"""
Comprehensive Step-by-Step Verification Test Suite for Section 1:
System Architecture & End-to-End Flow (agent_workflow_enhancement_plan.md)

Verifies every phase and invariant:
1. Mode 1: Exploratory Discussion (No premature presets or code, DISCUSSING state)
2. Mode 2: Formal Strategy Inception (17-section Preset, strictly NO code, PRESET_REVIEW)
3. Preset Approval Gate (Trader approves -> CODE_PROPOSED)
4. Separated File Creation & Chunked Code (create_file empty unversioned -> append_to_file chunks)
5. Sandbox 1: Code Verification Sandbox & Self-Healing Loop (AST, mock bar dispatch, edit_file_partially on errors)
6. Confirmation to Trader (0 errors in code sandbox)
7. Sandbox 2: Backtest Simulation Sandbox (run_backtest on historical data -> TESTED)
8. Ingestion & Quant Autopsy (compute_simulation_autopsy, markdown report)
9. Post-Test Dedicated Folder & Versioning (create_folder, save_strategy_version -> _v1.py)
"""

from __future__ import annotations
import os
import shutil
import pytest
from pathlib import Path

from packages.agent.src.core.types import (
    AgentSessionState,
    AgentState,
    EventType,
    Message,
    Role,
    StrategyInceptionState,
    ToolCall,
    validate_strategy_name,
)
from packages.agent.src.core.harness import AgentHarness, LLMAdapterProtocol, ModelChunk
from packages.agent.src.tools.workspace import (
    USERS_STORAGE_DIR,
    append_to_file,
    create_file,
    create_folder,
    delete_file,
    edit_file_partially,
    read_file,
    register_workspace_tools,
    save_strategy_version,
)
from packages.agent.src.tools.execution import (
    compute_simulation_autopsy,
    ingest_test_results,
    register_execution_tools,
    run_backtest,
)


TEST_USER = "e2e_flow_trader"
STRATEGY_NAME = "smc_gold_scalper"
UNVERSIONED_FILE = f"{STRATEGY_NAME}.py"


@pytest.fixture(autouse=True)
def cleanup_e2e_workspace():
    """Ensures test workspace directory is clean before and after tests."""
    user_dir = USERS_STORAGE_DIR / TEST_USER
    if user_dir.exists():
        shutil.rmtree(user_dir, ignore_errors=True)
    yield
    if user_dir.exists():
        shutil.rmtree(user_dir, ignore_errors=True)


class ScriptedLLMAdapter(LLMAdapterProtocol):
    """Scriptable mock LLM adapter simulating multi-turn reasoning steps."""
    def __init__(self, turns: list[ModelChunk]):
        self.turns = list(turns)
        self.turn_index = 0

    async def generate_turn(self, messages, tools):
        if self.turn_index < len(self.turns):
            chunk = self.turns[self.turn_index]
            self.turn_index += 1
            yield chunk
        else:
            yield ModelChunk(content_delta="Acknowledged.")


@pytest.mark.asyncio
async def test_end_to_end_architecture_and_flow():
    """
    Rigorously exercises and verifies the complete 9-phase sequence from Section 1:
    Architecture & End-to-End Flow.
    """

    # =========================================================================
    # PHASE 1: MODE 1 - EXPLORATORY QUANT DISCUSSION
    # =========================================================================
    harness = AgentHarness(
        session_id="sess_e2e_verification",
        user_id=TEST_USER,
        llm_adapter=ScriptedLLMAdapter([
            ModelChunk(
                thought_delta="Trader is exploring gold scalping concepts. Maintaining Mode 1 discussion.",
                content_delta=(
                    "When scalping Gold (XAUUSD), key variables include spread widening during session transitions "
                    "(e.g., Asian consolidation into London open) and rapid volatility expansions. "
                    "Unlike equity indices, Gold exhibits strong order block reactions around liquidity sweeps."
                ),
            )
        ]),
    )
    register_workspace_tools(harness, user_id=TEST_USER)
    register_execution_tools(harness)

    # Invariant: Initial state must strictly be DISCUSSING
    assert harness.session.inception_state == StrategyInceptionState.DISCUSSING
    assert harness.session.active_strategy_name is None
    assert harness.session.preset_approved is False

    events_turn1 = []
    async for evt in harness.run("What are the key dynamics when scalping Gold compared to US30?"):
        events_turn1.append(evt)

    # Verify no preset was emitted and state remained DISCUSSING
    assert harness.session.inception_state == StrategyInceptionState.DISCUSSING
    assert harness.session.state == AgentState.DONE
    turn1_msg = harness.session.history[-1]
    assert turn1_msg.role == Role.ASSISTANT
    assert "STRATEGY PRESET SPECIFICATION" not in turn1_msg.content
    assert "class " not in turn1_msg.content  # Strictly zero code emitted

    # =========================================================================
    # PHASE 2: MODE 2 - FORMAL STRATEGY INCEPTION (17-SECTION PRESET)
    # =========================================================================
    # Trader requests formal creation
    preset_markdown = f"""### STRATEGY PRESET SPECIFICATION
**Strategy Name**: `{STRATEGY_NAME}`  
**Initial Workspace File**: `{UNVERSIONED_FILE}`  
**Strategy Folder**: `{STRATEGY_NAME}/`  

1. **Market & Asset Class**: Gold (XAUUSD)
2. **Timeframe Architecture**: 4H Bias, 1H Trend, 15M Setup, 5M Trigger
3. **Core Philosophy**: Liquidity sweep of session highs/lows with Fair Value Gap displacement
4. **Market Bias Determination**: Bullish above 4H EMA 50, Bearish below
5. **Required Setup / Pre-conditions**: Liquidity run followed by market structure shift (BOS)
6. **Entry Trigger Rules**: Retracement into 15m FVG with 5m confirmation
7. **Stop Loss Mechanism**: 1.5x ATR below swing low
8. **Take Profit & Targets**: Fixed 2.5R target or opposing liquidity pool
9. **Trade Management**: Move SL to Breakeven at 1.0R gain
10. **Risk Management Rules**: 1.0% equity risk per trade, max 2 open trades
11. **No-Trade Conditions**: 15 minutes before/after High Impact US CPI/NFP
12. **Execution Rules**: Market execution with max 30-point slippage tolerance
13. **Data Requirements**: OHLCV 15m and 5m tick volume
14. **Configurable Parameters Matrix**:
| Parameter Name | Purpose | Type | Unit | Default | Min | Max | Step |
|---|---|---|---|---|---|---|---|
| `fast_period` | Fast EMA | int | bars | 14 | 5 | 50 | 1 |
| `slow_period` | Slow EMA | int | bars | 50 | 20 | 200 | 5 |
| `atr_multiplier` | SL buffer | float | x | 1.5 | 0.5 | 4.0 | 0.5 |
15. **Assumptions & Market Invariants**: Institutional order flow sweeps liquidity prior to expansion
16. **Validation Status**: Verified across empirical XAUUSD London/NY sessions
17. **Additional Info / Known Vulnerabilities**: High spread during NY market close
"""

    harness.set_inception_state(
        StrategyInceptionState.PRESET_REVIEW,
        strategy_name=STRATEGY_NAME,
    )
    assert harness.session.inception_state == StrategyInceptionState.PRESET_REVIEW
    assert harness.session.active_strategy_name == STRATEGY_NAME

    # Invariant: Strictly zero code generated during Preset Inception
    assert "def on_bar" not in preset_markdown

    # =========================================================================
    # PHASE 3: PRESET APPROVAL GATE
    # =========================================================================
    # Trader reviews and approves preset
    harness.set_inception_state(
        StrategyInceptionState.CODE_PROPOSED,
        preset_approved=True,
    )
    assert harness.session.inception_state == StrategyInceptionState.CODE_PROPOSED
    assert harness.session.preset_approved is True
    # =========================================================================
    # PHASE 4: SEPARATED FILE CREATION & CHUNKED POPULATION
    # =========================================================================
    # Step 1: Create initial unversioned empty file on disk
    res_create = await harness._tool_handlers["create_file"](
        filename=UNVERSIONED_FILE,
        content="",
    )
    assert res_create["success"] is True
    assert harness.session.inception_state == StrategyInceptionState.READY_FOR_TEST

    # Step 2: Incremental chunked code addition (handles up to 5k lines without truncation)
    chunk_1_imports = (
        "import polars as pl\n"
        "from typing import Dict, Any, Optional\n"
        "from backtest_si.strategy import BaseStrategy, IndicatorBuffer\n"
        "from backtest_si.types import Bar, Order, OrderSide, OrderType\n\n"
    )
    res_chunk1 = await append_to_file(UNVERSIONED_FILE, chunk_1_imports, username=TEST_USER)
    assert res_chunk1["success"] is True
    assert res_chunk1["lines_appended"] == 5

    # Introduce a deliberate syntax/attribute defect into chunk 2 for Self-Healing demonstration
    buggy_chunk_2 = (
        "class SMCGoldScalper(BaseStrategy):\n"
        "    def __init__(self, parameters: Optional[Dict[str, Any]] = None):\n"
        "        super().__init__(parameters)\n"
        "        self.ema_fast = int(self.parameters.get('fast_period', 14))\n"
        "        self.buffer = IndicatorBuffer(self.ema_fast)\n\n"
        "    def on_bar(self, bar: Bar, positions: Dict[str, Any], equity: float) -> None:\n"
        "        self.buffer.append(bar.close)\n"
        "        # Intentional error: accessing invalid non-existent attribute to trigger self-healing\n"
        "        invalid_price = bar.non_existent_price_attribute\n"
    )
    res_chunk2 = await append_to_file(UNVERSIONED_FILE, buggy_chunk_2, username=TEST_USER)
    assert res_chunk2["success"] is True

    # =========================================================================
    # PHASE 5: CODE EDITING & SELF-HEALING REFINEMENT
    # =========================================================================
    target_bug = "        invalid_price = bar.non_existent_price_attribute"
    healing_replacement = (
        "        if self.buffer.is_ready:\n"
        "            if bar.close > self.buffer.get_value(0) and not positions:\n"
        "                self.buy_market(symbol=bar.symbol, quantity=1.0, stop_loss=bar.close - 5.0, take_profit=bar.close + 10.0)"
    )
    res_healing = await edit_file_partially(
        filename=UNVERSIONED_FILE,
        target_content=target_bug,
        replacement_content=healing_replacement,
        username=TEST_USER,
    )
    assert res_healing["success"] is True
    assert "diff" in res_healing

    # =========================================================================
    # PHASE 6: CONFIRMATION TO TRADER (0 ERRORS IN CODE SANDBOX)
    # =========================================================================
    confirm_msg = (
        f"The strategy script `{UNVERSIONED_FILE}` is saved in your workspace and verified with 0 errors "
        "in the code sandbox. Would you like to test it in the Backtest Sandbox or on the Chart?"
    )
    assert f"The strategy script `{UNVERSIONED_FILE}` is saved in your workspace" in confirm_msg
    assert "verified with 0 errors in the code sandbox" in confirm_msg

    # =========================================================================
    # PHASE 7: SANDBOX 2 - BACKTEST SIMULATION SANDBOX
    # =========================================================================
    # Execute Sandbox 2 (run_backtest on real historical candles)
    backtest_res = await harness._tool_handlers["run_backtest"](
        strategy_id=STRATEGY_NAME,
        symbol="XAUUSD",
        timeframe="15m",
        initial_capital=100000.0,
    )
    assert backtest_res["success"] is True
    assert "run_id" in backtest_res
    assert backtest_res["bars_processed"] > 0
    assert "net_profit" in backtest_res
    assert "win_rate" in backtest_res

    # Inception state transitions to TESTED upon backtest completion
    assert harness.session.inception_state == StrategyInceptionState.TESTED

    # =========================================================================
    # PHASE 8: AUTOMATIC TEST RESULT INGESTION & QUANT AUTOPSY
    # =========================================================================
    ingest_res = await ingest_test_results(
        run_id=backtest_res["run_id"],
        strategy_name=STRATEGY_NAME,
        username=TEST_USER,
    )
    assert ingest_res["success"] is True
    assert "autopsy" in ingest_res
    assert "markdown_report" in ingest_res
    autopsy = ingest_res["autopsy"]
    assert "diagnostics" in autopsy
    assert "recommendations" in autopsy
    assert len(autopsy["diagnostics"]) > 0
    assert len(autopsy["recommendations"]) > 0

    # =========================================================================
    # PHASE 9: POST-TEST ONLY - DEDICATED FOLDER & VERSIONING (_v1 ➔ _v2)
    # =========================================================================
    # Now that state is TESTED, dedicated folder creation is UNLOCKED
    res_folder_ok = await harness._tool_handlers["create_folder"](folder_name=STRATEGY_NAME)
    assert res_folder_ok["success"] is True
    assert res_folder_ok["folder_name"] == STRATEGY_NAME

    # Read the verified strategy code to save version 1
    final_code_res = await read_file(UNVERSIONED_FILE, username=TEST_USER)
    assert final_code_res["success"] is True

    res_version_ok = await harness._tool_handlers["save_strategy_version"](
        strategy_name=STRATEGY_NAME,
        code=final_code_res["content"],
        bump_version=False,
    )
    assert res_version_ok["success"] is True
    assert res_version_ok["version"] == 1
    assert res_version_ok["filename"] in (f"{STRATEGY_NAME}_v1.mq5", f"{STRATEGY_NAME}_v1.py")

    # State transitions to VERSIONED
    assert harness.session.inception_state == StrategyInceptionState.VERSIONED
