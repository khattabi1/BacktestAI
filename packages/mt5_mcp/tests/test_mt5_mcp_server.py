import asyncio
import os
import pytest
from pathlib import Path
from mcp_mt5.main import mcp, _get_mt5_paths, _period_to_mt5_enum

@pytest.mark.asyncio
async def test_tool_enumeration():
    """Verify all 29 MT5 tools are registered on FastMCP."""
    tool_objs = await mcp.list_tools()
    tool_names = [getattr(t, "name", t.get("name", "") if isinstance(t, dict) else "") for t in tool_objs]
    
    assert len(tool_names) == 29
    
    # Core strategy & compilation tools
    assert "compile_mql5" in tool_names
    assert "run_strategy_tester" in tool_names
    assert "read_test_report" in tool_names
    assert "list_strategies" in tool_names
    
    # Market data tools
    assert "copy_rates_range" in tool_names
    assert "copy_ticks_range" in tool_names
    assert "get_symbol_info" in tool_names
    assert "symbol_select" in tool_names
    
    # Terminal lifecycle & trading tools
    assert "initialize" in tool_names
    assert "shutdown" in tool_names
    assert "get_account_info" in tool_names
    assert "order_send" in tool_names
    assert "positions_get" in tool_names

def test_mt5_worker_paths():
    """Verify portable worker path resolution."""
    paths = _get_mt5_paths()
    assert "terminal" in paths
    assert "metaeditor" in paths
    assert "data_folder" in paths
    assert "config_folder" in paths
    
    # Must point to worker_1 in workspace
    assert "worker_1" in paths["terminal"].replace("\\", "/")
    assert "worker_1" in paths["data_folder"].replace("\\", "/")
    assert Path(paths["terminal"]).name == "terminal64.exe"
    assert Path(paths["metaeditor"]).name == "MetaEditor64.exe"

def test_helpers_period_enum():
    """Verify official MT5 ENUM_TIMEFRAMES conversion."""
    assert _period_to_mt5_enum("M1") == 1
    assert _period_to_mt5_enum("M15") == 15
    assert _period_to_mt5_enum("H1") == 16385
    assert _period_to_mt5_enum("D1") == 16408
    assert _period_to_mt5_enum("W1") == 32769
    assert _period_to_mt5_enum("MN1") == 49153
