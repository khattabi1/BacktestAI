import os
import glob
import time
import duckdb

def rebuild():
    market = "forex"
    symbol = "XAUUSD"
    base_dir = f"data/parquet/{market}/{symbol}/1m"
    files = sorted([f for f in glob.glob(os.path.join(base_dir, "*.parquet")) if not os.path.basename(f).startswith("temp") and not os.path.basename(f).startswith("tmp") and not os.path.basename(f).startswith("_")])
    
    print(f"Found {len(files)} valid 1m files for {symbol}.")
    
    timeframes = {
        "5m": "INTERVAL '5 minutes'",
        "15m": "INTERVAL '15 minutes'",
        "1h": "INTERVAL '1 hour'",
        "4h": "INTERVAL '4 hours'",
        "1d": "INTERVAL '1 day'",
    }
    
    for tf_name, bucket_sql in timeframes.items():
        t0 = time.time()
        tf_dir = f"data/parquet/{market}/{symbol}/{tf_name}"
        os.makedirs(tf_dir, exist_ok=True)
        
        # Clean any leftover temp files
        for tmp in glob.glob(os.path.join(tf_dir, "*temp*")) + glob.glob(os.path.join(tf_dir, "*tmp*")):
            try:
                os.remove(tmp)
            except Exception:
                pass
                
        for file_path in files:
            year = os.path.basename(file_path).replace(".parquet", "")
            out_path = os.path.join(tf_dir, f"{year}.parquet").replace(os.sep, "/")
            in_file = file_path.replace(os.sep, '/')
            
            # Remove existing file first
            if os.path.exists(out_path):
                try:
                    os.remove(out_path)
                except Exception:
                    pass
            
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
                FROM read_parquet('{in_file}')
                GROUP BY 1
                ORDER BY 1 ASC
            ) TO '{out_path}' (FORMAT PARQUET, COMPRESSION ZSTD);
            """
            
            conn = duckdb.connect()
            try:
                conn.execute(query)
            finally:
                conn.close()
                
        elapsed = time.time() - t0
        print(f"Successfully generated {tf_name.upper()} pyramid ({len(files)} files) in {elapsed:.2f}s.")

if __name__ == "__main__":
    rebuild()
