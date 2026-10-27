"""
Patch main.py: splice in corrected run_strategy_tester, read_test_report,
and helper functions. Reads source from separate files to avoid escaping issues.
"""
import inspect, textwrap, ast

MAIN = r'C:\AA_Roan\AI\mt5-mcp-repo\src\mcp_mt5\main.py'

# ── Import helpers source ──────────────────────────────────────────
import importlib.util

def get_source(filepath, strip_decorator=None):
    """Read a .py file and return its source as a string.
    If strip_decorator is given, remove lines matching it."""
    with open(filepath, 'r') as f:
        src = f.read()
    if strip_decorator:
        lines = src.split('\n')
        lines = [l for l in lines if not l.strip().startswith(strip_decorator)]
        src = '\n'.join(lines)
    return src

# Read the helper functions source (no @mcp.tool decorators in helpers.py)
helper_src = get_source(r'C:\AA_Roan\AI\mt5-mcp-repo\scripts\helpers.py')
# Remove imports and logger (already in main.py)
helper_lines = []
skip_imports = True
for line in helper_src.split('\n'):
    if skip_imports and (line.startswith('import ') or line.startswith('from ') or 
                          line.startswith('#') or line.strip() == '' or
                          line.startswith('logger = ')):
        continue
    skip_imports = False
    helper_lines.append(line)
helper_src = '\n'.join(helper_lines).strip()

# Read the new function sources
new_rt_src = get_source(r'C:\AA_Roan\AI\mt5-mcp-repo\scripts\new_run_strategy_tester.py')
new_rr_src = get_source(r'C:\AA_Roan\AI\mt5-mcp-repo\scripts\new_read_test_report.py')

# ── Read main.py ──
with open(MAIN, 'r') as f:
    main_src = f.read()

# ── 1. Update _get_mt5_paths ──
old_paths = '''def _get_mt5_paths() -> dict[str, str]:
    """Read MT5 paths from environment / .env, with Portable Broker defaults."""
    return {
        "terminal": os.getenv(
            "MT5_PATH",
            r"C:\\Program Files\\MetaTrader 5 Portable Broker Global\\terminal64.exe",
        ),
        "metaeditor": os.getenv(
            "MT5_METAEDITOR_PATH",
            r"C:\\Program Files\\MetaTrader 5 Portable Broker Global\\MetaEditor64.exe",
        ),
        "data_folder": os.getenv(
            "MT5_DATA_FOLDER",
            r"C:\\MetaTrader5_Portable",
        ),
        "config_folder": os.getenv(
            "MT5_CONFIG_FOLDER",
            r"C:\\MetaTrader5_Portable\\Config",
        ),
    }'''

new_paths = '''def _get_mt5_paths() -> dict[str, str]:
    """Read MT5 paths from environment / .env, with Portable Broker defaults."""
    return {
        "terminal": os.getenv(
            "MT5_PATH",
            r"C:\\Program Files\\MetaTrader 5 Portable Broker Global\\terminal64.exe",
        ),
        "metaeditor": os.getenv(
            "MT5_METAEDITOR_PATH",
            r"C:\\Program Files\\MetaTrader 5 Portable Broker Global\\MetaEditor64.exe",
        ),
        "data_folder": os.getenv(
            "MT5_DATA_FOLDER",
            r"C:\\MetaTrader5_Portable",
        ),
        "config_folder": os.getenv(
            "MT5_CONFIG_FOLDER",
            r"C:\\MetaTrader5_Portable\\Config",
        ),
        "tester_log": os.getenv(
            "MT5_TESTER_LOG",
            r"C:\\MetaTrader5_Portable\\Tester\\logs",
        ),
        "terminal_ini": os.getenv(
            "MT5_TERMINAL_INI",
            r"C:\\MetaTrader5_Portable\\terminal.ini",
        ),
    }'''

assert old_paths in main_src, "Could not find _get_mt5_paths"
main_src = main_src.replace(old_paths, new_paths)
print("[PATCH] _get_mt5_paths updated (added tester_log + terminal_ini)")

# ── 2. Insert helper functions before compile_mql5 ──
# Find the section header
section = "# ──────────────────────────────────────────────────────────────────────────────\n# MQL5 COMPILATION & STRATEGY TESTING TOOLS"
helper_block = "\n\n# ──────────────────────────────────────────────────────────────────────────────\n# HELPER FUNCTIONS FOR STRATEGY TESTING (patched)\n# ──────────────────────────────────────────────────────────────────────────────\n\n" + helper_src + "\n"

assert section in main_src, "Could not find MQL5 COMPILATION section"
main_src = main_src.replace(section, helper_block + section)
print("[PATCH] Helper functions inserted")

# ── 3. Replace run_strategy_tester ──
# Find from @mcp.tool()\ndef run_strategy_tester to the next @mcp.tool()
old_rt_start = '@mcp.tool()\ndef run_strategy_tester('
old_rt_end = '@mcp.tool()\ndef read_test_report('

rt_start_idx = main_src.index(old_rt_start)
rt_end_idx = main_src.index(old_rt_end)

main_src = main_src[:rt_start_idx] + new_rt_src + "\n\n\n" + main_src[rt_end_idx:]
print("[PATCH] run_strategy_tester replaced")

# ── 4. Replace read_test_report ──
# Re-find after the replacement
new_rr_end = '@mcp.tool()\ndef list_strategies('

rr_start_idx = main_src.index('@mcp.tool()\ndef read_test_report(')
rr_end_idx = main_src.index(new_rr_end)

main_src = main_src[:rr_start_idx] + new_rr_src + "\n\n\n" + main_src[rr_end_idx:]
print("[PATCH] read_test_report replaced")

# ── Write patched file ──
with open(MAIN, 'w') as f:
    f.write(main_src)

# Verify syntax
try:
    ast.parse(main_src)
    print("[VERIFY] ✓ main.py syntax OK")
except SyntaxError as e:
    print(f"[VERIFY] ✗ SYNTAX ERROR: {e}")

# Count functions
tree = ast.parse(main_src)
funcs = [n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
print(f"[VERIFY] Total functions: {len(funcs)}")
for fn in funcs:
    print(f"  - {fn}")
