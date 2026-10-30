import os
import sys
import glob
import subprocess
import duckdb
from concurrent.futures import ThreadPoolExecutor, as_completed

def process_year(year: int):
    out_dir = "data/parquet/forex/XAUUSD/1m"
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs("download", exist_ok=True)
    target_parquet = os.path.join(out_dir, f"{year}.parquet").replace("\\", "/")

    # Check if already processed
    if os.path.exists(target_parquet):
        try:
            conn_chk = duckdb.connect()
            cnt = conn_chk.execute(f"SELECT count(*) FROM read_parquet('{target_parquet}')").fetchone()[0]
            conn_chk.close()
            if cnt > 100000 or (year == 2026 and cnt > 50000):
                print(f"[{year}] Already processed: {cnt:,} bars. Skipping.")
                return (year, cnt, "SKIPPED")
        except Exception:
            pass

    from_date = f"{year}-01-01"
    to_date = "now" if year == 2026 else f"{year + 1}-01-01"
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
        "-s",
        "-r", "3",
        "-rp", "1000",
        "-bp", "1200",
        "-dir", "./download",
        "-fn", fn_prefix
    ]

    print(f"[{year}] Downloading 1m bid bars ({from_date} -> {to_date})...")
    res = subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        err = res.stderr.decode('utf-8', errors='ignore') + " " + res.stdout.decode('utf-8', errors='ignore')
        print(f"[{year}] ERROR downloading: {err[:300]}")
        return (year, 0, "ERROR_DOWNLOAD")

    # Locate CSV file
    matches = glob.glob(f"download/{fn_prefix}*.csv")
    if not matches:
        matches = glob.glob(f"download/xauusd-m1-bid-{year}*.csv")

    if not matches:
        print(f"[{year}] ERROR: No CSV file found in download/")
        return (year, 0, "ERROR_NO_CSV")

    csv_file = matches[0].replace("\\", "/")
    print(f"[{year}] Converting {csv_file} -> {target_parquet} via DuckDB...")

    conn = duckdb.connect()
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
    conn.close()

    size_mb = os.path.getsize(target_parquet) / (1024 * 1024)
    print(f"[{year}] SUCCESS: {stats[0]:,} bars ({stats[1]} to {stats[2]}), ${stats[3]:.2f} - ${stats[4]:.2f}, {size_mb:.2f} MB")
    return (year, stats[0], "SUCCESS")

def main():
    start_year = 2010
    current_year = 2026
    years = list(range(start_year, current_year + 1))

    print(f"==================================================================")
    print(f"STARTING MULTI-WORKER PIPELINE: GOLD (XAUUSD) {start_year} -> {current_year}")
    print(f"Running across 5 parallel workers...")
    print(f"==================================================================")

    results = []
    with ThreadPoolExecutor(max_workers=3) as executor:
        future_to_year = {executor.submit(process_year, y): y for y in years}
        for future in as_completed(future_to_year):
            y = future_to_year[future]
            try:
                res = future.result()
                results.append(res)
            except Exception as e:
                print(f"[{y}] EXCEPTION: {e}")
                results.append((y, 0, f"FAILED: {e}"))

    # Consolidated Verification
    print("\n==================================================================")
    print("CONSOLIDATED GOLD PARQUET SUMMARY (ALL YEARS):")
    print("==================================================================")
    out_dir = "data/parquet/forex/XAUUSD/1m"
    all_parquets = sorted(glob.glob(f"{out_dir}/*.parquet"))
    conn = duckdb.connect()
    total_bars = 0
    for p in all_parquets:
        s = conn.execute(f"SELECT count(*), min(timestamp), max(timestamp) FROM read_parquet('{p.replace(os.sep, '/')}')").fetchone()
        sz = os.path.getsize(p) / (1024 * 1024)
        total_bars += s[0]
        fname = os.path.basename(p)
        print(f"  {fname:<14} | {s[0]:>8,} bars | {s[1]} to {s[2]} | {sz:.2f} MB")
    conn.close()

    print(f"\n==================================================================")
    print(f"GRAND TOTAL: {total_bars:,} REAL 1-MINUTE GOLD CANDLES")
    print(f"STATUS: DONE")
    print(f"==================================================================")

if __name__ == "__main__":
    main()
