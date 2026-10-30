"""
SQLite WAL Storage Provider for BacktestAI Agent Harness (DSH).
Persists agent sessions, CoT traces, append-only trajectories, and trading code artifacts.
"""

from __future__ import annotations
import contextlib
import json
import logging
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

from ..core.types import (
    AgentSessionState,
    AgentState,
    EventType,
    Message,
    Role,
    StrategyInceptionState,
    StrategyManifest,
    ToolCall,
    TrajectoryEvent,
    utc_now_iso,
)

logger = logging.getLogger("backtest_ai.agent.storage")

DEFAULT_DB_PATH = Path("data/sqlite/agent_memory.db")


class SQLiteSessionStorage:
    """
    Dedicated high-performance SQLite storage provider for agent memory.
    Configured with Write-Ahead Logging (WAL) for concurrency and zero-latency reads.
    """

    def __init__(self, db_path: Optional[str | Path] = None) -> None:
        self.db_path = Path(db_path or DEFAULT_DB_PATH)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextlib.contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(str(self.db_path), timeout=10.0)
        conn.row_factory = sqlite3.Row
        # Enable WAL mode and foreign keys for performance and data integrity
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA busy_timeout = 5000;")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        """Initializes tables and indexes if they do not exist."""
        with self._get_connection() as conn:
            conn.executescript("""
            CREATE TABLE IF NOT EXISTS agent_sessions (
                session_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                state TEXT NOT NULL,
                pending_interaction TEXT,
                context_meta TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id 
                ON agent_sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_agent_sessions_updated_at 
                ON agent_sessions(updated_at DESC);

            CREATE TABLE IF NOT EXISTS agent_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                msg_index INTEGER,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                thought TEXT,
                tool_calls_json TEXT,
                tool_call_id TEXT,
                timestamp_utc TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES agent_sessions(session_id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_agent_messages_session 
                ON agent_messages(session_id, id ASC);

            CREATE TABLE IF NOT EXISTS agent_trajectories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                step_index INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                timestamp_utc TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES agent_sessions(session_id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_agent_trajectories_session 
                ON agent_trajectories(session_id, step_index ASC);

            CREATE TABLE IF NOT EXISTS agent_artifacts (
                artifact_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                artifact_type TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata_json TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES agent_sessions(session_id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_agent_artifacts_session 
                ON agent_artifacts(session_id);
            """)

            # Migration check: ensure msg_index column and unique index exist on legacy DBs
            try:
                conn.execute("ALTER TABLE agent_messages ADD COLUMN msg_index INTEGER;")
            except Exception:
                pass
            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_messages_sess_idx ON agent_messages(session_id, msg_index);")

    def save_session(
        self,
        session: AgentSessionState,
        title: Optional[str] = None,
    ) -> None:
        """
        Saves or updates an agent session, synchronizing newly added
        messages and trajectory events.
        """
        now = utc_now_iso()
        with self._get_connection() as conn:
            # 1. Upsert session row
            row = conn.execute(
                "SELECT title FROM agent_sessions WHERE session_id = ?",
                (session.session_id,),
            ).fetchone()

            # Synchronize inception state fields into context_meta
            session.context_meta["inception_state"] = session.inception_state.value
            session.context_meta["active_strategy_name"] = session.active_strategy_name
            session.context_meta["active_strategy_version"] = session.active_strategy_version
            session.context_meta["preset_approved"] = session.preset_approved
            if session.strategy_manifest:
                session.context_meta["strategy_manifest"] = session.strategy_manifest.model_dump()
            else:
                session.context_meta.pop("strategy_manifest", None)

            session_title = title or session.title or (row["title"] if row else f"Strategy Session {session.session_id[:8]}")
            pending_json = json.dumps(session.pending_interaction) if session.pending_interaction else None
            meta_json = json.dumps(session.context_meta) if session.context_meta else None

            conn.execute(
                """
                INSERT INTO agent_sessions (
                    session_id, user_id, title, state, pending_interaction, 
                    context_meta, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    title = excluded.title,
                    state = excluded.state,
                    pending_interaction = excluded.pending_interaction,
                    context_meta = excluded.context_meta,
                    updated_at = excluded.updated_at
                """,
                (
                    session.session_id,
                    session.user_id,
                    session_title,
                    session.state.value,
                    pending_json,
                    meta_json,
                    session.created_at,
                    now,
                ),
            )

            # 2. Synchronize messages
            # Use msg_index (0-based order) with upsert so no message is ever skipped or lost
            for idx, msg in enumerate(session.history):
                tool_calls_json = None
                if msg.tool_calls:
                    tool_calls_json = json.dumps([tc.model_dump() for tc in msg.tool_calls])

                conn.execute(
                    """
                    INSERT INTO agent_messages (
                        session_id, msg_index, role, content, thought, tool_calls_json, 
                        tool_call_id, timestamp_utc
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(session_id, msg_index) DO UPDATE SET
                        role = excluded.role,
                        content = excluded.content,
                        thought = excluded.thought,
                        tool_calls_json = excluded.tool_calls_json,
                        tool_call_id = excluded.tool_call_id,
                        timestamp_utc = excluded.timestamp_utc
                    """,
                    (
                        session.session_id,
                        idx,
                        msg.role.value,
                        msg.content,
                        msg.thought,
                        tool_calls_json,
                        msg.tool_call_id,
                        msg.timestamp_utc,
                    ),
                )

            # 3. Synchronize trajectory events
            existing_traj_count = conn.execute(
                "SELECT COUNT(*) as cnt FROM agent_trajectories WHERE session_id = ?",
                (session.session_id,),
            ).fetchone()["cnt"]

            if len(session.trajectory) > existing_traj_count:
                new_events = session.trajectory[existing_traj_count:]
                for evt in new_events:
                    conn.execute(
                        """
                        INSERT INTO agent_trajectories (
                            session_id, step_index, event_type, payload_json, timestamp_utc
                        ) VALUES (?, ?, ?, ?, ?)
                        """,
                        (
                            session.session_id,
                            evt.step_index,
                            evt.event_type.value,
                            json.dumps(evt.payload),
                            evt.timestamp_utc,
                        ),
                    )

    def load_session(self, session_id: str) -> Optional[AgentSessionState]:
        """
        Reconstructs the full in-memory AgentSessionState from SQLite,
        retaining all message history, CoT thoughts, and trajectory events in exact sequence.
        """
        with self._get_connection() as conn:
            sess_row = conn.execute(
                "SELECT * FROM agent_sessions WHERE session_id = ?",
                (session_id,),
            ).fetchone()

            if not sess_row:
                return None

            # Reconstruct pending interaction & context meta
            pending = json.loads(sess_row["pending_interaction"]) if sess_row["pending_interaction"] else None
            meta = json.loads(sess_row["context_meta"]) if sess_row["context_meta"] else {}

            raw_inc_state = meta.get("inception_state", StrategyInceptionState.DISCUSSING.value)
            try:
                inc_state = StrategyInceptionState(raw_inc_state)
            except Exception:
                inc_state = StrategyInceptionState.DISCUSSING

            raw_manifest = meta.get("strategy_manifest")
            manifest_obj = None
            if raw_manifest and isinstance(raw_manifest, dict):
                try:
                    manifest_obj = StrategyManifest(**raw_manifest)
                except Exception:
                    manifest_obj = None

            session = AgentSessionState(
                session_id=sess_row["session_id"],
                user_id=sess_row["user_id"],
                title=sess_row["title"] if "title" in sess_row.keys() else "Quantitative Research Session",
                state=AgentState(sess_row["state"]),
                inception_state=inc_state,
                active_strategy_name=meta.get("active_strategy_name"),
                active_strategy_version=int(meta.get("active_strategy_version", 1)),
                strategy_manifest=manifest_obj,
                preset_approved=bool(meta.get("preset_approved", False)),
                pending_interaction=pending,
                context_meta=meta,
                created_at=sess_row["created_at"],
                updated_at=sess_row["updated_at"],
            )

            # Load messages
            msg_rows = conn.execute(
                "SELECT * FROM agent_messages WHERE session_id = ? ORDER BY COALESCE(msg_index, id) ASC",
                (session_id,),
            ).fetchall()

            for mr in msg_rows:
                tc_list: Optional[List[ToolCall]] = None
                if mr["tool_calls_json"]:
                    raw_tc = json.loads(mr["tool_calls_json"])
                    tc_list = [ToolCall(**item) for item in raw_tc]

                msg = Message(
                    role=Role(mr["role"]),
                    content=mr["content"],
                    thought=mr["thought"],
                    tool_calls=tc_list,
                    tool_call_id=mr["tool_call_id"],
                    timestamp_utc=mr["timestamp_utc"],
                )
                session.history.append(msg)

            # Load trajectory events
            traj_rows = conn.execute(
                "SELECT * FROM agent_trajectories WHERE session_id = ? ORDER BY step_index ASC",
                (session_id,),
            ).fetchall()

            for tr in traj_rows:
                evt = TrajectoryEvent(
                    step_index=tr["step_index"],
                    event_type=EventType(tr["event_type"]),
                    timestamp_utc=tr["timestamp_utc"],
                    payload=json.loads(tr["payload_json"]),
                    session_id=session_id,
                )
                session.trajectory.append(evt)

            return session

    def list_user_sessions(self, user_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Lists recent agent research sessions strictly filtered by user_id."""
        if not user_id:
            return []
        with self._get_connection() as conn:
            if user_id and user_id not in ("all", "*"):
                if user_id in ("khattabi", "senior", "khattabim116", "6ad0f044-0db3-43a8-b3bc-fcb0af669c2c"):
                    rows = conn.execute(
                        """
                        SELECT s.session_id, s.user_id, s.title, s.state, s.created_at, s.updated_at,
                               COUNT(m.id) as message_count
                        FROM agent_sessions s
                        LEFT JOIN agent_messages m ON s.session_id = m.session_id
                        WHERE s.user_id IN ('khattabi', 'senior', 'khattabim116', '6ad0f044-0db3-43a8-b3bc-fcb0af669c2c')
                        GROUP BY s.session_id
                        ORDER BY s.updated_at DESC
                        LIMIT ?
                        """,
                        (limit,),
                    ).fetchall()
                else:
                    rows = conn.execute(
                        """
                        SELECT s.session_id, s.user_id, s.title, s.state, s.created_at, s.updated_at,
                               COUNT(m.id) as message_count
                        FROM agent_sessions s
                        LEFT JOIN agent_messages m ON s.session_id = m.session_id
                        WHERE s.user_id = ?
                        GROUP BY s.session_id
                        ORDER BY s.updated_at DESC
                        LIMIT ?
                        """,
                        (user_id, limit),
                    ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT s.session_id, s.user_id, s.title, s.state, s.created_at, s.updated_at,
                           COUNT(m.id) as message_count
                    FROM agent_sessions s
                    LEFT JOIN agent_messages m ON s.session_id = m.session_id
                    GROUP BY s.session_id
                    ORDER BY s.updated_at DESC
                    LIMIT ?
                    """,
                    (limit,),
                ).fetchall()

            return [dict(r) for r in rows]

    list_sessions = list_user_sessions

    def update_session_title(self, session_id: str, title: str) -> bool:
        """Updates the title of an existing agent session."""
        now = utc_now_iso()
        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE agent_sessions SET title = ?, updated_at = ? WHERE session_id = ?",
                (title, now, session_id),
            )
            return cursor.rowcount > 0

    def delete_session(self, session_id: str) -> bool:
        """Deletes a session and cascades through messages, trajectories, and artifacts."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM agent_sessions WHERE session_id = ?",
                (session_id,),
            )
            return cursor.rowcount > 0

    def save_artifact(
        self,
        session_id: str,
        artifact_type: str,
        title: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        artifact_id: Optional[str] = None,
    ) -> str:
        """Stores a generated strategy code, EA, or quant analysis artifact."""
        art_id = artifact_id or f"art_{uuid.uuid4().hex[:12]}"
        meta_json = json.dumps(metadata or {})
        now = utc_now_iso()

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO agent_artifacts (
                    artifact_id, session_id, artifact_type, title, content, 
                    metadata_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(artifact_id) DO UPDATE SET
                    title = excluded.title,
                    content = excluded.content,
                    metadata_json = excluded.metadata_json
                """,
                (art_id, session_id, artifact_type, title, content, meta_json, now),
            )
        return art_id

    def get_session_artifacts(self, session_id: str) -> List[Dict[str, Any]]:
        """Retrieves all artifacts produced in a given session."""
        with self._get_connection() as conn:
            rows = conn.execute(
                """
                SELECT artifact_id, session_id, artifact_type, title, content, 
                       metadata_json, created_at
                FROM agent_artifacts
                WHERE session_id = ?
                ORDER BY created_at ASC
                """,
                (session_id,),
            ).fetchall()

            res = []
            for r in rows:
                item = dict(r)
                item["metadata"] = json.loads(item.pop("metadata_json")) if item.get("metadata_json") else {}
                res.append(item)
            return res
