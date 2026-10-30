import os
import sys
import time
from pathlib import Path
from datetime import datetime, timezone
import MetaTrader5 as mt5
import pandas as pd
from scripts.build_timeframe_pyramids import build_timeframes_for_symbol

def main():
    terminal = Path('mt5_workers/worker_1/terminal64.exe').resolve()
    if not terminal.exists():
        print(f"Terminal not found: {terminal}")
        sys.exit(1)

    if not mt5.initialize(str(terminal), portable=True):
        print("Failed to initialize MT5")
        sys.exit(1)

    symbol = 'XAUUSD'
    mt5.symbol_select(symbol, True)
    out_dir = Path('data/parquet/forex/XAUUSD/1m')
    out_dir.mkdir(parents=True, exist_ok=True)

    for year in [2022, 2023]:
        start_dt = datetime(year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        end_dt = datetime(year, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
        t0 = time.time()
        rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_M1, start_dt, end_dt)
        if rates is None or len(rates) == 0:
            print(f"No rates returned for {year}")
            continue

        df_pd = pd.DataFrame(rates)
        df_pd['timestamp'] = pd.to_datetime(df_pd['time'], unit='s')
        df_pd['symbol'] = symbol
        df_pd.rename(columns={'tick_volume': 'volume'}, inplace=True)
        df_pd = df_pd[['timestamp', 'open', 'high', 'low', 'close', 'volume', 'spread', 'symbol']]

        # Match exact schema types
        df_pd['volume'] = df_pd['volume'].astype('uint64')
        df_pd['spread'] = df_pd['spread'].astype('int32')

        out_file = out_dir / f"{year}.parquet"
        df_pd.to_parquet(out_file, engine='pyarrow', compression='zstd')
        print(f"Successfully saved {out_file.name}: {len(df_pd):,} bars ({df_pd['timestamp'].min()} to {df_pd['timestamp'].max()}) in {time.time() - t0:.2f}s")

    mt5.shutdown()
    print("Rebuilding timeframe pyramids for XAUUSD...")
    t_pyr = time.time()
    build_timeframes_for_symbol('XAUUSD', 'forex')
    print(f"All pyramids updated in {time.time() - t_pyr:.2f}s!")

if __name__ == '__main__':
    main()
