import os
import glob
import time
import calendar
from datetime import datetime
import duckdb

def get_us_dst_bounds(year: int):
    c = calendar.Calendar(firstweekday=calendar.MONDAY)
    sundays_mar = [d for d in c.itermonthdates(year, 3) if d.month == 3 and d.weekday() == 6]
    start = datetime(sundays_mar[1].year, sundays_mar[1].month, sundays_mar[1].day, 2, 0, 0)
    sundays_nov = [d for d in c.itermonthdates(year, 11) if d.month == 11 and d.weekday() == 6]
    end = datetime(sundays_nov[0].year, sundays_nov[0].month, sundays_nov[0].day, 2, 0, 0)
    return start.strftime("%Y-%m-%d %H:%M:%S"), end.strftime("%Y-%m-%d %H:%M:%S")

def align_all_1m():
    conn = duckdb.connect()
    base_dir = "data/parquet/forex/XAUUSD/1m"
    files = sorted(glob.glob(os.path.join(base_dir, "*.parquet")))
    
    print(f"Aligning {len(files)} files in {base_dir} to MT5 Broker Server Time...")

    for f in files:
        base_name = os.path.basename(f)
        if base_name.startswith("temp") or base_name.startswith("_") or base_name.startswith("tmp"):
            continue
        year_str = base_name.replace(".parquet", "")
        try:
            year = int(year_str)
        except ValueError:
            continue

        target_file = f.replace(os.sep, "/")
        max_ts = conn.execute(f"SELECT max(timestamp) FROM read_parquet('{target_file}')").fetchone()[0]
        
        # In MT5 Broker Time (EET/EEST), end-of-year close is at 23:xx. In UTC, it's 21:xx (or 20:xx).
        if max_ts and max_ts.hour >= 23:
            print(f"[{year}] Already aligned (max={max_ts}). Skipping.")
            continue

        dst_start, dst_end = get_us_dst_bounds(year)
        temp_file = os.path.join(base_dir, f"_temp_align_{year}.parquet").replace(os.sep, "/")

        print(f"[{year}] Shifting timestamps (max={max_ts}, DST: {dst_start} -> {dst_end})...")
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

        if os.path.exists(temp_file):
            try:
                os.remove(f)
            except Exception:
                pass
            os.replace(temp_file, f)
            print(f"[{year}] Done in {time.time() - t0:.2f}s.")

    conn.close()

if __name__ == "__main__":
    align_all_1m()
