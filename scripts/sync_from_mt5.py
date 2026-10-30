#!/usr/bin/env python3
"""
Sync Native Market Data directly from MT5 IC Markets Terminal (Option B)
========================================================================
- Direct 1:1 connection to MetaTrader 5 IC Markets (worker_1)
- 100% bit-for-bit identical to MT5 Strategy Tester trade tickets
- Zero timezone math, zero DST conversion: native EET/EEST server time
- Automatically writes to data/parquet/forex/{symbol}/1m/{year}.parquet
- Rebuilds all aggregation pyramids: 5m, 15m, 1h, 4h, 1d
"""
import os
import sys
import time
from pathlib import Path
from datetime import datetime
import pandas as pd
import duckdb

try:
    import MetaTrader5 as mt5
except ImportError:
    print("MetaTrader5 python module required. Run in .venv.")
    sys.exit(1)

def sync_symbol_from_mt5(symbol: str = "XAUUSD", total_bars: int = 1500000):
    root_dir = Path(__file__).resolve().parent.parent
    terminal_path = root_dir / "mt5_workers" / "worker_1" / "terminal64.exe"
    
    if not terminal_path.exists():
        print(f"Error: Terminal not found at {terminal_path}")
        return False

    print("=" * 65)
    print(f"Starting Option B Native MT5 Data Sync for {symbol}")
    print(f"Target Terminal: {terminal_path}")
    print("=" * 65)

    if not mt5.initialize(path=str(terminal_path), portable=True):
        print(f"Failed to initialize MT5: {mt5.last_error()}")
        return False

    info = mt5.terminal_info()
    acc = mt5.account_info()
    print(f"Connected to: {info.name} ({info.company})")
    print(f"Account: {acc.login if acc else 'N/A'} @ {acc.server if acc else 'N/A'}")

    mt5.symbol_select(symbol, True)

    print(f"\n[1/3] Fetching up to {total_bars:,} raw M1 bars directly from IC Markets...")
    t0 = time.time()
    rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, total_bars)
    
    if rates is None or len(rates) == 0:
        print(f"Error pulling rates: {mt5.last_error()}")
        mt5.shutdown()
        return False

    elapsed = time.time() - t0
    print(f"Successfully retrieved {len(rates):,} M1 bars in {elapsed:.2f}s!")
    mt5.shutdown()

    # Convert to pandas dataframe
    print("\n[2/3] Processing and partitioning by year into local Parquet...")
    df = pd.DataFrame(rates)
    df["timestamp"] = pd.to_datetime(df["time"], unit="s")
    df["symbol"] = symbol
    df.rename(columns={"tick_volume": "volume"}, inplace=True)
    df = df[["timestamp", "open", "high", "low", "close", "volume", "spread", "symbol"]]

    print(f"Date range in retrieved data: {df['timestamp'].min()} to {df['timestamp'].max()}")

    # Output directory
    base_parquet_dir = root_dir / "data" / "parquet" / "forex" / symbol
    m1_dir = base_parquet_dir / "1m"
    m1_dir.mkdir(parents=True, exist_ok=True)

    # Save partitioned by year
    years = df["timestamp"].dt.year.unique()
    for y in sorted(years):
        year_df = df[df["timestamp"].dt.year == y].sort_values("timestamp").reset_index(drop=True)
        out_file = m1_dir / f"{y}.parquet"
        year_df.to_parquet(out_file, engine="pyarrow", compression="zstd")
        print(f"  -> Saved {out_file.name}: {len(year_df):,} bars ({year_df['timestamp'].min()} to {year_df['timestamp'].max()})")

    # [3/3] Rebuild timeframe pyramids using DuckDB
    print("\n[3/3] Building multi-timeframe pyramids (5m, 15m, 1h, 4h, 1d)...")
    rebuild_pyramids(base_parquet_dir, symbol)

    print("\n" + "=" * 65)
    print(f"SUCCESS: Option B Sync Complete for {symbol}!")
    print("AI Lab and Backtest Studio now run on unified native MT5 data.")
    print("=" * 65)
    return True

def rebuild_pyramids(base_parquet_dir: Path, symbol: str):
    conn = duckdb.connect()
    conn.execute("SET preserve_insertion_order = false;")
    
    m1_glob = str(base_parquet_dir / "1m" / "*.parquet").replace(os.sep, "/")
    
    timeframes = {
        "5m": "5 minutes",
        "15m": "15 minutes",
        "1h": "1 hour",
        "4h": "4 hours",
        "1d": "1 day",
    }
    
    for tf_name, interval_str in timeframes.items():
        tf_dir = base_parquet_dir / tf_name
        tf_dir.mkdir(parents=True, exist_ok=True)
        t0 = time.time()
        
        # Get list of years from 1m files
        years_query = f"SELECT DISTINCT year(timestamp) as yr FROM read_parquet('{m1_glob}') ORDER BY yr;"
        years = [row[0] for row in conn.execute(years_query).fetchall()]
        
        for yr in years:
            target_file = (tf_dir / f"{yr}.parquet").as_posix()
            query = f"""
            COPY (
                SELECT
                    time_bucket(INTERVAL '{interval_str}', timestamp) AS timestamp,
                    first(open) AS open,
                    max(high) AS high,
                    min(low) AS low,
                    last(close) AS close,
                    sum(volume) AS volume,
                    round(avg(spread)) AS spread,
                    '{symbol}' AS symbol
                FROM read_parquet('{m1_glob}')
                WHERE year(timestamp) = {yr}
                GROUP BY 1
                ORDER BY 1 ASC
            ) TO '{target_file}' (FORMAT PARQUET, COMPRESSION ZSTD);
            """
            conn.execute(query)
            
        print(f"  Built {tf_name.upper()} timeframe for years {years} ({time.time() - t0:.2f}s)")
        
    conn.close()

if __name__ == "__main__":
    sym = sys.argv[1] if len(sys.argv) > 1 else "XAUUSD"
    bars = int(sys.argv[2]) if len(sys.argv) > 2 else 1500000
    sync_symbol_from_mt5(sym, bars)
