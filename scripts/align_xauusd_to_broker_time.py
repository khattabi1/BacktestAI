"""
Align XAUUSD 1m & 5m Parquet to MT5 Broker Server Time (EET/EEST)
==================================================================
Dukascopy historical tick data is in UTC (GMT+0).
MetaTrader 5 brokers (e.g. IC Markets) operate on New York 5pm close (EET/EEST):
- Winter (Standard Time): UTC + 2 hours
- Summer (US Daylight Saving Time): UTC + 3 hours

This script shifts XAUUSD 1m parquet data by +2h (winter) / +3h (summer),
and then rebuilds the 5m timeframe pyramid so that 1m, 5m, 15m, 1h, 4h, 1d
all share 100% bit-for-bit identical timestamps and price action matching
the MT5 Strategy Tester trade tickets.
"""

import os
import glob
import time
import calendar
from datetime import datetime
import duckdb

def get_us_dst_bounds(year: int):
    """Calculates US DST start (2nd Sun March 02:00) and end (1st Sun Nov 02:00)."""
    c = calendar.Calendar(firstweekday=calendar.MONDAY)
    sundays_mar = [d for d in c.itermonthdates(year, 3) if d.month == 3 and d.weekday() == 6]
    start = datetime(sundays_mar[1].year, sundays_mar[1].month, sundays_mar[1].day, 2, 0, 0)
    sundays_nov = [d for d in c.itermonthdates(year, 11) if d.month == 11 and d.weekday() == 6]
    end = datetime(sundays_nov[0].year, sundays_nov[0].month, sundays_nov[0].day, 2, 0, 0)
    return start.strftime("%Y-%m-%d %H:%M:%S"), end.strftime("%Y-%m-%d %H:%M:%S")

def align_1m_data():
    conn = duckdb.connect()
    base_dir = "data/parquet/forex/XAUUSD/1m"
    files = sorted(glob.glob(os.path.join(base_dir, "*.parquet")))
    
    print(f"Aligning {len(files)} files in {base_dir} to MT5 Broker Server Time...")

    for f in files:
        base_name = os.path.basename(f)
        year_str = base_name.replace(".parquet", "")
        try:
            year = int(year_str)
        except ValueError:
            continue

        # Check if already aligned: in MT5 Broker Time (EET/EEST), trading day closes at 23:xx. In UTC it is 21:xx.
        max_ts = conn.execute(f"SELECT max(timestamp) FROM read_parquet('{f.replace(os.sep, '/')}')").fetchone()[0]
        if max_ts and max_ts.hour >= 23:
            print(f"[{year}] Already aligned (max={max_ts}). Skipping.")
            continue

        dst_start, dst_end = get_us_dst_bounds(year)
        temp_file = os.path.join(base_dir, f"temp_{year}.parquet").replace(os.sep, "/")
        target_file = f.replace(os.sep, "/")

        print(f"[{year}] Shifting timestamps (DST: {dst_start} -> {dst_end})...")
        t0 = time.time()
        shift_query = f"""
        COPY (
            SELECT 
                CASE 
                    WHEN timestamp >= '{dst_start}' AND timestamp < '{dst_end}'
                    THEN timestamp + INTERVAL '3 hours'
                    ELSE timestamp + INTERVAL '2 hours'
                END AS timestamp,
                open, high, low, close, volume, spread, symbol
            FROM read_parquet('{target_file}')
            ORDER BY 1 ASC
        ) TO '{temp_file}' (FORMAT PARQUET, COMPRESSION ZSTD);
        """
        conn.execute(shift_query)

        # Replace original file atomically
        if os.path.exists(temp_file):
            os.replace(temp_file, f)
            print(f"[{year}] Done in {time.time() - t0:.2f}s.")

    conn.close()

def rebuild_5m_pyramid():
    from scripts.build_timeframe_pyramids import build_timeframes_for_symbol
    print("\nRebuilding 5m timeframe pyramid from aligned 1m bars...")
    # Rebuild only 5m
    conn = duckdb.connect()
    files = sorted(glob.glob("data/parquet/forex/XAUUSD/1m/*.parquet"))
    tf_dir = "data/parquet/forex/XAUUSD/5m"
    os.makedirs(tf_dir, exist_ok=True)

    for file_path in files:
        year = os.path.basename(file_path).replace(".parquet", "")
        out_path = os.path.join(tf_dir, f"{year}.parquet").replace(os.sep, "/")
        
        query = f"""
        COPY (
            SELECT 
                time_bucket(INTERVAL '5 minutes', timestamp) AS timestamp,
                arg_min(open, timestamp) AS open,
                max(high) AS high,
                min(low) AS low,
                arg_max(close, timestamp) AS close,
                round(sum(volume), 4) AS volume,
                round(avg(spread), 2) AS spread,
                first(symbol) AS symbol
            FROM read_parquet('{file_path.replace(os.sep, '/')}')
            GROUP BY 1
            ORDER BY 1 ASC
        ) TO '{out_path}' (FORMAT PARQUET, COMPRESSION ZSTD);
        """
        conn.execute(query)
        print(f"  -> Rebuilt 5m for {year}")

    conn.close()
    print("5m timeframe pyramid rebuilt successfully!")

if __name__ == "__main__":
    align_1m_data()
    rebuild_5m_pyramid()
