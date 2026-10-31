"""
SQLAlchemy 2.0 Declarative ORM Models for Backtest AI.
Typed with Mapped[] and mapped_column(), with robust server_default attributes
fully compatible with SQLite (local) and production PostgreSQL.
"""

from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import (
    String,
    Integer,
    Float,
    Text,
    ForeignKey,
    Index,
    UniqueConstraint,
    func
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship
)

class Base(DeclarativeBase):
    """Base class for all SQLAlchemy 2.0 declarative models."""
    pass

# -----------------------------------------------------------------------------
# 1. Users & Authentication
# -----------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    tier: Mapped[str] = mapped_column(String(32), server_default="researcher", default="researcher", nullable=False)
    role: Mapped[str] = mapped_column(String(32), server_default="user", default="user", nullable=False)
    is_active: Mapped[int] = mapped_column(Integer, server_default="1", default=1, nullable=False)
    created_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())

    # Relationships
    sessions: Mapped[List["UserSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    workspaces: Mapped[List["Workspace"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    strategies: Mapped[List["Strategy"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    backtest_sessions: Mapped[List["BacktestSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    journal_entries: Mapped[List["JournalEntry"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    agent_sessions: Mapped[List["AgentSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")

class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    expires_at: Mapped[str] = mapped_column(String(32), nullable=False)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())

    user: Mapped["User"] = relationship(back_populates="sessions")

# -----------------------------------------------------------------------------
# 2. Workspaces
# -----------------------------------------------------------------------------
class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    slug: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_default: Mapped[int] = mapped_column(Integer, server_default="0", default=0, nullable=False)
    created_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())

    user: Mapped["User"] = relationship(back_populates="workspaces")
    strategies: Mapped[List["Strategy"]] = relationship(back_populates="workspace")

# -----------------------------------------------------------------------------
# 3. Persistent Replay Studio Sandboxes
# -----------------------------------------------------------------------------
class BacktestSession(Base):
    __tablename__ = "backtest_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    workspace_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(16), nullable=False)
    initial_capital: Mapped[float] = mapped_column(Float, server_default="10000.0", default=10000.0, nullable=False)
    leverage: Mapped[float] = mapped_column(Float, server_default="1.0", default=1.0, nullable=False)
    current_bar_index: Mapped[int] = mapped_column(Integer, server_default="0", default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), server_default="active", default="active", nullable=False)
    state_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())

    user: Mapped[Optional["User"]] = relationship(back_populates="backtest_sessions")
    trades: Mapped[List["Trade"]] = relationship(back_populates="session", cascade="all, delete-orphan")

# -----------------------------------------------------------------------------
# 4. Strategies & Versions
# -----------------------------------------------------------------------------
class Strategy(Base):
    __tablename__ = "strategies"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    workspace_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    slug: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(16), server_default="python", default="python", nullable=False)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    default_parameters: Mapped[str] = mapped_column(Text, server_default="{}", default="{}", nullable=False)
    is_built_in: Mapped[int] = mapped_column(Integer, server_default="0", default=0, nullable=False)
    created_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())

    user: Mapped[Optional["User"]] = relationship(back_populates="strategies")
    workspace: Mapped[Optional["Workspace"]] = relationship(back_populates="strategies")
    versions: Mapped[List["StrategyVersion"]] = relationship(back_populates="strategy", cascade="all, delete-orphan")
    runs: Mapped[List["BacktestRun"]] = relationship(back_populates="strategy")

class StrategyVersion(Base):
    __tablename__ = "strategy_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    strategy_id: Mapped[str] = mapped_column(String(64), ForeignKey("strategies.id", ondelete="CASCADE"), nullable=False, index=True)
    version_num: Mapped[int] = mapped_column(Integer, nullable=False)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    parameters: Mapped[str] = mapped_column(Text, server_default="{}", default="{}", nullable=False)
    commit_message: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())

    strategy: Mapped["Strategy"] = relationship(back_populates="versions")

# -----------------------------------------------------------------------------
# 5. Backtest Simulation Runs & Trades
# -----------------------------------------------------------------------------
class BacktestRun(Base):
    __tablename__ = "backtest_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    strategy_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("strategies.id", ondelete="SET NULL"), nullable=True, index=True)
    strategy_name: Mapped[str] = mapped_column(String(128), nullable=False)
    version_num: Mapped[int] = mapped_column(Integer, server_default="1", default=1, nullable=False)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(16), nullable=False)
    start_date: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    end_date: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    initial_capital: Mapped[float] = mapped_column(Float, nullable=False)
    final_equity: Mapped[float] = mapped_column(Float, nullable=False)
    total_trades: Mapped[int] = mapped_column(Integer, nullable=False)
    win_rate: Mapped[float] = mapped_column(Float, nullable=False)
    sharpe_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    sortino_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    max_drawdown_pct: Mapped[float] = mapped_column(Float, nullable=False)
    profit_factor: Mapped[float] = mapped_column(Float, nullable=False)
    execution_time_ms: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(32), server_default="completed", default="completed", nullable=False)
    config_json: Mapped[str] = mapped_column(Text, nullable=False)
    metrics_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())

    strategy: Mapped[Optional["Strategy"]] = relationship(back_populates="runs")
    trades: Mapped[List["Trade"]] = relationship(back_populates="backtest_run", cascade="all, delete-orphan")

class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    backtest_run_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("backtest_runs.id", ondelete="CASCADE"), nullable=True, index=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("backtest_sessions.id", ondelete="CASCADE"), nullable=True, index=True)
    trade_id: Mapped[str] = mapped_column(String(64), nullable=False)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    side: Mapped[str] = mapped_column(String(8), nullable=False)
    entry_time: Mapped[str] = mapped_column(String(32), nullable=False)
    entry_price: Mapped[float] = mapped_column(Float, nullable=False)
    exit_time: Mapped[str] = mapped_column(String(32), nullable=False)
    exit_price: Mapped[float] = mapped_column(Float, nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    pnl: Mapped[float] = mapped_column(Float, nullable=False)
    pnl_pct: Mapped[float] = mapped_column(Float, nullable=False)
    fee: Mapped[float] = mapped_column(Float, server_default="0.0", default=0.0, nullable=False)
    swap: Mapped[float] = mapped_column(Float, server_default="0.0", default=0.0, nullable=False)
    stop_loss: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    take_profit: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    exit_reason: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    screenshot_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    trade_card_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    backtest_run: Mapped[Optional["BacktestRun"]] = relationship(back_populates="trades")
    session: Mapped[Optional["BacktestSession"]] = relationship(back_populates="trades")

# -----------------------------------------------------------------------------
# 6. Research Journal & Audit Logs
# -----------------------------------------------------------------------------
class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("backtest_sessions.id", ondelete="SET NULL"), nullable=True)
    backtest_run_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("backtest_runs.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    hypothesis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    setup_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    market_conditions: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    outcome: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())

    user: Mapped["User"] = relationship(back_populates="journal_entries")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())


# -----------------------------------------------------------------------------
# 7. Social Quant Community Models
# -----------------------------------------------------------------------------
class CommunityPost(Base):
    __tablename__ = "community_posts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    author_username: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    author_display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    author_avatar_url: Mapped[str] = mapped_column(String(512), nullable=False)
    author_reputation: Mapped[str] = mapped_column(String(64), server_default="Quant Trader", default="Quant Trader")
    author_followers_count: Mapped[int] = mapped_column(Integer, server_default="0", default=0)

    content: Mapped[str] = mapped_column(Text, nullable=False)
    chart_image_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    # Strategy attachment metadata
    strategy_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    strategy_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    strategy_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    strategy_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # 'open_source' | 'pro_ea'
    strategy_price: Mapped[float] = mapped_column(Float, server_default="0.0", default=0.0)
    strategy_category: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    strategy_symbols_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    strategy_metrics_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    strategy_code_snippet: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    strategy_stars_average: Mapped[float] = mapped_column(Float, server_default="5.0", default=5.0)
    strategy_stars_count: Mapped[int] = mapped_column(Integer, server_default="1", default=1)
    strategy_forks_count: Mapped[int] = mapped_column(Integer, server_default="0", default=0)

    likes_count: Mapped[int] = mapped_column(Integer, server_default="0", default=0)
    comments_count: Mapped[int] = mapped_column(Integer, server_default="0", default=0)
    created_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())

    comments: Mapped[List["CommunityComment"]] = relationship(back_populates="post", cascade="all, delete-orphan")


class CommunityComment(Base):
    __tablename__ = "community_comments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    post_id: Mapped[str] = mapped_column(String(64), ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    author_username: Mapped[str] = mapped_column(String(64), nullable=False)
    author_display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    author_avatar_url: Mapped[str] = mapped_column(String(512), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())

    post: Mapped["CommunityPost"] = relationship(back_populates="comments")


class CommunityPostLike(Base):
    __tablename__ = "community_post_likes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    post_id: Mapped[str] = mapped_column(String(64), ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())


class CommunityStrategyStar(Base):
    __tablename__ = "community_strategy_stars"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    strategy_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())


class CommunityBenchmarkCache(Base):
    __tablename__ = "community_benchmark_cache"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    strategy_name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    version_num: Mapped[int] = mapped_column(Integer, nullable=False)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    metrics_json: Mapped[str] = mapped_column(Text, nullable=False)
    ai_audit_json: Mapped[str] = mapped_column(Text, nullable=False)
    verified_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())


class CommunityDirectMessage(Base):
    __tablename__ = "community_direct_messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    sender_username: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    receiver_username: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())
    read_at: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

# -----------------------------------------------------------------------------
# 8. Autonomous Agent Memory, Sessions & Trajectories (AI Chats)
# -----------------------------------------------------------------------------
class AgentSession(Base):
    __tablename__ = "agent_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    state: Mapped[str] = mapped_column(String(64), default="idle", server_default="idle", nullable=False)
    pending_interaction: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    context_meta: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())

    user: Mapped["User"] = relationship(back_populates="agent_sessions")
    messages: Mapped[List["AgentMessage"]] = relationship(back_populates="session", cascade="all, delete-orphan", order_by="AgentMessage.id")
    trajectories: Mapped[List["AgentTrajectory"]] = relationship(back_populates="session", cascade="all, delete-orphan", order_by="AgentTrajectory.step_index")
    artifacts: Mapped[List["AgentArtifact"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class AgentMessage(Base):
    __tablename__ = "agent_messages"
    __table_args__ = (UniqueConstraint("session_id", "msg_index", name="uq_agent_messages_sess_idx"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    msg_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False)  # user, assistant, system, tool
    content: Mapped[str] = mapped_column(Text, nullable=False)
    thought: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tool_calls_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tool_call_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    timestamp_utc: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())

    session: Mapped["AgentSession"] = relationship(back_populates="messages")


class AgentTrajectory(Base):
    __tablename__ = "agent_trajectories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp_utc: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())

    session: Mapped["AgentSession"] = relationship(back_populates="trajectories")


class AgentArtifact(Base):
    __tablename__ = "agent_artifacts"

    artifact_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(64), ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    artifact_type: Mapped[str] = mapped_column(String(64), nullable=False)  # mql5_code, blueprint, report
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[Text] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(32), server_default=func.now(), default=lambda: datetime.now(timezone.utc).isoformat())

    session: Mapped["AgentSession"] = relationship(back_populates="artifacts")
