"""
Core modules for BacktestAI Agent Harness (DSH).
"""

from .types import (
    AgentState,
    StrategyInceptionState,
    EventType,
    Role,
    Message,
    ToolCall,
    ToolResult,
    TrajectoryEvent,
    ToolDefinition,
    StrategyManifest,
    AgentSessionState,
    validate_strategy_name,
    format_strategy_filename,
    ModelChunk,
)
from .parser import StreamThoughtParser
from .events import TrajectoryEventEmitter
from .compaction import QuantSessionDigest
from .introspector import introspect_strategy_code
from .harness import AgentHarness, ToolHandler

__all__ = [
    "AgentState",
    "StrategyInceptionState",
    "EventType",
    "Role",
    "Message",
    "ToolCall",
    "ToolResult",
    "TrajectoryEvent",
    "ToolDefinition",
    "StrategyManifest",
    "AgentSessionState",
    "validate_strategy_name",
    "format_strategy_filename",
    "ModelChunk",
    "StreamThoughtParser",
    "TrajectoryEventEmitter",
    "QuantSessionDigest",
    "introspect_strategy_code",
    "AgentHarness",
    "ToolHandler",
]
