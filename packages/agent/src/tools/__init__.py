"""
Domain Tool Plugins for BacktestAI Agent Harness (DSH).
"""

from .strategy import (
    read_strategy,
    create_strategy,
    edit_strategy,
    validate_strategy,
    transpile_python_to_mql5,
    generate_mql5_ea,
    register_strategy_tools,
)
from .execution import (
    run_backtest,
    get_backtest_result,
    compare_backtests,
    run_parameter_matrix_sweep,
    register_execution_tools,
)
from .mt5_mcp import (
    register_mt5_mcp_tools,
    compile_mql5,
    run_strategy_tester,
    read_test_report,
)
from .analytical import (
    query_market_data,
    inspect_chart_context,
    register_analytical_tools,
)
from .research import (
    search_web,
    read_web_page,
    register_research_tools,
)
from .workspace import (
    list_workspace_files,
    read_file,
    create_file,
    create_folder,
    edit_file,
    edit_file_partially,
    delete_file,
    search_in_files,
    save_strategy_version,
    list_strategy_versions,
    register_workspace_tools,
)

__all__ = [
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
    "register_mt5_mcp_tools",
    "compile_mql5",
    "run_strategy_tester",
    "read_test_report",
    "query_market_data",
    "inspect_chart_context",
    "register_analytical_tools",
    "search_web",
    "read_web_page",
    "register_research_tools",
    "list_workspace_files",
    "read_file",
    "create_file",
    "create_folder",
    "edit_file",
    "edit_file_partially",
    "delete_file",
    "search_in_files",
    "save_strategy_version",
    "list_strategy_versions",
    "register_workspace_tools",
]
