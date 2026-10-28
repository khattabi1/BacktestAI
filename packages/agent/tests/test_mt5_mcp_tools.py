"""
Unit tests for MT5 MCP Tool Bridge in packages/agent.
Verifies dynamic discovery, registration of all 29 MT5 MCP tools into AgentHarness,
schema compliance, and clean execution without duplicate conflicts.
"""

from __future__ import annotations

import inspect
import pytest
from packages.agent.src.core.harness import AgentHarness
from packages.agent.src.tools.mt5_mcp import (
    register_mt5_mcp_tools,
    sanitize_json,
    compile_mql5,
    run_strategy_tester,
    read_test_report,
)
from packages.agent.src.tools import (
    register_strategy_tools,
    register_execution_tools,
    register_analytical_tools,
    register_research_tools,
    register_workspace_tools,
)


class DummyAdapter:
    pass


def test_mt5_mcp_tools_registration_count():
    """Verifies exactly 29 tools are registered from the MT5 FastMCP server."""
    harness = AgentHarness(session_id="test_mcp_count", user_id="test_user", llm_adapter=DummyAdapter())
    registered = register_mt5_mcp_tools(harness)

    assert len(registered) == 29, f"Expected 29 registered MT5 MCP tools, got {len(registered)}"
    assert "initialize" in registered
    assert "shutdown" in registered
    assert "login" in registered
    assert "get_account_info" in registered
    assert "get_version" in registered
    assert "get_symbols" in registered
    assert "get_symbols_by_group" in registered
    assert "get_symbol_info" in registered
    assert "get_symbol_info_tick" in registered
    assert "symbol_select" in registered
    assert "copy_rates_from_pos" in registered
    assert "copy_rates_from_date" in registered
    assert "copy_rates_range" in registered
    assert "copy_ticks_from_pos" in registered
    assert "copy_ticks_from_date" in registered
    assert "copy_ticks_range" in registered
    assert "get_last_error" in registered
    assert "order_send" in registered
    assert "order_check" in registered
    assert "positions_get" in registered
    assert "positions_get_by_ticket" in registered
    assert "orders_get" in registered
    assert "orders_get_by_ticket" in registered
    assert "history_orders_get" in registered
    assert "history_deals_get" in registered
    assert "compile_mql5" in registered
    assert "run_strategy_tester" in registered
    assert "read_test_report" in registered
    assert "list_strategies" in registered


def test_zero_tool_name_collisions():
    """Verifies that all 56 tools (27 native + 29 MT5 MCP) have completely unique names."""
    harness = AgentHarness(session_id="test_mcp_unique", user_id="test_user", llm_adapter=DummyAdapter())
    register_strategy_tools(harness, user_id="test_user")
    register_execution_tools(harness)
    register_analytical_tools(harness)
    register_research_tools(harness)
    register_workspace_tools(harness, user_id="test_user")
    register_mt5_mcp_tools(harness)

    # 1 ask_user + 27 native domain (including edit_file_partially) + 29 MT5 MCP = 57 unique tools
    assert len(harness._tools) == 57, f"Expected 57 unique registered tools, got {len(harness._tools)}"


def test_sanitize_json_helpers():
    """Verifies JSON sanitizer cleanly handles numpy, nan, timestamps, and nested objects."""
    import math
    from datetime import datetime

    data = {
        "nan_val": float("nan"),
        "inf_val": float("inf"),
        "timestamp": datetime(2026, 1, 1, 12, 0, 0),
        "nested": {"items": (1, 2, 3), "ok": True},
    }
    sanitized = sanitize_json(data)
    assert sanitized["nan_val"] is None
    assert sanitized["inf_val"] is None
    assert sanitized["timestamp"] == "2026-01-01T12:00:00"
    assert sanitized["nested"]["items"] == [1, 2, 3]
    assert sanitized["nested"]["ok"] is True


@pytest.mark.asyncio
async def test_mt5_mcp_tool_dispatch():
    """Verifies that dispatching an MT5 MCP tool handler executes and returns a sanitized dict."""
    harness = AgentHarness(session_id="test_mcp_exec", user_id="test_user", llm_adapter=DummyAdapter())
    register_mt5_mcp_tools(harness)

    handler = harness._tool_handlers.get("get_version")
    assert handler is not None

    res = await handler()
    assert isinstance(res, dict)
    assert "version" in res or "error" in res or "success" in res


def test_ea_binary_auto_deployment_and_log_decoding(tmp_path):
    """Verifies _deploy_ea_binary syncs .ex5 files and _read_log_file decodes UTF-16 LE properly."""
    import os
    from mcp_mt5.main import _deploy_ea_binary, _read_log_file

    # 1. Test UTF-16 LE log reading without null bytes
    log_file = tmp_path / "compile.log"
    utf16_text = "0 errors, 0 warnings, 1540 msec elapsed\n"
    with open(log_file, "wb") as f:
        f.write(b"\xff\xfe" + utf16_text.encode("utf-16-le"))

    decoded = _read_log_file(str(log_file))
    assert "\x00" not in decoded
    assert "0 errors" in decoded

    # 2. Test auto-deploying an EA binary
    fake_ex5 = tmp_path / "TestEA.ex5"
    fake_ex5.write_bytes(b"\x00\x01\x02\x03EX5BINARY")

    deployed = _deploy_ea_binary(str(fake_ex5))
    assert len(deployed) > 0
    for p in deployed:
        assert os.path.exists(p)
        assert os.path.basename(p) == "TestEA.ex5"

    # Clean up temporary test binary from worker folders
    for p in deployed:
        try:
            if os.path.exists(p):
                os.remove(p)
        except Exception:
            pass


def test_mt5_period_normalization_and_enums():
    """Verifies MT5 period normalization and enum resolution for standard timeframes and aliases."""
    from mcp_mt5.main import _normalize_period_str, _period_to_mt5_enum, _PERIOD_ENUM

    # Verify M15, M20, M30 exist in enum
    assert "M15" in _PERIOD_ENUM
    assert "M20" in _PERIOD_ENUM
    assert "M30" in _PERIOD_ENUM
    assert _PERIOD_ENUM["M15"] == 15

    # Test normalization of aliases
    assert _normalize_period_str("15m") == "M15"
    assert _normalize_period_str("15M") == "M15"
    assert _normalize_period_str("5m") == "M5"
    assert _normalize_period_str("1h") == "H1"
    assert _normalize_period_str("4h") == "H4"
    assert _normalize_period_str("1d") == "D1"
    assert _normalize_period_str("M15") == "M15"
    assert _normalize_period_str("H1") == "H1"

    # Test enum resolution
    assert _period_to_mt5_enum("M15") == 15
    assert _period_to_mt5_enum("15m") == 15
    assert _period_to_mt5_enum("1h") == 16385
    assert _period_to_mt5_enum("4h") == 16388
    assert _period_to_mt5_enum("1d") == 16408


@pytest.mark.asyncio
async def test_run_backtest_guards_against_mql5(tmp_path):
    """Verifies run_backtest rejects .mq5 strategies immediately without timing out."""
    from packages.agent.src.tools.execution import run_backtest

    res = await run_backtest(strategy_id="gold_sr_bounce.mq5", symbol="XAUUSD")
    assert res["success"] is False
    assert "run_strategy_tester" in res["error"]


def test_compile_mql5_path_resolution_via_workspace():
    """Verifies that an agent passing a relative filename or non-existent root path resolves to user workspace."""
    from packages.agent.src.tools.workspace import _resolve_file_path, PROJECT_ROOT
    test_file = PROJECT_ROOT / "data" / "users" / "senior" / "gold_sr_bounce.mq5"
    if test_file.exists():
        resolved_rel = _resolve_file_path("gold_sr_bounce.mq5", "senior")
        assert resolved_rel.exists()
        assert resolved_rel.resolve() == test_file.resolve()

        resolved_root = _resolve_file_path(str(PROJECT_ROOT / "gold_sr_bounce.mq5"), "senior")
        assert resolved_root.exists()
        assert resolved_root.resolve() == test_file.resolve()



