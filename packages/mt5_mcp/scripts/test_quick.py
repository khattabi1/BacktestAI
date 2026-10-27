#!/usr/bin/env python
"""Quick test: compile + backtest Moving Average on EURUSD H1 for 3 days."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from run_backtest import run_backtest, compile_ea

if __name__ == "__main__":
    result = run_backtest(
        ea_name="Examples\\Moving Average\\Moving Average.ex5",
        symbol="EURUSD",
        period="H1",
        model=0,
        deposit=10000,
        from_date="2026.09.14",
        to_date="2026.09.16",
        save_html="outputs/html_reports",
        save_excel="outputs/excel_reports",
        timeout=300,
    )
    print(f"\n=== Result ===")
    print(f"Success: {result['success']}")
    print(f"Test completed: {result['test_completed']}")
    print(f"Reports: {result.get('reports', {})}")
    print(f"Metrics: {result['metrics']}")
