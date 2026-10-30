import os
import glob
import time
import duckdb

def build_timeframes_for_symbol(symbol: str = "XAUUSD", market: str = "forex"):
    base_dir = f"data/parquet/{market}/{symbol}/1m"
    files = glob.glob(os.path.join(base_dir, "*.parquet"))
    if not files:
        print(f"No 1m parquet files found in {base_dir}")
        return

    print(f"Found {len(files)} 1m parquet files for {symbol}. Building timeframe pyramids...")

    timeframes = {
        "5m": "INTERVAL '5 minutes'",
        "15m": "INTERVAL '15 minutes'",
        "1h": "INTERVAL '1 hour'",
        "4h": "INTERVAL '4 hours'",
        "1d": "INTERVAL '1 day'",
    }

    conn = duckdb.connect()
    
    # Process each year for each timeframe
    for tf_name, bucket_sql in timeframes.items():
        t0 = time.time()
        tf_dir = f"data/parquet/{market}/{symbol}/{tf_name}"
        os.makedirs(tf_dir, exist_ok=True)
        
        # Read all 1m files and export directly partitioned by year or per file
        for file_path in sorted(files):
            year = os.path.basename(file_path).replace(".parquet", "")
            out_path = os.path.join(tf_dir, f"{year}.parquet")
            
            query = f"""
            COPY (
                SELECT 
                    time_bucket({bucket_sql}, timestamp) AS timestamp,
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
            ) TO '{out_path.replace(os.sep, '/')}' (FORMAT PARQUET, COMPRESSION ZSTD);
            """
            conn.execute(query)

        elapsed = time.time() - t0
        out_files = glob.glob(os.path.join(tf_dir, "*.parquet"))
        total_size_mb = sum(os.path.getsize(f) for f in out_files) / (1024 * 1024)
        print(f"Generated {tf_name.upper()} pyramid: {len(out_files)} files, {total_size_mb:.2f} MB in {elapsed:.2f}s")

    conn.close()
    print("All timeframe pyramids successfully built!")

if __name__ == "__main__":
    build_timeframes_for_symbol("XAUUSD", "forex")
