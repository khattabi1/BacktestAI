"""
Unit tests for Backtest AI SQLite relational database layer.
Asserts schema integrity, WAL pragmas, foreign keys, user/session CRUD,
and backtest run persistence.
"""

import tempfile
import sqlite3
from pathlib import Path
import pytest

from apps.api.src.db.connection import create_connection, get_db_connection
from apps.api.src.db.init_db import init_database
from apps.api.src.db.repository import DatabaseRepository

@pytest.fixture
def temp_db():
    """Create an isolated temporary SQLite database for testing."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_path = Path(f.name)
    
    init_database(temp_path)
    yield temp_path
    
    # Teardown
    try:
        temp_path.unlink(missing_ok=True)
        wal_file = temp_path.with_name(f"{temp_path.name}-wal")
        wal_file.unlink(missing_ok=True)
        shm_file = temp_path.with_name(f"{temp_path.name}-shm")
        shm_file.unlink(missing_ok=True)
    except Exception:
        pass

def test_database_tables_exist(temp_db):
    """Verify all 10 institutional tables are created by schema DDL."""
    expected_tables = {
        "users",
        "user_sessions",
        "workspaces",
        "backtest_sessions",
        "strategies",
        "strategy_versions",
        "backtest_runs",
        "trades",
        "journal_entries",
        "audit_logs"
    }
    
    with get_db_connection(temp_db) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = {row["name"] for row in cursor.fetchall()}
        
        for table in expected_tables:
            assert table in tables, f"Expected table '{table}' not found in SQLite schema."

def test_pragmas_wal_and_foreign_keys(temp_db):
    """Verify WAL journal mode and foreign key constraint enforcement."""
    with get_db_connection(temp_db) as conn:
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys;")
        assert cursor.fetchone()[0] == 1, "Foreign key enforcement must be ON."

def test_seeded_users_and_strategies(temp_db):
    """Verify default quant users and built-in strategies are properly seeded."""
    repo = DatabaseRepository(temp_db)
    
    quant_user = repo.get_user_by_email("quant@backtestai.io")
    assert quant_user is not None
    assert quant_user["role"] == "user"
    assert quant_user["tier"] == "pro"
    
    admin_user = repo.get_user_by_email("admin@backtestai.io")
    assert admin_user is not None
    assert admin_user["role"] == "admin"
    
    strategies = repo.list_strategies()
    assert len(strategies) >= 2
    strat_names = [s["name"] for s in strategies]
    assert "SMA Crossover Strategy" in strat_names
    assert "RSI Mean Reversion" in strat_names

def test_user_authentication_and_sessions(temp_db):
    """Test user creation, credential verification, and session token lifecycle."""
    repo = DatabaseRepository(temp_db)
    
    # 1. Create User
    user = repo.create_user(
        email="alex.thorne@citadel.com",
        password="SecureQuantPassword123!",
        full_name="Alex Thorne",
        tier="enterprise"
    )
    assert user["id"] is not None
    assert user["email"] == "alex.thorne@citadel.com"
    assert user["tier"] == "enterprise"
    
    # 2. Verify Credentials
    verified = repo.verify_credentials("alex.thorne@citadel.com", "SecureQuantPassword123!")
    assert verified is not None
    assert verified["id"] == user["id"]
    
    # Bad password
    assert repo.verify_credentials("alex.thorne@citadel.com", "WrongPassword") is None
    
    # 3. Create Session
    session = repo.create_session(user["id"], user_agent="Mozilla/5.0", ip_address="127.0.0.1")
    assert session["token"].startswith("si_sess_")
    
    # 4. Lookup Session
    fetched_sess = repo.get_session(session["token"])
    assert fetched_sess is not None
    assert fetched_sess["user_id"] == user["id"]
    assert fetched_sess["email"] == "alex.thorne@citadel.com"
    
    # 5. Delete Session (Logout)
    deleted = repo.delete_session(session["token"])
    assert deleted is True
    assert repo.get_session(session["token"]) is None

def test_backtest_run_and_trades_persistence(temp_db):
    """Test full persistence of simulation metrics and trade ledger records."""
    repo = DatabaseRepository(temp_db)
    
    run_id = "test_run_btc_001"
    config = {
        "symbol": "BTCUSDT",
        "timeframe": "1m",
        "initial_capital": 50000.0,
        "spread_pips": 1.5,
    }
    metrics = {
        "equity": 56420.0,
        "total_trades": 2,
        "win_rate": 0.5,
        "sharpe_ratio": 2.14,
        "sortino_ratio": 3.05,
        "max_drawdown_pct": 4.2,
        "profit_factor": 1.85,
    }
    trades = [
        {
            "trade_id": "T1",
            "side": "BUY",
            "entry_time": "2026-01-01T10:00:00Z",
            "entry_price": 95000.0,
            "exit_time": "2026-01-01T10:15:00Z",
            "exit_price": 96200.0,
            "quantity": 1.0,
            "pnl": 1200.0,
            "pnl_pct": 1.26,
            "fee": 12.0,
            "exit_reason": "TAKE_PROFIT",
        },
        {
            "trade_id": "T2",
            "side": "SELL",
            "entry_time": "2026-01-01T11:00:00Z",
            "entry_price": 96000.0,
            "exit_time": "2026-01-01T11:10:00Z",
            "exit_price": 96500.0,
            "quantity": 1.0,
            "pnl": -500.0,
            "pnl_pct": -0.52,
            "fee": 12.0,
            "exit_reason": "STOP_LOSS",
        }
    ]
    
    repo.save_backtest_run(
        run_id=run_id,
        strategy_name="TrendFollowingAlpha",
        symbol="BTCUSDT",
        timeframe="1m",
        config=config,
        metrics=metrics,
        trades=trades,
        execution_time_ms=18.5
    )
    
    # Fetch run
    fetched = repo.get_backtest_run(run_id)
    assert fetched is not None
    assert fetched["symbol"] == "BTCUSDT"
    assert fetched["sharpe_ratio"] == 2.14
    assert fetched["final_equity"] == 56420.0
    assert len(fetched["trades"]) == 2
    assert fetched["trades"][0]["pnl"] == 1200.0
    assert fetched["trades"][1]["pnl"] == -500.0

def test_replay_session_persistence(temp_db):
    """Test Replay Studio persistent sandbox session creation and update."""
    repo = DatabaseRepository(temp_db)
    
    sess = repo.save_replay_session(
        session_id="replay_xauusd_session",
        name="Gold Scalping Replay",
        symbol="XAUUSD",
        timeframe="5m",
        initial_capital=25000.0,
        current_bar_index=142,
        state_json='{"drawings": [{"type": "trendline", "points": [1, 2]}], "orders": []}'
    )
    
    assert sess["id"] == "replay_xauusd_session"
    assert sess["symbol"] == "XAUUSD"
    assert sess["current_bar_index"] == 142
    
    # Fetch
    fetched = repo.get_replay_session("replay_xauusd_session")
    assert fetched is not None
    assert fetched["name"] == "Gold Scalping Replay"

def test_sqlalchemy_orm_models_and_relationships(temp_db):
    """Test SQLAlchemy 2.0 ORM operations and relationship navigations."""
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session
    from apps.api.src.db.models import User
    
    engine = create_engine(f"sqlite:///{temp_db.as_posix()}", connect_args={"check_same_thread": False})
    
    with Session(engine) as session:
        # Query seeded user via ORM
        stmt = select(User).where(User.email == "quant@backtestai.io")
        user = session.scalars(stmt).first()
        assert user is not None
        assert user.full_name == "Senior Quant Researcher"
        assert user.tier == "pro"
        
        # Check workspace relationship
        assert len(user.workspaces) >= 1
        assert user.workspaces[0].slug == "main-alpha-lab"
        
        # Check strategy relationship
        assert len(user.strategies) >= 2
        names = [s.name for s in user.strategies]
        assert "SMA Crossover Strategy" in names

