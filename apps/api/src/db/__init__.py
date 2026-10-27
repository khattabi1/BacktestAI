"""
Database module for Backtest AI providing connection pooling, SQLAlchemy 2.0 ORM models,
Alembic migration support, SQLite WAL persistence, and typed repositories.
"""

from apps.api.src.db.connection import (
    get_db_connection,
    get_db_path,
    get_database_url,
    create_connection,
    engine,
    SessionLocal,
    get_db,
)
from apps.api.src.db.models import (
    Base,
    User,
    UserSession,
    Workspace,
    BacktestSession,
    Strategy,
    StrategyVersion,
    BacktestRun,
    Trade,
    JournalEntry,
    AuditLog,
)
from apps.api.src.db.init_db import init_database
from apps.api.src.db.repository import db_repo, DatabaseRepository

__all__ = [
    # Connections & Sessions
    "get_db_connection",
    "get_db_path",
    "get_database_url",
    "create_connection",
    "engine",
    "SessionLocal",
    "get_db",
    "init_database",
    # SQLAlchemy 2.0 Models
    "Base",
    "User",
    "UserSession",
    "Workspace",
    "BacktestSession",
    "Strategy",
    "StrategyVersion",
    "BacktestRun",
    "Trade",
    "JournalEntry",
    "AuditLog",
    # Repositories
    "db_repo",
    "DatabaseRepository",
]
