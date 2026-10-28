"""
BacktestAI Agent Package
Based on DeepSeek Agent Harness (DSH) architecture.
"""

from .core.types import (
    AgentState,
    EventType,
    Role,
    Message,
    ToolCall,
    ToolResult,
    TrajectoryEvent,
    ToolDefinition,
    AgentSessionState,
)
from .core.harness import AgentHarness, ToolHandler
from .core.parser import StreamThoughtParser
from .core.events import TrajectoryEventEmitter
from .adapters.llm import (
    BaseLLMAdapter,
    OpenRouterAdapter,
    AnthropicAdapter,
    create_llm_adapter,
)

from .storage.sqlite import SQLiteSessionStorage
from .tools.strategy import (
    read_strategy,
    create_strategy,
    edit_strategy,
    validate_strategy,
    transpile_python_to_mql5,
    generate_mql5_ea,
    register_strategy_tools,
)
from .tools.execution import (
    run_backtest,
    get_backtest_result,
    compare_backtests,
    run_parameter_matrix_sweep,
    register_execution_tools,
)
from .tools.analytical import (
    query_market_data,
    inspect_chart_context,
    register_analytical_tools,
)
from .sandbox.gates import (
    RiskTier,
    ActionStatus,
    ActionPlan,
    ActionPreview,
    AuditRecord,
    ApprovalGateManager,
)

__all__ = [
    "AgentState",
    "EventType",
    "Role",
    "Message",
    "ToolCall",
    "ToolResult",
    "TrajectoryEvent",
    "ToolDefinition",
    "AgentSessionState",
    "AgentHarness",
    "ToolHandler",
    "StreamThoughtParser",
    "TrajectoryEventEmitter",
    "BaseLLMAdapter",
    "OpenRouterAdapter",
    "AnthropicAdapter",
    "create_llm_adapter",
    "SQLiteSessionStorage",
    "read_strategy",
    "create_strategy",
    "edit_strategy",
    "validate_strategy",
    "transpile_python_to_mql5",
    "generate_mql5_ea",
    "register_strategy_tools",
    "run_backtest",
    "get_backtest_result",
    "compare_backtests",
    "run_parameter_matrix_sweep",
    "register_execution_tools",
    "query_market_data",
    "inspect_chart_context",
    "register_analytical_tools",
    "RiskTier",
    "ActionStatus",
    "ActionPlan",
    "ActionPreview",
    "AuditRecord",
    "ApprovalGateManager",
]

