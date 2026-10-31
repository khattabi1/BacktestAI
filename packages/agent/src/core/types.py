"""
Type definitions for BacktestAI Agent Harness (DSH Architecture).
Directly ported from institutional BacktestAI agent engine.
"""

from __future__ import annotations
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
import re
from pydantic import BaseModel, Field


def utc_now_iso() -> str:
    """Returns current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


class AgentState(str, Enum):
    """Execution state of the agent harness."""
    IDLE = "IDLE"
    THINKING = "THINKING"
    EXECUTING_TOOL = "EXECUTING_TOOL"
    WAITING_FOR_USER = "WAITING_FOR_USER"
    DONE = "DONE"
    ERROR = "ERROR"


class StrategyInceptionState(str, Enum):
    """
    Quant SI Strategy Inception State Machine.
    Governs progression from exploratory discussion to Preset approval, code synthesis,
    testing, and post-test strategy folder versioning.
    """
    DISCUSSING = "DISCUSSING"          # Multi-turn open discussion, answering questions, autonomous web search
    PRESET_REVIEW = "PRESET_REVIEW"    # Formal 17-section Preset emitted, awaiting trader review / approval
    CODE_PROPOSED = "CODE_PROPOSED"    # Preset approved, unversioned strategy script (<name>.py/.mq5) synthesized
    COMPILED = "COMPILED"              # Strategy compiled (.ex5) cleanly, verified ready for tester
    READY_FOR_TEST = "READY_FOR_TEST"  # Unversioned strategy script saved and syntax-checked, ready for testing
    TESTED = "TESTED"                  # Strategy executed in sandbox or backtest, results produced
    VERSIONED = "VERSIONED"            # Dedicated strategy folder created, versioned (_v1.py), registered in library


class EventType(str, Enum):
    """Event types emitted during agent execution trajectory."""
    SESSION_STARTED = "SESSION_STARTED"
    STATE_CHANGED = "STATE_CHANGED"
    INCEPTION_STATE_CHANGED = "INCEPTION_STATE_CHANGED"
    THOUGHT_CHUNK = "THOUGHT_CHUNK"
    THOUGHT_COMPLETE = "THOUGHT_COMPLETE"
    TOOL_CALL_STARTED = "TOOL_CALL_STARTED"
    TOOL_CALL_FINISHED = "TOOL_CALL_FINISHED"
    ASK_USER = "ASK_USER"
    USER_RESPONSE = "USER_RESPONSE"
    MESSAGE_CHUNK = "MESSAGE_CHUNK"
    MESSAGE_COMPLETE = "MESSAGE_COMPLETE"
    AGENT_DONE = "AGENT_DONE"
    AGENT_ERROR = "AGENT_ERROR"
    STATUS_ANNOUNCEMENT = "STATUS_ANNOUNCEMENT"
    TEST_AUTOPSY_INGESTED = "TEST_AUTOPSY_INGESTED"


class Role(str, Enum):
    """Message sender roles."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class ToolCall(BaseModel):
    """Represents a tool call invocation by the LLM."""
    id: str
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)


class ToolResult(BaseModel):
    """Represents the outcome of a tool execution."""
    call_id: str
    tool_name: str
    output: Any
    is_error: bool = False


class Message(BaseModel):
    """Represents a conversational message in the agent history."""
    role: Role
    content: str = ""
    thought: Optional[str] = None
    tool_calls: Optional[list[ToolCall]] = None
    tool_call_id: Optional[str] = None
    media: Optional[list[dict[str, Any]]] = None
    timestamp_utc: str = Field(default_factory=utc_now_iso)


class TrajectoryEvent(BaseModel):
    """Event item recorded in the execution trajectory."""
    step_index: int
    event_type: EventType
    timestamp_utc: str = Field(default_factory=utc_now_iso)
    payload: dict[str, Any] = Field(default_factory=dict)
    session_id: str


class ToolDefinition(BaseModel):
    """Schema descriptor for a registered agent tool."""
    name: str
    description: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    requires_approval: bool = False
    is_interactive: bool = False


class StrategyManifest(BaseModel):
    """
    Compact strategy summary injected into system prompt and persisted across sessions.
    Maintains target symbol, timeframe, version, and latest simulation metrics.
    """
    strategy_name: str
    version: int = 1
    target_symbol: str = "PENDING"
    native_timeframe: str = "PENDING"
    engine: str = "MT5"
    core_rules_summary: str = ""
    test_status: str = "NOT_TESTED"
    last_test_metrics: dict[str, Any] = Field(default_factory=dict)
    updated_at: str = Field(default_factory=utc_now_iso)

    def to_compact_header(self) -> str:
        """Serializes manifest into a compact one-line header for prompt injection."""
        parts = [
            f"Strategy='{self.strategy_name}'",
            f"v{self.version}",
            f"Symbol='{self.target_symbol}'",
            f"TF='{self.native_timeframe}'",
            f"Engine='{self.engine}'",
            f"Status='{self.test_status}'",
        ]
        if self.core_rules_summary:
            parts.append(f"Rules='{self.core_rules_summary}'")
        if self.last_test_metrics:
            wr = self.last_test_metrics.get("win_rate") or self.last_test_metrics.get("winRate")
            sh = self.last_test_metrics.get("sharpe") or self.last_test_metrics.get("sharpe_ratio")
            tr = self.last_test_metrics.get("total_trades") or self.last_test_metrics.get("totalTrades")
            metrics_summary = []
            if wr is not None:
                metrics_summary.append(f"WR:{wr}%")
            if sh is not None:
                metrics_summary.append(f"Sharpe:{sh}")
            if tr is not None:
                metrics_summary.append(f"Trades:{tr}")
            if metrics_summary:
                parts.append(f"LastMetrics=[{', '.join(metrics_summary)}]")
        return f"[STRATEGY MANIFEST: {' | '.join(parts)}]"


class AgentSessionState(BaseModel):
    """
    Master state of an agent session, containing history, trajectory,
    active strategy metadata, and inception lifecycle stage.
    """
    session_id: str
    user_id: str
    title: str = "Quantitative Research Session"
    state: AgentState = AgentState.IDLE
    inception_state: StrategyInceptionState = StrategyInceptionState.DISCUSSING
    active_strategy_name: Optional[str] = None
    active_strategy_version: int = 1
    strategy_manifest: Optional[StrategyManifest] = None
    preset_approved: bool = False
    history: list[Message] = Field(default_factory=list)
    trajectory: list[TrajectoryEvent] = Field(default_factory=list)
    pending_interaction: Optional[dict[str, Any]] = None
    context_meta: dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=utc_now_iso)
    updated_at: str = Field(default_factory=utc_now_iso)

    def append_event(self, event_type: EventType, payload: dict[str, Any]) -> TrajectoryEvent:
        """Appends a new trajectory event and updates session timestamp."""
        event = TrajectoryEvent(
            step_index=len(self.trajectory) + 1,
            event_type=event_type,
            payload=payload,
            session_id=self.session_id,
        )
        self.trajectory.append(event)
        self.updated_at = utc_now_iso()
        return event

    def append_message(self, message: Message) -> None:
        """Appends a message to the conversational history."""
        self.history.append(message)
        self.updated_at = utc_now_iso()


def validate_strategy_name(name: str) -> tuple[bool, str, str]:
    """
    Validates that a strategy name adheres to 2 to 6 words in lowercase snake_case,
    preferring concise names (2-3 words) where possible.
    Returns: (is_valid, normalized_name, error_message)
    Examples:
      - 'ict_gold_scalper' -> (True, 'ict_gold_scalper', '')
      - 'gold_m1_liquidity_scalper' -> (True, 'gold_m1_liquidity_scalper', '')
      - 'rsi_vol_reversal' -> (True, 'rsi_vol_reversal', '')
      - 'single' -> (False, 'single', 'Strategy name must be between 2 and 6 words...')
      - 'way_too_many_words_in_this_strategy_name_here' -> (False, ..., 'Strategy name must be between 2 and 6 words...')
    """
    if not name or not isinstance(name, str):
        return False, "", "Strategy name cannot be empty."

    clean = name.strip().lower()
    # Remove file extension if provided
    if clean.endswith(".py") or clean.endswith(".mq5"):
        clean = re.sub(r"\.(py|mq5)$", "", clean)
    # Remove version suffix like _v1, _v2 if provided
    clean = re.sub(r"_v\d+$", "", clean)
    clean = clean.strip("_")

    # Replace dashes and spaces with underscores
    clean = re.sub(r"[\s\-]+", "_", clean)

    # Must only contain lowercase a-z, 0-9 and underscores
    if not re.match(r"^[a-z0-9]+(_[a-z0-9]+)*$", clean):
        return False, clean, "Strategy name must contain only lowercase alphanumeric characters and underscores."

    words = [w for w in clean.split("_") if w]
    if len(words) < 2 or len(words) > 6:
        return False, clean, (
            f"Strategy name must be strictly 2 or 3 words (or between 2 and 6 words in lowercase snake_case, "
            f"got {len(words)} words: '{clean}'). Always prefer shorter names (2–3 words, e.g. 'ict_gold_scalper')."
        )

    return True, clean, ""


def format_strategy_filename(strategy_name: str, version: int = 1, ext: str = "py") -> str:
    """
    Formats standard disk filename: <strategy_name>_v<version>.<ext>
    Example: 'ict_gold_scalper_v1.py'
    """
    _, clean_name, _ = validate_strategy_name(strategy_name)
    target_name = clean_name or "custom_strategy"
    clean_ext = ext.lstrip(".")
    return f"{target_name}_v{version}.{clean_ext}"


class ModelChunk:
    """Represents a chunk received from the LLM stream."""
    def __init__(
        self,
        thought_delta: str = "",
        content_delta: str = "",
        tool_calls: Optional[list[ToolCall]] = None,
        is_finished: bool = False,
    ) -> None:
        self.thought_delta = thought_delta
        self.content_delta = content_delta
        self.tool_calls = tool_calls or []
        self.is_finished = is_finished
