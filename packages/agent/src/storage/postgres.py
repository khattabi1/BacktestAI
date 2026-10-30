"""
PostgreSQL Session & Memory Storage Provider for BacktestAI Agent Harness.
100% Pure PostgreSQL storage replacing legacy SQLite memory files.
"""

from __future__ import annotations
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from apps.api.src.db.connection import engine
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

logger = logging.getLogger("backtest_ai.agent.storage.postgres")


class PostgresSessionStorage:
    """
    Enterprise PostgreSQL storage provider for agent memory, chat sessions,
    and trajectories. Replaces legacy SQLite storage.
    """

    def __init__(self) -> None:
        self.engine = engine
        self._ensure_indexes()

    def _ensure_indexes(self) -> None:
        """Ensure necessary indexes exist in PostgreSQL."""
        try:
            with self.engine.begin() as conn:
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_messages_sess_idx "
                        "ON agent_messages(session_id, msg_index);"
                    )
                )
        except Exception as e:
            logger.warning(f"Error ensuring agent_messages index: {e}")

    def save_session(
        self,
        session: AgentSessionState,
        title: Optional[str] = None,
    ) -> None:
        """
        Saves or updates an agent session in PostgreSQL, synchronizing newly added
        messages and trajectory events.
        """
        now = utc_now_iso()
        with self.engine.begin() as conn:
            # 1. Check existing title if not supplied
            row = conn.execute(
                text("SELECT title FROM agent_sessions WHERE id = :id"),
                {"id": session.session_id},
            ).mappings().first()

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

            # Upsert into agent_sessions
            conn.execute(
                text("""
                    INSERT INTO agent_sessions (
                        id, user_id, title, state, pending_interaction, 
                        context_meta, created_at, updated_at
                    ) VALUES (
                        :id, :user_id, :title, :state, :pending_interaction,
                        :context_meta, :created_at, :updated_at
                    )
                    ON CONFLICT(id) DO UPDATE SET
                        title = EXCLUDED.title,
                        state = EXCLUDED.state,
                        pending_interaction = EXCLUDED.pending_interaction,
                        context_meta = EXCLUDED.context_meta,
                        updated_at = EXCLUDED.updated_at
                """),
                {
                    "id": session.session_id,
                    "user_id": session.user_id,
                    "title": session_title,
                    "state": session.state.value,
                    "pending_interaction": pending_json,
                    "context_meta": meta_json,
                    "created_at": session.created_at,
                    "updated_at": now,
                },
            )

            # 2. Synchronize messages
            for idx, msg in enumerate(session.history):
                tool_calls_json = None
                if msg.tool_calls:
                    tool_calls_json = json.dumps([tc.model_dump() for tc in msg.tool_calls])

                conn.execute(
                    text("""
                        INSERT INTO agent_messages (
                            session_id, msg_index, role, content, thought, tool_calls_json, 
                            tool_call_id, timestamp_utc
                        ) VALUES (
                            :session_id, :msg_index, :role, :content, :thought, :tool_calls_json,
                            :tool_call_id, :timestamp_utc
                        )
                        ON CONFLICT(session_id, msg_index) DO UPDATE SET
                            role = EXCLUDED.role,
                            content = EXCLUDED.content,
                            thought = EXCLUDED.thought,
                            tool_calls_json = EXCLUDED.tool_calls_json,
                            tool_call_id = EXCLUDED.tool_call_id,
                            timestamp_utc = EXCLUDED.timestamp_utc
                    """),
                    {
                        "session_id": session.session_id,
                        "msg_index": idx,
                        "role": msg.role.value,
                        "content": msg.content,
                        "thought": msg.thought,
                        "tool_calls_json": tool_calls_json,
                        "tool_call_id": msg.tool_call_id,
                        "timestamp_utc": msg.timestamp_utc,
                    },
                )

            # 3. Synchronize trajectory events
            existing_traj_count = conn.execute(
                text("SELECT COUNT(*) as cnt FROM agent_trajectories WHERE session_id = :session_id"),
                {"session_id": session.session_id},
            ).scalar() or 0

            if len(session.trajectory) > existing_traj_count:
                new_events = session.trajectory[existing_traj_count:]
                for evt in new_events:
                    conn.execute(
                        text("""
                            INSERT INTO agent_trajectories (
                                session_id, step_index, event_type, payload_json, timestamp_utc
                            ) VALUES (
                                :session_id, :step_index, :event_type, :payload_json, :timestamp_utc
                            )
                        """),
                        {
                            "session_id": session.session_id,
                            "step_index": evt.step_index,
                            "event_type": evt.event_type.value,
                            "payload_json": json.dumps(evt.payload),
                            "timestamp_utc": evt.timestamp_utc,
                        },
                    )

    def load_session(self, session_id: str) -> Optional[AgentSessionState]:
        """
        Reconstructs the full in-memory AgentSessionState from PostgreSQL,
        retaining all message history, CoT thoughts, and trajectory events.
        """
        with self.engine.connect() as conn:
            sess_row = conn.execute(
                text("SELECT * FROM agent_sessions WHERE id = :id"),
                {"id": session_id},
            ).mappings().first()

            if not sess_row:
                return None

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
                session_id=sess_row["id"],
                user_id=sess_row["user_id"],
                title=sess_row.get("title") or "Quantitative Research Session",
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
                text("SELECT * FROM agent_messages WHERE session_id = :session_id ORDER BY COALESCE(msg_index, id) ASC"),
                {"session_id": session_id},
            ).mappings().all()

            for mr in msg_rows:
                tc_list: Optional[List[ToolCall]] = None
                if mr.get("tool_calls_json"):
                    raw_tc = json.loads(mr["tool_calls_json"])
                    tc_list = [ToolCall(**item) for item in raw_tc]

                msg = Message(
                    role=Role(mr["role"]),
                    content=mr["content"],
                    thought=mr.get("thought"),
                    tool_calls=tc_list,
                    tool_call_id=mr.get("tool_call_id"),
                    timestamp_utc=mr["timestamp_utc"],
                )
                session.history.append(msg)

            # Load trajectory events
            traj_rows = conn.execute(
                text("SELECT * FROM agent_trajectories WHERE session_id = :session_id ORDER BY step_index ASC"),
                {"session_id": session_id},
            ).mappings().all()

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
        """
        Lists recent agent research sessions strictly filtered by user_id in PostgreSQL.
        Zero hardcoded fallbacks; returns ONLY sessions belonging strictly to user_id.
        """
        if not user_id:
            return []

        with self.engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT s.id as session_id, s.user_id, s.title, s.state, s.created_at, s.updated_at,
                           COUNT(m.id) as message_count
                    FROM agent_sessions s
                    LEFT JOIN agent_messages m ON s.id = m.session_id
                    WHERE s.user_id = :user_id
                    GROUP BY s.id, s.user_id, s.title, s.state, s.created_at, s.updated_at
                    ORDER BY s.updated_at DESC
                    LIMIT :limit
                """),
                {"user_id": user_id, "limit": limit},
            ).mappings().all()

            return [dict(r) for r in rows]

    list_sessions = list_user_sessions

    def update_session_title(self, session_id: str, title: str) -> bool:
        """Updates the title of an existing agent session in PostgreSQL."""
        now = utc_now_iso()
        with self.engine.begin() as conn:
            res = conn.execute(
                text("UPDATE agent_sessions SET title = :title, updated_at = :now WHERE id = :id"),
                {"title": title, "now": now, "id": session_id},
            )
            return res.rowcount > 0

    def delete_session(self, session_id: str) -> bool:
        """Deletes a session from PostgreSQL. Cascades through messages, trajectories, and artifacts."""
        with self.engine.begin() as conn:
            res = conn.execute(
                text("DELETE FROM agent_sessions WHERE id = :id"),
                {"id": session_id},
            )
            return res.rowcount > 0

    def save_artifact(
        self,
        session_id: str,
        artifact_type: str,
        title: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        artifact_id: Optional[str] = None,
    ) -> str:
        """Stores a generated strategy code, EA, or quant analysis artifact in PostgreSQL."""
        art_id = artifact_id or f"art_{uuid.uuid4().hex[:12]}"
        meta_json = json.dumps(metadata or {})
        now = utc_now_iso()

        with self.engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO agent_artifacts (
                        artifact_id, session_id, artifact_type, title, content, 
                        metadata_json, created_at
                    ) VALUES (
                        :art_id, :session_id, :artifact_type, :title, :content,
                        :metadata_json, :now
                    )
                    ON CONFLICT(artifact_id) DO UPDATE SET
                        title = EXCLUDED.title,
                        content = EXCLUDED.content,
                        metadata_json = EXCLUDED.metadata_json
                """),
                {
                    "art_id": art_id,
                    "session_id": session_id,
                    "artifact_type": artifact_type,
                    "title": title,
                    "content": content,
                    "metadata_json": meta_json,
                    "now": now,
                },
            )
        return art_id

    def get_session_artifacts(self, session_id: str) -> List[Dict[str, Any]]:
        """Retrieves all artifacts produced in a given session from PostgreSQL."""
        with self.engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT artifact_id, session_id, artifact_type, title, content, 
                           metadata_json, created_at
                    FROM agent_artifacts
                    WHERE session_id = :session_id
                    ORDER BY created_at ASC
                """),
                {"session_id": session_id},
            ).mappings().all()

            res = []
            for r in rows:
                item = dict(r)
                item["metadata"] = json.loads(item.pop("metadata_json")) if item.get("metadata_json") else {}
                res.append(item)
            return res

