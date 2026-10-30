import sqlite3
from pathlib import Path

def main():
    print("=== STARTING FRESH STRATEGY DATA RESET ===")

    # 1. Clear SQLite tables: trades, backtest_runs, extra strategy_versions
    db_path = Path("data/sqlite/backtest_ai.db")
    if db_path.exists():
        conn = sqlite3.connect(str(db_path))
        c = conn.cursor()
        c.execute("DELETE FROM trades;")
        trades_del = c.rowcount
        c.execute("DELETE FROM backtest_runs;")
        runs_del = c.rowcount
        c.execute("DELETE FROM strategy_versions WHERE version_num > 1;")
        v_del = c.rowcount
        c.execute("UPDATE strategy_versions SET commit_message = 'Version 1 (Baseline)', created_at = datetime('now', 'utc') WHERE version_num = 1;")
        conn.commit()
        print(f"[SQLite] Deleted {trades_del} trades, {runs_del} backtest runs, {v_del} version milestones (> v1).")

        # 2. Reset gold_sr_fade in database
        v1_file = Path("data/users/senior/gold_sr_fade/gold_sr_fade_v1.mq5")
        if v1_file.exists():
            v1_code = v1_file.read_text(encoding="utf-8", errors="replace")
            c.execute(
                "UPDATE strategies SET code = ?, updated_at = datetime('now', 'utc') WHERE slug = 'gold_sr_fade' OR name = 'gold_sr_fade';",
                (v1_code,)
            )
            conn.commit()
            print("[SQLite] Reset gold_sr_fade strategy row code to Version 1.")

            # Overwrite active working file on disk with clean v1 code
            work_file = Path("data/users/senior/gold_sr_fade.mq5")
            work_file.write_text(v1_code, encoding="utf-8")
            print(f"[Filesystem] Reset {work_file} to clean Version 1.")
        conn.close()

    # 3. Clean version snapshots (v2, v3) in data/users/senior/gold_sr_fade/
    fade_dir = Path("data/users/senior/gold_sr_fade")
    if fade_dir.is_dir():
        for f in list(fade_dir.iterdir()):
            if f.name != "gold_sr_fade_v1.mq5":
                f.unlink()
                print(f"[Filesystem] Removed checkpoint: {f.name}")

    # 4. Remove compiled binaries (.ex5) and logs (.log) in user folder
    user_senior = Path("data/users/senior")
    if user_senior.is_dir():
        for ext in ("*.ex5", "*.log"):
            for f in user_senior.glob(ext):
                try:
                    f.unlink()
                    print(f"[Filesystem] Removed binary: {f.name}")
                except Exception:
                    pass

    # 5. Remove all old MT5 HTML reports across all workers
    workers_dir = Path("mt5_workers")
    if workers_dir.is_dir():
        for htm in workers_dir.glob("**/*.htm*"):
            try:
                htm.unlink()
                print(f"[MT5] Removed report: {htm.name}")
            except Exception:
                pass
        for ini in workers_dir.glob("**/tester_*.ini"):
            try:
                ini.unlink()
                print(f"[MT5] Removed tester config: {ini.name}")
            except Exception:
                pass

    print("=== FRESH STRATEGY DATA RESET COMPLETE ===")

if __name__ == "__main__":
    main()
