# MT5-MCP: Strategy Testing for Every LLM

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.12%2B-blue.svg)](https://www.python.org/)
[![MetaTrader 5](https://img.shields.io/badge/MT5-Build%206000%2B-orange.svg)](https://www.metatrader5.com/)

This is a **Model Context Protocol (MCP) server for MetaTrader 5 strategy testing**. It lets any LLM (Claude, GPT-4, Ollama, etc.) **compile Expert Advisors, run backtests with arbitrary settings, and receive structured results** — all via MCP tools.

This repo is a **fork of [Qoyyuum/mcp-metatrader5-server](https://github.com/Qoyyuum/mcp-metatrader5-server)** extended with corrected strategy-tester workflows, terminal.ini date-range editing (the original approach doesn't work), and automatic HTML/CSV report generation.

---

## TL;DR — For an AI Setting This Up for the First Time

1. Ask the user for their **MetaTrader 5 installation path** and **data folder path**
2. Copy [`configs/env.example`](configs/env.example) → `.env` at repo root, fill in the paths
3. `uv sync` (or `pip install -e .`)
4. Register the MCP server in your `claude_desktop_config.json`, `cursor_config.json`, etc.
5. Call `run_strategy_tester()` — done

---

## Prerequisites

| Item | Requirement |
|------|-------------|
| **OS** | Windows 10/11 (MT5 is Windows-only) |
| **MT5** | MetaTrader 5 installed (tested on build 6199, Portable Broker) |
| **Python** | 3.12+ (or 3.11 with `MetaTrader5==5.0.6180`) |
| **uv** | Recommended (`pip install uv`) |
| **MCP client** | Claude Desktop, Cursor, Windsurf, or any MCP-compatible LLM tool |

> 💡 **If you only have a `.mq5` file and no MT5 installed:** You need MT5 (with MetaEditor) to compile and test. There is no cloud alternative that produces real strategy-tester results.

---

## Installation (Step-by-Step for AI Agents)

### Step 1: Discover the user's MT5 paths

Ask the user:

> "Where is your MetaTrader 5 installed? Please provide the full path to `terminal64.exe`."
>
> "Can you open MetaTrader 5 and go to **File → Open Data Folder**? Please paste the folder path shown in the address bar."

Typical paths:

| Binary | Common Path |
|--------|-------------|
| `terminal64.exe` | `C:\Program Files\MetaTrader 5\terminal64.exe` |
| `terminal64.exe` (Portable Broker) | `C:\Program Files\MetaTrader 5 Portable Broker Global\terminal64.exe` |
| `MetaEditor64.exe` | Same folder as terminal64.exe |
| Data folder | `C:\Users\[username]\AppData\Roaming\MetaQuotes\Terminal\[32-char-hash]\` |

If you can't get the data folder path from the user, find it programmatically:
```python
import glob, os
candidates = glob.glob(r"C:\Users\*\AppData\Roaming\MetaQuotes\Terminal\*\")
# Look for folders containing MQL5/ and Config/
```

### Step 2: Configure environment

```bash
cp configs/env.example .env
```

Edit `.env` and set:
- `MT5_PATH` → path to `terminal64.exe`
- `MT5_METAEDITOR_PATH` → path to `MetaEditor64.exe`
- `MT5_DATA_FOLDER` → the data folder path from "Open Data Folder"
- `MT5_CONFIG_FOLDER` → `[data_folder]\Config`
- `MT5_TESTER_LOG` → `[data_folder]\Tester\logs`
- `MT5_TERMINAL_INI` → `[data_folder]\terminal.ini`

### Step 3: Install dependencies

```bash
uv sync        # recommended
# OR
pip install -e ".[dev]"
```

### Step 4: Register as MCP server

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "mt5": {
      "command": "uv",
      "args": ["run", "mt5mcp"],
      "cwd": "C:\\path\\to\\this\\repo"
    }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "mt5": {
      "command": "uv",
      "args": ["run", "mt5mcp"],
      "cwd": "C:\\path\\to\\this\\repo"
    }
  }
}
```

**Windsurf** (`.openhands.json`):
```json
{
  "mcpServers": {
    "mt5": {
      "command": "uv",
      "args": ["run", "mt5mcp"],
      "cwd": "C:\\path\\to\\this\\repo"
    }
  }
}
```

### Step 5: Verify

Restart your LLM client, then ask it:
> "List available MCP tools and specifically the MT5 tools"

You should see tools like: `compile_mql5`, `run_strategy_tester`, `read_test_report`, `list_strategies`, `get_account_info`, `order_send`, etc.

---

## MCP Server Tools (Extended)

The original Qoyyuum server provides **50+ tools** for trading (order_send, positions_get, history_deals_get, etc.). This fork adds/fixes:

| Tool | Description |
|------|-------------|
| `compile_mql5(filepath)` | Compile `.mq5` → `.ex5` via MetaEditor CLI |
| `run_strategy_tester(ea_name, symbol, period, ...)` | **Corrected** strategy tester (see workflow below) |
| `read_test_report(report_path)` | Parse HTML report **or Tester log** (UTF-16-LE) |
| `list_strategies()` | List all EAs in the Experts folder |
| + 46 original trading tools | `get_account_info`, `order_send`, `copy_rates_range`, etc. |

### `run_strategy_tester` — Corrected Workflow

```python
from mcp_mt5.main import run_strategy_tester

result = run_strategy_tester(
    ea_name="Moving Average.ex5",       # NO "Experts\" prefix!
    symbol="EURUSD",
    period="H1",
    model=0,                            # 0 = every tick (only reliable mode)
    deposit=10000,
    from_date="2026.09.14",             # YYYY.MM.DD
    to_date="2026.09.16",
    timeout=600,
)
print(result["metrics"])
```

### `read_test_report` — Dual-Mode Parser

```python
from mcp_mt5.main import read_test_report

# From HTML report (if generated)
result = read_test_report(r"C:\...\TestReport.html")

# From Tester log (UTF-16-LE, fallback when no HTML)
result = read_test_report(r"C:\...\Tester\logs\20260918.log")
```

---

## Standalone Scripts

The [`scripts/`](scripts/) folder contains standalone Python scripts that work **without** the MCP server:

### `run_backtest.py` — One-shot pipeline

```bash
python scripts/run_backtest.py \
    --ea "Moving Average.ex5" \
    --symbol EURUSD \
    --period H1 \
    --from-date 2026.09.14 \
    --to-date 2026.09.16 \
    --save-html outputs/html_reports/ \
    --save-excel outputs/excel_reports/
```

This will:
1. Modify `terminal.ini` for the date range
2. Write a tester config file
3. Launch MT5, run the test
4. Parse the Tester log
5. Save HTML + CSV reports

### `compile_ea.py` — Compile only

```bash
python scripts/compile_ea.py "Experts\MyExpert.mq5"
```

### `test_quick.py` — Quick smoke test

```bash
python scripts/test_quick.py
```

Tests the Moving Average example EA on EURUSD/H1 for 3 days and saves reports to `outputs/`.

---

## ⚠️ Critical Workflow Knowledge

These are **hard-won insights** from extensive testing. Skip at your peril:

### 1. Date ranges MUST be set in terminal.ini, NOT the config file

MT5's config `.ini` file parameters `TestDateMode`, `TestFromDate`, and `TestToDate` are **completely ignored** by the terminal. The only way to set a date range is to directly edit `terminal.ini`'s `[Tester]` section:

```
DateFrom=1789344000   (Unix timestamp for 2026-09-14)
DateTo=1789516800     (Unix timestamp for 2026-09-16)
```

The patched `_modify_terminal_ini()` function handles this automatically, including:
- UTF-16-LE encoding preservation
- BOM (Byte Order Mark) detection and re-insertion
- Only touching values in the `[Tester]` section

### 2. Config file must NOT have a `[Common]` section

Adding `[Common] Enable=1` to the config file **prevents the strategy tester from triggering**. The test will not start ("Tester automatic testing started" never appears in logs).

### 3. Model=0 (every tick) is the only reliable testing model

| Model | Behavior |
|-------|----------|
| `0` | Every tick — **RECOMMENDED**, downloads historical tick data, produces reports |
| `2` | Control points — uses OHLC bars, faster |
| `3` | Mathematical calculation — runs in 0.04s, **NO historical data loaded, NO report generated** |

### 4. EA filename must NOT include `Experts\` prefix

MT5 automatically prepends `Experts\` to the EA path. Including it manually causes `Experts\Experts\EA.ex5` — double prefix error.

✅ Correct: `Expert=Moving Average.ex5`  
✅ Correct: `Expert=Examples\Moving Average\Moving Average.ex5`  
❌ Wrong: `Expert=Experts\Moving Average.ex5`

### 5. Period uses STRING in config, NUMERIC in terminal.ini

- **Config file**: `Period=H1` (string)
- **terminal.ini**: `Period=16397` (numeric MT5 enum)

The patched `_period_to_mt5_enum()` converts automatically.

| Period String | MT5 Enum |
|---------------|----------|
| M1 | 16385 |
| M5 | 16389 |
| H1 | 16397 |
| H4 | 16400 |
| D1 | 16409 |
| W1 | 16416 |
| MN1 | 16422 |

### 6. Historical data must be pre-cached

The first strategy test for a symbol downloads historical M1 data, which takes ~67 seconds for EURUSD. To avoid this:
1. Run a quick test first to trigger data download
2. Or use the MT5 Python API to pre-cache:
```python
import MetaTrader5 as mt5
mt5.initialize(path="C:\\...\\terminal64.exe")
mt5.copy_rates_from("EURUSD", mt5.TIMEFRAME_M1, datetime(2020,1,1), 50000)
```

### 7. Tester logs are UTF-16-LE encoded

MT5 stores logs as UTF-16-LE. Use `_read_utf16_log()` to read them — `cat` or the filesystem `read_file` tool will show garbage.

### 8. HTML report is not always generated

When terminal is killed too quickly after test completion, the HTML report (`TestReport.html`) is not written. The patched code **falls back to parsing the Tester log** to extract metrics, and generates a **fallback HTML report from log data**.

### 9. AutoTrading must be ENABLED for EA execution

Check `common.ini` in the Config folder:
```
[Common]
Enable=1
```

If AutoTrading is disabled, EAs won't execute during testing.

---

## File Structure

```
mt5-mcp/
├── README.md                          # This file
├── pyproject.toml                     # Python package config (from Qoyyuum)
├── .env.example                       # Environment template
├── .gitignore
├── LICENSE
├── src/
│   └── mcp_mt5/
│       ├── __init__.py                # MCP server entry point
│       └── main.py                    # Patched: 54 tools incl. corrected tester
├── scripts/
│   ├── run_backtest.py                # Standalone: compile + test + report
│   ├── compile_ea.py                  # Standalone: just compile .mq5 → .ex5
│   ├── test_quick.py                  # Quick smoke test (Moving Average EA)
│   ├── helpers.py                     # Helper functions (spliced into main.py)
│   ├── new_run_strategy_tester.py     # Replacement function (for patching)
│   ├── new_read_test_report.py        # Replacement function (for patching)
│   └── patch_main_v2.py              # Script that patches main.py
├── configs/
│   ├── env.example                    # .env template with instructions
│   └── tester_config_example.ini      # Strategy tester config template
└── outputs/
    ├── html_reports/                  # HTML report output
    └── excel_reports/                 # CSV report output
```

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/Roan2802/MT5-MCP.git
cd MT5-MCP

# 2. Configure
cp configs/env.example .env
# Edit .env with your MT5 paths

# 3. Install
uv sync

# 4. Quick test (Moving Average EA, EURUSD H1, 3-day range)
python scripts/test_quick.py

# 5. Custom test
python scripts/run_backtest.py \
    --ea "Advisors\\MyStrategy.ex5" \
    --symbol XAUUSD \
    --period H1 \
    --from-date 2024.01.01 \
    --to-date 2024.01.07 \
    --deposit 5000

# 6. Compile an EA
python scripts/compile_ea.py "Experts\\MyExpert.mq5"
```

---

## License

MIT — forks the [Qoyyuum/mcp-metatrader5-server](https://github.com/Qoyyuum/mcp-metatrader5-server) MIT license and extends it.
