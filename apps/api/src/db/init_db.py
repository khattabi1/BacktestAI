"""
Database initialization and seed utility for Backtest AI.
Initializes SQLAlchemy 2.0 tables and seeds initial institutional quant demo user, workspace, and strategies.
"""

import hashlib
import uuid
from pathlib import Path
from typing import Optional

from sqlalchemy import create_engine, select, func, text
from sqlalchemy.orm import Session

from apps.api.src.db.connection import get_db_path, get_database_url
from apps.api.src.db.models import Base, User, Workspace

def hash_password(password: str) -> str:
    """Standard SHA-256 password hash for local SQLite database."""
    salt = "backtest_ai_quant_salt"
    return hashlib.sha256(f"{salt}{password}".encode('utf-8')).hexdigest()

def init_database(db_path: Optional[Path] = None) -> None:
    """
    Initialize database tables via SQLAlchemy 2.0 and seed baseline institutional data.
    """
    if db_path is not None:
        db_url = f"sqlite:///{db_path.as_posix()}"
        connect_args = {"check_same_thread": False}
        sa_engine = create_engine(db_url, connect_args=connect_args)
    else:
        from apps.api.src.db.connection import engine
        sa_engine = engine
    
    # Create all tables defined in models.py
    Base.metadata.create_all(bind=sa_engine)

    # Ensure version_num column exists on backtest_runs (lightweight SQLite migration)
    with sa_engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE backtest_runs ADD COLUMN version_num INTEGER DEFAULT 1;"))
            conn.commit()
        except Exception:
            pass
    
    # Seed baseline records using SQLAlchemy ORM Session
    with Session(sa_engine) as session:
        user_count = session.scalar(select(func.count(User.id))) or 0
        
        if user_count == 0:
            demo_user_id = str(uuid.uuid4())
            admin_user_id = str(uuid.uuid4())
            workspace_id = str(uuid.uuid4())
            
            # 1. Seed Users
            demo_user = User(
                id=demo_user_id,
                email="quant@backtestai.io",
                password_hash=hash_password("quant2026"),
                full_name="Senior Quant Researcher",
                tier="pro",
                role="user",
                is_active=1
            )
            
            admin_user = User(
                id=admin_user_id,
                email="admin@backtestai.io",
                password_hash=hash_password("admin2026!"),
                full_name="Platform Administrator",
                tier="enterprise",
                role="admin",
                is_active=1
            )
            
            # 2. Seed Default Workspace
            workspace = Workspace(
                id=workspace_id,
                user_id=demo_user_id,
                name="Main Alpha Lab",
                slug="main-alpha-lab",
                description="Primary quantitative research and replay workspace.",
                is_default=1
            )

            # 3. Seed Default Built-in Strategies
            from apps.api.src.db.models import Strategy
            import json
            sma_strat = Strategy(
                id="strat_sma_cross",
                user_id=demo_user_id,
                workspace_id=workspace_id,
                name="SMA Crossover Strategy",
                slug="sma-crossover-strategy",
                description="Dual Simple Moving Average trend-following MQL5 Expert Advisor.",
                language="mql5",
                code="//+------------------------------------------------------------------+\n//| SMA Crossover Strategy                                           |\n//+------------------------------------------------------------------+\n#property strict\ninput int fast_period = 10;\ninput int slow_period = 50;\n",
                default_parameters=json.dumps({"fast_period": 10, "slow_period": 50}),
                is_built_in=1
            )
            rsi_strat = Strategy(
                id="strat_rsi_revert",
                user_id=demo_user_id,
                workspace_id=workspace_id,
                name="RSI Mean Reversion",
                slug="rsi-mean-reversion",
                description="Relative Strength Index dynamic mean-reversion MQL5 Expert Advisor.",
                language="mql5",
                code="//+------------------------------------------------------------------+\n//| RSI Mean Reversion Strategy                                      |\n//+------------------------------------------------------------------+\n#property strict\ninput int rsi_period = 14;\ninput double oversold = 30.0;\ninput double overbought = 70.0;\n",
                default_parameters=json.dumps({"period": 14, "overbought": 70, "oversold": 30}),
                is_built_in=1
            )
            
            session.add_all([demo_user, admin_user, workspace, sma_strat, rsi_strat])
            session.commit()

        # Seed initial Community posts if empty
        from apps.api.src.db.models import CommunityPost, CommunityComment
        import json
        comm_count = session.scalar(select(func.count(CommunityPost.id))) or 0
        if comm_count == 0:
            post1 = CommunityPost(
                id="post_1",
                author_username="KarimQuant",
                author_display_name="Karim Al-Husseini",
                author_avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80",
                author_reputation="Lead Quant",
                author_followers_count=320,
                content="Just deployed our verified Gold FVG Scalper v4 to the community! Calibrated on London / New York overlap volatility. The strategy uses pure institutional Fair Value Gap mitigation with strict fixed 25-pip stop loss and zero martingale. Passed the 5-year cloud benchmark with +$18,450 net gain and 6.8% max drawdown. Open source for all quant lab members—feel free to fork and test!",
                chart_image_url="https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=900&q=80",
                strategy_id="strat_1",
                strategy_name="gold_fvg_scalper",
                strategy_version="v4",
                strategy_type="open_source",
                strategy_price=0.0,
                strategy_category="Scalping / SMC",
                strategy_symbols_json=json.dumps(["XAUUSD"]),
                strategy_metrics_json=json.dumps({
                    "netProfit": 18450,
                    "maxDrawdown": 6.8,
                    "winRate": 62.4,
                    "profitFactor": 2.18,
                    "totalTrades": 412,
                    "sharpeRatio": 1.88,
                    "period": "2021-01-01 → 2026-01-01 (5 Years)",
                    "verifiedAt": "2026-10-15T18:00:00Z"
                }),
                strategy_code_snippet="//+------------------------------------------------------------------+\n//| Gold FVG Scalper v4 - Institutional Open Source                 |\n//+------------------------------------------------------------------+\n#property copyright \"Backtest AI Community\"\n#property version   \"4.00\"\n\ninput double InpRiskPercent    = 1.0;     // Risk per trade %\ninput int    InpMinFvgPips     = 15;      // Min FVG threshold (pips)\ninput int    InpFixedSlPips    = 25;      // Fixed Stop Loss (pips)\ninput double InpTrailingAtr    = 1.5;     // ATR Trailing Stop multiplier",
                strategy_stars_average=4.9,
                strategy_stars_count=28,
                strategy_forks_count=45,
                likes_count=34,
                comments_count=6,
                created_at="2026-10-15T18:30:00Z"
            )

            post2 = CommunityPost(
                id="post_2",
                author_username="ElenaV",
                author_display_name="Elena Voronova, CFA",
                author_avatar_url="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&h=120&q=80",
                author_reputation="Prop Fund Manager",
                author_followers_count=512,
                content="Releasing Titan Momentum Engine (v3) as a protected Pro EA license. This algorithm targets structural breakouts during high liquidity windows on EURUSD. Zero grid, zero curve-fitting. Every prospective buyer can test it on our zero-leak cloud sandbox with your own custom out-of-sample dates (3 free runs/day) before buying. Check the verified 5Y metrics below!",
                chart_image_url=None,
                strategy_id="strat_2",
                strategy_name="titan_momentum_engine",
                strategy_version="v3",
                strategy_type="pro_ea",
                strategy_price=149.0,
                strategy_category="Breakout Momentum",
                strategy_symbols_json=json.dumps(["EURUSD", "GBPUSD"]),
                strategy_metrics_json=json.dumps({
                    "netProfit": 24600,
                    "maxDrawdown": 5.2,
                    "winRate": 66.8,
                    "profitFactor": 2.45,
                    "totalTrades": 580,
                    "sharpeRatio": 2.12,
                    "period": "2021-01-01 → 2026-01-01 (5 Years)",
                    "verifiedAt": "2026-10-15T16:30:00Z"
                }),
                strategy_code_snippet=None,
                strategy_stars_average=5.0,
                strategy_stars_count=42,
                strategy_forks_count=0,
                likes_count=89,
                comments_count=14,
                created_at="2026-10-15T16:45:00Z"
            )

            post3 = CommunityPost(
                id="post_3",
                author_username="DavidChen",
                author_display_name="David Chen",
                author_avatar_url="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80",
                author_reputation="Quant Researcher",
                author_followers_count=189,
                content="Quick market dispatch on London Breakout Pro v2: When testing 2022 Fed rate hike cycles, the 8-period EMA volatility filter reduced max drawdown by nearly 40% compared to vanilla breakout models. The strategy is 100% open-source for community inspection.",
                chart_image_url=None,
                strategy_id="strat_3",
                strategy_name="london_breakout_pro",
                strategy_version="v2",
                strategy_type="open_source",
                strategy_price=0.0,
                strategy_category="Trend Following",
                strategy_symbols_json=json.dumps(["GBPUSD"]),
                strategy_metrics_json=json.dumps({
                    "netProfit": 12180,
                    "maxDrawdown": 7.4,
                    "winRate": 58.2,
                    "profitFactor": 1.95,
                    "totalTrades": 360,
                    "sharpeRatio": 1.68,
                    "period": "2021-01-01 → 2026-01-01 (5 Years)",
                    "verifiedAt": "2026-10-15T12:00:00Z"
                }),
                strategy_code_snippet="// London Session High/Low Breakout System v2\n#property version \"2.00\"\ninput int LondonOpenHour = 8; // UTC",
                strategy_stars_average=4.8,
                strategy_stars_count=19,
                strategy_forks_count=31,
                likes_count=22,
                comments_count=3,
                created_at="2026-10-15T13:00:00Z"
            )

            comm1 = CommunityComment(
                id="c1",
                post_id="post_1",
                author_username="AlexQuant",
                author_display_name="Alex Rivera",
                author_avatar_url="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80",
                content="Solid 5-year drawdown profile. How does it handle the FOMC high-spread spikes on Gold?",
                created_at="2026-10-15T19:00:00Z"
            )

            session.add_all([post1, post2, post3, comm1])
            session.commit()

if __name__ == "__main__":
    init_database()
    print("Database initialized successfully at:", get_db_path())

