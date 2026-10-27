import os, sys, asyncio, json, re
if "PYTHONPATH" in os.environ:
    del os.environ["PYTHONPATH"]
sys.path.insert(0, r"C:\AI\MT5_MCP\MT5-MCP-main\src")
from mcp_mt5.main import mcp, _get_mt5_paths

def parse(r):
    """Parse a FastMCP call_tool result."""
    txt = r.text if hasattr(r, "text") else str(r)
    if txt.startswith("content=[TextContent") or txt.startswith("content=["):
        m = re.search(r"text='((?:[^'\\]|\\\\')*)'", txt, re.DOTALL)
        txt = m.group(1) if m else txt
    txt = txt.replace("\\'", "'").replace("\\\\", "\\")
    try:
        return json.loads(txt)
    except Exception:
        return {"raw": txt[:300]}

async def run(name, **params):
    try:
        r = await mcp.call_tool(name, arguments=params or {})
        return parse(r)
    except Exception as e:
        return {"error": f"{type(e).__name__}: {str(e)[:250]}"}

async def main():
    p = _get_mt5_paths()
    print("=== initialize (portable, MT5 running)")
    i = await run("initialize", **{"path": p["terminal"]})
    print("init:", i)

    print("=== get_account_info ===")
    a = await run("get_account_info")
    if "login" in a:
        print("login:", a.get("login"), "server:", a.get("server"),
              "balance:", a.get("balance"), "trade_allowed:", a.get("trade_allowed"))
    else:
        print(a)

    print("=== list_strategies ===")
    s = await run("list_strategies")
    n = len(s["strategies"]) if isinstance(s.get("strategies"), list) else s
    print("strategies:", n)

    print("=== compile_mql5 ===")
    c = await run("compile_mql5", **{"filepath": r"C:\AI\MetaTrader5_Portable\MQL5\Experts\Examples\Moving Average\Moving Average.mq5"})
    print("compile success:", c.get("success"), "ex5_exists:", c.get("ex5_exists"))

    print("=== shutdown ===")
    print(await run("shutdown"))

asyncio.run(main())
