# MetaTrader 5 Multi-Worker Portable Setup Guide (BYOB - Bring Your Own Broker)

This guide documents the complete setup workflow for running **BacktestAI** with isolated MetaTrader 5 portable worker fleets (`worker_1` through `worker_5`) orchestrated via FastMCP.

---

## 1. Architecture Overview

BacktestAI uses **isolated portable worker instances** to run headless, high-throughput quantitative backtests with broker-grade simulation:
- **Zero Registry Bloat:** MT5 runs strictly in `/portable` mode where all user data, logs, and configurations remain self-contained.
- **Shared Tick History (`shared_bases`):** All 5 workers share the same cached broker tick database via NTFS junctions, saving disk space while allowing parallel simulations.
- **Shared Expert Advisors (`shared_experts`):** When the AI agent compiles an MQL5 strategy, the `.ex5` binary is immediately available across all worker terminals.

```
mt5_workers/               [Local directory - excluded from Git via .gitignore]
|-- shared_bases/          <-- Shared tick and bar database (NTFS Junction)
|-- shared_experts/        <-- Shared compiled .ex5 strategies
|-- shared_reports/        <-- Stored HTML & CSV strategy tester reports
|-- worker_1/              <-- Primary FastMCP terminal
|-- worker_2/              <-- Parallel backtest worker 2
|-- worker_3/              <-- Parallel backtest worker 3
|-- worker_4/              <-- Parallel backtest worker 4
\-- worker_5/              <-- Parallel backtest worker 5
```

---

## 2. Quick Setup Guide (Any Broker)

You can use **any MT5 broker** (any regulated broker (Demo or Live), etc.).

### Step 1: Download & Install Portable MT5
1. Download the official MetaTrader 5 installer from your preferred broker.
2. Run the installer from command line with the `/portable` flag:
   ```cmd
   mt5setup.exe /portable
   ```
   Or simply copy an existing MT5 installation folder into `mt5_workers/worker_1`.

### Step 2: Configure `.env`
Set your demo account credentials and worker paths in the root `.env` file:
```env
# MetaTrader 5 Paths (relative to workspace root)
MT5_PATH="mt5_workers/worker_1/terminal64.exe"
MT5_METAEDITOR_PATH="mt5_workers/worker_1/MetaEditor64.exe"
MT5_DATA_FOLDER="mt5_workers/worker_1"
MT5_CONFIG_FOLDER="mt5_workers/worker_1/Config"
MT5_TESTER_LOG="mt5_workers/worker_1/Tester/logs"
MT5_TERMINAL_INI="mt5_workers/worker_1/Config/terminal.ini"

# Demo Account Credentials (Free Demo)
MT5_LOGIN=12345678
MT5_SERVER=YourBroker-Demo
MT5_AUTO_LOGIN=true
```

### Step 3: Replicate the 5-Worker Fleet
Run our automated PowerShell script to create `worker_2` through `worker_5` and establish shared NTFS junctions automatically:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/replicate_workers.ps1
```

### Step 4: Verify the Setup
Run the FastMCP automated test verification:
```bash
python packages/mt5_mcp/scripts/verify_setup.py
```
Expected output:
```text
PASS: .env MT5 worker paths loaded correctly
Total tools registered: 29
PASS: all 13 core tools registered successfully!
```

---

## 3. Legal, Ethical & Licensing Notice

- **MetaTrader 5 & MetaEditor** are registered trademarks and proprietary software of MetaQuotes Software Corp.
- BacktestAI does **not** redistribute MetaQuotes proprietary `.exe` binaries within this repository.
- Users and judges provide their own local client terminal via `/portable` mode.
- BacktestAI interfaces with MT5 strictly via official Python API (`MetaTrader5` on PyPI) and open-source FastMCP protocol.
