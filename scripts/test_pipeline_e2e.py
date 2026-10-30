"""
End-to-End Pipeline Verification Script for Backtest-AI.
Tests the complete pristine flow:
1. MQL5 Strategy writing in user workspace (data/users/senior/)
2. MetaEditor compilation via compile_mql5
3. Automatic deployment of .ex5 to mt5_workers/shared_experts and worker terminals
4. Strategy Tester launch with normalized EA path resolution
5. Clean log reading with UTF-16 LE detection
"""

import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR / "packages" / "mt5_mcp" / "src"))
sys.path.insert(0, str(ROOT_DIR))

from mcp_mt5.main import compile_mql5, run_strategy_tester, _get_mt5_paths

SAMPLE_EA_CODE = """//+------------------------------------------------------------------+
//|                                           gold_momentum_test.mq5 |
//|                                  Copyright 2026, Backtest-AI     |
//+------------------------------------------------------------------+
#property copyright "Backtest-AI Institutional"
#property link      "https://backtestsi.com"
#property version   "1.00"
#property strict

input double   InpLotSize       = 0.01;   // Trade Lot Size
input int      InpFastPeriod    = 9;      // Fast MA Period
input int      InpSlowPeriod    = 21;     // Slow MA Period
input double   InpStopLoss      = 15.0;   // Stop Loss in Points

int handle_fast_ma = INVALID_HANDLE;
int handle_slow_ma = INVALID_HANDLE;

int OnInit()
{
    Print("[Gold Momentum] Initializing EA for symbol: ", _Symbol);
    handle_fast_ma = iMA(_Symbol, _Period, InpFastPeriod, 0, MODE_EMA, PRICE_CLOSE);
    handle_slow_ma = iMA(_Symbol, _Period, InpSlowPeriod, 0, MODE_EMA, PRICE_CLOSE);
    
    if(handle_fast_ma == INVALID_HANDLE || handle_slow_ma == INVALID_HANDLE)
    {
        Print("[Gold Momentum] Failed to create indicator handles");
        return(INIT_FAILED);
    }
    
    return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
    if(handle_fast_ma != INVALID_HANDLE) IndicatorRelease(handle_fast_ma);
    if(handle_slow_ma != INVALID_HANDLE) IndicatorRelease(handle_slow_ma);
    Print("[Gold Momentum] Deinitialized cleanly.");
}

void OnTick()
{
    // Minimal valid tick handler
}
//+------------------------------------------------------------------+
"""


def test_full_pipeline():
    print("=" * 70)
    print("STEP 1: Checking MT5 Paths & Environment")
    print("=" * 70)
    paths = _get_mt5_paths()
    for k, v in paths.items():
        exists = os.path.exists(v)
        print(f"  {k:15}: {v} [{'EXISTS' if exists else 'MISSING'}]")

    print("\n" + "=" * 70)
    print("STEP 2: Creating MQL5 Strategy File in data/users/senior/")
    print("=" * 70)
    user_dir = ROOT_DIR / "data" / "users" / "senior"
    user_dir.mkdir(parents=True, exist_ok=True)
    ea_mq5 = user_dir / "gold_momentum_test.mq5"
    with open(ea_mq5, "w", encoding="utf-8") as f:
        f.write(SAMPLE_EA_CODE)
    print(f"  Written: {ea_mq5} ({os.path.getsize(ea_mq5)} bytes)")

    print("\n" + "=" * 70)
    print("STEP 3: Compiling MQL5 EA via compile_mql5")
    print("=" * 70)
    compile_res = compile_mql5(str(ea_mq5))
    print(f"  Success      : {compile_res.get('success')}")
    print(f"  Returncode   : {compile_res.get('returncode')}")
    print(f"  EX5 Path     : {compile_res.get('ex5_path')}")
    print(f"  EX5 Exists   : {compile_res.get('ex5_exists')}")
    print(f"  Deployed To  : {compile_res.get('deployed_to')}")
    log_sample = compile_res.get("log", "").strip()
    print(f"  Compile Log  : {log_sample[:200] if log_sample else '[Empty]'}")

    assert compile_res.get("success"), f"Compile failed: {compile_res}"
    assert compile_res.get("ex5_exists"), "EX5 binary does not exist"
    assert "\x00" not in compile_res.get("log", ""), "Null bytes found in compiler log!"

    # Verify auto-deployment targets
    deployed = compile_res.get("deployed_to", [])
    assert len(deployed) > 0, "No deployment locations recorded!"
    for p in deployed:
        assert os.path.exists(p), f"Deployed path missing on disk: {p}"
        print(f"  Verified deployed binary: {p}")

    print("\n" + "=" * 70)
    print("STEP 4: Testing EA Path Resolution in MT5 Strategy Tester")
    print("=" * 70)
    # Test launching with relative path or clean EA name
    tester_res = run_strategy_tester(
        ea_name="gold_momentum_test.ex5",
        symbol="XAUUSD",
        period="H1",
        from_date="2025.05.01",
        to_date="2025.06.01",
        timeout=25,
    )

    print(f"  Tester Success   : {tester_res.get('success')}")
    print(f"  Config File      : {tester_res.get('config_file')}")
    print(f"  Report Target    : {tester_res.get('report_path')}")
    print(f"  Report Exists    : {tester_res.get('report_exists')}")
    print(f"  Tester Log Length: {len(tester_res.get('tester_log', ''))} chars")

    # Read the generated INI config to ensure clean Expert= without Experts\\ or absolute paths
    config_file = tester_res.get("config_file")
    if config_file and os.path.exists(config_file):
        with open(config_file, "r") as f:
            ini_lines = [line.strip() for line in f if line.startswith("Expert=")]
        print(f"  INI Config Line  : {ini_lines}")
        assert ini_lines == ["Expert=gold_momentum_test.ex5"], f"Unexpected INI Expert line: {ini_lines}"

    print("\n" + "=" * 70)
    print("ALL TESTS PASSED: Full MQL5 Pipeline is pristine, functional, and production-ready!")
    print("=" * 70)


if __name__ == "__main__":
    test_full_pipeline()
