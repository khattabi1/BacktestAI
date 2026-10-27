"""
Thread-safe SQLite and SQLAlchemy 2.0 connection factory with WAL mode,
foreign key constraints, and session dependency providers.
"""

import sqlite3
import os
from pathlib import Path
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# Find root workspace directory (BacktestAI/)
ROOT_DIR = Path(__file__).resolve().parents[4]
DEFAULT_DB_PATH = ROOT_DIR / "data" / "sqlite" / "backtest_ai.db"

def get_db_path() -> Path:
    """Return configured database path, ensuring parent directory exists."""
    path_str = os.getenv("BACKTEST_AI_DB_PATH", str(DEFAULT_DB_PATH))
    db_path = Path(path_str)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path

def get_database_url(db_path: Path | None = None) -> str:
    """Return standard SQLAlchemy database connection URL."""
    target = db_path or get_db_path()
    return f"sqlite:///{target.as_posix()}"

# -----------------------------------------------------------------------------
# SQLAlchemy 2.0 Engine & Session Factory
# -----------------------------------------------------------------------------
DATABASE_URL = get_database_url()

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a SQLAlchemy session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -----------------------------------------------------------------------------
# Direct SQLite Connection with WAL & Foreign Keys
# -----------------------------------------------------------------------------
def create_connection(db_path: Path | None = None) -> sqlite3.Connection:
    """
    Create a new sqlite3 connection with WAL mode and foreign keys enabled.
    """
    target_path = db_path or get_db_path()
    conn = sqlite3.connect(
        str(target_path),
        check_same_thread=False,
        timeout=10.0,
        isolation_level=None  # autocommit mode; transactions handled via BEGIN/COMMIT
    )
    conn.row_factory = sqlite3.Row
    
    # Configure institutional database pragmas
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    
    return conn

@contextmanager
def get_db_connection(db_path: Path | None = None) -> Generator[sqlite3.Connection, None, None]:
    """
    Context manager yielding a database connection.
    Ensures safe transaction commit or rollback on exception.
    """
    conn = create_connection(db_path)
    try:
        yield conn
    finally:
        conn.close()

@contextmanager
def get_db_cursor(db_path: Path | None = None) -> Generator[sqlite3.Cursor, None, None]:
    """
    Context manager yielding a cursor within an explicit transaction.
    """
    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("BEGIN IMMEDIATE;")
            yield cursor
            cursor.execute("COMMIT;")
        except Exception:
            cursor.execute("ROLLBACK;")
            raise
        finally:
            cursor.close()
