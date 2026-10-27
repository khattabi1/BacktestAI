"""
Seed baseline demo data for Backtest AI.
Populates default workspace, demonstration quant user, and baseline strategies.
"""
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from apps.api.src.db.init_db import init_database

if __name__ == "__main__":
    print("Seeding Backtest AI database...")
    init_database()
    print("Seeding completed successfully!")
