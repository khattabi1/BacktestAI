"""
Dedicated integration test suite for PostgreSQL 18 unified database.
Verifies synchronous psycopg pooling, asynchronous asyncpg sessions,
all 20 unified models, and Agent Memory (Chat) CRUD operations.
"""

import pytest
from sqlalchemy import text, select
from apps.api.src.db.connection import engine, async_engine, SessionLocal, AsyncSessionLocal
from apps.api.src.db.models import (
    User,
    AgentSession,
    AgentMessage,
    AgentTrajectory,
    AgentArtifact
)

@pytest.mark.asyncio
async def test_postgres_sync_and_async_engines():
    """Verify both sync psycopg and async asyncpg engines connect successfully."""
    # 1. Sync connection
    with engine.connect() as conn:
        res = conn.execute(text("SELECT current_user, current_database();")).fetchone()
        assert res[0] == "bt_user"
        assert res[1] == "backtest_ai"

    # 2. Async connection
    assert async_engine is not None
    async with async_engine.connect() as aconn:
        ares = await aconn.execute(text("SELECT current_user, current_database();"))
        row = ares.fetchone()
        assert row[0] == "bt_user"
        assert row[1] == "backtest_ai"

def test_postgres_all_20_tables_exist():
    """Verify all 20 unified institutional tables exist in PostgreSQL."""
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
        "audit_logs",
        "community_posts",
        "community_comments",
        "community_post_likes",
        "community_strategy_stars",
        "community_benchmark_cache",
        "community_direct_messages",
        "agent_sessions",
        "agent_messages",
        "agent_trajectories",
        "agent_artifacts",
    }
    with engine.connect() as conn:
        res = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public';"))
        actual_tables = {row[0] for row in res.fetchall()}

    missing = expected_tables - actual_tables
    assert not missing, f"Missing tables in PostgreSQL: {missing}"

def test_postgres_agent_chat_memory_crud():
    """Test creating and querying Agent Chat Messages linked to an AgentSession."""
    with SessionLocal() as session:
        # Find demo user
        user = session.scalars(select(User).where(User.email == "quant@backtestai.io")).first()
        assert user is not None

        # Create AgentSession
        agent_session = AgentSession(
            id="test_sess_001",
            user_id=user.id,
            title="Gold Scalping Strategy Formulation",
            state="active"
        )
        session.merge(agent_session)
        session.commit()

        # Create AgentMessage (User message)
        user_msg = AgentMessage(
            session_id="test_sess_001",
            msg_index=0,
            role="user",
            content="Can you build an SMC Gold Scalper on M5?"
        )
        # Create AgentMessage (Assistant message with thought)
        asst_msg = AgentMessage(
            session_id="test_sess_001",
            msg_index=1,
            role="assistant",
            thought="Analyzing market microstructure and Fair Value Gap parameters for XAUUSD M5...",
            content="I have designed the 8-Block Blueprint for the Gold SMC Scalper."
        )
        session.add_all([user_msg, asst_msg])
        session.commit()

        # Query messages via relationship
        retrieved_sess = session.scalars(select(AgentSession).where(AgentSession.id == "test_sess_001")).first()
        assert retrieved_sess is not None
        assert len(retrieved_sess.messages) >= 2
        assert retrieved_sess.messages[0].role == "user"
        assert retrieved_sess.messages[1].thought is not None
        assert "Fair Value Gap" in retrieved_sess.messages[1].thought
