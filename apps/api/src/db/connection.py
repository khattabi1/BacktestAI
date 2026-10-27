"""
Thread-safe PostgreSQL and SQLite SQLAlchemy 2.0 connection factory
with institutional connection pooling, asyncpg, psycopg, and session dependency providers.
"""

import os
import sqlite3
from pathlib import Path
from contextlib import contextmanager
from typing import AsyncGenerator, Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from dotenv import load_dotenv

# Find root workspace directory (BacktestAI/)
ROOT_DIR = Path(__file__).resolve().parents[4]
load_dotenv(ROOT_DIR / ".env")

DEFAULT_SQLITE_PATH = ROOT_DIR / "data" / "sqlite" / "backtest_ai.db"

def get_db_path() -> Path:
    """Return configured SQLite path if in SQLite mode."""
    path_str = os.getenv("BACKTEST_AI_DB_PATH", str(DEFAULT_SQLITE_PATH))
    db_path = Path(path_str)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path

def get_database_url(db_path: Path | None = None) -> str:
    """Return active synchronous database URL."""
    if db_path is not None:
        return f"sqlite:///{db_path.as_posix()}"
    sync_url, _ = get_database_urls()
    return sync_url

def get_database_urls() -> tuple[str, str]:
    """
    Returns (sync_database_url, async_database_url).
    Prefers PostgreSQL from environment variables, falling back to SQLite.
    """
    env_sync = os.getenv("SYNC_DATABASE_URL")
    env_async = os.getenv("DATABASE_URL")

    if env_sync and env_sync.startswith("postgresql"):
        if env_sync.startswith("postgresql://"):
            sync_url = env_sync.replace("postgresql://", "postgresql+psycopg://", 1)
        else:
            sync_url = env_sync
            
        if env_async and "asyncpg" in env_async:
            async_url = env_async
        else:
            async_url = sync_url.replace("postgresql+psycopg://", "postgresql+asyncpg://", 1)
            
        return sync_url, async_url

    # Fallback SQLite
    sqlite_path = get_db_path()
    posix_path = sqlite_path.as_posix()
    return f"sqlite:///{posix_path}", f"sqlite+aiosqlite:///{posix_path}"

SYNC_URL, ASYNC_URL = get_database_urls()
is_postgres = SYNC_URL.startswith("postgresql")

# -----------------------------------------------------------------------------
# SQLAlchemy 2.0 Engines & Session Factories
# -----------------------------------------------------------------------------
if is_postgres:
    engine = create_engine(
        SYNC_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=False
    )
    async_engine = create_async_engine(
        ASYNC_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=False
    )
else:
    engine = create_engine(
        SYNC_URL,
        connect_args={"check_same_thread": False},
        echo=False
    )
    async_engine = None

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

if async_engine:
    AsyncSessionLocal = async_sessionmaker(
        bind=async_engine,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False
    )
else:
    AsyncSessionLocal = None

def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a synchronous SQLAlchemy session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an asynchronous SQLAlchemy session."""
    if not AsyncSessionLocal:
        raise RuntimeError("Async database engine is not configured for SQLite mode")
    async with AsyncSessionLocal() as session:
        yield session

def init_db() -> None:
    """Create all 20 tables in the active database engine."""
    from .models import Base
    Base.metadata.create_all(bind=engine)

# -----------------------------------------------------------------------------
# Direct Connection Fallback for Legacy Callers
# -----------------------------------------------------------------------------
def create_connection(db_path: Path | None = None) -> sqlite3.Connection:
    """Create direct sqlite3 connection (used when SQLite fallback is active)."""
    target_path = db_path or get_db_path()
    conn = sqlite3.connect(str(target_path), check_same_thread=False, timeout=10.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

@contextmanager
def get_db_connection(db_path: Path | None = None):
    """Context manager for direct connections."""
    conn = create_connection(db_path)
    try:
        yield conn
    finally:
        conn.close()
