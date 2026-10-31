"""
Standardized relational SQL DDL schema for BacktestAI.
Designed for 100% compatibility with SQLite (local development) and seamless future upgrade to PostgreSQL.
"""

SCHEMA_DDL = """
-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'researcher', -- 'researcher', 'pro', 'enterprise'
    role TEXT NOT NULL DEFAULT 'user',       -- 'user', 'admin'
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. User Sessions Table
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);

-- 3. Workspaces Table
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id);

-- 4. Backtest Persistent Sessions (Replay Studio)
CREATE TABLE IF NOT EXISTS backtest_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    initial_capital REAL NOT NULL DEFAULT 10000.0,
    leverage REAL NOT NULL DEFAULT 1.0,
    current_bar_index INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'archived'
    state_json TEXT,                       -- drawings, active orders, setup notes
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_backtest_sessions_user ON backtest_sessions(user_id);

-- 5. Strategies Table
CREATE TABLE IF NOT EXISTS strategies (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    language TEXT NOT NULL DEFAULT 'python', -- 'python', 'mql5'
    code TEXT NOT NULL,
    default_parameters TEXT NOT NULL DEFAULT '{}',
    is_built_in INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_strategies_user ON strategies(user_id);

-- 6. Strategy Versions Table
CREATE TABLE IF NOT EXISTS strategy_versions (
    id TEXT PRIMARY KEY,
    strategy_id TEXT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    version_num INTEGER NOT NULL,
    code TEXT NOT NULL,
    parameters TEXT NOT NULL DEFAULT '{}',
    commit_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_strategy_versions_strat ON strategy_versions(strategy_id);

-- 7. Backtest Runs Table (Persistent Simulation History)
CREATE TABLE IF NOT EXISTS backtest_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    strategy_id TEXT REFERENCES strategies(id) ON DELETE SET NULL,
    strategy_name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    initial_capital REAL NOT NULL,
    final_equity REAL NOT NULL,
    total_trades INTEGER NOT NULL,
    win_rate REAL NOT NULL,
    sharpe_ratio REAL NOT NULL,
    sortino_ratio REAL NOT NULL,
    max_drawdown_pct REAL NOT NULL,
    profit_factor REAL NOT NULL,
    execution_time_ms REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    config_json TEXT NOT NULL,
    metrics_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_backtest_runs_user ON backtest_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_strat ON backtest_runs(strategy_id);

-- 8. Trades Table
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    backtest_run_id TEXT REFERENCES backtest_runs(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES backtest_sessions(id) ON DELETE CASCADE,
    trade_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    entry_time TEXT NOT NULL,
    entry_price REAL NOT NULL,
    exit_time TEXT NOT NULL,
    exit_price REAL NOT NULL,
    quantity REAL NOT NULL,
    pnl REAL NOT NULL,
    pnl_pct REAL NOT NULL,
    fee REAL NOT NULL DEFAULT 0.0,
    swap REAL NOT NULL DEFAULT 0.0,
    stop_loss REAL,
    take_profit REAL,
    exit_reason TEXT,
    screenshot_path TEXT,
    trade_card_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_trades_run ON trades(backtest_run_id);
CREATE INDEX IF NOT EXISTS idx_trades_session ON trades(session_id);

-- 9. Research Journal Entries Table
CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES backtest_sessions(id) ON DELETE CASCADE,
    backtest_run_id TEXT REFERENCES backtest_runs(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    hypothesis TEXT,
    setup_type TEXT,
    market_conditions TEXT,
    notes TEXT,
    tags TEXT,
    outcome TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id);

-- 10. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    metadata_json TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);

-- 11. Community Posts Table
CREATE TABLE IF NOT EXISTS community_posts (
    id TEXT PRIMARY KEY,
    author_username TEXT NOT NULL,
    author_display_name TEXT NOT NULL,
    author_avatar_url TEXT NOT NULL,
    author_reputation TEXT NOT NULL DEFAULT 'Quant Trader',
    author_followers_count INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    chart_image_url TEXT,
    strategy_id TEXT,
    strategy_name TEXT,
    strategy_version TEXT,
    strategy_type TEXT,
    strategy_price REAL NOT NULL DEFAULT 0.0,
    strategy_category TEXT,
    strategy_symbols_json TEXT,
    strategy_metrics_json TEXT,
    strategy_code_snippet TEXT,
    strategy_stars_average REAL NOT NULL DEFAULT 5.0,
    strategy_stars_count INTEGER NOT NULL DEFAULT 1,
    strategy_forks_count INTEGER NOT NULL DEFAULT 0,
    likes_count INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_comm_posts_author ON community_posts(author_username);
CREATE INDEX IF NOT EXISTS idx_comm_posts_strat ON community_posts(strategy_id);

-- 12. Community Comments Table
CREATE TABLE IF NOT EXISTS community_comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    author_username TEXT NOT NULL,
    author_display_name TEXT NOT NULL,
    author_avatar_url TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_comm_comments_post ON community_comments(post_id);

-- 13. Community Post Likes Table
CREATE TABLE IF NOT EXISTS community_post_likes (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    UNIQUE(post_id, username)
);

CREATE INDEX IF NOT EXISTS idx_comm_likes_post ON community_post_likes(post_id);

-- 14. Community Strategy Ratings Table
CREATE TABLE IF NOT EXISTS community_strategy_stars (
    id TEXT PRIMARY KEY,
    strategy_id TEXT NOT NULL,
    username TEXT NOT NULL,
    rating INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    UNIQUE(strategy_id, username)
);

CREATE INDEX IF NOT EXISTS idx_comm_stars_strat ON community_strategy_stars(strategy_id);

-- 15. Community 5Y Benchmark Cache Table
CREATE TABLE IF NOT EXISTS community_benchmark_cache (
    id TEXT PRIMARY KEY,
    strategy_name TEXT NOT NULL,
    version_num INTEGER NOT NULL,
    code_hash TEXT NOT NULL,
    metrics_json TEXT NOT NULL,
    ai_audit_json TEXT NOT NULL,
    verified_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_comm_cache_strat ON community_benchmark_cache(strategy_name, version_num);

-- 16. Community Direct Messages Table
CREATE TABLE IF NOT EXISTS community_direct_messages (
    id TEXT PRIMARY KEY,
    sender_username TEXT NOT NULL,
    receiver_username TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    read_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_comm_msgs_sender ON community_direct_messages(sender_username);
CREATE INDEX IF NOT EXISTS idx_comm_msgs_receiver ON community_direct_messages(receiver_username);
"""

