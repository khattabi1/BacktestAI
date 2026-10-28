import inspect
import pytest
from packages.agent.src.core.harness import AgentHarness
from packages.agent.src.tools import (
    register_strategy_tools,
    register_execution_tools,
    register_analytical_tools,
    register_research_tools,
    register_workspace_tools,
    register_mt5_mcp_tools,
)

class DummyAdapter:
    pass

def test_all_registered_tools_signatures_and_schemas():
    harness = AgentHarness(session_id="test_session", user_id="test_user", llm_adapter=DummyAdapter())
    register_strategy_tools(harness, user_id="test_user")
    register_execution_tools(harness)
    register_analytical_tools(harness)
    register_research_tools(harness)
    register_workspace_tools(harness, user_id="test_user")
    register_mt5_mcp_tools(harness)

    assert len(harness._tools) == 57, f"Expected 57 tools (28 native + 29 MT5 MCP), got {len(harness._tools)}"

    errors = []
    for name, tool in harness._tools.items():
        assert name in harness._tool_handlers, f"Tool {name} has no registered handler!"
        handler = harness._tool_handlers[name]
        sig = inspect.signature(handler)
        props = tool.parameters.get("properties", {})
        reqs = tool.parameters.get("required", [])

        # Check required schema parameters against handler signature
        has_var_keyword = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values())
        if not has_var_keyword:
            for req in reqs:
                if req not in sig.parameters:
                    errors.append(f"Tool '{name}': required property '{req}' missing from handler signature {sig}")

        # Check if handler has required parameters without defaults that aren't in schema
        for p_name, param in sig.parameters.items():
            if param.default == inspect.Parameter.empty and param.kind not in (
                inspect.Parameter.VAR_POSITIONAL,
                inspect.Parameter.VAR_KEYWORD,
            ):
                if p_name not in props and p_name != "user_id":  # user_id can be injected
                    errors.append(f"Tool '{name}': handler required param '{p_name}' not defined in schema properties")

    assert not errors, f"Tool signature/schema errors: {errors}"
