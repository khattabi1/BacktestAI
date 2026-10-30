import os
import sys
import glob
import subprocess
import duckdb
from datetime import datetime

def run_pipeline():
    out_dir = "data/parquet/forex/XAUUSD/1m"
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs("download", exist_ok=True)

    current_year = 2026
    start_year = 2010

    conn = duckdb.connect()

    for year in range(start_year, current_year + 1):
        target_parquet = os.path.join(out_dir, f"{year}.parquet").replace("\\", "/")
        
        # Check if already completed with valid data
        if os.path.exists(target_parquet):
            try:
                cnt = conn.execute(f"SELECT count(*) FROM read_parquet('{target_parquet}')").fetchone()[0]
                if cnt > 100000 or (year == 2026 and cnt > 50000):
                    print(f"[{year}] Already processed: {cnt:,} bars in {target_parquet}. Skipping.")
                    continue
            except Exception as e:
                print(f"[{year}] Existing file corrupted ({e}), will re-process.")

        print(f"\n==================================================================")
        print(f"[{year}] DOWNLOADING HISTORICAL 1M BARS FOR XAUUSD")
        print(f"==================================================================")

        from_date = f"{year}-01-01"
        if year == 2026:
            to_date = "now"
        else:
            to_date = f"{year + 1}-01-01"

        fn_prefix = f"xauusd-m1-{year}"
        cmd = [
            "npx", "dukascopy-node",
            "-i", "xauusd",
            "-from", from_date,
            "-to", to_date,
            "-t", "m1",
            "-p", "bid",
            "-f", "csv",
            "-v",
            "-dir", "./download",
            "-fn", fn_prefix
        ]

        print(f"Executing: {' '.join(cmd)}")
        res = subprocess.run(cmd, shell=True)
        if res.returncode != 0:
            print(f"Error downloading {year}, return code {res.returncode}")
            continue

        # Locate output file
        matches = glob.glob(f"download/{fn_prefix}*.csv")
        if not matches:
            # Fallback check standard dukascopy pattern
            matches = glob.glob(f"download/xauusd-m1-bid-{year}*.csv")

        if not matches:
            print(f"No CSV found for year {year}")
            continue

        csv_file = matches[0].replace("\\", "/")
        print(f"[{year}] Converting {csv_file} -> {target_parquet} via DuckDB...")

        write_query = f"""
        COPY (
            SELECT 
                epoch_ms(timestamp::BIGINT) AS timestamp,
                open::DOUBLE AS open,
                high::DOUBLE AS high,
                low::DOUBLE AS low,
                close::DOUBLE AS close,
                COALESCE(volume::DOUBLE, 0.0) AS volume,
                0.2::DOUBLE AS spread,
                'XAUUSD'::VARCHAR AS symbol
            FROM (
                SELECT *,
                       ROW_NUMBER() OVER (PARTITION BY timestamp ORDER BY timestamp) as rn
                FROM read_csv_auto('{csv_file}', union_by_name=true)
                WHERE year(epoch_ms(timestamp::BIGINT)) = {year}
            )
            WHERE rn = 1
            ORDER BY timestamp ASC
        ) TO '{target_parquet}' (FORMAT PARQUET, COMPRESSION ZSTD);
        """
        conn.execute(write_query)

        stats = conn.execute(f"""
        SELECT count(*), min(timestamp), max(timestamp), min(low), max(high)
        FROM read_parquet('{target_parquet}')
        """).fetchone()

        size_mb = os.path.getsize(target_parquet) / (1024 * 1024)
        print(f" Successfully created {target_parquet}:")
        print(f"   Bars:       {stats[0]:,}")
        print(f"   Range:      {stats[1]} -> {stats[2]}")
        print(f"   Price:      ${stats[3]:.2f} - ${stats[4]:.2f}")
        print(f"   File Size:  {size_mb:.2f} MB")

    # Final summary of all available years
    all_parquets = sorted(glob.glob(f"{out_dir}/*.parquet"))
    print("\n==================================================================")
    print("ALL AVAILABLE GOLD (XAUUSD) PARQUET DATASETS:")
    print("==================================================================")
    total_bars_all = 0
    for p in all_parquets:
        s = conn.execute(f"SELECT count(*), min(timestamp), max(timestamp) FROM read_parquet('{p.replace(os.sep, '/')}')").fetchone()
        sz = os.path.getsize(p) / (1024 * 1024)
        total_bars_all += s[0]
        fname = os.path.basename(p)
        print(f"  {fname:<14} | {s[0]:>8,} bars | {s[1]} to {s[2]} | {sz:.2f} MB")

    print(f"\nGRAND TOTAL: {total_bars_all:,} real 1-minute Gold bars available!")
    conn.close()

if __name__ == "__main__":
    run_pipeline()
