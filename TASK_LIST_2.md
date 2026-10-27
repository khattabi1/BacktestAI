# ?? Backtest AI ? Master Task List 2 (Modern MT5 & Agent-Centric Architecture)

> **Platform**: **Backtest AI** ([`BacktestAI.io`](https://backtestai.io))  
> **Autonomous Agent**: **Quant Agent** (Powered by Meta Model API: `muse-wonder` + `muse-spark-1.3` + `muse-voice-transcribe`)  
> **Architecture Pivot**: 100% Native MQL5 (`.mq5`) Strategies + Real Broker MetaTrader 5 Simulation via MCP Server  
> **Agent Model Picker**: Dual-Mode Support (**Auto Mode** [Spark Frontline + Wonder Architect/Coder/Error-Healer] vs. **Direct Model Overrides** [`muse-wonder`, `muse-spark-1.3`])  
> **Multimodal Inputs**: Voice Microphone Input (`muse-voice-transcribe`) + Chart Screenshot Upload (`muse-wonder` Vision)  
> **Execution Standard**: Strict Single Micro-Task Execution with Hard Terminal Receipts  
> **Zero Mock Data Invariant**: Absolute Causality, Zero Look-Ahead Bias, and Real Broker Tick Simulation  

---

## ?? Reconstruction Progress Dashboard

| Phase | Description | Focus Area | Tasks | Completed | Status |
| :---: | :--- | :--- | :---: | :---: | :---: |
| **1** | Monorepo Scaffolding & Python Environment | `.venv`, Tooling & Configs | 10 | 0 | ? Pending |
| **2** | SQLite WAL Database & Real Schema | SQLAlchemy 2.0 & Alembic | 8 | 0 | ? Queued |
| **3** | Core Domain Contracts | Dual Python / TypeScript Types | 6 | 0 | ? Queued |
| **4** | MT5 MCP Server & Multi-Worker Fleet | Real MT5 Terminal Engine | 10 | 0 | ? Queued |
| **5** | Autonomous Quant Agent Engine | Wonder + Spark + MCP Bridge | 12 | 0 | ? Queued |
| **6** | FastAPI Backend & Real-Time SSE Streams | Agent & MT5 Services Layer | 12 | 0 | ? Queued |
| **7** | Frontend Design System & Shell | Obsidian Dark & Auth Shell | 8 | 0 | ? Queued |
| **8** | High-Density Charting & Replay Engine | Canvas/WebGL Candlestick Replay | 8 | 0 | ? Queued |
| **9** | Master Quant Cockpit & Agent UI | Monaco IDE, Agent Panel & Autopsy | 10 | 0 | ? Queued |
| **10**| Platform Hubs & Full Monorepo Verification | Production E2E Suite | 8 | 0 | ? Queued |
| **TOTAL** | **Full Production Surface** | **Agent & MT5 Native** | **92** | **0** | **0% Completed** |

---

# ??? 10-Phase Micro-Task Verification Ledger

---

### ?? Phase 1: Monorepo Scaffolding, Tooling & Python Virtual Environment (`.venv`)
- [x] **[T2.1.1]** Create root `package.json` with workspace configuration (`apps/*`, `packages/*`), monorepo dev scripts, and TypeScript dependencies.
- [x] **[T2.1.2]** Create root `.gitignore` ignoring `.venv`, node_modules, `.next`, Python cache, duckdb, `.env`, and MT5 worker directories.
- [x] **[T2.1.3]** Create root `requirements.txt` with Polars, NumPy, DuckDB, FastAPI, SQLAlchemy, Alembic, ARQ, Redis, and local editable packages.
- [x] **[T2.1.4]** Create root `sitecustomize.py` excluding `data/` and user strategy directories from Uvicorn reloader to prevent server restarts during testing.
- [x] **[T2.1.5]** Create `pyrightconfig.json` with strict Python 3.12 typing configuration across all monorepo packages.
- [x] **[T2.1.6]** Create `pytest.ini` with `asyncio_mode = auto`, python paths, and execution markers.
- [x] **[T2.1.7]** Create root `.env` and `.env.example` templates with Meta Model API (`META_MODEL_API_KEY`, `META_BASE_URL`), Gemini, Redis, and JWT secrets.
- [x] **[T2.1.8]** Create `alembic.ini` and `alembic/` migration environment (`env.py`, `script.py.mako`).
- [x] **[T2.1.9]** Create Python virtual environment (`.venv`) using `python -m venv .venv`.
- [x] **[T2.1.10]** Activate `.venv`, install all root dependencies (`pip install -r requirements.txt`), and verify clean Python terminal environment.

---

### ??? Phase 2: SQLite WAL Database & Real Persistence Layer (`alembic` & `apps/api/src/db`)
- [ ] **[T2.2.1]** Create `apps/api/src/db/session.py` configuring SQLAlchemy 2.0 SQLite WAL database engine (`backtest_ai.db`) with PRAGMA foreign keys.
- [ ] **[T2.2.2]** Create `apps/api/src/db/models.py` defining SQLAlchemy ORM models: `User`, `UserSession`, `AuditLog`, `Workspace`, `BacktestSessionRecord`, `Strategy`, `StrategyVersion`, `BacktestRun`, `TradeDeal`, `JournalEntry`.
- [ ] **[T2.2.3]** Create `alembic/versions/8b5401339d98_create_initial_tables.py` containing complete schema migration for all tables and indices.
- [ ] **[T2.2.4]** Execute `alembic upgrade head` to provision local SQLite database with zero schema errors.
- [ ] **[T2.2.5]** Create `apps/api/src/db/repository.py` providing transactional CRUD for sessions, strategy versions, backtest runs, and journal entries.
- [ ] **[T2.2.6]** Create `apps/api/src/db/__init__.py` exporting database session and models.
- [ ] **[T2.2.7]** Create seed utility `scripts/seed_demo_data.py` populating default workspace, asset pairs, and demonstration user.
- [ ] **[T2.2.8]** Verify SQLite database tables, foreign keys, and indexes via pytest receipt (`apps/api/tests/test_db_schema.py`).

---

### ?? Phase 3: Core Domain Contracts & Dual-Language Types (`packages/domain`)
- [ ] **[T2.3.1]** Create `packages/domain/pyproject.toml` and package directory structure.
- [ ] **[T2.3.2]** Create `packages/domain/domain/models.py` defining Pydantic v2 models: `Candle`, `Tick`, `OrderSide`, `OrderType`, `OrderStatus`, `PendingOrder`, `ReplayPosition`, `Trade`, `SimulationConfig`, `BacktestSession`, `AutopsyDiagnostics`.
- [ ] **[T2.3.3]** Create `packages/domain/domain/__init__.py` exposing all Pydantic domain models.
- [ ] **[T2.3.4]** Create `packages/domain/package.json` and `tsconfig.json` for `@backtest-ai/domain`.
- [ ] **[T2.3.5]** Create `packages/domain/src/index.ts` dual TypeScript contract matching Python domain models.
- [ ] **[T2.3.6]** Execute TypeScript compilation (`npx tsc --noEmit`) and Python model serialization tests.

---

### ?? Phase 4: MetaTrader 5 MCP Server & Multi-Worker Fleet (`packages/mt5_mcp` & `mt5_workers`)
- [ ] **[T2.4.1]** Create `packages/mt5_mcp/pyproject.toml` and package configuration for MT5 MCP Server.
- [ ] **[T2.4.2]** Create `packages/mt5_mcp/src/mcp_mt5/main.py` exposing 30 MCP tools:
  - MetaEditor Compiler: `compile_mql5` (with exact line error parser).
  - Strategy Tester: `run_strategy_tester` (generating dynamic `.ini` files).
  - Report Reader: `read_test_report` (extracting closed deal history).
  - Market Data: `copy_rates_range`, `copy_ticks_range`, `get_symbol_info`, `symbol_select`.
  - Account & Orders: `initialize`, `get_account_info`, `order_send`, `positions_get`.
- [ ] **[T2.4.3]** Create compilation automation script `packages/mt5_mcp/scripts/compile_ea.py`.
- [ ] **[T2.4.4]** Create strategy tester automation script `packages/mt5_mcp/scripts/new_run_strategy_tester.py`.
- [ ] **[T2.4.5]** Create deal and report extraction script `packages/mt5_mcp/scripts/new_read_test_report.py`.
- [ ] **[T2.4.6]** Create portable launcher scripts: `start_mt5_portable.py`, `sync_env_creds.py`, `verify_setup.py`.
- [ ] **[T2.4.7]** Create worker provisioning script `scripts/replicate_workers.ps1` setting up 5 isolated MT5 terminals (`mt5_workers/worker_1`..`worker_5`) + shared folders.
- [ ] **[T2.4.8]** Create test client `packages/mt5_mcp/src/mcp_mt5/test_client.py` for JSON-RPC verification.
- [ ] **[T2.4.9]** Create institutional MQL5 coding prompt manual `packages/mt5_mcp/SKILLS-codex/MT5_TRADING.md` with diagnostic telemetry standard (`g_ticks_total`, `g_blocked_by_time`, `g_blocked_by_spread`, `g_signals_found`).
- [ ] **[T2.4.10]** Verify MT5 MCP Server startup and tool listing via automated test receipt.

---

### ?? Phase 5: Autonomous Quant Agent Core Engine (`packages/agent`) [CORE FOCUS]
- [ ] **[T2.5.1]** Create `packages/agent/pyproject.toml` and package structure.
- [ ] **[T2.5.2]** Create `packages/agent/src/core/types.py` defining:
  - Agent state: `IDLE`, `THINKING`, `EXECUTING_TOOL`, `WAITING_FOR_USER`, `DONE`, `ERROR`.
  - Strategy inception state machine: `DISCUSSING` -> `PRESET_REVIEW` -> `CODE_PROPOSED` -> `COMPILED` -> `READY_FOR_TEST` -> `TESTED` -> `VERSIONED`.
  - Message contracts, ToolCall, ToolResult, and TrajectoryEvent.
- [ ] **[T2.5.3]** Create `packages/agent/src/core/events.py` implementing real-time streaming protocol: `THINKING`, `TOOL_CALL`, `TOOL_RESULT`, `STATUS_ANNOUNCEMENT`, `TEST_AUTOPSY_INGESTED`.
- [ ] **[T2.5.4]** Create `packages/agent/src/core/parser.py` parsing streaming thoughts and tool calls.
- [ ] **[T2.5.5]** Create `packages/agent/src/core/compaction.py` for token preservation and sliding-window context compaction.
- [ ] **[T2.5.6]** Create `packages/agent/src/core/introspector.py` analyzing compiler errors (`.log` line parser) and backtest zero-trade diagnostic bottlenecks.
- [ ] **[T2.5.7]** Create `packages/agent/src/adapters/llm.py` with dynamic Model Router:
  - **`Auto Mode`**: `Muse Spark 1.3` (frontline chat & MCP tools) + `Muse Wonder` (strategy blueprint planning, pure MQL5 coding, error reflection).
  - **Direct Model Overrides**: `muse-wonder`, `muse-spark-1.3`.
  - **Voice Mic Input**: `muse-voice-transcribe` speech-to-text.
  - **Vision Input**: Multimodal chart screenshot analysis.
- [ ] **[T2.5.8]** Create `packages/agent/src/tools/mt5_mcp.py` integrating agent directly with MT5 MCP Server tools (`compile_mql5`, `run_strategy_tester`, `read_test_report`).
- [ ] **[T2.5.9]** Create `packages/agent/src/tools/workspace.py` providing disk-based unversioned `.mq5` strategy file creation and surgical in-place edits (`edit_file_partially`).
- [ ] **[T2.5.10]** Create `packages/agent/src/tools/analytical.py` (quant forensics, Long/Short asymmetry, toxic hour analysis) and `packages/agent/src/tools/research.py` (`search_web`, `read_web_page`).
- [ ] **[T2.5.11]** Create `packages/agent/src/sandbox/gates.py` (4-stage HITL approval gate: `PLAN` -> `PREVIEW` -> `APPROVE` -> `EXECUTE`) and `packages/agent/src/storage/sqlite.py` (trajectory persistence).
- [ ] **[T2.5.12]** Create `packages/agent/src/core/harness.py` implementing the complete autonomous agent loop with Zero-Trade Invariant and Meta model mesh orchestration.

---

### ? Phase 6: FastAPI Backend Services & Real-Time SSE Streams (`apps/api`)
- [ ] **[T2.6.1]** Create `apps/api/src/services/ai_copilot_service.py` orchestrating multi-turn agent sessions, SSE event streaming, and session resumption.
- [ ] **[T2.6.2]** Create `apps/api/src/services/mt5_engine_service.py` coordinating MT5 strategy tester runs, tick data loading, and deal ingestion.
- [ ] **[T2.6.3]** Create `apps/api/src/services/mt5_pool_service.py` managing worker terminal lifecycle, health checks, and process isolation.
- [ ] **[T2.6.4]** Create `apps/api/src/services/data_service.py` and `strategy_registry.py` managing disk strategy files.
- [ ] **[T2.6.5]** Create `apps/api/src/routers/agent.py` exposing:
  - `/api/agent/stream`: Server-Sent Events (SSE) streaming reasoning, tool calls, and text tokens.
  - `/api/agent/sessions`: Session lifecycle management.
  - `/api/agent/transcribe`: Audio microphone transcription endpoint using `muse-voice-transcribe`.
- [ ] **[T2.6.6]** Create `apps/api/src/routers/strategies.py` exposing workspace file CRUD, MQL5 compilation trigger, and file sync.
- [ ] **[T2.6.7]** Create `apps/api/src/routers/backtests.py` triggering MT5 strategy tester simulations and returning performance metrics.
- [ ] **[T2.6.8]** Create `apps/api/src/routers/workspace_files.py` supporting multi-file disk editing and AST linting.
- [ ] **[T2.6.9]** Create `apps/api/src/routers/auth.py` providing JWT authentication and Google OAuth login.
- [ ] **[T2.6.10]** Create `apps/api/src/routers/market_data.py` and `journal.py`.
- [ ] **[T2.6.11]** Create distributed worker queue `apps/api/src/job_queue.py` and `apps/api/src/worker.py` (ARQ + Redis).
- [ ] **[T2.6.12]** Create `apps/api/src/main.py` assembling all routers, CORS middleware, and lifecycle handlers.

---

### ?? Phase 7: Frontend Core Design System, Auth & Obsidian Shell (`apps/web`)
- [ ] **[T2.7.1]** Create `apps/web/package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`.
- [ ] **[T2.7.2]** Create `apps/web/tailwind.config.ts` configuring Obsidian Dark palette (`#080B10` bg, `#0B0F16` cards, Cyan, Emerald, Amber, Crimson).
- [ ] **[T2.7.3]** Create `apps/web/src/app/globals.css` with custom dark scrollbar, typography, and glow utilities.
- [ ] **[T2.7.4]** Create `apps/web/src/stores/authStore.ts` with persistent JWT auth state.
- [ ] **[T2.7.5]** Create App Shell components in `apps/web/src/components/layout/` (`AppLayoutShell.tsx`, `AppHeader.tsx`, `AppSidebar.tsx`, `CommandSearchModal.tsx`).
- [ ] **[T2.7.6]** Create authentication pages in `apps/web/src/app/(auth)/` (`login/`, `signup/`).
- [ ] **[T2.7.7]** Create public showcase landing page in `apps/web/src/app/(public)/page.tsx`.
- [ ] **[T2.7.8]** Verify Next.js build compilation and routing integrity.

---

### ?? Phase 8: High-Density Interactive Charting Package (`@backtest-ai/chart` + Replay Workspace)
- [ ] **[T2.8.1]** Create `packages/chart/package.json` for `@backtest-ai/chart`.
- [ ] **[T2.8.2]** Create `packages/chart/src/types.ts` defining chart API contracts, themes, and marker contracts.
- [ ] **[T2.8.3]** Create `packages/chart/src/theme.ts` configuring Obsidian Dark candlestick styling.
- [ ] **[T2.8.4]** Create `packages/chart/src/markers.ts` for rendering Buy/Sell execution arrows and SL/TP price levels.
- [ ] **[T2.8.5]** Create `packages/chart/src/OpenAlgoChart.tsx` high-performance Canvas/WebGL chart component.
- [ ] **[T2.8.6]** Create `packages/chart/src/ReplayDataManager.ts` and `ReplayController.tsx` managing candle buffers and replay playback ($1\times$ to $50\times$).
- [ ] **[T2.8.7]** Create `apps/web/src/stores/sessionStore.ts` managing replay balance, open positions, closed trades, and manual orders.
- [ ] **[T2.8.8]** Create `apps/web/src/app/(app)/app/backtest/workspace/page.tsx` full-screen replay container with global spacebar candle stepping.

---

### ??? Phase 9: Master Quant Cockpit, Agent Panel & Multi-File Editor (`apps/web`) [AGENT UI FOCUS]
- [ ] **[T2.9.1]** Create `apps/web/src/components/editor/MonacoMultiFileEditor.tsx` with MQL5 syntax highlighting, AST linting, and disk file sync.
- [ ] **[T2.9.2]** Create `apps/web/src/components/quant/QuantAgentPanel.tsx` (Complete 213KB Agent Cockpit):
  - Model Picker dropdown: `Auto [Recommended]`, `Muse Wonder [Direct]`, `Muse Spark 1.3 [Direct]`.
  - Voice Microphone button streaming speech to `muse-voice-transcribe` speech-to-text.
  - Image Upload dropzone for TradingView / MT5 chart screenshots.
  - Real-time Server-Sent Events (SSE) token viewer with thought collapsible accordion.
  - Interactive HITL Blueprint Approval Card (`Approve` / `Adjust`).
- [ ] **[T2.9.3]** Create `apps/web/src/components/quant/CentralSandboxRunnerPanel.tsx` (MT5 Strategy Tester execution cockpit, progress bar, live trade ticker).
- [ ] **[T2.9.4]** Create `apps/web/src/components/quant/CentralChartRunnerPanel.tsx` (interactive chart runner with trade markers).
- [ ] **[T2.9.5]** Create `apps/web/src/components/quant/AutopsyDiagnosticsDrawer.tsx` (telemetry analysis, directional Long/Short asymmetry, toxic hour analysis).
- [ ] **[T2.9.6]** Create `apps/web/src/components/quant/CentralBacktestSubHeader.tsx` (viewport switcher between Editor, Sandbox Runner, and Chart Runner).
- [ ] **[T2.9.7]** Create `apps/web/src/app/(app)/app/quant/page.tsx` Master Quant Cockpit assembling all panels in unified responsive layout.
- [ ] **[T2.9.8]** Create `apps/web/src/app/(app)/app/strategies/page.tsx` Strategy Library with 1-click "Open in Quant Lab".
- [ ] **[T2.9.9]** Create `apps/web/src/app/(app)/app/backtest/page.tsx` Sessions Hub.
- [ ] **[T2.9.10]** Create `apps/web/src/app/(app)/app/journal/page.tsx` Trading Journal with persistent autopsy notes.

---

### ?? Phase 10: Platform Verification Suite, Production Build & Hackathon Submission
- [ ] **[T2.10.1]** Run monorepo typecheck across all packages (`npx tsc --noEmit`).
- [ ] **[T2.10.2]** Run Python test suite across domain, agent, and api packages (`pytest`).
- [ ] **[T2.10.3]** Verify MT5 MCP Server end-to-end compilation loop (`compile_mql5` with 0 errors).
- [ ] **[T2.10.4]** Verify MT5 Strategy Tester simulation dispatch (`run_strategy_tester` with `total_trades > 0`).
- [ ] **[T2.10.5]** Verify Quant Agent Model Router in both `Auto Mode` and direct overrides.
- [ ] **[T2.10.6]** Verify Next.js production build (`npm --workspace=apps/web run build`).
- [ ] **[T2.10.7]** Create demo walk-through script and video recording checklist for Hackathon submission.
- [ ] **[T2.10.8]** Generate final Phase 10 completion report and architecture receipts.
