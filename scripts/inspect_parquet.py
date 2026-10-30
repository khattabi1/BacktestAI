import duckdb

conn = duckdb.connect()
path = 'data/parquet/forex/XAUUSD/15m/2025.parquet'
schema = conn.execute(f"DESCRIBE SELECT * FROM '{path}'").fetchall()
print("SCHEMA:")
for col in schema:
    print(f"  {col[0]}: {col[1]}")

stats = conn.execute(f"SELECT min(timestamp), max(timestamp), count(*), avg(spread), avg(close) FROM '{path}'").fetchall()
print("\nSTATS:")
print("  Min Timestamp:", stats[0][0])
print("  Max Timestamp:", stats[0][1])
print("  Total Rows:", stats[0][2])
print("  Avg Spread:", stats[0][3])
print("  Avg Close Price:", stats[0][4])
