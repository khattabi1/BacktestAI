import sqlite3
import os

def reset_test_data():
    db_path = "data/sqlite/backtest_ai.db"
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # Check counts before
    cursor.execute("SELECT COUNT(*) FROM trades;")
    trades_before = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM backtest_runs;")
    runs_before = cursor.fetchone()[0]
    
    print(f"Before reset: {runs_before} backtest runs, {trades_before} trades.")
    
    cursor.execute("DELETE FROM trades;")
    cursor.execute("DELETE FROM backtest_sessions;")
    cursor.execute("DELETE FROM journal_entries;")
    cursor.execute("DELETE FROM backtest_runs;")
    
    conn.commit()
    
    cursor.execute("SELECT COUNT(*) FROM trades;")
    trades_after = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM backtest_runs;")
    runs_after = cursor.fetchone()[0]
    
    print(f"After reset: {runs_after} backtest runs, {trades_after} trades.")
    conn.close()
    print("All backtest test runs and trade data have been completely deleted for clean testing!")

if __name__ == "__main__":
    reset_test_data()
