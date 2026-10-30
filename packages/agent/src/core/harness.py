"""
DeepSeek Agent Harness (DSH) Core Execution Loop for BacktestAI.
Implements multi-turn interleaved reasoning, CoT preservation,
append-only trajectory streaming, and Human-in-the-Loop interaction.
"""

from __future__ import annotations
import inspect
import json
import logging
from pathlib import Path
import re
import sys
from typing import Any, AsyncGenerator, Callable, Coroutine, Dict, List, Optional, Protocol

# Ensure UTF-8 console output on Windows to prevent charmap encoding errors
if sys.stdout:
    try:
        reconfig = getattr(sys.stdout, "reconfigure", None)
        if callable(reconfig):
            reconfig(encoding="utf-8", errors="replace")
    except Exception:
        pass
if sys.stderr:
    try:
        reconfig = getattr(sys.stderr, "reconfigure", None)
        if callable(reconfig):
            reconfig(encoding="utf-8", errors="replace")
    except Exception:
        pass

def _safe_print(text: str, flush: bool = True) -> None:
    """Prints safely to console, falling back to ASCII/replace on Windows encoding mismatches."""
    try:
        print(text, flush=flush)
    except Exception:
        try:
            enc = sys.stdout.encoding or "utf-8"
            print(text.encode(enc, errors="replace").decode(enc), flush=flush)
        except Exception:
            pass

from .types import (
    AgentSessionState,
    AgentState,
    EventType,
    Message,
    ModelChunk,
    Role,
    StrategyInceptionState,
    ToolCall,
    ToolDefinition,
    ToolResult,
    TrajectoryEvent,
    validate_strategy_name,
)
from .events import TrajectoryEventEmitter

logger = logging.getLogger("backtest_ai.agent.harness")


class ToolHandler(Protocol):
    async def __call__(self, **kwargs: Any) -> Any:
        ...


class LLMAdapterProtocol(Protocol):
    def generate_turn(
        self,
        messages: List[Message],
        tools: List[ToolDefinition],
    ) -> AsyncGenerator[ModelChunk, None]:
        ...


DEFAULT_SYSTEM_PROMPT = """You are BacktestAI Assistant, a Senior Quantitative Research and Algorithmic Trading Specialist.
You collaborate with the trader to brainstorm, research, develop, validate, backtest, and optimize production-grade algorithmic trading strategies for the BacktestAI platform.

### 1. SYSTEM ARCHITECTURE & END-TO-END FLOW

You operate fluidly across a multi-phase quantitative development lifecycle:

#### PHASE A: EXPLORATORY QUANT DISCUSSION & BROAD BRAINSTORMING (DEFAULT MODE)
- When the trader asks general questions ("hi", "what do you think of ICT?", "is it good?"), brainstorms ideas, or gives broad requests like "create new strategy":
  1. Act as a collegiate, insightful Senior Quant Research Partner.
  2. Carry on a fluid, natural conversation in direct chat. Discuss market microstructure, volatility profiles, session timings, and edge viability.
  3. **DO NOT USE HITL (`ask_user`) FOR BROAD BRAINSTORMING**: When a request opens a broad "sea of questions" (e.g., user says "create a new strategy" without specifications), DO NOT trigger interactive HITL questionnaires! Instead, ask the user directly in normal chat: e.g. *"Could you please explain the strategy concept, trading logic, and indicators you have in mind?"* Then conclude the turn cleanly and wait for the trader's next prompt in normal conversation.
  4. **Autonomous Web Research**: If you need verified facts, latest market developments, economic calendar data, specific algorithmic formulas, or MQL5 documentation:
     - Use `search_web(query=...)` to retrieve accurate, up-to-date sources and relevant URLs.
     - Use `read_web_page(url=...)` to fetch and read complete technical documentation pages (e.g. from `mql5.com/docs` or quantitative research papers) before synthesizing code.

#### PHASE B: FORMAL STRATEGY INCEPTION & AUTONOMOUS CODE SYNTHESIS
- Activated when the trader explicitly requests to create, build, code, or formalize a strategy (e.g., "create an ICT strategy for gold", "let's build it", "code this strategy", "can we make a bot from this?").
- Follow the rigorous **Autonomous Quantitative Synthesis Protocol**:
  1. **Extract & Normalize**: Smartly capture target asset, timeframe preferences, and risk parameters from the prompt and prior discussion.
  2. **Analyze Core Philosophy**: Articulate the exact underlying economic rationale and market inefficiency (e.g. liquidity sweeps, institutional order blocks, mean reversion).
  3. **Deep Web & Literature Research**: Autonomously call `search_web` and `read_web_page` to cross-examine independent sources, terminology, and proven quantitative implementations.
  4. **Assemble Executive Blueprint**: Synthesize the comprehensive architecture into an executive **QUANT STRATEGY BLUEPRINT** (8 concise blocks, readable in 15 seconds).
  5. **BLUEPRINT APPROVAL GATE (MANDATORY HITL REVIEW & APPROVAL)**:
     - The `📋 QUANT STRATEGY BLUEPRINT` serves as the architectural contract and review gate.
     - Output the complete, structured `📋 QUANT STRATEGY BLUEPRINT`.
     - **DO NOT JUMP DIRECTLY TO WRITING CODE IN THE SAME TURN**.
     - Conclude the turn by calling `ask_user` to request trader review and approval:
       * `question`: "I have synthesized the Quant Strategy Blueprint above for <strategy_name>.mq5. Please review the core edge, entry rules, and parameters matrix. Do you approve proceeding with MQL5 code generation, or would you like to adjust any rules?"
       * `options`: ["Approve blueprint & generate MQL5 code", "Adjust rules or risk parameters"]
     - **STRICTLY ONE-TIME GATE (CRITICAL - NO APPROVAL LOOPS)**:
       * This blueprint approval gate applies ONCE and ONLY ONCE at the very first inception of a new strategy plan.
       * If the trader chose "Adjust rules or risk parameters" and provides their adjustments (e.g. "2% risk per trade", "change timeframe"):
         **THE GATE IS COMPLETE. DO NOT RE-GENERATE A SECOND BLUEPRINT. DO NOT CALL `ask_user` AGAIN.**
         Immediately accept their parameter ("Adjusting risk to 2.0%..."), call `create_file`, write the complete native MQL5 code with `edit_file`, compile with `compile_mql5`, and test via `run_strategy_tester`.
       * Once `<strategy_name>.mq5` exists on disk or code has been written, **YOU ARE NO LONGER IN INCEPTION MODE**.
       * YOU ARE STRICTLY PROHIBITED from re-generating a second blueprint or calling `ask_user` to re-ask to build code that is already built!
       * If a symbol or parameter needs adjusting (e.g. broker symbol `NAS100` -> `USTEC`), edit the code in place via `edit_file_partially` and run the tester. NEVER wipe or reset existing code!
  6. **NEW STRATEGY FILE ISOLATION & INTEGRITY (NEVER HIJACK OR OVERWRITE EXISTING FILES)**:
     - Always synthesize a brand new, distinct snake_case filename representing the new strategy concept (e.g. `gold_m1_momentum_scalper.mq5`, `eurusd_breakout.mq5`).
     - NEVER name the new strategy after an existing strategy in the workspace, and NEVER modify, edit, or overwrite any existing strategy file or open editor reference file.
     - NEVER wander through the workspace calling `list_workspace_files` or `search_in_files` when synthesizing a new strategy — proceed directly to `create_file`.
     - If `create_file` reports that the filename already exists in the workspace, DO NOT inspect or overwrite it! Immediately append a distinct identifier to synthesize a clean, independent EA file (e.g. `gold_m1_momentum_scalper_ea.mq5`) to guarantee previous trader strategies remain 100% safe and intact.

#### PHASE C: STRATEGY MODIFICATIONS & CONTINUOUS ENHANCEMENT (AUTONOMOUS EXECUTION)
- Activated ONLY when the trader explicitly asks to modify, tune, optimize, or fix the CURRENT ACTIVE STRATEGY (e.g. add trailing stop, tighten stop loss, add indicator filter, or resolve backtest losses).
- **Target Integrity**: ONLY modify the strategy file explicitly designated as active in context. NEVER modify or overwrite a different or reference file.
- **ACT AUTONOMOUSLY AS THE EXPERT**: DO NOT stop to ask permission ("Would you like me to proceed with implementing these changes?"). The user came to you for your expertise and explicitly asked for the enhancement!
- **Single Inspection Pass**: When inspecting code, read the relevant file in ONE call using `read_file(filename=...)` or search for the specific symbol using `search_in_files(query=...)`. NEVER read the same file repeatedly in multiple small slices.
- **Implement Missing Logic Immediately**: If a function or filter is not yet defined, DO NOT spend multiple turns re-reading looking for it — IMPLEMENT IT immediately in the code using `edit_file` or `edit_file_partially`.
- Immediately edit the strategy file (`edit_file` or `edit_file_partially`), recompile with `compile_mql5` (0 errors), and clearly explain what was improved.

#### PHASE D: CODE SYNTHESIS & WORKSPACE INTEGRATION (100% PURE MQL5 ONLY)
All strategies on BacktestAI are written strictly and natively in **MQL5 (`.mq5`)**. There is NO Python strategy code.
Execution Flow:
1. **Separated File Creation & Code Population (MANDATORY TWO SEPARATE STEPS)**:
   - Step 1: Call `create_file("<strategy_name>.mq5")` to initialize the empty strategy file in the user workspace. DO NOT write code in this step. Initial file creation must be strictly unversioned (e.g. `ict_gold_sweep.mq5`). Never append `_v1`.
   - Step 2: Call `edit_file("<strategy_name>.mq5", content=...)` (or incrementally section-by-section with `append_to_file`) to write the complete native MQL5 Expert Advisor code into the created file (complete with `#property strict`, inputs, OnInit, OnDeinit, OnTick, diagnostic telemetry counters, and risk controls).
2. **Diagnostic Telemetry Block (Mandatory in every EA)**:
   - Every EA generated must declare diagnostic counters:
     `int g_ticks_total = 0; int g_blocked_by_time = 0; int g_blocked_by_spread = 0; int g_signals_found = 0;`
   - Increment `g_ticks_total++` at top of `OnTick()`, increment rejection filters before returning, and print telemetry in `OnDeinit()`:
     `PrintFormat("[DIAGNOSTIC] Ticks: %d | Blocked Time: %d | Blocked Spread: %d | Signals: %d", g_ticks_total, g_blocked_by_time, g_blocked_by_spread, g_signals_found);`
3. **Autonomous Compilation & Self-Healing Loop via MT5 MCP (Superpowers Compiler Loop)**:
   - Immediately compile the strategy via `compile_mql5("<strategy_name>.mq5")`.
   - On successful compilation, the `.ex5` binary is automatically built and deployed to MT5 Strategy Tester workers.
   - If the compiler returns errors or warnings:
     - Read compiler diagnostics and line numbers from `<strategy_name>.log`.
     - **STRICT SINGLE-FILE HEALING (NEVER CREATE A NEW FILE OR VERSION)**: Fix affected lines using targeted edits via `edit_file` or `edit_file_partially` on the EXACT same strategy file.
     - **NEVER CALL `create_file` DURING ERROR HEALING**: You are strictly prohibited from creating a new file (e.g. `_v2.mq5`, `_v3.mq5`) to resolve errors. All healing is done strictly in-place.
     - Re-run `compile_mql5("<strategy_name>.mq5")` until **0 errors and 0 warnings** are achieved.
4. **Confirm Compilation to Trader**: In your response, confirm that `<strategy_name>.mq5` has been created, populated, and compiled with 0 errors.

#### PHASE E: STRATEGY VERSIONING PROTOCOL (STRICT USER CONTROL)
1. **Rule 1: 1 Physical Working File = 1 Strategy**:
   - Each distinct trading strategy in the workspace has its own single dedicated working file (e.g. `gold_scalper.mq5`).
   - NEVER create separate files like `gold_scalper_v2.mq5` or `gold_scalper_v3.mq5` in the file tree. The `create_file` tool will strictly reject any filename containing `_v<N>`. All iterative parameter tests, tuning, and logic modifications for THAT strategy are made in its single dedicated working file.
   - Distinct strategies (different concepts, algorithms, or assets) are completely separate files and MUST NEVER overwrite each other.
2. **Rule 2: Versions are 100% User-Controlled (NEVER Autonomously Bump)**:
   - YOU MUST NEVER BUMP OR INCREMENT THE STRATEGY VERSION NUMBER AUTONOMOUSLY.
   - When the user asks to modify, fix, tune, or optimize the strategy, edit the CURRENT active file in place under the current version.
   - You ONLY create a new version milestone if the user EXPLICITLY requests it (e.g., "create v2", "bump version", "save as v2").
3. **Rule 3: Parameters, Tests, and Tuning Under Active Version**:
   - Parameter adjustments and test runs across timeframes/symbols are **Tests** under the active version, not a new strategy version.
   - Synchronize test counter with active workspace context: `"Running Test #{Next_Test_Number} under Version {N} with timeframe {TF}..."`

#### PHASE F: TESTING & SIMULATION VIA METATRADER 5 STRATEGY TESTER
Execute broker-grade backtesting with real broker tick data:
1. **Historical Backtest Simulation (`run_strategy_tester`)**:
   - Full broker simulation directly in the MetaTrader 5 Strategy Tester on real tick data with true floating spread, commissions, and swap.
   - All `.mq5` / `.ex5` strategies MUST be tested via `run_strategy_tester`. NEVER use `run_backtest` for MQL5 strategies.
2. **STRICT ZERO-TRADE FAILURE INVARIANT (CRITICAL - NEVER ACCEPT 0 TRADES)**:
   - Any backtest simulation that yields **0 trades** (`total_trades = 0`, `net_profit = $0.00`, `win_rate = 0%`) is STRICTLY CLASSIFIED AS A **FAILED TEST / BROKEN CODE**.
   - When `run_strategy_tester` returns 0 trades, you are **STRICTLY PROHIBITED** from stopping or claiming success.
   - Inspect the `diagnostic_telemetry` extracted from the tester log, fix the identified bottleneck (spread, session time, or signal trigger), recompile, and re-run until trades execute (`total_trades > 0`).

#### PHASE G: TEST RESULT INGESTION & QUANT AUTOPSY
- Once the backtest completes with real executed trades (`total_trades > 0`), analyze the quantitative telemetry:
  - Long vs Short directional performance: Win Rate and Net PnL asymmetry.
  - Hourly loss clustering: Identify toxic trading hours or session drift.
  - Initial Stop Loss and Take Profit execution: Sl hits vs TP hits.
  - Provide concrete, quantified recommendations for future iterations.

---

### QUANT STRATEGY BLUEPRINT TEMPLATE
When entering strategy inception, output the specification formatted as an executive **QUANT STRATEGY BLUEPRINT** readable in 15 seconds:

### 📋 QUANT STRATEGY BLUEPRINT
**Strategy**: `<strategy_name>.mq5` | **Symbol**: `<Symbol>` | **Timeframe**: `<TF>`

1. **Asset & Trading Session**: Target asset and active liquidity session (e.g. London/NY overlap, 13:00-17:00 UTC).
2. **Core Quantitative Edge**: Market inefficiency or structural edge (e.g., liquidity sweep, fair value gap retest).
3. **Entry Trigger Rules**: Exact deterministic mathematical logic for Buy / Sell entries.
4. **Stop Loss (SL)**: Structural or ATR invalidation level.
5. **Take Profit (TP)**: Target liquidity pool or fixed risk-reward ratio.
6. **Trade Management**: Dynamic break-even, trailing stop, or session close rules.
7. **Risk & Sizing**: Account equity risk percentage per trade and max drawdown circuit breaker.
8. **Parameters Matrix**:
| Parameter Name | Purpose | Type | Default | MQL5 Input Variable |
|---|---|---|---|---|
| InpStopLossPips | Initial SL distance in pips | double | 25.0 | `InpStopLossPips` |
| InpTakeProfitPips | Initial TP target in pips | double | 50.0 | `InpTakeProfitPips` |
| InpMaxSpread | Maximum allowed spread filter | int | 20 | `InpMaxSpread` |

*Parameters Matrix Alignment Invariant*: Every single row in the Parameters Matrix table MUST strictly correspond 1-to-1 to MQL5 `input` variables in the generated MQL5 code.

*Blueprint Approval Gate Invariant*: When synthesizing a new strategy for the first time, present the initial Quant Strategy Blueprint and call `ask_user` once. This gate is strictly one-time: once approved or once the trader replies with parameter adjustments, proceed directly to code synthesis and testing. Never re-prompt with the blueprint gate once code has been built or after parameters are adjusted.

---

### PATH HYGIENE & INFORMATION SECURITY INVARIANT
1. **Never Disclose Host Filesystem Paths**: Strictly prohibit mentioning host absolute directories, internal worker folders, or local system user paths in chat messages.
2. **Always Use Clean Workspace Paths**: Refer to strategies and files strictly by their clean relative workspace name (e.g. `gold_scalper.mq5`, `eurusd_breakout.mq5`).
3. **Confidentiality of Broker Accounts**: Never output raw broker account numbers, server credentials, or internal worker architecture in chat.

---

### CAPABILITIES PRESENTATION RULE
When the trader asks about your tools, capabilities, or identity:
- **DO NOT** output a raw, overwhelming list of backend API functions or server commands.
- Respond as an institutional Quantitative Specialist presenting your 5 core institutional capabilities:
  1. **Quantitative Market Research**: Web literature analysis (`search_web`), full MQL5 documentation inspection (`read_web_page`), and chart context verification.
  2. **Native MQL5 Engineering**: Synthesizing production-grade `.mq5` Expert Advisors with `#property strict` and compiler self-healing (0 errors, 0 warnings).
  3. **Broker-Grade Tick Simulation**: Real MT5 Strategy Tester execution on real tick data with floating spread, commissions, and execution telemetry.
  4. **Dynamic Trade Forensics & Autopsy**: Deep directional Long vs Short breakdown, hourly loss clustering, and diagnostic telemetry extraction.
  5. **Continuous Hypothesis Optimization**: Data-driven parameter tuning and edge refinement.

---

### SINGLE-VARIABLE HYPOTHESIS & USER AGENCY RULE
1. **Autonomous Iteration (Scientific Method)**:
   - When optimizing, diagnosing, or improving a strategy autonomously, you MUST modify only ONE variable or filter per iteration (e.g. only `InpStopLossPips` or only the spread filter). This ensures clear causality in backtest results.
2. **User Agency (Immediate Execution with Advisory)**:
   - When the trader explicitly asks for multiple simultaneous changes (e.g. "change SL to 20, TP to 60, and add RSI filter"):
     - **NEVER refuse, delay, or lecture the user**.
     - Immediately execute ALL requested modifications in the code and compile.
     - Add a brief, collegiate quant advisory note: *"Implemented all requested changes: Stop Loss to 20, Take Profit to 60, and RSI filter. Note from a quant research standpoint: testing multiple variables simultaneously makes it harder to isolate individual causality, but we will test this combined configuration immediately."*

---

### HUMAN-IN-THE-LOOP (HITL) POLICY: HIGH-LEVEL STRATEGIC DILEMMAS ONLY
1. **ONE-TIME STRATEGY INCEPTION APPROVAL GATE**:
   - For NEW strategy inception, the `📋 QUANT STRATEGY BLUEPRINT` is an explicit, ONE-TIME approval gate. You MUST call `ask_user` once to obtain trader review.
   - If the trader responds with parameter adjustments (e.g. "2% risk", "change timeframe"), accept their input as their final approval and IMMEDIATELY proceed to code generation, compilation, and testing. NEVER trigger a secondary blueprint approval loop!
   - Once a strategy file exists in the workspace, the blueprint gate is CLOSED. All future iterations proceed autonomously via Phase C & F.
2. **AUTONOMOUS EXECUTION ONCE APPROVED OR ON ACTIVE STRATEGIES**:
   - Once a strategy blueprint is approved, or when the trader is working on an already active strategy (e.g. "change SL to 20", "use 1h tf", "fix compiler errors"), you execute autonomously without stopping or asking permission for routine steps.
   - **DO NOT interrogate the user** for routine technical decisions, standard indicator periods (e.g. RSI 14, EMA 200, ATR 14), session windows, stop loss / take profit calculations, or MQL5 architecture. Choose sound quantitative defaults and execute immediately.

3. **STRICTLY WHEN TO USE HITL (`ask_user`)**:
   - Use `ask_user` **ONLY** when facing a genuine, critical, high-level strategic dilemma where two (or at most three) fundamentally opposing quantitative paths exist, and the decision cannot be deduced from mathematical or quant literature standards.
   - Example of valid strategic dilemmas:
     * High-frequency scalping (M1-M5 / Tight SL) vs. Multi-day swing holding horizon (H4-D1 / Structural SL).
     * Account execution fee model (Raw ECN Zero-Spread + Commission vs. Standard Retail Spread Markup).

4. **RULES FOR `ask_user` OPTIONS (ZERO FILLER / ZERO FAKE CHOICES)**:
   - Provide ONLY genuine, actionable, mutually exclusive domain alternatives (2, or at most 3 options).
   - **ZERO GENERIC FILLERS**: Strictly forbid adding fake, lazy, or filler options just to fill slots (e.g. NEVER add "Adjust rules", "Change parameters", "None of the above", "I'm not sure", or "Other"). The UI automatically provides a unified "Other (write your answer)" option.
   - Every option must represent a concrete, distinct trading architecture or risk specification.
   - If there are not at least 2 distinct, genuine domain alternatives, **DO NOT CALL `ask_user`**. Execute autonomously.
"""


def _format_tool_output_for_session(tool_name: str, output: Any, max_chars: int = 12000) -> str:
    """
    Optimizes tool output for the agent's multi-turn conversation memory.
    Extracts high-density quantitative signals (metrics, sample trades, parameters)
    while dropping bloated raw arrays (thousands of trades/deals/ticks) to protect
    the LLM context window and prevent token exhaustion.
    """
    if isinstance(output, dict):
        # 1. Backtesting / Simulation tools: extract clean quant synthesis
        if tool_name in ("run_strategy_tester", "read_test_report", "run_backtest"):
            metrics = dict(output.get("metrics") or {})
            for k in (
                "sharpe_ratio", "sortino_ratio", "calmar_ratio",
                "net_profit", "net_profit_pct", "profit_factor",
                "max_drawdown", "max_drawdown_pct", "win_rate",
                "total_trades", "winning_trades", "losing_trades",
                "initial_capital", "ending_equity", "expectancy"
            ):
                if k in output and k not in metrics:
                    metrics[k] = output[k]

            trades = output.get("trades") or []
            sample_trades = output.get("sample_trades") or (trades[:3] + trades[-3:] if len(trades) > 6 else trades)
            total_count = output.get("total_trades_count") or len(trades) or output.get("deals_count", 0)

            # Generate dynamic institutional forensic autopsy if trades are available
            autopsy_report = None
            directional_bd = output.get("directional_breakdown")
            if trades:
                try:
                    from ..tools.execution import generate_dynamic_forensic_autopsy
                    autopsy = generate_dynamic_forensic_autopsy(
                        metrics=metrics,
                        trades=trades,
                        strategy_name=output.get("strategy_id") or output.get("strategy_name") or "strategy",
                        symbol=output.get("symbol") or "BTCUSDT",
                        timeframe=output.get("timeframe") or "1h",
                    )
                    autopsy_report = autopsy.get("markdown_report")
                    if "directional_breakdown" in autopsy:
                        directional_bd = autopsy["directional_breakdown"]
                except Exception as e:
                    logging.getLogger(__name__).warning("Failed to build forensic autopsy in session formatter: %s", e)

            slim: Dict[str, Any] = {
                "success": output.get("success", True),
                "strategy_id": output.get("strategy_id") or output.get("strategy_name"),
                "symbol": output.get("symbol"),
                "timeframe": output.get("timeframe"),
                "metrics": metrics,
                "total_trades_count": total_count,
                "sample_trades": sample_trades,
            }
            if directional_bd:
                slim["directional_breakdown"] = directional_bd
            if autopsy_report:
                if len(autopsy_report) > 1200:
                    slim["forensic_autopsy"] = autopsy_report[:1200] + "\n..."
                else:
                    slim["forensic_autopsy"] = autopsy_report
            if output.get("error"):
                slim["error"] = output["error"]
            if output.get("tester_log"):
                log_str = str(output["tester_log"])
                slim["tester_log_summary"] = log_str[-1500:] if len(log_str) > 1500 else log_str

            return json.dumps(slim, default=str)

        # 2. Workspace file editing tools: drop massive duplicate 'original' and 'content' blobs
        if tool_name in ("edit_file", "edit_file_partially", "append_to_file"):
            slim_edit: Dict[str, Any] = {
                "success": output.get("success", True),
                "filename": output.get("filename"),
                "lines_changed": output.get("lines_changed", 0),
                "lines_added": output.get("lines_added", 0),
                "lines_removed": output.get("lines_removed", 0),
                "diff": str(output.get("diff", ""))[:2000],
                "message": output.get("message", "File updated successfully."),
            }
            if output.get("syntax_warnings"):
                slim_edit["syntax_warnings"] = output["syntax_warnings"]
            if output.get("error"):
                slim_edit["error"] = output["error"]
            return json.dumps(slim_edit, default=str)

        # 3. MetaEditor compilation: retain compact compiler summary
        if tool_name == "compile_mql5":
            log_str = str(output.get("log", ""))
            slim_compile: Dict[str, Any] = {
                "success": output.get("success", False),
                "returncode": output.get("returncode", 0),
                "log": log_str[-1200:] if len(log_str) > 1200 else log_str,
            }
            if output.get("error"):
                slim_compile["error"] = output["error"]
            return json.dumps(slim_compile, default=str)

        # 4. Large list truncation in dict outputs (e.g. symbols, deals, ticks)
        cleaned_dict = {}
        for k, v in output.items():
            if isinstance(v, list) and len(v) > 20:
                cleaned_dict[k] = v[:5] + [f"... ({len(v) - 10} items omitted) ..."] + v[-5:]
            else:
                cleaned_dict[k] = v
        serialized = json.dumps(cleaned_dict, default=str)
    elif isinstance(output, list) and len(output) > 20:
        slim_list = output[:5] + [f"... ({len(output) - 10} items omitted) ..."] + output[-5:]
        serialized = json.dumps(slim_list, default=str)
    else:
        serialized = json.dumps(output, default=str) if not isinstance(output, str) else output

    # 3. Hard safety cap on characters
    if len(serialized) > max_chars:
        half = max_chars // 2
        omitted = len(serialized) - max_chars
        serialized = (
            serialized[:half]
            + f"\n\n[... OMITTED {omitted} CHARACTERS FOR CONTEXT BUDGET PROTECTION ...]\n\n"
            + serialized[-half:]
        )

    return serialized


class AgentHarness:
    """
    Core DSH Engine that manages the multi-turn agent lifecycle,
    reasoning preservation, tool dispatching, and human interactions.
    """

    def __init__(
        self,
        session_id: str,
        user_id: str,
        llm_adapter: LLMAdapterProtocol,
        max_turns: int = 60,
        system_prompt: Optional[str] = None,
        storage: Optional[Any] = None,
        session: Optional[AgentSessionState] = None,
    ) -> None:
        self.session = session or AgentSessionState(
            session_id=session_id,
            user_id=user_id,
            state=AgentState.IDLE,
        )
        self.llm = llm_adapter
        self.max_turns = max_turns
        self.storage = storage
        self.emitter = TrajectoryEventEmitter(session_id=session_id)
        self._tools: Dict[str, ToolDefinition] = {}
        self._tool_handlers: Dict[str, Callable[..., Coroutine[Any, Any, Any]]] = {}

        # System prompt for Algorithmic Trading Specialist
        self.system_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT

        # Register default Human-in-the-Loop interaction tool
        self._register_default_tools()

        self.user_id: str = user_id
        self.viewing_file: Optional[str] = None
        self.active_strategy: Optional[str] = None
        self._recent_tool_sigs: List[str] = []

        # Cancellation state
        self._is_cancelled: bool = False

        # If starting with existing storage, ensure initial record exists
        self._persist()

    def cancel(self) -> None:
        """Cooperatively cancels the running agent loop, halts pending tool calls, and resets state."""
        self._is_cancelled = True
        self.session.pending_interaction = None
        self._set_state(AgentState.DONE)
        _safe_print(f"\033[93m[AGENT] [CANCEL] Session {self.session.session_id} execution aborted by user.\033[0m")
        self._persist()

    def reset_cancellation(self) -> None:
        """Resets the cancellation flag so a new turn can proceed."""
        self._is_cancelled = False

    @property
    def llm_adapter(self) -> LLMAdapterProtocol:
        return self.llm

    @llm_adapter.setter
    def llm_adapter(self, value: LLMAdapterProtocol) -> None:
        self.llm = value

    def set_llm_adapter(self, adapter: LLMAdapterProtocol) -> None:
        self.llm = adapter

    def _persist(self) -> None:
        if self.storage:
            try:
                self.storage.save_session(self.session)
            except Exception as err:
                logger.error(f"Error persisting session to storage: {err}")

    @classmethod
    def restore(
        cls,
        session_id: str,
        storage: Any,
        llm_adapter: LLMAdapterProtocol,
        max_turns: int = 60,
        system_prompt: Optional[str] = None,
    ) -> "AgentHarness":
        """Reconstructs an active AgentHarness instance from persistent SQLite storage."""
        loaded_session = storage.load_session(session_id)
        if not loaded_session:
            raise ValueError(f"Session '{session_id}' not found in storage.")
        return cls(
            session_id=loaded_session.session_id,
            user_id=loaded_session.user_id,
            llm_adapter=llm_adapter,
            max_turns=max_turns,
            system_prompt=system_prompt,
            storage=storage,
            session=loaded_session,
        )

    def _register_default_tools(self) -> None:
        """Registers the built-in Human-in-the-Loop tool."""
        self.register_tool(
            name="ask_user",
            description=(
                "Human-in-the-Loop (HITL) tool strictly reserved for critical, high-level strategic dilemmas "
                "with 2 (or at most 3) genuine, mutually exclusive domain alternatives. "
                "DO NOT use this tool for pre-code confirmation, routine parameter extraction (SL/TP, indicators), "
                "permission gates, or sequential questionnaires. The agent is the quant expert and must choose "
                "sound defaults autonomously. NEVER provide generic filler choices (e.g. 'Adjust rules', 'Change parameters')."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "Direct, high-level strategic dilemma question (e.g. 'Which trading horizon aligns with your mandate?').",
                    },
                    "options": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "2 (or at most 3) concrete, mutually exclusive quantitative alternatives. DO NOT add generic filler options or 'Other' (the platform automatically provides the Other option).",
                    },
                    "context": {
                        "type": "string",
                        "description": "Optional brief context explaining the quantitative trade-off.",
                    },
                },
                "required": ["question", "options"],
            },
            handler=self._noop_interactive_handler,
            is_interactive=True,
        )

    async def _noop_interactive_handler(self, **kwargs: Any) -> Any:
        return kwargs

    def register_tool(
        self,
        name: str,
        description: str,
        parameters: Dict[str, Any],
        handler: Callable[..., Coroutine[Any, Any, Any]],
        requires_approval: bool = False,
        is_interactive: bool = False,
    ) -> None:
        """Registers a domain tool into the harness."""
        defn = ToolDefinition(
            name=name,
            description=description,
            parameters=parameters,
            requires_approval=requires_approval,
            is_interactive=is_interactive,
        )
        self._tools[name] = defn
        self._tool_handlers[name] = handler

    def _extract_pseudo_tool_calls(self, content: str) -> List[ToolCall]:
        """Recovers and converts text pseudo-tool calls leaked by models into real ToolCalls."""
        import re
        import ast
        import uuid
        pattern_square = re.compile(r"\[Tool Call:\s*([a-zA-Z0-9_]+)\s*\((.*?)\)\]", re.DOTALL)
        pattern_executed = re.compile(r"\(Executed action\s+['\"]?([a-zA-Z0-9_]+)['\"]?\s+with arguments\s+(.*?)\)", re.DOTALL)
        found: List[ToolCall] = []

        matches = []
        for m in pattern_square.finditer(content):
            matches.append((m.group(1).strip(), m.group(2).strip()))
        for m in pattern_executed.finditer(content):
            matches.append((m.group(1).strip(), m.group(2).strip()))

        for tool_name, raw_args in matches:
            if tool_name not in self._tools:
                continue

            args_dict: Dict[str, Any] = {}
            if raw_args:
                try:
                    parsed = json.loads(raw_args)
                    if isinstance(parsed, dict):
                        args_dict = parsed
                except Exception:
                    pass

                if not args_dict:
                    try:
                        parsed = ast.literal_eval(raw_args)
                        if isinstance(parsed, dict):
                            args_dict = parsed
                    except Exception:
                        pass

                if not args_dict:
                    try:
                        eval_tuple = ast.literal_eval(f"({raw_args},)" if not raw_args.endswith(",") else f"({raw_args})")
                        if isinstance(eval_tuple, tuple):
                            tool_handler = self._tool_handlers.get(tool_name)
                            if tool_handler:
                                sig = inspect.signature(tool_handler)
                                param_names = [p.name for p in sig.parameters.values() if p.name not in ("self", "cls")]
                                for idx, val in enumerate(eval_tuple):
                                    if idx < len(param_names):
                                        args_dict[param_names[idx]] = val
                    except Exception:
                        pass

            found.append(
                ToolCall(
                    id=f"call_fallback_{uuid.uuid4().hex[:8]}",
                    name=tool_name,
                    arguments=args_dict,
                )
            )

        return found

    def _strip_pseudo_tool_calls(self, content: str) -> str:
        """Removes pseudo-tool call text wrappers from emitted content."""
        import re
        pattern_square = re.compile(r"\[Tool Call:\s*[a-zA-Z0-9_]+\s*\(.*?\)\]", re.DOTALL)
        pattern_executed = re.compile(r"\(Executed action\s+['\"]?[a-zA-Z0-9_]+['\"]?\s+with arguments\s+.*?\)", re.DOTALL)
        res = pattern_square.sub("", content)
        res = pattern_executed.sub("", res)
        return res.strip()

    def _decompose_tool_call(self, tc: ToolCall) -> List[ToolCall]:
        """
        Defensively splits a ToolCall if its name is a concatenation of two or more
        known tools (e.g. 'launch_sandbox_runnerrun_strategy_tester') and its arguments
        contain multiple argument payloads.
        """
        if tc.name in self._tools:
            return [tc]

        import uuid
        import json

        decomposed_names: List[str] = []
        rem_name = tc.name
        while rem_name:
            matched_tool = None
            for candidate in sorted(self._tools.keys(), key=len, reverse=True):
                if rem_name.startswith(candidate):
                    matched_tool = candidate
                    break
            if matched_tool:
                decomposed_names.append(matched_tool)
                rem_name = rem_name[len(matched_tool):]
            else:
                break

        if len(decomposed_names) >= 2 and not rem_name:
            raw_args_str = ""
            if isinstance(tc.arguments, dict):
                if "raw_arguments" in tc.arguments:
                    raw_args_str = str(tc.arguments["raw_arguments"])
                else:
                    raw_args_str = json.dumps(tc.arguments)
            else:
                raw_args_str = str(tc.arguments)

            decoder = json.JSONDecoder()
            idx = 0
            length = len(raw_args_str)
            parsed_args_list: List[Dict[str, Any]] = []

            while idx < length:
                while idx < length and raw_args_str[idx].isspace():
                    idx += 1
                if idx >= length:
                    break
                try:
                    obj, end_idx = decoder.raw_decode(raw_args_str, idx)
                    if isinstance(obj, dict):
                        parsed_args_list.append(obj)
                    idx = end_idx
                except Exception:
                    break

            decomposed_calls: List[ToolCall] = []
            for i, tool_name in enumerate(decomposed_names):
                call_args = parsed_args_list[i] if i < len(parsed_args_list) else {}
                decomposed_calls.append(
                    ToolCall(
                        id=f"{tc.id}_{i}" if i > 0 else tc.id,
                        name=tool_name,
                        arguments=call_args,
                    )
                )
            _safe_print(f"\033[1;33m[AGENT] [RECOVERY] Decomposed glued tool '{tc.name}' into: {decomposed_names}\033[0m")
            return decomposed_calls

        return [tc]

    def _set_state(self, new_state: AgentState) -> None:
        if self.session.state != new_state:
            self.session.state = new_state
            event = self.session.append_event(
                EventType.STATE_CHANGED,
                {"state": new_state.value},
            )
            self.emitter.emit(event)
            self._persist()

    def set_inception_state(
        self,
        new_state: StrategyInceptionState,
        strategy_name: Optional[str] = None,
        strategy_version: Optional[int] = None,
        preset_approved: Optional[bool] = None,
    ) -> TrajectoryEvent:
        """
        Transitions the strategy inception state machine and emits an INCEPTION_STATE_CHANGED event.
        - DISCUSSING -> PRESET_REVIEW -> CODE_PROPOSED -> READY_FOR_TEST
        """
        old_state = self.session.inception_state
        self.session.inception_state = new_state

        if strategy_name is not None:
            is_valid, norm_name, _ = validate_strategy_name(strategy_name)
            self.session.active_strategy_name = norm_name if is_valid else strategy_name
        if strategy_version is not None:
            self.session.active_strategy_version = strategy_version
        if preset_approved is not None:
            self.session.preset_approved = preset_approved

        # Keep context_meta synchronized for SQLite persistence
        self.session.context_meta["inception_state"] = self.session.inception_state.value
        self.session.context_meta["active_strategy_name"] = self.session.active_strategy_name
        self.session.context_meta["active_strategy_version"] = self.session.active_strategy_version
        self.session.context_meta["preset_approved"] = self.session.preset_approved

        event = self.session.append_event(
            EventType.INCEPTION_STATE_CHANGED,
            {
                "from_state": old_state.value,
                "to_state": new_state.value,
                "strategy_name": self.session.active_strategy_name,
                "version": self.session.active_strategy_version,
                "preset_approved": self.session.preset_approved,
            },
        )
        self.emitter.emit(event)
        self._persist()
        return event

    def _build_effective_system_prompt(self) -> str:
        base = self.system_prompt
        header_parts = []
        if getattr(self.session, "strategy_manifest", None):
            manifest_header = self.session.strategy_manifest.to_compact_header()
            header_parts.append(manifest_header)

        viewing_file = getattr(self, "viewing_file", None)
        active_strat = getattr(self.session, "active_strategy_name", None) or getattr(self, "active_strategy", None)
        if viewing_file and active_strat and viewing_file != active_strat and viewing_file != f"{active_strat}.mq5" and viewing_file != f"{active_strat}.py":
            header_parts.append(
                f"[REFERENCE CONTEXT: The trader currently has '{viewing_file}' open in their editor tab for reference, while actively developing '{active_strat}'. Do NOT modify or test '{viewing_file}' unless explicitly instructed.]"
            )
        elif viewing_file and not active_strat:
            header_parts.append(
                f"[REFERENCE CONTEXT: The trader currently has '{viewing_file}' open in their editor tab for reference only. You are in New Strategy Synthesis mode. Do NOT modify, edit, or overwrite '{viewing_file}'. Synthesize a brand new distinct strategy file.]"
            )

        if header_parts:
            return f"{'\n\n'.join(header_parts)}\n\n{base}"
        return base

    def sync_strategy_manifest(self, file_path_or_name: Any, code_content: Optional[str] = None) -> Any:
        from pathlib import Path
        from .introspector import introspect_strategy_code

        p = Path(file_path_or_name)
        # If relative or just a name, try to resolve via user workspace
        if not p.is_file():
            try:
                from ..tools.workspace import _resolve_file_path
                user_id = getattr(self.session, "user_id", "senior")
                cand = _resolve_file_path(str(file_path_or_name), user_id)
                if cand.is_file():
                    p = cand
            except Exception:
                pass

        manifest = introspect_strategy_code(p, code_content)
        # Preserve existing test results if strategy matches and results exist
        if self.session.strategy_manifest and self.session.strategy_manifest.strategy_name == manifest.strategy_name:
            if self.session.strategy_manifest.last_test_metrics:
                manifest.last_test_metrics = self.session.strategy_manifest.last_test_metrics
            if self.session.strategy_manifest.test_status != "NOT_TESTED":
                manifest.test_status = self.session.strategy_manifest.test_status

        self.session.strategy_manifest = manifest
        self.session.active_strategy_name = manifest.strategy_name
        self.session.active_strategy_version = manifest.version
        self._persist()
        return manifest

    async def run(
        self,
        user_prompt: Optional[str] = None,
        context_envelope: Optional[str] = None,
    ) -> AsyncGenerator[TrajectoryEvent, None]:
        """
        Executes the DSH reasoning loop.
        Yields TrajectoryEvents in real-time as thoughts and tool actions occur.
        """
        if self._is_cancelled:
            self._set_state(AgentState.DONE)
            return

        # If user provides a prompt, append to history
        if user_prompt:
            _safe_print(f"\n\033[1;36m{'='*80}\033[0m", flush=True)
            _safe_print(f"\033[1;36m[AGENT] >>> Turn Started | Session: {self.session.session_id} | User: \"{user_prompt}\"\033[0m", flush=True)
            _safe_print(f"\033[1;36m{'-'*80}\033[0m", flush=True)

            effective_sys = self._build_effective_system_prompt()
            if not self.session.history:
                # Add system prompt first
                self.session.append_message(
                    Message(role=Role.SYSTEM, content=effective_sys)
                )
            elif self.session.history[0].role == Role.SYSTEM:
                # Keep active system prompt synchronized with platform specs
                self.session.history[0].content = effective_sys

            # Safety guard: If previous message in history had unfulfilled tool calls,
            # resolve them with user response to ensure API contract integrity
            if self.session.history:
                last_msg = self.session.history[-1]
                if last_msg.role == Role.ASSISTANT and last_msg.tool_calls:
                    for pending_tc in last_msg.tool_calls:
                        self.session.append_message(
                            Message(
                                role=Role.TOOL,
                                content=json.dumps({"user_response": user_prompt}),
                                tool_call_id=pending_tc.id,
                            )
                        )
                    self.session.pending_interaction = None

            user_msg = Message(role=Role.USER, content=user_prompt)
            self.session.append_message(user_msg)
            self._persist()
            event = self.session.append_event(
                EventType.MESSAGE_COMPLETE,
                {"role": "user", "content": user_prompt},
            )
            self.emitter.emit(event)
            yield event

        self._set_state(AgentState.THINKING)

        turn_count = 0
        paused_for_user = False
        while turn_count < self.max_turns and self.session.state == AgentState.THINKING:
            if self._is_cancelled:
                self._set_state(AgentState.DONE)
                return

            turn_count += 1
            tools_list = list(self._tools.values())

            # Check if rolling compaction is required to protect LLM context window
            from .compaction import QuantSessionDigest
            llm_turn_history = self.session.history
            if QuantSessionDigest.should_compact(self.session.history):
                if turn_count == 1:
                    compact_event = self.session.append_event(
                        EventType.STATUS_ANNOUNCEMENT,
                        {"message": "Compacting conversation memory & research context..."},
                    )
                    self.emitter.emit(compact_event)
                    yield compact_event
                # CRITICAL: We DO NOT overwrite self.session.history!
                # self.session.history is the user's permanent, immutable chat history ("no perd, no lost").
                # Compaction is strictly applied to create a token-efficient prompt for the LLM turn.
                llm_turn_history = QuantSessionDigest.compact_history(self.session.history)

            # Context envelope injection for active strategy continuity (LLM prompt only, not persisted into session history)
            if context_envelope and turn_count == 1 and llm_turn_history:
                for idx in range(len(llm_turn_history) - 1, -1, -1):
                    if llm_turn_history[idx].role == Role.USER:
                        original_msg = llm_turn_history[idx]
                        augmented_msg = Message(
                            role=Role.USER,
                            content=f"{original_msg.content}\n\n{context_envelope.strip()}",
                            tool_calls=original_msg.tool_calls,
                        )
                        llm_turn_history = list(llm_turn_history[:idx]) + [augmented_msg] + list(llm_turn_history[idx + 1:])
                        break

            # Accumulators for this model turn
            thought_acc: List[str] = []
            content_acc: List[str] = []
            pending_tool_calls: List[ToolCall] = []

            # Stream LLM turn
            turn_stream = self.llm.generate_turn(llm_turn_history, tools_list)
            if inspect.isawaitable(turn_stream):
                turn_stream = await turn_stream
            async for chunk in turn_stream:
                if self._is_cancelled:
                    self._set_state(AgentState.DONE)
                    return

                if chunk.thought_delta:
                    thought_acc.append(chunk.thought_delta)
                    event = self.session.append_event(
                        EventType.THOUGHT_CHUNK,
                        {"delta": chunk.thought_delta},
                    )
                    self.emitter.emit(event)
                    yield event

                if chunk.content_delta:
                    content_acc.append(chunk.content_delta)
                    event = self.session.append_event(
                        EventType.MESSAGE_CHUNK,
                        {"delta": chunk.content_delta},
                    )
                    self.emitter.emit(event)
                    yield event

                if chunk.tool_calls:
                    pending_tool_calls.extend(chunk.tool_calls)

            full_thought = "".join(thought_acc).strip() or None
            full_content = "".join(content_acc).strip()

            if full_thought:
                _safe_print(f"\033[1;35m[AGENT] [THINKING] Chain-of-Thought:\n{full_thought}\033[0m")
                event = self.session.append_event(
                    EventType.THOUGHT_COMPLETE,
                    {"thought": full_thought},
                )
                self.emitter.emit(event)
                yield event

            # Guard against empty turn if no tool calls were generated
            # Fallback Recovery: Detect pseudo-tool calls leaked as plain text by models
            if full_content:
                pseudo_calls = self._extract_pseudo_tool_calls(full_content)
                if pseudo_calls:
                    pending_tool_calls.extend(pseudo_calls)
                    full_content = self._strip_pseudo_tool_calls(full_content)

            if not full_content and not pending_tool_calls:
                if full_thought:
                    full_content = "I have analyzed your quantitative request. Please let me know the specific parameters or strategy rules you would like to test."
                else:
                    full_content = "I did not receive a response from the quantitative model. Please try sending your inquiry again."

            # Record Assistant turn in history (DSH invariant: preserve CoT in history!)
            assistant_msg = Message(
                role=Role.ASSISTANT,
                content=full_content,
                thought=full_thought,
                tool_calls=pending_tool_calls if pending_tool_calls else None,
            )
            self.session.append_message(assistant_msg)
            self._persist()

            if full_content:
                _safe_print(f"\033[1;37m[AGENT] [RESPONSE] Emitted Content:\n{full_content[:250]}...\033[0m")
                event = self.session.append_event(
                    EventType.MESSAGE_COMPLETE,
                    {"role": "assistant", "content": full_content},
                )
                self.emitter.emit(event)
                yield event

            # If no tool calls, the model is done responding
            if not pending_tool_calls:
                self._set_state(AgentState.DONE)
                _safe_print(f"\033[1;32m[AGENT] [DONE] Turn Finished (no pending tools).\033[0m")
                _safe_print(f"\033[1;36m{'='*80}\033[0m\n")
                event = self.session.append_event(
                    EventType.AGENT_DONE,
                    {"turns": turn_count},
                )
                self.emitter.emit(event)
                yield event
                break

            # Process tool calls
            # Defensively decompose any glued tool calls
            normalized_tool_calls: List[ToolCall] = []
            for tc in pending_tool_calls:
                normalized_tool_calls.extend(self._decompose_tool_call(tc))
            pending_tool_calls = normalized_tool_calls

            paused_for_user = False
            for tc in pending_tool_calls:
                if self._is_cancelled or self.session.state == AgentState.DONE:
                    self._set_state(AgentState.DONE)
                    _safe_print(f"\033[1;33m[AGENT] Execution stopped: session cancelled or marked DONE.\033[0m")
                    return

                tool_def = self._tools.get(tc.name)

                _safe_print(f"\033[1;33m[AGENT] [TOOL] Calling: {tc.name} | Arguments: {tc.arguments}\033[0m")

                # Emit tool call start
                start_event = self.session.append_event(
                    EventType.TOOL_CALL_STARTED,
                    {"call_id": tc.id, "tool_name": tc.name, "arguments": tc.arguments},
                )
                self.emitter.emit(start_event)
                yield start_event

                # Check if this tool is Human-in-the-Loop interaction (e.g. ask_user)
                if tool_def and tool_def.is_interactive:
                    raw_options = tc.arguments.get("options", [])
                    if isinstance(raw_options, list):
                        # Filter out any variations of 'other' / 'custom' passed by the LLM
                        clean_opts = [
                            str(opt).strip()
                            for opt in raw_options
                            if opt and not any(k in str(opt).strip().lower() for k in ("other", "custom", "write your answer"))
                        ]
                        # Agent decides variable 2 to 4 choices + platform appends single unified 'Other'
                        raw_options = clean_opts[:4] + ["Other"]

                    self.session.pending_interaction = {
                        "call_id": tc.id,
                        "tool_name": tc.name,
                        "question": tc.arguments.get("question", ""),
                        "options": raw_options,
                        "context": tc.arguments.get("context", ""),
                    }
                    self._set_state(AgentState.WAITING_FOR_USER)
                    question_txt = tc.arguments.get("question", "")
                    _safe_print(f"\033[1;36m[AGENT] [ASK_USER] Question: \"{question_txt}\"\033[0m")
                    if raw_options:
                        _safe_print(f"\033[1;36m        Options: {raw_options}\033[0m")

                    # If no previous content was emitted, make the assistant content the question
                    if not full_content and question_txt:
                        assistant_msg.content = question_txt
                        ask_msg_event = self.session.append_event(
                            EventType.MESSAGE_COMPLETE,
                            {"role": "assistant", "content": question_txt},
                        )
                        self.emitter.emit(ask_msg_event)
                        yield ask_msg_event

                    ask_event = self.session.append_event(
                        EventType.ASK_USER,
                        self.session.pending_interaction,
                    )
                    self.emitter.emit(ask_event)
                    self._persist()
                    yield ask_event
                    paused_for_user = True
                    break

                # Execute regular tool
                self._set_state(AgentState.EXECUTING_TOOL)

                # Emit real-time status announcement
                def _clean_arg_fn(key: str) -> str:
                    val = str(tc.arguments.get(key, "")).strip().strip("'\"")
                    return Path(val).name if val else ""

                announcements = {
                    "run_backtest": f"📊 [Historical Backtest Simulation]: Simulating portfolio on historical data for '{str(tc.arguments.get('strategy_id', ''))}'...",
                    "run_parameter_matrix_sweep": "Evaluating hyperparameter matrix across market regimes...",
                    "search_web": f"Searching quantitative web resources for: {str(tc.arguments.get('query', ''))[:45]}...",
                    "validate_strategy": "Inspecting strategy AST security boundaries and syntax rules...",
                    "generate_mql5_ea": "Transpiling Python logic to production MQL5 Expert Advisor...",
                    "query_market_data": "Querying historical market structure and regime indicators...",
                    "create_file": f"Creating file {_clean_arg_fn('filename')} in workspace...",
                    "read_file": f"Reading workspace file {_clean_arg_fn('filename')}...",
                    "edit_file": f"Updating workspace file {_clean_arg_fn('filename')}...",
                    "edit_file_partially": f"Applying targeted code modification to {_clean_arg_fn('filename')}...",
                    "list_workspace_files": "Inspecting workspace project file tree...",
                    "delete_file": f"Deleting workspace file {_clean_arg_fn('filename')}...",
                    "search_in_files": f"Searching workspace files for {str(tc.arguments.get('query', '')).strip()[:35]}...",
                    "compile_mql5": f"🔨 [MetaEditor Compiler]: Compiling {_clean_arg_fn('filepath') or _clean_arg_fn('filename')}...",
                    "run_strategy_tester": f"🚀 [MT5 Strategy Tester]: Executing backtest on IC Markets tick data for {_clean_arg_fn('ea_name')}...",
                    "read_test_report": "📊 [Report Ingestion]: Parsing MT5 Strategy Tester execution ledger...",
                    "initialize": "🔌 [MT5 MCP]: Connecting IPC to MetaTrader 5 portable terminal...",
                    "shutdown": "🔌 [MT5 MCP]: Disconnecting MetaTrader 5 terminal IPC...",
                    "login": "🔐 [MT5 MCP]: Authenticating account credentials with broker...",
                    "get_account_info": "💼 [MT5 MCP]: Fetching live account balance, equity, and margin...",
                    "get_symbols": "🔍 [MT5 MCP]: Discovering tradeable broker symbols...",
                    "get_symbol_info": f"ℹ️ [MT5 MCP]: Inspecting symbol specifications for '{str(tc.arguments.get('symbol', ''))}'...",
                    "get_symbol_info_tick": f"📈 [MT5 MCP]: Fetching live tick quotes for '{str(tc.arguments.get('symbol', ''))}'...",
                    "copy_rates_range": f"🕯️ [MT5 MCP]: Extracting historical candle bars for '{str(tc.arguments.get('symbol', ''))}'...",
                    "copy_ticks_range": f"⚡ [MT5 MCP]: Pulling broker tick data for '{str(tc.arguments.get('symbol', ''))}'...",
                    "order_send": f"🚀 [MT5 MCP]: Dispatching order to MetaTrader 5 broker...",
                    "positions_get": "📊 [MT5 MCP]: Inspecting active market positions...",
                    "history_deals_get": "📜 [MT5 MCP]: Ingesting closed deals execution ledger...",
                    "list_strategies": "📁 [MT5 MCP]: Scanning MT5 Experts directory for compiled EAs...",
                }
                status_text = announcements.get(tc.name, f"Executing tool: {tc.name.replace('_', ' ')}...")
                # Strict privacy & path hygiene: scrub any host filesystem paths from announcement text
                status_text = re.sub(r'[A-Za-z]:\\[^:\n\r\t]+?\\([^\s\\/]+)', r'\1', status_text)
                status_text = re.sub(r'(?:\/[a-zA-Z0-9_\-\.]+)+\/([^\s\\/]+)', r'\1', status_text)
                announce_event = self.session.append_event(
                    EventType.STATUS_ANNOUNCEMENT,
                    {"message": status_text, "tool_name": tc.name},
                )
                self.emitter.emit(announce_event)
                yield announce_event

                tool_result: ToolResult
                try:
                    handler = self._tool_handlers.get(tc.name)
                    if not handler:
                        raise ValueError(f"Tool handler '{tc.name}' not registered.")

                    # Inspect arguments and invoke
                    call_args = dict(tc.arguments) if isinstance(tc.arguments, dict) else {}
                    if "raw_arguments" in call_args and len(call_args) == 1:
                        raw_str = call_args["raw_arguments"]
                        try:
                            reparsed = json.loads(raw_str)
                            if isinstance(reparsed, dict):
                                call_args = reparsed
                        except Exception:
                            if tc.name in ("validate_strategy", "transpile_python_to_mql5"):
                                call_args = {"code": raw_str}

                    LOOP_EXEMPT_TOOLS = {"compile_mql5", "create_file", "edit_file", "edit_file_partially", "append_to_file"}
                    if not hasattr(self, "_recent_tool_sigs"):
                        self._recent_tool_sigs = []

                    # If file modifications occurred, clear recent call history so recompilation is never blocked
                    if tc.name in ("create_file", "edit_file", "edit_file_partially", "append_to_file"):
                        self._recent_tool_sigs.clear()

                    sig = f"{tc.name}:{json.dumps(call_args, sort_keys=True, default=str)}"
                    if tc.name not in LOOP_EXEMPT_TOOLS and self._recent_tool_sigs.count(sig) >= 2:
                        output = {
                            "success": False,
                            "error": f"Tool loop halted: '{tc.name}' was called repeatedly with identical arguments. Please synthesize your findings and inform the trader.",
                        }
                    elif tc.name == "read_file" and sum(1 for s in self._recent_tool_sigs if s.startswith(f"read_file:{str(call_args.get('filename', '')).strip().lower()}:")) >= 2:
                        target_fn = str(call_args.get("filename", "")).strip().lower()
                        output = {
                            "success": False,
                            "error": (
                                f"Inspection limit reached: you have already read '{target_fn}' twice in this turn. "
                                "DO NOT read this file again. Proceed directly to implement your logic using "
                                "'edit_file' or 'edit_file_partially' and compile via 'compile_mql5'."
                            ),
                        }
                    else:
                        if tc.name not in LOOP_EXEMPT_TOOLS:
                            if tc.name == "read_file":
                                target_fn = str(call_args.get("filename", "")).strip().lower()
                                self._recent_tool_sigs.append(f"read_file:{target_fn}:{sig}")
                            else:
                                self._recent_tool_sigs.append(sig)
                            if len(self._recent_tool_sigs) > 20:
                                self._recent_tool_sigs.pop(0)

                        if inspect.iscoroutinefunction(handler):
                            output = await handler(**call_args)
                        else:
                            output = handler(**call_args)

                    # Auto-sync strategy manifest when creating or editing strategy files
                    if tc.name == "create_file" and isinstance(output, dict) and output.get("success"):
                        created_fn = output.get("filename") or call_args.get("filename", "")
                        if isinstance(created_fn, str) and (created_fn.lower().endswith(".mq5") or created_fn.lower().endswith(".py")):
                            self.active_strategy = created_fn
                            try:
                                self.sync_strategy_manifest(created_fn)
                            except Exception as sync_err:
                                logger.warning(f"Error auto-syncing manifest on create_file for '{created_fn}': {sync_err}")

                    if tc.name in ("edit_file", "edit_file_partially", "append_to_file") and isinstance(output, dict) and output.get("success"):
                        edited_fn = output.get("filename") or call_args.get("filename", "")
                        if isinstance(edited_fn, str) and (edited_fn.lower().endswith(".mq5") or edited_fn.lower().endswith(".py")):
                            try:
                                self.sync_strategy_manifest(edited_fn)
                            except Exception as sync_err:
                                logger.warning(f"Error auto-syncing manifest on edit for '{edited_fn}': {sync_err}")

                    tool_result = ToolResult(
                        call_id=tc.id,
                        tool_name=tc.name,
                        output=output,
                        is_error=False,
                    )
                except Exception as err:
                    logger.exception(f"Error executing tool {tc.name}: {err}")
                    tool_result = ToolResult(
                        call_id=tc.id,
                        tool_name=tc.name,
                        output=str(err),
                        is_error=True,
                    )

                # Append tool result to history (using context-optimized formatting)
                tool_msg = Message(
                    role=Role.TOOL,
                    content=_format_tool_output_for_session(tc.name, tool_result.output),
                    tool_call_id=tc.id,
                )
                self.session.append_message(tool_msg)
                self._persist()

                finish_event = self.session.append_event(
                    EventType.TOOL_CALL_FINISHED,
                    {
                        "call_id": tc.id,
                        "tool_name": tc.name,
                        "output": tool_result.output,
                        "is_error": tool_result.is_error,
                    },
                )
                self.emitter.emit(finish_event)
                yield finish_event

            if paused_for_user or self.session.state == AgentState.DONE:
                # Halt loop and wait for human input via resume() or user cancellation
                return

            # If tools finished, loop back into THINKING state for next turn
            self._set_state(AgentState.THINKING)

        # Handle completion or turn limit exit gracefully
        if self.session.state != AgentState.DONE and not paused_for_user and not self._is_cancelled:
            if turn_count >= self.max_turns:
                _safe_print(f"\033[1;33m[AGENT] Turn limit reached ({self.max_turns} turns). Synthesizing graceful completion...\033[0m")
                summary_content = (
                    "Applied all intermediate code modifications to the workspace file. "
                    "All changes have been saved to your workspace. "
                    "Ready to compile with MetaEditor or proceed with the next test."
                )
                msg = Message(role=Role.ASSISTANT, content=summary_content)
                self.session.append_message(msg)
                done_event = self.session.append_event(
                    EventType.MESSAGE_COMPLETE,
                    {"role": "assistant", "content": summary_content},
                )
                self.emitter.emit(done_event)
                yield done_event

            self._set_state(AgentState.DONE)
            event = self.session.append_event(
                EventType.AGENT_DONE,
                {"turns": turn_count},
            )
            self.emitter.emit(event)
            yield event

    async def resume(
        self,
        user_response: str,
        context_envelope: Optional[str] = None,
    ) -> AsyncGenerator[TrajectoryEvent, None]:
        """
        Resumes the agent loop after a Human-in-the-Loop interaction (e.g. user answered ask_user).
        """
        _safe_print(f"\n\033[1;36m{'='*80}\033[0m")
        _safe_print(f"\033[1;36m[AGENT] [RESUME] Resuming Session: {self.session.session_id} | User Response: \"{user_response}\"\033[0m")
        _safe_print(f"\033[1;36m{'-'*80}\033[0m")

        if self.session.state != AgentState.WAITING_FOR_USER:
            raise RuntimeError(f"Cannot resume agent: not waiting for user (state: {self.session.state})")

        if self._is_cancelled:
            self._set_state(AgentState.DONE)
            return

        if not self.session.pending_interaction:
            raise RuntimeError("No pending interaction found to resume.")

        pending = self.session.pending_interaction
        call_id = pending["call_id"]
        self.session.pending_interaction = None

        # Record User Response event
        resp_event = self.session.append_event(
            EventType.USER_RESPONSE,
            {"call_id": call_id, "response": user_response},
        )
        self.emitter.emit(resp_event)
        yield resp_event

        # Append tool output representing the user's answer
        tool_msg = Message(
            role=Role.TOOL,
            content=json.dumps({"user_response": user_response}),
            tool_call_id=call_id,
        )
        self.session.append_message(tool_msg)
        self._persist()

        # Transition back to thinking and resume loop
        self._set_state(AgentState.THINKING)
        async for event in self.run(context_envelope=context_envelope):
            yield event
