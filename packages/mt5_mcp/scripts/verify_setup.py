import sys, asyncio
from pathlib import Path

# Add src to sys.path dynamically
src_dir = Path(__file__).resolve().parent.parent / "src"
sys.path.insert(0, str(src_dir))

from mcp_mt5.main import mcp, _get_mt5_paths
import os

paths = _get_mt5_paths()
print("terminal      :", paths["terminal"])
print("metaeditor    :", paths["metaeditor"])
print("data_folder   :", paths["data_folder"])
print("config_folder :", paths["config_folder"])

# Validate paths resolve to worker_1 or portable MT5
norm_term = paths["terminal"].replace("\\", "/")
norm_data = paths["data_folder"].replace("\\", "/")
assert "worker_1" in norm_term or "terminal64.exe" in norm_term, f"FAIL: unexpected terminal path {norm_term}"
print("PASS: .env MT5 worker paths loaded correctly")

# Validate all tools registered
async def names():
    tool_objs = await mcp.list_tools()
    return [getattr(t, "name", t.get("name", "") if isinstance(t, dict) else "") for t in tool_objs]

names_list = asyncio.run(names())
print("Total tools registered:", len(names_list))
required_tools = [
    "initialize", "shutdown", "login", "get_account_info",
    "get_symbols", "copy_rates_range", "copy_ticks_range",
    "order_send", "positions_get", "compile_mql5",
    "run_strategy_tester", "read_test_report", "list_strategies"
]
for tool in required_tools:
    assert tool in names_list, f"FAIL: {tool} missing from FastMCP registry"
print(f"PASS: all {len(required_tools)} core tools registered successfully!")
