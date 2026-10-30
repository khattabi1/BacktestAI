#!/usr/bin/env python3
"""
Pristine Slate Reset Utility for Backtest-AI
===========================================
Permanently deletes:
  1. All strategy records and versions in SQLite (backtest_ai.db)
  2. All backtest runs, sessions, trades, and journals in SQLite
  3. All strategy source code (.mq5, .py) and user subfolders in data/users/
  4. All generated MT5 binaries (.ex5), tester reports (.htm, .png), and logs (.log)
  5. All uploaded files in data/uploads/
  6. All agent conversations, messages, trajectories, and artifacts in agent_memory.db
  7. In-memory runtime caches (via local API if running)

Usage:
  python tests/reset_fresh_slate.py             # 100% clean pristine wipe
  python tests/reset_fresh_slate.py --seed      # Clean wipe + seeds a pristine gold_sr_fade.mq5 v1
  python tests/reset_fresh_slate.py --dry-run   # Preview items to be deleted
"""

import os
import sys
import argparse
import shutil
import sqlite3
import urllib.request
import urllib.error
from pathlib import Path

# Resolve workspace root robustly regardless of where script is invoked
SCRIPT_DIR = Path(__file__).resolve().parent
if (SCRIPT_DIR / ".." / "data").resolve().exists():
    ROOT_DIR = (SCRIPT_DIR / "..").resolve()
elif (SCRIPT_DIR / "data").resolve().exists():
    ROOT_DIR = SCRIPT_DIR.resolve()
else:
    ROOT_DIR = Path.cwd().resolve()

# Standard MT5 system experts to preserve
PRESERVED_EXPERTS = {
    "Advisors",
    "Examples",
    "Free Robots",
    "Moving Average.ex5",
    "Moving Average.mq5",
}

BASELINE_GOLD_SR_FADE_MQ5 = """//+------------------------------------------------------------------+
//|                                              gold_sr_fade.mq5     |
//|                                  Copyright 2026, Backtest-AI Lab  |
//|                                             https://backtest.si   |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Backtest-AI Lab"
#property link      "https://backtest.si"
#property version   "1.00"
#property strict

//--- Input Parameters
input group "=== Strategy Parameters ==="
input double   InpLotSize        = 0.10;     // Trade Lot Size
input int      InpSRPeriod       = 20;       // Support/Resistance Lookback Period
input double   InpBufferPoints   = 15.0;     // Breakout Buffer (Points)
input double   InpTakeProfitPts  = 50.0;     // Take Profit (Points)
input double   InpStopLossPts    = 30.0;     // Stop Loss (Points)

input group "=== Risk Management ==="
input int      InpMagicNumber    = 101102;   // Magic Number
input int      InpSlippage       = 3;        // Max Slippage (Points)

//--- Global Handles
int            g_atrHandle       = INVALID_HANDLE;
datetime       g_lastBarTime     = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   PrintFormat("[INIT] gold_sr_fade v1.00 initialized on %s %s", _Symbol, EnumToString(_Period));
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   PrintFormat("[DEINIT] gold_sr_fade deinitialized. Reason: %d", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   datetime currentBarTime = iTime(_Symbol, _Period, 0);
   if(currentBarTime == g_lastBarTime)
      return; // Run on new bar open
   g_lastBarTime = currentBarTime;

   // Simple Support / Resistance Calculation
   int highestBar = iHighest(_Symbol, _Period, MODE_HIGH, InpSRPeriod, 1);
   int lowestBar  = iLowest(_Symbol, _Period, MODE_LOW, InpSRPeriod, 1);
   if(highestBar < 0 || lowestBar < 0) return;

   double resistance = iHigh(_Symbol, _Period, highestBar);
   double support    = iLow(_Symbol, _Period, lowestBar);
   double close1     = iClose(_Symbol, _Period, 1);
   double bid        = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask        = SymbolInfoDouble(_Symbol, SYMBOL_ASK);

   // Mean reversion fade logic
   // If price touched resistance and closed back below -> Sell Fade
   if(close1 >= resistance - (InpBufferPoints * _Point) && PositionsTotal() == 0)
   {
      MqlTradeRequest request = {};
      MqlTradeResult  result  = {};
      request.action       = TRADE_ACTION_DEAL;
      request.symbol       = _Symbol;
      request.volume       = InpLotSize;
      request.type         = ORDER_TYPE_SELL;
      request.price        = bid;
      request.sl           = bid + (InpStopLossPts * _Point);
      request.tp           = bid - (InpTakeProfitPts * _Point);
      request.magic        = InpMagicNumber;
      request.comment      = "SR Fade Sell v1";
      OrderSend(request, result);
   }
   // If price touched support and closed back above -> Buy Fade
   else if(close1 <= support + (InpBufferPoints * _Point) && PositionsTotal() == 0)
   {
      MqlTradeRequest request = {};
      MqlTradeResult  result  = {};
      request.action       = TRADE_ACTION_DEAL;
      request.symbol       = _Symbol;
      request.volume       = InpLotSize;
      request.type         = ORDER_TYPE_BUY;
      request.price        = ask;
      request.sl           = ask - (InpStopLossPts * _Point);
      request.tp           = ask + (InpTakeProfitPts * _Point);
      request.magic        = InpMagicNumber;
      request.comment      = "SR Fade Buy v1";
      OrderSend(request, result);
   }
}
//+------------------------------------------------------------------+
"""


def clean_database_tables(dry_run: bool = False) -> dict:
    """Wipes all strategy, run, trade, and agent memory records from SQLite databases."""
    stats = {
        "strategies": 0,
        "strategy_versions": 0,
        "backtest_runs": 0,
        "trades": 0,
        "backtest_sessions": 0,
        "journal_entries": 0,
        "agent_sessions": 0,
        "agent_messages": 0,
        "agent_trajectories": 0,
        "agent_artifacts": 0,
    }

    # 1. Backtest & Platform DB
    backtest_db = ROOT_DIR / "data" / "sqlite" / "backtest_ai.db"
    if backtest_db.exists():
        conn = sqlite3.connect(str(backtest_db))
        try:
            cur = conn.cursor()
            tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
            for tbl in ["trades", "backtest_runs", "backtest_sessions", "journal_entries", "strategy_versions", "strategies"]:
                if tbl in tables:
                    cnt = cur.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
                    stats[tbl] = cnt
                    if not dry_run and cnt > 0:
                        cur.execute(f"DELETE FROM {tbl}")
            if not dry_run:
                conn.commit()
                cur.execute("VACUUM")
        finally:
            conn.close()

    # 2. Agent Memory & Conversation DB
    agent_db = ROOT_DIR / "data" / "sqlite" / "agent_memory.db"
    if agent_db.exists():
        conn = sqlite3.connect(str(agent_db))
        try:
            cur = conn.cursor()
            tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
            for tbl in ["agent_messages", "agent_trajectories", "agent_artifacts", "agent_sessions"]:
                if tbl in tables:
                    cnt = cur.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
                    stats[tbl] = cnt
                    if not dry_run and cnt > 0:
                        cur.execute(f"DELETE FROM {tbl}")
            if "sqlite_sequence" in tables and not dry_run:
                cur.execute("DELETE FROM sqlite_sequence")
            if not dry_run:
                conn.commit()
                cur.execute("VACUUM")
        finally:
            conn.close()

    # 3. Legacy session databases
    legacy_agent_db = ROOT_DIR / "data" / "agent_sessions.db"
    if legacy_agent_db.exists() and not dry_run:
        legacy_agent_db.unlink(missing_ok=True)

    return stats


def clean_user_code_and_files(dry_run: bool = False) -> int:
    """Removes all strategy code (.mq5, .py), subfolders, archives, and files from data/users/."""
    users_dir = ROOT_DIR / "data" / "users"
    removed_count = 0
    if not users_dir.exists():
        return 0

    for user_folder in users_dir.iterdir():
        if not user_folder.is_dir():
            continue

        # Keep common user accounts like 'senior' or 'default', but wipe everything inside them
        # For temporary/test user folders, remove the whole folder
        if user_folder.name in {"test_agent_user", "trader_folder_test", "trader_version_test", "trader1"}:
            if not dry_run:
                shutil.rmtree(user_folder, ignore_errors=True)
            removed_count += 1
            continue

        for item in list(user_folder.iterdir()):
            if dry_run:
                removed_count += 1
                continue
            if item.is_dir():
                shutil.rmtree(item, ignore_errors=True)
                removed_count += 1
            elif item.is_file():
                item.unlink(missing_ok=True)
                removed_count += 1

    return removed_count


def clean_uploads(dry_run: bool = False) -> int:
    """Removes all uploaded images and custom script files from data/uploads/."""
    uploads_dir = ROOT_DIR / "data" / "uploads"
    removed = 0
    if uploads_dir.exists():
        for f in uploads_dir.iterdir():
            if f.is_file():
                if not dry_run:
                    f.unlink(missing_ok=True)
                removed += 1
    return removed


def clean_mt5_generated_binaries_and_reports(dry_run: bool = False) -> int:
    """Removes all compiled binaries (.ex5), test HTML reports, charts, and tester logs."""
    workers_dir = ROOT_DIR / "mt5_workers"
    removed = 0
    if not workers_dir.exists():
        return 0

    # 1. Clean shared_experts
    shared_experts = workers_dir / "shared_experts"
    if shared_experts.exists():
        for item in list(shared_experts.iterdir()):
            if item.name not in PRESERVED_EXPERTS:
                if not dry_run:
                    if item.is_file():
                        item.unlink(missing_ok=True)
                    elif item.is_dir():
                        shutil.rmtree(item, ignore_errors=True)
                removed += 1

    # 2. Clean each worker directory
    for worker_folder in workers_dir.glob("worker_*"):
        if not worker_folder.is_dir():
            continue

        # Loose reports, pngs, ini, log files in worker root
        for pattern in ["report_*", "gold_*", "tester_*.ini", "*.log"]:
            for f in list(worker_folder.glob(pattern)):
                if not dry_run:
                    f.unlink(missing_ok=True)
                removed += 1

        # MQL5/Experts
        experts_dir = worker_folder / "MQL5" / "Experts"
        if experts_dir.exists():
            for item in list(experts_dir.iterdir()):
                if item.name not in PRESERVED_EXPERTS:
                    if not dry_run:
                        if item.is_file():
                            item.unlink(missing_ok=True)
                        elif item.is_dir():
                            shutil.rmtree(item, ignore_errors=True)
                    removed += 1

        # MQL5/Files (Simulation reports & images)
        files_dir = worker_folder / "MQL5" / "Files"
        if files_dir.exists():
            for f in list(files_dir.glob("report_*")):
                if not dry_run:
                    f.unlink(missing_ok=True)
                removed += 1
            for f in list(files_dir.glob("*.htm")):
                if not dry_run:
                    f.unlink(missing_ok=True)
                removed += 1
            for f in list(files_dir.glob("*.html")):
                if not dry_run:
                    f.unlink(missing_ok=True)
                removed += 1

        # Tester/logs
        logs_dir = worker_folder / "Tester" / "logs"
        if logs_dir.exists():
            for f in list(logs_dir.glob("*.log")):
                if not dry_run:
                    f.unlink(missing_ok=True)
                removed += 1

        # Tester/cache
        cache_dir = worker_folder / "Tester" / "cache"
        if cache_dir.exists():
            for f in list(cache_dir.glob("*.opt")):
                if not dry_run:
                    f.unlink(missing_ok=True)
                removed += 1
            for f in list(cache_dir.glob("*.tst")):
                if not dry_run:
                    f.unlink(missing_ok=True)
                removed += 1

        # MQL5/profiles/Tester
        profiles_tester = worker_folder / "MQL5" / "profiles" / "Tester"
        if profiles_tester.exists():
            for f in list(profiles_tester.glob("gold_*")):
                if not dry_run:
                    f.unlink(missing_ok=True)
                removed += 1

    # Root accidental artifacts
    stray_3 = ROOT_DIR / "3"
    if stray_3.exists() and not dry_run:
        stray_3.unlink(missing_ok=True)

    return removed


def clear_api_runtime_stores() -> bool:
    """Calls running local FastAPI backend endpoints to flush in-memory singletons."""
    endpoints = [
        "http://127.0.0.1:8000/api/v1/backtests",
        "http://127.0.0.1:8000/api/v1/strategies",
    ]
    contacted = False
    for ep in endpoints:
        try:
            req = urllib.request.Request(ep, method="DELETE")
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                if resp.status == 200:
                    contacted = True
        except Exception:
            pass
    return contacted


def seed_pristine_baseline() -> None:
    """Seeds a single pristine gold_sr_fade.mq5 v1.0 strategy for instant testing."""
    senior_dir = ROOT_DIR / "data" / "users" / "senior"
    senior_dir.mkdir(parents=True, exist_ok=True)

    target_file = senior_dir / "gold_sr_fade.mq5"
    target_file.write_text(BASELINE_GOLD_SR_FADE_MQ5, encoding="utf-8")
    print(f"  [SEED] Written pristine baseline EA: {target_file}")

    # Register in SQLite
    backtest_db = ROOT_DIR / "data" / "sqlite" / "backtest_ai.db"
    if backtest_db.exists():
        import uuid
        conn = sqlite3.connect(str(backtest_db))
        try:
            cur = conn.cursor()
            strat_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO strategies (id, user_id, name, slug, description, language, code, default_parameters, is_built_in, created_at, updated_at)
                VALUES (?, 'senior', 'gold_sr_fade', 'gold-sr-fade', 'Mean-reversion support/resistance fade strategy', 'mql5', ?, '{}', 0, datetime('now', 'utc'), datetime('now', 'utc'))
                """,
                (strat_id, BASELINE_GOLD_SR_FADE_MQ5)
            )
            cur.execute(
                """
                INSERT INTO strategy_versions (id, strategy_id, version_num, code, parameters, commit_message, created_at)
                VALUES (?, ?, 1, ?, '{}', 'Initial v1.0 baseline', datetime('now', 'utc'))
                """,
                (str(uuid.uuid4()), strat_id, BASELINE_GOLD_SR_FADE_MQ5)
            )
            conn.commit()
            print("  [SEED] Registered gold_sr_fade v1.0 baseline in backtest_ai.db")
        finally:
            conn.close()


def main():
    parser = argparse.ArgumentParser(description="Pristine slate reset: deletes all strategies, code, binaries, files, conversations.")
    parser.add_argument("--dry-run", action="store_true", help="Preview items without deleting")
    parser.add_argument("--seed", "--seed-baseline", action="store_true", help="After full wipe, seed a clean gold_sr_fade.mq5 v1.0")
    args = parser.parse_args()

    mode_label = "[DRY-RUN PREVIEW]" if args.dry_run else "[EXECUTING WIPE]"
    print("=" * 70)
    print(f" Backtest-AI: Fresh Slate Reset {mode_label}")
    print("=" * 70)

    # 1. Databases
    db_stats = clean_database_tables(dry_run=args.dry_run)
    print("  [1/5] Database Records Wiped:")
    print(f"        - Strategies:          {db_stats['strategies']} rows")
    print(f"        - Strategy Versions:   {db_stats['strategy_versions']} rows")
    print(f"        - Backtest Runs:       {db_stats['backtest_runs']} rows")
    print(f"        - Simulated Trades:    {db_stats['trades']} rows")
    print(f"        - Agent Sessions:      {db_stats['agent_sessions']} sessions")
    print(f"        - Agent Messages:      {db_stats['agent_messages']} messages")
    print(f"        - Agent Trajectories:  {db_stats['agent_trajectories']} steps")

    # 2. Strategy Code in data/users/
    code_cleaned = clean_user_code_and_files(dry_run=args.dry_run)
    print(f"  [2/5] Strategy Source Files & Folders (.mq5, .py, subfolders): {code_cleaned} removed")

    # 3. Compiled Binaries (.ex5) & Reports (.htm, .png, .log)
    binaries_cleaned = clean_mt5_generated_binaries_and_reports(dry_run=args.dry_run)
    print(f"  [3/5] MT5 Generated Binaries (.ex5) & Reports (.htm, .png, .log): {binaries_cleaned} removed")

    # 4. Uploads
    uploads_cleaned = clean_uploads(dry_run=args.dry_run)
    print(f"  [4/5] Uploaded Files (data/uploads/): {uploads_cleaned} removed")

    # 5. In-Memory API Store
    if not args.dry_run:
        flushed = clear_api_runtime_stores()
        status_str = "flushed successfully" if flushed else "backend offline or flushed via direct DB"
        print(f"  [5/5] In-memory Backend Runtime Store: {status_str}")

    # Optional Seed
    if args.seed and not args.dry_run:
        print("\n  " + "-" * 60)
        seed_pristine_baseline()

    print("=" * 70)
    if args.dry_run:
        print("  Dry-run complete. Nothing was deleted.")
    else:
        print("  SUCCESS: System is 100% clean and ready for a fresh test!")
    print("=" * 70)


if __name__ == "__main__":
    main()
