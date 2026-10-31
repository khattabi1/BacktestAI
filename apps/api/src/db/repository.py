"""
Data access repository implementing CRUD operations across users, sessions,
strategies, backtest runs, trades, and research journals.
Unified PostgreSQL production architecture with backward-compatible SQLite fallback.
"""

import json
import uuid
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from pathlib import Path

from apps.api.src.db.connection import get_db_connection, get_db_path, engine, is_postgres
from apps.api.src.db.init_db import hash_password
from sqlalchemy import text


def _row_to_dict(row: Any) -> Dict[str, Any]:
    """Convert SQLAlchemy RowMapping, Row, or sqlite3.Row to a strictly typed Dict[str, Any]."""
    if row is None:
        return {}
    if hasattr(row, "items"):
        return {str(k): v for k, v in row.items()}
    if hasattr(row, "_mapping"):
        return {str(k): v for k, v in row._mapping.items()}
    return {str(k): v for k, v in dict(row).items()}


class DatabaseRepository:
    def __init__(self, db_path: Optional[Path] = None):
        self.explicit_db_path = db_path is not None
        self.db_path = db_path or get_db_path()
        self.use_postgres = is_postgres and not self.explicit_db_path

    # ---------------------------------------------------------
    # 1. Users & Authentication
    # ---------------------------------------------------------
    def create_user(
        self,
        email: str,
        password: str,
        full_name: str,
        tier: str = "researcher",
        role: str = "user"
    ) -> Dict[str, Any]:
        user_id = str(uuid.uuid4())
        pw_hash = hash_password(password)
        clean_email = email.lower().strip()

        if self.use_postgres:
            with engine.begin() as conn:
                conn.execute(
                    text("""
                        INSERT INTO users (id, email, password_hash, full_name, tier, role, is_active, created_at, updated_at)
                        VALUES (:id, :email, :pw_hash, :full_name, :tier, :role, 1, NOW(), NOW())
                    """),
                    {
                        "id": user_id,
                        "email": clean_email,
                        "pw_hash": pw_hash,
                        "full_name": full_name,
                        "tier": tier,
                        "role": role,
                    }
                )
                # Create a default workspace for new user
                ws_id = str(uuid.uuid4())
                conn.execute(
                    text("""
                        INSERT INTO workspaces (id, user_id, name, slug, description, is_default, created_at, updated_at)
                        VALUES (:id, :user_id, 'Personal Lab', 'personal-lab', 'Default quantitative workspace', 1, NOW(), NOW())
                    """),
                    {"id": ws_id, "user_id": user_id}
                )
            user_data = self.get_user_by_id(user_id)
            return user_data or {}

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO users (id, email, password_hash, full_name, tier, role, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now', 'utc'), datetime('now', 'utc'));
                """,
                (user_id, clean_email, pw_hash, full_name, tier, role)
            )
            # Create a default workspace for new user
            ws_id = str(uuid.uuid4())
            cursor.execute(
                """
                INSERT INTO workspaces (id, user_id, name, slug, description, is_default, created_at, updated_at)
                VALUES (?, ?, 'Personal Lab', 'personal-lab', 'Default quantitative workspace', 1, datetime('now', 'utc'), datetime('now', 'utc'));
                """,
                (ws_id, user_id)
            )
            conn.commit()
            user_data = self.get_user_by_id(user_id)
            return user_data or {}

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        clean_email = email.lower().strip()
        if self.use_postgres:
            with engine.connect() as conn:
                row = conn.execute(
                    text("SELECT * FROM users WHERE LOWER(email) = :email"),
                    {"email": clean_email}
                ).mappings().first()
                return _row_to_dict(row) if row else None

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ?;", (clean_email,))
            row = cursor.fetchone()
            return _row_to_dict(row) if row else None

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        if self.use_postgres:
            with engine.connect() as conn:
                row = conn.execute(
                    text("SELECT id, email, full_name, tier, role, is_active, created_at, updated_at FROM users WHERE id = :id"),
                    {"id": user_id}
                ).mappings().first()
                return _row_to_dict(row) if row else None

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, email, full_name, tier, role, is_active, created_at, updated_at FROM users WHERE id = ?;", (user_id,))
            row = cursor.fetchone()
            return _row_to_dict(row) if row else None

    def verify_credentials(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        user = self.get_user_by_email(email)
        if not user or not user["is_active"]:
            return None
        if user["password_hash"] == hash_password(password):
            user_clean = {k: v for k, v in user.items() if k != "password_hash"}
            return user_clean
        return None

    def update_user_password(self, user_id: str, new_password: str) -> bool:
        pw_hash = hash_password(new_password)
        if self.use_postgres:
            with engine.begin() as conn:
                res = conn.execute(
                    text("UPDATE users SET password_hash = :pw_hash, updated_at = NOW() WHERE id = :id"),
                    {"pw_hash": pw_hash, "id": user_id}
                )
                return res.rowcount > 0

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET password_hash = ?, updated_at = datetime('now', 'utc') WHERE id = ?;", (pw_hash, user_id))
            conn.commit()
            return cursor.rowcount > 0

    def list_all_users(self) -> List[Dict[str, Any]]:
        if self.use_postgres:
            with engine.connect() as conn:
                rows = conn.execute(
                    text("""
                        SELECT 
                            u.id, 
                            u.email, 
                            u.full_name, 
                            u.tier, 
                            u.role, 
                            u.is_active, 
                            u.created_at, 
                            u.updated_at,
                            (SELECT s.created_at FROM user_sessions s WHERE s.user_id = u.id ORDER BY s.created_at DESC LIMIT 1) as last_login
                        FROM users u
                        ORDER BY u.created_at DESC
                    """)
                ).mappings().all()
                return [_row_to_dict(r) for r in rows]

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT 
                    u.id, 
                    u.email, 
                    u.full_name, 
                    u.tier, 
                    u.role, 
                    u.is_active, 
                    u.created_at, 
                    u.updated_at,
                    (SELECT s.created_at FROM user_sessions s WHERE s.user_id = u.id ORDER BY s.created_at DESC LIMIT 1) as last_login
                FROM users u
                ORDER BY u.created_at DESC;
                """
            )
            return [_row_to_dict(r) for r in cursor.fetchall()]

    def update_user_status(self, user_id: str, is_active: int) -> bool:
        if self.use_postgres:
            with engine.begin() as conn:
                res = conn.execute(
                    text("UPDATE users SET is_active = :status, updated_at = NOW() WHERE id = :id"),
                    {"status": 1 if is_active else 0, "id": user_id}
                )
                return res.rowcount > 0

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET is_active = ?, updated_at = datetime('now', 'utc') WHERE id = ?;",
                (1 if is_active else 0, user_id)
            )
            conn.commit()
            return cursor.rowcount > 0

    def get_admin_stats(self) -> Dict[str, Any]:
        if self.use_postgres:
            with engine.connect() as conn:
                user_counts = conn.execute(
                    text("SELECT COUNT(*) as total_users, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users FROM users")
                ).mappings().first() or {"total_users": 0, "active_users": 0}
                strat_count = conn.execute(text("SELECT COUNT(*) FROM strategies")).scalar() or 0
                bt_count = conn.execute(text("SELECT COUNT(*) FROM backtest_runs")).scalar() or 0
                sz = conn.execute(text("SELECT pg_database_size(current_database()) / (1024 * 1024.0)")).scalar() or 0.0
                return {
                    "total_users": user_counts.get("total_users", 0),
                    "active_users": user_counts.get("active_users", 0),
                    "total_strategies": strat_count,
                    "total_backtest_runs": bt_count,
                    "database_size_mb": round(float(sz), 2),
                    "cluster_status": "OPTIMAL",
                    "active_workers": 16,
                }

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as total_users, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users FROM users;")
            user_counts = dict(cursor.fetchone() or {"total_users": 0, "active_users": 0})
            
            cursor.execute("SELECT COUNT(*) as total_strategies FROM strategies;")
            strat_count = cursor.fetchone()[0] if cursor.rowcount != 0 else 0
            
            cursor.execute("SELECT COUNT(*) as total_backtests FROM backtest_runs;")
            bt_count = cursor.fetchone()[0] if cursor.rowcount != 0 else 0

            db_size_mb = 0.0
            if self.db_path and self.db_path.exists():
                db_size_mb = round(self.db_path.stat().st_size / (1024 * 1024), 2)

            return {
                "total_users": user_counts.get("total_users", 0),
                "active_users": user_counts.get("active_users", 0),
                "total_strategies": strat_count,
                "total_backtest_runs": bt_count,
                "database_size_mb": db_size_mb,
                "cluster_status": "OPTIMAL",
                "active_workers": 16,
            }

    def list_workspaces(self, user_id: str) -> List[Dict[str, Any]]:
        if self.use_postgres:
            with engine.connect() as conn:
                rows = conn.execute(
                    text("SELECT * FROM workspaces WHERE user_id = :uid ORDER BY is_default DESC, created_at ASC"),
                    {"uid": user_id}
                ).mappings().all()
                return [_row_to_dict(r) for r in rows]

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM workspaces WHERE user_id = ? ORDER BY is_default DESC, created_at ASC;", (user_id,))
            return [_row_to_dict(r) for r in cursor.fetchall()]

    def get_default_workspace(self, user_id: str) -> Optional[Dict[str, Any]]:
        if self.use_postgres:
            with engine.connect() as conn:
                row = conn.execute(
                    text("SELECT * FROM workspaces WHERE user_id = :uid AND is_default = 1 LIMIT 1"),
                    {"uid": user_id}
                ).mappings().first()
                if row:
                    return _row_to_dict(row)
                fallback = conn.execute(
                    text("SELECT * FROM workspaces WHERE user_id = :uid LIMIT 1"),
                    {"uid": user_id}
                ).mappings().first()
                return _row_to_dict(fallback) if fallback else None

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM workspaces WHERE user_id = ? AND is_default = 1 LIMIT 1;", (user_id,))
            row = cursor.fetchone()
            if row:
                return _row_to_dict(row)
            cursor.execute("SELECT * FROM workspaces WHERE user_id = ? LIMIT 1;", (user_id,))
            fallback = cursor.fetchone()
            return _row_to_dict(fallback) if fallback else None

    def create_session(
        self,
        user_id: str,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
        days_valid: int = 30
    ) -> Dict[str, Any]:
        session_id = str(uuid.uuid4())
        token = f"si_sess_{uuid.uuid4().hex}"
        now = datetime.now(timezone.utc)
        expires_at = (now + timedelta(days=days_valid)).isoformat()

        if self.use_postgres:
            with engine.begin() as conn:
                conn.execute(
                    text("""
                        INSERT INTO user_sessions (id, user_id, token, expires_at, user_agent, ip_address, created_at)
                        VALUES (:id, :user_id, :token, :expires_at, :user_agent, :ip_address, NOW())
                    """),
                    {
                        "id": session_id,
                        "user_id": user_id,
                        "token": token,
                        "expires_at": expires_at,
                        "user_agent": user_agent,
                        "ip_address": ip_address,
                    }
                )
            return {
                "id": session_id,
                "user_id": user_id,
                "token": token,
                "expires_at": expires_at
            }
        
        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO user_sessions (id, user_id, token, expires_at, user_agent, ip_address, created_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'utc'));
                """,
                (session_id, user_id, token, expires_at, user_agent, ip_address)
            )
            conn.commit()
            return {
                "id": session_id,
                "user_id": user_id,
                "token": token,
                "expires_at": expires_at
            }

    def get_session(self, token: str) -> Optional[Dict[str, Any]]:
        if self.use_postgres:
            with engine.connect() as conn:
                row = conn.execute(
                    text("""
                        SELECT s.*, u.email, u.full_name, u.tier, u.role
                        FROM user_sessions s
                        JOIN users u ON s.user_id = u.id
                        WHERE s.token = :token AND u.is_active = 1
                    """),
                    {"token": token}
                ).mappings().first()
                if not row:
                    return None
                sess: Dict[str, Any] = _row_to_dict(row)
                expires_at = sess["expires_at"]
                if isinstance(expires_at, str):
                    expires_dt = datetime.fromisoformat(expires_at)
                else:
                    expires_dt = expires_at
                if expires_dt.tzinfo is None:
                    expires_dt = expires_dt.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) > expires_dt:
                    return None
                return sess

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT s.*, u.email, u.full_name, u.tier, u.role
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token = ? AND u.is_active = 1;
                """,
                (token,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            sess_sqlite: Dict[str, Any] = _row_to_dict(row)
            # Check expiration
            expires_at = datetime.fromisoformat(sess_sqlite["expires_at"])
            if datetime.now(timezone.utc) > expires_at:
                return None
            return sess_sqlite

    def delete_session(self, token: str) -> bool:
        if self.use_postgres:
            with engine.begin() as conn:
                res = conn.execute(
                    text("DELETE FROM user_sessions WHERE token = :token"),
                    {"token": token}
                )
                return res.rowcount > 0

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_sessions WHERE token = ?;", (token,))
            conn.commit()
            return cursor.rowcount > 0

    # ---------------------------------------------------------
    # 2. Strategies & Version Control
    # ---------------------------------------------------------
    def list_strategies(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if self.use_postgres:
            with engine.connect() as conn:
                if user_id:
                    rows = conn.execute(
                        text("SELECT * FROM strategies WHERE user_id = :uid OR is_built_in = 1 ORDER BY is_built_in DESC, created_at DESC"),
                        {"uid": user_id}
                    ).mappings().all()
                else:
                    rows = conn.execute(
                        text("SELECT * FROM strategies WHERE is_built_in = 1 ORDER BY is_built_in DESC, created_at DESC")
                    ).mappings().all()
                return [_row_to_dict(r) for r in rows]

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute(
                    "SELECT * FROM strategies WHERE user_id = ? OR is_built_in = 1 ORDER BY is_built_in DESC, created_at DESC;",
                    (user_id,)
                )
            else:
                cursor.execute("SELECT * FROM strategies WHERE is_built_in = 1 ORDER BY is_built_in DESC, created_at DESC;")
            return [_row_to_dict(r) for r in cursor.fetchall()]

    def get_strategy(self, strategy_id: str) -> Optional[Dict[str, Any]]:
        if self.use_postgres:
            with engine.connect() as conn:
                row = conn.execute(
                    text("SELECT * FROM strategies WHERE id = :id"),
                    {"id": strategy_id}
                ).mappings().first()
                return _row_to_dict(row) if row else None

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM strategies WHERE id = ?;", (strategy_id,))
            row = cursor.fetchone()
            return _row_to_dict(row) if row else None

    def get_strategy_by_name(self, name: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        clean_name = name.strip()
        slug = clean_name.lower().replace(" ", "-").replace("_", "-")
        norm_name = clean_name.lower().replace(" ", "").replace("_", "").replace("-", "")

        if self.use_postgres:
            with engine.connect() as conn:
                query = """
                    SELECT * FROM strategies 
                    WHERE id = :name 
                       OR slug = :slug 
                       OR LOWER(name) = :lower_name
                       OR LOWER(REPLACE(REPLACE(name, ' ', ''), '_', '')) = :norm_name
                """
                params = {
                    "name": clean_name,
                    "slug": slug,
                    "lower_name": clean_name.lower(),
                    "norm_name": norm_name,
                }
                if user_id:
                    query += " AND (user_id = :uid OR is_built_in = 1)"
                    params["uid"] = user_id
                query += " ORDER BY is_built_in ASC, updated_at DESC LIMIT 1"

                row = conn.execute(text(query), params).mappings().first()
                return _row_to_dict(row) if row else None

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            query = """
                SELECT * FROM strategies 
                WHERE id = ? 
                   OR slug = ? 
                   OR LOWER(name) = ?
                   OR LOWER(REPLACE(REPLACE(name, ' ', ''), '_', '')) = ?
            """
            params_list = [clean_name, slug, clean_name.lower(), norm_name]
            if user_id:
                query += " AND (user_id = ? OR is_built_in = 1)"
                params_list.append(user_id)
            query += " ORDER BY is_built_in ASC, updated_at DESC LIMIT 1;"

            cursor.execute(query, tuple(params_list))
            row = cursor.fetchone()
            return _row_to_dict(row) if row else None

    def create_strategy(
        self,
        name: str,
        code: str,
        language: str = "python",
        description: str = "",
        user_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        default_parameters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        strat_id = str(uuid.uuid4())
        slug = name.lower().replace(" ", "-")
        params_json = json.dumps(default_parameters or {})

        if self.use_postgres:
            with engine.begin() as conn:
                valid_user_id = None
                if user_id:
                    valid_user_id = conn.execute(
                        text("SELECT id FROM users WHERE id = :uid"), {"uid": user_id}
                    ).scalar()
                if not valid_user_id:
                    valid_user_id = conn.execute(
                        text("SELECT id FROM users ORDER BY created_at ASC LIMIT 1")
                    ).scalar()

                valid_ws_id = None
                if workspace_id:
                    valid_ws_id = conn.execute(
                        text("SELECT id FROM workspaces WHERE id = :wsid"), {"wsid": workspace_id}
                    ).scalar()
                if not valid_ws_id and valid_user_id:
                    valid_ws_id = conn.execute(
                        text("SELECT id FROM workspaces WHERE user_id = :uid ORDER BY is_default DESC LIMIT 1"),
                        {"uid": valid_user_id}
                    ).scalar()

                conn.execute(
                    text("""
                        INSERT INTO strategies (id, user_id, workspace_id, name, slug, description, language, code, default_parameters, is_built_in, created_at, updated_at)
                        VALUES (:id, :uid, :wsid, :name, :slug, :desc, :lang, :code, :params, 0, TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
                    """),
                    {
                        "id": strat_id,
                        "uid": valid_user_id,
                        "wsid": valid_ws_id,
                        "name": name,
                        "slug": slug,
                        "desc": description,
                        "lang": language,
                        "code": code,
                        "params": params_json,
                    }
                )
                conn.execute(
                    text("""
                        INSERT INTO strategy_versions (id, strategy_id, version_num, code, parameters, commit_message, created_at)
                        VALUES (:id, :strat_id, 1, :code, :params, 'Initial commit', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
                    """),
                    {
                        "id": str(uuid.uuid4()),
                        "strat_id": strat_id,
                        "code": code,
                        "params": params_json,
                    }
                )
            created = self.get_strategy(strat_id)
            return created or {}
        
        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            valid_user_id = None
            if user_id:
                cursor.execute("SELECT id FROM users WHERE id = ?;", (user_id,))
                row = cursor.fetchone()
                if row:
                    valid_user_id = row[0]
            if not valid_user_id:
                cursor.execute("SELECT id FROM users ORDER BY created_at ASC LIMIT 1;")
                row = cursor.fetchone()
                if row:
                    valid_user_id = row[0]

            valid_ws_id = None
            if workspace_id:
                cursor.execute("SELECT id FROM workspaces WHERE id = ?;", (workspace_id,))
                row = cursor.fetchone()
                if row:
                    valid_ws_id = row[0]
            if not valid_ws_id and valid_user_id:
                cursor.execute("SELECT id FROM workspaces WHERE user_id = ? ORDER BY is_default DESC LIMIT 1;", (valid_user_id,))
                row = cursor.fetchone()
                if row:
                    valid_ws_id = row[0]

            cursor.execute(
                """
                INSERT INTO strategies (id, user_id, workspace_id, name, slug, description, language, code, default_parameters, is_built_in, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now', 'utc'), datetime('now', 'utc'));
                """,
                (strat_id, valid_user_id, valid_ws_id, name, slug, description, language, code, params_json)
            )
            cursor.execute(
                """
                INSERT INTO strategy_versions (id, strategy_id, version_num, code, parameters, commit_message, created_at)
                VALUES (?, ?, 1, ?, ?, 'Initial commit', datetime('now', 'utc'));
                """,
                (str(uuid.uuid4()), strat_id, code, params_json)
            )
            conn.commit()
            created = self.get_strategy(strat_id)
            return created or {}

    def update_strategy(
        self,
        strategy_id: str,
        name: Optional[str] = None,
        code: Optional[str] = None,
        description: Optional[str] = None,
        default_parameters: Optional[Dict[str, Any]] = None,
        create_version: bool = True,
    ) -> Optional[Dict[str, Any]]:
        existing = self.get_strategy(strategy_id)
        if not existing:
            return None

        new_name = name if name is not None else existing["name"]
        new_code = code if code is not None else existing["code"]
        new_desc = description if description is not None else existing["description"]
        new_params = default_parameters if default_parameters is not None else (
            json.loads(existing.get("default_parameters") or "{}") if isinstance(existing.get("default_parameters"), str) else (existing.get("default_parameters") or {})
        )
        params_json = json.dumps(new_params)

        if self.use_postgres:
            with engine.begin() as conn:
                conn.execute(
                    text("""
                        UPDATE strategies 
                        SET name = :name, description = :desc, code = :code, default_parameters = :params, updated_at = TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                        WHERE id = :id
                    """),
                    {"name": new_name, "desc": new_desc, "code": new_code, "params": params_json, "id": strategy_id}
                )
                if create_version and code is not None and code != existing["code"]:
                    next_version = (conn.execute(
                        text("SELECT COALESCE(MAX(version_num), 0) + 1 FROM strategy_versions WHERE strategy_id = :sid"),
                        {"sid": strategy_id}
                    ).scalar() or 1)
                    conn.execute(
                        text("""
                            INSERT INTO strategy_versions (id, strategy_id, version_num, code, parameters, commit_message, created_at)
                            VALUES (:id, :sid, :ver, :code, :params, 'Agent revision', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
                        """),
                        {"id": str(uuid.uuid4()), "sid": strategy_id, "ver": next_version, "code": new_code, "params": params_json}
                    )
                elif not create_version and code is not None:
                    latest_ver_id = conn.execute(
                        text("SELECT id FROM strategy_versions WHERE strategy_id = :sid ORDER BY version_num DESC LIMIT 1"),
                        {"sid": strategy_id}
                    ).scalar()
                    if latest_ver_id:
                        conn.execute(
                            text("UPDATE strategy_versions SET code = :code, parameters = :params WHERE id = :id"),
                            {"code": new_code, "params": params_json, "id": latest_ver_id}
                        )
            return self.get_strategy(strategy_id)

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE strategies 
                SET name = ?, description = ?, code = ?, default_parameters = ?, updated_at = datetime('now', 'utc')
                WHERE id = ?;
                """,
                (new_name, new_desc, new_code, params_json, strategy_id)
            )
            if create_version and code is not None and code != existing["code"]:
                cursor.execute(
                    "SELECT COALESCE(MAX(version_num), 0) + 1 FROM strategy_versions WHERE strategy_id = ?;",
                    (strategy_id,)
                )
                next_version = cursor.fetchone()[0]
                cursor.execute(
                    """
                    INSERT INTO strategy_versions (id, strategy_id, version_num, code, parameters, commit_message, created_at)
                    VALUES (?, ?, ?, ?, ?, 'Agent revision', datetime('now', 'utc'));
                    """,
                    (str(uuid.uuid4()), strategy_id, next_version, new_code, params_json)
                )
            elif not create_version and code is not None:
                cursor.execute(
                    "SELECT id FROM strategy_versions WHERE strategy_id = ? ORDER BY version_num DESC LIMIT 1;",
                    (strategy_id,)
                )
                latest_ver_row = cursor.fetchone()
                if latest_ver_row:
                    cursor.execute(
                        "UPDATE strategy_versions SET code = ?, parameters = ? WHERE id = ?;",
                        (new_code, params_json, latest_ver_row[0])
                    )
            conn.commit()
            return self.get_strategy(strategy_id)

    def upsert_strategy_with_version(
        self,
        name: str,
        code: str,
        language: str = "python",
        description: str = "",
        user_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        default_parameters: Optional[Dict[str, Any]] = None,
        commit_message: str = "Strategy revision",
        bump_version: bool = False,
        version_num: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Idempotent strategy creation/update with automatic versioning.
        Creates version 1 on initial insert, or appends to strategy_versions if code changes or bump_version is True.
        """
        existing = self.get_strategy_by_name(name, user_id=user_id)
        if not existing:
            strat = self.create_strategy(
                name=name,
                code=code,
                language=language,
                description=description,
                user_id=user_id,
                workspace_id=workspace_id,
                default_parameters=default_parameters,
            )
            strat["current_version"] = version_num or 1
            strat["is_new"] = True
            return strat

        strat_id = existing["id"]
        raw_existing_params = existing.get("default_parameters") or "{}"
        if isinstance(raw_existing_params, str):
            try:
                existing_params_dict = json.loads(raw_existing_params)
            except Exception:
                existing_params_dict = {}
        else:
            existing_params_dict = raw_existing_params or {}

        merged_params = default_parameters if default_parameters is not None else existing_params_dict
        params_json = json.dumps(merged_params)

        if self.use_postgres:
            with engine.begin() as conn:
                conn.execute(
                    text("""
                        UPDATE strategies
                        SET name = :name, description = :desc, code = :code, default_parameters = :params, updated_at = TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                        WHERE id = :id
                    """),
                    {
                        "name": name,
                        "desc": description or existing.get("description", ""),
                        "code": code,
                        "params": params_json,
                        "id": strat_id
                    }
                )

                max_v = conn.execute(
                    text("SELECT COALESCE(MAX(version_num), 0) FROM strategy_versions WHERE strategy_id = :sid"),
                    {"sid": strat_id}
                ).scalar() or 0

                if bump_version or max_v == 0:
                    target_version = (version_num if version_num and version_num > max_v else max_v + 1) if max_v > 0 else (version_num or 1)
                    conn.execute(
                        text("""
                            INSERT INTO strategy_versions (id, strategy_id, version_num, code, parameters, commit_message, created_at)
                            VALUES (:id, :sid, :ver, :code, :params, :msg, TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
                        """),
                        {
                            "id": str(uuid.uuid4()),
                            "sid": strat_id,
                            "ver": target_version,
                            "code": code,
                            "params": params_json,
                            "msg": commit_message or f"Version {target_version}"
                        }
                    )
                else:
                    target_version = version_num if version_num is not None else max_v
                    existing_ver_id = conn.execute(
                        text("SELECT id FROM strategy_versions WHERE strategy_id = :sid AND version_num = :ver"),
                        {"sid": strat_id, "ver": target_version}
                    ).scalar()
                    if existing_ver_id:
                        conn.execute(
                            text("""
                                UPDATE strategy_versions
                                SET code = :code, parameters = :params, commit_message = COALESCE(:msg, commit_message)
                                WHERE id = :id
                            """),
                            {"code": code, "params": params_json, "msg": commit_message, "id": existing_ver_id}
                        )
                    else:
                        conn.execute(
                            text("""
                                INSERT INTO strategy_versions (id, strategy_id, version_num, code, parameters, commit_message, created_at)
                                VALUES (:id, :sid, :ver, :code, :params, :msg, TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
                            """),
                            {
                                "id": str(uuid.uuid4()),
                                "sid": strat_id,
                                "ver": target_version,
                                "code": code,
                                "params": params_json,
                                "msg": commit_message or f"Version {target_version}"
                            }
                        )
            res = self.get_strategy(strat_id)
            if res:
                res["current_version"] = target_version
                res["is_new"] = False
            return res or existing

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE strategies
                SET name = ?, description = ?, code = ?, default_parameters = ?, updated_at = datetime('now', 'utc')
                WHERE id = ?;
                """,
                (name, description or existing.get("description", ""), code, params_json, strat_id)
            )

            cursor.execute(
                "SELECT COALESCE(MAX(version_num), 0) FROM strategy_versions WHERE strategy_id = ?;",
                (strat_id,)
            )
            max_v = cursor.fetchone()[0]

            if bump_version or max_v == 0:
                target_version = (version_num if version_num and version_num > max_v else max_v + 1) if max_v > 0 else (version_num or 1)
                cursor.execute(
                    """
                    INSERT INTO strategy_versions (id, strategy_id, version_num, code, parameters, commit_message, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'utc'));
                    """,
                    (str(uuid.uuid4()), strat_id, target_version, code, params_json, commit_message or f"Version {target_version}")
                )
            else:
                target_version = version_num if version_num is not None else max_v
                cursor.execute(
                    "SELECT id FROM strategy_versions WHERE strategy_id = ? AND version_num = ?;",
                    (strat_id, target_version)
                )
                existing_ver_row = cursor.fetchone()
                if existing_ver_row:
                    cursor.execute(
                        """
                        UPDATE strategy_versions
                        SET code = ?, parameters = ?, commit_message = COALESCE(?, commit_message)
                        WHERE id = ?;
                        """,
                        (code, params_json, commit_message, existing_ver_row[0])
                    )
                else:
                    cursor.execute(
                        """
                        INSERT INTO strategy_versions (id, strategy_id, version_num, code, parameters, commit_message, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'utc'));
                        """,
                        (str(uuid.uuid4()), strat_id, target_version, code, params_json, commit_message or f"Version {target_version}")
                    )

            conn.commit()

        res = self.get_strategy(strat_id)
        if res:
            res["current_version"] = target_version
            res["is_new"] = False
        return res or existing

    def get_strategy_versions(self, strategy_id: str) -> List[Dict[str, Any]]:
        """Retrieve all historical snapshots for a strategy ordered by version descending."""
        if self.use_postgres:
            with engine.connect() as conn:
                rows = conn.execute(
                    text("""
                        SELECT id, strategy_id, version_num, commit_message, created_at,
                               LENGTH(code) as code_length
                        FROM strategy_versions
                        WHERE strategy_id = :sid
                        ORDER BY version_num DESC
                    """),
                    {"sid": strategy_id}
                ).mappings().all()
                return [_row_to_dict(r) for r in rows]

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, strategy_id, version_num, commit_message, created_at,
                       LENGTH(code) as code_length
                FROM strategy_versions
                WHERE strategy_id = ?
                ORDER BY version_num DESC;
                """,
                (strategy_id,)
            )
            return [_row_to_dict(r) for r in cursor.fetchall()]

    def get_strategy_version_code(self, strategy_id: str, version_num: int) -> Optional[Dict[str, Any]]:
        """Retrieve the exact code and parameter snapshot for a specific version."""
        if self.use_postgres:
            with engine.connect() as conn:
                row = conn.execute(
                    text("SELECT * FROM strategy_versions WHERE strategy_id = :sid AND version_num = :ver"),
                    {"sid": strategy_id, "ver": version_num}
                ).mappings().first()
                return _row_to_dict(row) if row else None

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM strategy_versions WHERE strategy_id = ? AND version_num = ?;",
                (strategy_id, version_num)
            )
            row = cursor.fetchone()
            return _row_to_dict(row) if row else None

    def revert_strategy_to_version(self, strategy_id: str, version_num: int) -> Optional[Dict[str, Any]]:
        """Reverts the active strategy code to a previous version without creating a new milestone."""
        ver = self.get_strategy_version_code(strategy_id, version_num)
        if not ver:
            return None
        res = self.update_strategy(
            strategy_id=strategy_id,
            code=ver["code"],
            default_parameters=json.loads(ver.get("parameters") or "{}"),
            create_version=False,
        )
        if res:
            res["version_num"] = version_num
        return res

    def delete_strategy(self, strategy_id: str) -> bool:
        if self.use_postgres:
            with engine.begin() as conn:
                conn.execute(text("DELETE FROM strategy_versions WHERE strategy_id = :sid"), {"sid": strategy_id})
                res = conn.execute(text("DELETE FROM strategies WHERE id = :sid"), {"sid": strategy_id})
                return res.rowcount > 0

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM strategy_versions WHERE strategy_id = ?;", (strategy_id,))
            cursor.execute("DELETE FROM strategies WHERE id = ?;", (strategy_id,))
            conn.commit()
            return cursor.rowcount > 0

    def delete_all_strategies(self, user_id: Optional[str] = None) -> int:
        if self.use_postgres:
            with engine.begin() as conn:
                if user_id:
                    conn.execute(
                        text("DELETE FROM strategy_versions WHERE strategy_id IN (SELECT id FROM strategies WHERE user_id = :uid AND is_built_in = 0)"),
                        {"uid": user_id}
                    )
                    res = conn.execute(
                        text("DELETE FROM strategies WHERE user_id = :uid AND is_built_in = 0"),
                        {"uid": user_id}
                    )
                else:
                    conn.execute(text("DELETE FROM strategy_versions"))
                    res = conn.execute(text("DELETE FROM strategies WHERE is_built_in = 0"))
                return res.rowcount

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute(
                    "DELETE FROM strategy_versions WHERE strategy_id IN (SELECT id FROM strategies WHERE user_id = ? AND is_built_in = 0);"
                )
                cursor.execute("DELETE FROM strategies WHERE user_id = ? AND is_built_in = 0;", (user_id,))
            else:
                cursor.execute("DELETE FROM strategy_versions;")
                cursor.execute("DELETE FROM strategies WHERE is_built_in = 0;")
            count = cursor.rowcount
            conn.commit()
            return count

    # ---------------------------------------------------------
    # 3. Persistent Backtest Runs & Ledgers
    # ---------------------------------------------------------
    def delete_all_backtest_runs(self, user_id: Optional[str] = None) -> int:
        if self.use_postgres:
            with engine.begin() as conn:
                if user_id:
                    conn.execute(
                        text("DELETE FROM trades WHERE backtest_run_id IN (SELECT id FROM backtest_runs WHERE user_id = :uid)"),
                        {"uid": user_id}
                    )
                    res = conn.execute(
                        text("DELETE FROM backtest_runs WHERE user_id = :uid"),
                        {"uid": user_id}
                    )
                    conn.execute(
                        text("DELETE FROM backtest_sessions WHERE user_id = :uid"),
                        {"uid": user_id}
                    )
                    return res.rowcount
                else:
                    return 0

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute("DELETE FROM trades WHERE backtest_run_id IN (SELECT id FROM backtest_runs WHERE user_id = ?);", (user_id,))
                cursor.execute("DELETE FROM backtest_runs WHERE user_id = ?;", (user_id,))
                cursor.execute("DELETE FROM backtest_sessions WHERE user_id = ?;", (user_id,))
                count = cursor.rowcount
            else:
                return 0
            conn.commit()
            return count

    def delete_backtest_run(self, run_id: str, user_id: Optional[str] = None) -> bool:
        if self.use_postgres:
            with engine.begin() as conn:
                if user_id:
                    chk = conn.execute(
                        text("SELECT id FROM backtest_runs WHERE id = :rid AND user_id = :uid"),
                        {"rid": run_id, "uid": user_id}
                    ).scalar()
                    if not chk:
                        return False
                conn.execute(text("DELETE FROM trades WHERE backtest_run_id = :rid"), {"rid": run_id})
                res = conn.execute(text("DELETE FROM backtest_runs WHERE id = :rid"), {"rid": run_id})
                return res.rowcount > 0

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute("SELECT id FROM backtest_runs WHERE id = ? AND user_id = ?;", (run_id, user_id))
                if not cursor.fetchone():
                    return False
            cursor.execute("DELETE FROM trades WHERE backtest_run_id = ?;", (run_id,))
            cursor.execute("DELETE FROM backtest_runs WHERE id = ?;", (run_id,))
            conn.commit()
            return cursor.rowcount > 0

    def save_backtest_run(
        self,
        run_id: str,
        strategy_name: str,
        symbol: str,
        timeframe: str,
        config: Dict[str, Any],
        metrics: Dict[str, Any],
        user_id: Optional[str] = None,
        strategy_id: Optional[str] = None,
        trades: Optional[List[Dict[str, Any]]] = None,
        execution_time_ms: float = 0.0,
        version_num: int = 1,
    ) -> None:
        init_cap = float(config.get("initial_capital", 10000.0))
        final_eq = float(metrics.get("equity", init_cap))
        total_tr = int(metrics.get("total_trades", len(trades or [])))
        run_status = "completed" if total_tr > 0 else "failed"
        win_rate = float(metrics.get("win_rate", 0.0))
        sharpe = float(metrics.get("sharpe_ratio", 0.0))
        sortino = float(metrics.get("sortino_ratio", 0.0))
        max_dd = float(metrics.get("max_drawdown_pct", 0.0))
        prof_fac = float(metrics.get("profit_factor", 0.0))
        eff_version = int(config.get("version_num") or version_num or 1)

        def _clean_sim_date(val: Any) -> Optional[str]:
            if not val:
                return None
            s = str(val).strip().replace(".", "-")
            if "T" in s:
                s = s.split("T")[0]
            elif " " in s:
                s = s.split(" ")[0]
            return s if len(s) >= 4 else None

        sim_start = _clean_sim_date(
            config.get("start_date") or config.get("from_date") or config.get("startDate")
        )
        sim_end = _clean_sim_date(
            config.get("end_date") or config.get("to_date") or config.get("endDate")
        )

        if (not sim_start or not sim_end) and trades:
            valid_trades = [t for t in trades if t.get("entry_time")]
            if valid_trades:
                sorted_tr = sorted(valid_trades, key=lambda x: str(x.get("entry_time", "")))
                if not sim_start and sorted_tr:
                    sim_start = _clean_sim_date(sorted_tr[0].get("entry_time"))
                if not sim_end and sorted_tr:
                    last_t = sorted_tr[-1]
                    sim_end = _clean_sim_date(last_t.get("exit_time") or last_t.get("entry_time"))

        if sim_start:
            config["start_date"] = sim_start
            if not config.get("from_date"):
                config["from_date"] = sim_start
        if sim_end:
            config["end_date"] = sim_end
            if not config.get("to_date"):
                config["to_date"] = sim_end

        if self.use_postgres:
            with engine.begin() as conn:
                valid_user_id = None
                if user_id:
                    valid_user_id = conn.execute(
                        text("SELECT id FROM users WHERE id = :uid"), {"uid": user_id}
                    ).scalar()
                valid_strategy_id = None
                if strategy_id:
                    valid_strategy_id = conn.execute(
                        text("SELECT id FROM strategies WHERE id = :sid"), {"sid": strategy_id}
                    ).scalar()

                conn.execute(
                    text("""
                        INSERT INTO backtest_runs (
                            id, user_id, strategy_id, strategy_name, version_num, symbol, timeframe,
                            start_date, end_date, initial_capital, final_equity, total_trades,
                            win_rate, sharpe_ratio, sortino_ratio, max_drawdown_pct, profit_factor,
                            execution_time_ms, status, config_json, metrics_json, created_at
                        )
                        VALUES (
                            :id, :user_id, :strategy_id, :strategy_name, :version_num, :symbol, :timeframe,
                            :start_date, :end_date, :initial_capital, :final_equity, :total_trades,
                            :win_rate, :sharpe_ratio, :sortino_ratio, :max_drawdown_pct, :profit_factor,
                            :execution_time_ms, :status, :config_json, :metrics_json, TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                        )
                        ON CONFLICT (id) DO UPDATE SET
                            final_equity = EXCLUDED.final_equity,
                            total_trades = EXCLUDED.total_trades,
                            win_rate = EXCLUDED.win_rate,
                            sharpe_ratio = EXCLUDED.sharpe_ratio,
                            sortino_ratio = EXCLUDED.sortino_ratio,
                            max_drawdown_pct = EXCLUDED.max_drawdown_pct,
                            profit_factor = EXCLUDED.profit_factor,
                            execution_time_ms = EXCLUDED.execution_time_ms,
                            status = EXCLUDED.status,
                            config_json = EXCLUDED.config_json,
                            metrics_json = EXCLUDED.metrics_json
                    """),
                    {
                        "id": run_id,
                        "user_id": valid_user_id,
                        "strategy_id": valid_strategy_id,
                        "strategy_name": strategy_name,
                        "version_num": eff_version,
                        "symbol": symbol,
                        "timeframe": timeframe,
                        "start_date": sim_start,
                        "end_date": sim_end,
                        "initial_capital": init_cap,
                        "final_equity": final_eq,
                        "total_trades": total_tr,
                        "win_rate": win_rate,
                        "sharpe_ratio": sharpe,
                        "sortino_ratio": sortino,
                        "max_drawdown_pct": max_dd,
                        "profit_factor": prof_fac,
                        "execution_time_ms": execution_time_ms,
                        "status": run_status,
                        "config_json": json.dumps(config),
                        "metrics_json": json.dumps(metrics),
                    }
                )

                if trades:
                    conn.execute(text("DELETE FROM trades WHERE backtest_run_id = :rid"), {"rid": run_id})
                    for t in trades:
                        side_str = str(t.get("side", "BUY")).upper()
                        pnl_pct_val = t.get("pnl_percent") if t.get("pnl_percent") is not None else t.get("pnl_pct", 0.0)
                        fee_val = t.get("commission") if t.get("commission") is not None else t.get("fee", 0.0)
                        swap_val = float(t.get("swap") or 0.0)
                        sl_val = float(t.get("stop_loss") or t.get("initial_sl") or t.get("sl") or 0.0) or None
                        tp_val = float(t.get("take_profit") or t.get("initial_tp") or t.get("tp") or 0.0) or None

                        conn.execute(
                            text("""
                                INSERT INTO trades (
                                    id, backtest_run_id, trade_id, symbol, side,
                                    entry_time, entry_price, exit_time, exit_price,
                                    quantity, pnl, pnl_pct, fee, swap, stop_loss, take_profit, exit_reason
                                )
                                VALUES (
                                    :id, :backtest_run_id, :trade_id, :symbol, :side,
                                    :entry_time, :entry_price, :exit_time, :exit_price,
                                    :quantity, :pnl, :pnl_pct, :fee, :swap, :stop_loss, :take_profit, :exit_reason
                                )
                            """),
                            {
                                "id": str(uuid.uuid4()),
                                "backtest_run_id": run_id,
                                "trade_id": str(t.get("trade_id", t.get("id", uuid.uuid4().hex[:8]))),
                                "symbol": symbol,
                                "side": side_str,
                                "entry_time": str(t.get("entry_time", "")),
                                "entry_price": float(t.get("entry_price") or 0.0),
                                "exit_time": str(t.get("exit_time", "")),
                                "exit_price": float(t.get("exit_price") or 0.0),
                                "quantity": float(t.get("quantity") or 1.0),
                                "pnl": float(t.get("pnl") or 0.0),
                                "pnl_pct": float(pnl_pct_val or 0.0),
                                "fee": float(fee_val or 0.0),
                                "swap": float(swap_val),
                                "stop_loss": sl_val,
                                "take_profit": tp_val,
                                "exit_reason": str(t.get("exit_reason", "STOP_TARGET")),
                            }
                        )
            return

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            
            valid_user_id = None
            if user_id:
                cursor.execute("SELECT id FROM users WHERE id = ?;", (user_id,))
                r_user = cursor.fetchone()
                if r_user:
                    valid_user_id = r_user[0]

            valid_strategy_id = None
            if strategy_id:
                cursor.execute("SELECT id FROM strategies WHERE id = ?;", (strategy_id,))
                r_strat = cursor.fetchone()
                if r_strat:
                    valid_strategy_id = r_strat[0]

            cursor.execute(
                """
                INSERT OR REPLACE INTO backtest_runs (
                    id, user_id, strategy_id, strategy_name, version_num, symbol, timeframe,
                    start_date, end_date, initial_capital, final_equity, total_trades,
                    win_rate, sharpe_ratio, sortino_ratio, max_drawdown_pct, profit_factor,
                    execution_time_ms, status, config_json, metrics_json, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'utc'));
                """,
                (
                    run_id,
                    valid_user_id,
                    valid_strategy_id,
                    strategy_name,
                    eff_version,
                    symbol,
                    timeframe,
                    sim_start,
                    sim_end,
                    init_cap,
                    final_eq,
                    total_tr,
                    win_rate,
                    sharpe,
                    sortino,
                    max_dd,
                    prof_fac,
                    execution_time_ms,
                    run_status,
                    json.dumps(config),
                    json.dumps(metrics)
                )
            )
            
            if trades:
                for t in trades:
                    side_str = str(t.get("side", "BUY")).upper()
                    pnl_pct_val = t.get("pnl_percent") if t.get("pnl_percent") is not None else t.get("pnl_pct", 0.0)
                    fee_val = t.get("commission") if t.get("commission") is not None else t.get("fee", 0.0)
                    swap_val = float(t.get("swap") or 0.0)
                    sl_val = float(t.get("stop_loss") or t.get("initial_sl") or t.get("sl") or 0.0) or None
                    tp_val = float(t.get("take_profit") or t.get("initial_tp") or t.get("tp") or 0.0) or None
                    try:
                        cursor.execute(
                            """
                            INSERT OR REPLACE INTO trades (
                                id, backtest_run_id, trade_id, symbol, side,
                                entry_time, entry_price, exit_time, exit_price,
                                quantity, pnl, pnl_pct, fee, swap, stop_loss, take_profit, exit_reason
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                            """,
                            (
                                str(uuid.uuid4()),
                                run_id,
                                str(t.get("trade_id", t.get("id", uuid.uuid4().hex[:8]))),
                                symbol,
                                side_str,
                                str(t.get("entry_time", "")),
                                float(t.get("entry_price") or 0.0),
                                str(t.get("exit_time", "")),
                                float(t.get("exit_price") or 0.0),
                                float(t.get("quantity") or 1.0),
                                float(t.get("pnl") or 0.0),
                                float(pnl_pct_val or 0.0),
                                float(fee_val or 0.0),
                                float(swap_val),
                                sl_val,
                                tp_val,
                                str(t.get("exit_reason", "STOP_TARGET"))
                            )
                        )
                    except Exception:
                        cursor.execute(
                            """
                            INSERT OR REPLACE INTO trades (
                                id, backtest_run_id, trade_id, symbol, side,
                                entry_time, entry_price, exit_time, exit_price,
                                quantity, pnl, pnl_pct, fee, exit_reason
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                            """,
                            (
                                str(uuid.uuid4()),
                                run_id,
                                str(t.get("trade_id", t.get("id", uuid.uuid4().hex[:8]))),
                                symbol,
                                side_str,
                                str(t.get("entry_time", "")),
                                float(t.get("entry_price") or 0.0),
                                str(t.get("exit_time", "")),
                                float(t.get("exit_price") or 0.0),
                                float(t.get("quantity") or 1.0),
                                float(t.get("pnl") or 0.0),
                                float(pnl_pct_val or 0.0),
                                float(fee_val or 0.0),
                                str(t.get("exit_reason", "STOP_TARGET"))
                            )
                        )
            conn.commit()

    @staticmethod
    def _normalize_run_dict(d: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure start_date and end_date are populated with authentic simulation dates."""
        cfg = d.get("config") or {}
        trades = d.get("trades") or []

        def _clean(val: Any) -> Optional[str]:
            if not val:
                return None
            s = str(val).strip().replace(".", "-")
            if "T" in s:
                s = s.split("T")[0]
            elif " " in s:
                s = s.split(" ")[0]
            return s if len(s) >= 4 else None

        start_val = _clean(d.get("start_date") or cfg.get("start_date") or cfg.get("from_date") or cfg.get("startDate"))
        end_val = _clean(d.get("end_date") or cfg.get("end_date") or cfg.get("to_date") or cfg.get("endDate"))

        if (not start_val or not end_val) and trades:
            valid_tr = [t for t in trades if t.get("entry_time")]
            if valid_tr:
                if not start_val:
                    start_val = _clean(valid_tr[0].get("entry_time"))
                if not end_val:
                    last_t = valid_tr[-1]
                    end_val = _clean(last_t.get("exit_time") or last_t.get("entry_time"))

        d["start_date"] = start_val
        d["end_date"] = end_val
        if start_val and "start_date" not in cfg:
            cfg["start_date"] = start_val
        if end_val and "end_date" not in cfg:
            cfg["end_date"] = end_val
        return d

    def get_backtest_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        if self.use_postgres:
            with engine.connect() as conn:
                row = conn.execute(
                    text("SELECT * FROM backtest_runs WHERE id = :id"),
                    {"id": run_id}
                ).mappings().first()
                if not row:
                    return None
                run_dict: Dict[str, Any] = _row_to_dict(row)
                run_dict["config"] = json.loads(run_dict.get("config_json") or "{}")
                run_dict["metrics"] = json.loads(run_dict.get("metrics_json") or "{}")
                trades_rows = conn.execute(
                    text("SELECT * FROM trades WHERE backtest_run_id = :id ORDER BY entry_time ASC"),
                    {"id": run_id}
                ).mappings().all()
                run_dict["trades"] = [_row_to_dict(t) for t in trades_rows]
                return self._normalize_run_dict(run_dict)

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM backtest_runs WHERE id = ?;", (run_id,))
            row = cursor.fetchone()
            if not row:
                return None
            run_dict = _row_to_dict(row)
            run_dict["config"] = json.loads(run_dict["config_json"])
            run_dict["metrics"] = json.loads(run_dict["metrics_json"])
            
            cursor.execute("SELECT * FROM trades WHERE backtest_run_id = ? ORDER BY entry_time ASC;", (run_id,))
            run_dict["trades"] = [_row_to_dict(t) for t in cursor.fetchall()]
            return self._normalize_run_dict(run_dict)

    def list_backtest_runs(self, user_id: Optional[str] = None, limit: int = 50, min_trades: int = 0) -> List[Dict[str, Any]]:
        if self.use_postgres:
            with engine.connect() as conn:
                if user_id:
                    if min_trades > 0:
                        rows = conn.execute(
                            text("SELECT * FROM backtest_runs WHERE user_id = :uid AND total_trades >= :min_t ORDER BY created_at DESC LIMIT :lim"),
                            {"uid": user_id, "min_t": min_trades, "lim": limit}
                        ).mappings().all()
                    else:
                        rows = conn.execute(
                            text("SELECT * FROM backtest_runs WHERE user_id = :uid ORDER BY created_at DESC LIMIT :lim"),
                            {"uid": user_id, "lim": limit}
                        ).mappings().all()
                else:
                    return []
                results: List[Dict[str, Any]] = []
                for r in rows:
                    d: Dict[str, Any] = _row_to_dict(r)
                    d["config"] = json.loads(d.get("config_json") or "{}")
                    d["metrics"] = json.loads(d.get("metrics_json") or "{}")
                    results.append(self._normalize_run_dict(d))
                return results

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            if user_id:
                if min_trades > 0:
                    cursor.execute(
                        "SELECT * FROM backtest_runs WHERE user_id = ? AND total_trades >= ? ORDER BY created_at DESC LIMIT ?;",
                        (user_id, min_trades, limit)
                    )
                else:
                    cursor.execute(
                        "SELECT * FROM backtest_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?;",
                        (user_id, limit)
                    )
            else:
                return []
            rows = cursor.fetchall()
            results = []
            for r in rows:
                d = _row_to_dict(r)
                d["config"] = json.loads(d["config_json"])
                d["metrics"] = json.loads(d["metrics_json"])
                results.append(self._normalize_run_dict(d))
            return results

    # ---------------------------------------------------------
    # 4. Replay Studio Persistent Sessions
    # ---------------------------------------------------------
    def save_replay_session(
        self,
        session_id: str,
        name: str,
        symbol: str,
        timeframe: str,
        user_id: Optional[str] = None,
        initial_capital: float = 10000.0,
        current_bar_index: int = 0,
        state_json: Optional[str] = None
    ) -> Dict[str, Any]:
        if self.use_postgres:
            with engine.begin() as conn:
                conn.execute(
                    text("""
                        INSERT INTO backtest_sessions (
                            id, user_id, name, symbol, timeframe, initial_capital, leverage,
                            current_bar_index, status, state_json, created_at, updated_at
                        )
                        VALUES (
                            :id, :user_id, :name, :symbol, :timeframe, :initial_capital, 1.0,
                            :current_bar_index, 'active', :state_json, TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                        )
                        ON CONFLICT (id) DO UPDATE SET
                            name = EXCLUDED.name,
                            current_bar_index = EXCLUDED.current_bar_index,
                            state_json = EXCLUDED.state_json,
                            updated_at = TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                    """),
                    {
                        "id": session_id,
                        "user_id": user_id,
                        "name": name,
                        "symbol": symbol,
                        "timeframe": timeframe,
                        "initial_capital": initial_capital,
                        "current_bar_index": current_bar_index,
                        "state_json": state_json,
                    }
                )
                row = conn.execute(text("SELECT * FROM backtest_sessions WHERE id = :id"), {"id": session_id}).mappings().first()
                return _row_to_dict(row) if row else {}

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO backtest_sessions (
                    id, user_id, name, symbol, timeframe, initial_capital, leverage,
                    current_bar_index, status, state_json, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, 1.0, ?, 'active', ?, datetime('now', 'utc'), datetime('now', 'utc'));
                """,
                (
                    session_id,
                    user_id,
                    name,
                    symbol,
                    timeframe,
                    initial_capital,
                    current_bar_index,
                    state_json
                )
            )
            conn.commit()
            cursor.execute("SELECT * FROM backtest_sessions WHERE id = ?;", (session_id,))
            return _row_to_dict(cursor.fetchone())

    def get_replay_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        if self.use_postgres:
            with engine.connect() as conn:
                row = conn.execute(text("SELECT * FROM backtest_sessions WHERE id = :id"), {"id": session_id}).mappings().first()
                return _row_to_dict(row) if row else None

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM backtest_sessions WHERE id = ?;", (session_id,))
            row = cursor.fetchone()
            return _row_to_dict(row) if row else None

    def list_replay_sessions(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if self.use_postgres:
            with engine.connect() as conn:
                if user_id:
                    rows = conn.execute(
                        text("SELECT * FROM backtest_sessions WHERE user_id = :uid ORDER BY updated_at DESC"),
                        {"uid": user_id}
                    ).mappings().all()
                else:
                    rows = conn.execute(
                        text("SELECT * FROM backtest_sessions ORDER BY updated_at DESC")
                    ).mappings().all()
                return [_row_to_dict(r) for r in rows]

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute("SELECT * FROM backtest_sessions WHERE user_id = ? ORDER BY updated_at DESC;", (user_id,))
            else:
                cursor.execute("SELECT * FROM backtest_sessions ORDER BY updated_at DESC;")
            return [_row_to_dict(r) for r in cursor.fetchall()]

    def delete_replay_session(self, session_id: str) -> bool:
        # 1. Purge in-memory AI Watcher cache
        try:
            from apps.api.src.services.ai_watcher_service import ai_watcher_service
            ai_watcher_service.clear_session(session_id)
        except Exception:
            pass

        # 2. Purge screenshot files from disk (data/uploads/screenshots/{session_id})
        try:
            from apps.api.src.services.screenshot_storage import delete_session_screenshots
            delete_session_screenshots(session_id)
        except Exception:
            pass

        # 3. Cascade delete from PostgreSQL / SQLite
        if self.use_postgres:
            with engine.begin() as conn:
                conn.execute(text("DELETE FROM trades WHERE session_id = :id"), {"id": session_id})
                conn.execute(text("DELETE FROM journal_entries WHERE session_id = :id"), {"id": session_id})
                res = conn.execute(text("DELETE FROM backtest_sessions WHERE id = :id"), {"id": session_id})
                return res.rowcount > 0

        with get_db_connection(self.db_path) as conn:
            self._ensure_trades_schema(conn)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM trades WHERE session_id = ?;", (session_id,))
            cursor.execute("DELETE FROM journal_entries WHERE session_id = ?;", (session_id,))
            cursor.execute("DELETE FROM backtest_sessions WHERE id = ?;", (session_id,))
            conn.commit()
            return cursor.rowcount > 0

    def _ensure_trades_schema(self, conn) -> None:
        cursor = conn.cursor()
        cols = [r[1] for r in cursor.execute("PRAGMA table_info(trades);").fetchall()]
        new_cols = [
            ("screenshot_path", "TEXT"),
            ("trade_card_json", "TEXT"),
        ]
        for col_name, col_type in new_cols:
            if col_name not in cols:
                try:
                    cursor.execute(f"ALTER TABLE trades ADD COLUMN {col_name} {col_type};")
                except Exception:
                    pass
        conn.commit()

    def save_session_trade(self, session_id: str, trade_data: Dict[str, Any]) -> Dict[str, Any]:
        """Saves a single trade with native .webp screenshot on disk and path in PostgreSQL."""
        import json
        tid = trade_data.get("id") or str(uuid.uuid4())
        trade_id = str(trade_data.get("trade_id") or tid)
        symbol = str(trade_data.get("symbol", "XAUUSD"))
        side = str(trade_data.get("side", trade_data.get("direction", "BUY"))).upper()
        entry_time = str(trade_data.get("entry_time") or datetime.now(timezone.utc).isoformat())
        exit_time = str(trade_data.get("exit_time") or datetime.now(timezone.utc).isoformat())
        entry_price = float(trade_data.get("entry_price", 0.0))
        exit_price = float(trade_data.get("exit_price", 0.0))
        quantity = float(trade_data.get("quantity", trade_data.get("lot_size", 1.0)))
        pnl = float(trade_data.get("pnl", 0.0))
        pnl_pct = float(trade_data.get("pnl_pct", trade_data.get("pnl_percent", 0.0)))
        fee = float(trade_data.get("fee", 0.0))
        swap = float(trade_data.get("swap", 0.0))
        stop_loss = float(trade_data["stop_loss"]) if trade_data.get("stop_loss") is not None else None
        take_profit = float(trade_data["take_profit"]) if trade_data.get("take_profit") is not None else None
        exit_reason = str(trade_data.get("exit_reason", "MANUAL"))

        # Save screenshot file to disk: data/uploads/screenshots/{session_id}/{trade_id}.webp
        screenshot_path = trade_data.get("screenshot_path")
        if not screenshot_path:
            b64 = trade_data.get("screenshot_base64") or trade_data.get("canvas_snapshot_base64")
            if b64:
                from apps.api.src.services.screenshot_storage import save_screenshot_file
                screenshot_path = save_screenshot_file(session_id, trade_id, b64)

        card_json = trade_data.get("trade_card_json")
        if not card_json and trade_data.get("trade_card"):
            card_json = json.dumps(trade_data["trade_card"])

        if self.use_postgres:
            with engine.begin() as conn:
                conn.execute(
                    text("""
                        INSERT INTO trades (
                            id, session_id, trade_id, symbol, side,
                            entry_time, entry_price, exit_time, exit_price,
                            quantity, pnl, pnl_pct, fee, swap, stop_loss, take_profit,
                            exit_reason, screenshot_path, trade_card_json
                        )
                        VALUES (
                            :id, :session_id, :trade_id, :symbol, :side,
                            :entry_time, :entry_price, :exit_time, :exit_price,
                            :quantity, :pnl, :pnl_pct, :fee, :swap, :stop_loss, :take_profit,
                            :exit_reason, :screenshot_path, :trade_card_json
                        )
                        ON CONFLICT (id) DO UPDATE SET
                            exit_price = EXCLUDED.exit_price,
                            exit_time = EXCLUDED.exit_time,
                            pnl = EXCLUDED.pnl,
                            screenshot_path = EXCLUDED.screenshot_path,
                            trade_card_json = EXCLUDED.trade_card_json
                    """),
                    {
                        "id": tid, "session_id": session_id, "trade_id": trade_id, "symbol": symbol, "side": side,
                        "entry_time": entry_time, "entry_price": entry_price, "exit_time": exit_time, "exit_price": exit_price,
                        "quantity": quantity, "pnl": pnl, "pnl_pct": pnl_pct, "fee": fee, "swap": swap,
                        "stop_loss": stop_loss, "take_profit": take_profit, "exit_reason": exit_reason,
                        "screenshot_path": screenshot_path, "trade_card_json": card_json,
                    }
                )
                row = conn.execute(text("SELECT * FROM trades WHERE id = :id"), {"id": tid}).mappings().first()
                return _row_to_dict(row) if row else {}

        with get_db_connection(self.db_path) as conn:
            self._ensure_trades_schema(conn)
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO trades (
                    id, session_id, trade_id, symbol, side,
                    entry_time, entry_price, exit_time, exit_price,
                    quantity, pnl, pnl_pct, fee, swap, stop_loss, take_profit,
                    exit_reason, screenshot_path, trade_card_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    tid, session_id, trade_id, symbol, side,
                    entry_time, entry_price, exit_time, exit_price,
                    quantity, pnl, pnl_pct, fee, swap, stop_loss, take_profit,
                    exit_reason, screenshot_path, card_json
                )
            )
            conn.commit()
            cursor.execute("SELECT * FROM trades WHERE id = ?;", (tid,))
            return _row_to_dict(cursor.fetchone())

    def get_session_trades(self, session_id: str) -> List[Dict[str, Any]]:
        """Returns all trades for a session including screenshots and trade cards."""
        if self.use_postgres:
            with engine.connect() as conn:
                rows = conn.execute(text("SELECT * FROM trades WHERE session_id = :sid ORDER BY entry_time ASC"), {"sid": session_id}).mappings().all()
                return [_row_to_dict(r) for r in rows]

        with get_db_connection(self.db_path) as conn:
            self._ensure_trades_schema(conn)
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM trades WHERE session_id = ? ORDER BY entry_time ASC;", (session_id,))
            return [_row_to_dict(r) for r in cursor.fetchall()]

    def get_session_trades(self, session_id: str) -> List[Dict[str, Any]]:
        """Returns all trades for a session including screenshots and trade cards."""
        if self.use_postgres:
            with engine.connect() as conn:
                rows = conn.execute(text("SELECT * FROM trades WHERE session_id = :sid ORDER BY entry_time ASC"), {"sid": session_id}).mappings().all()
                return [_row_to_dict(r) for r in rows]

        with get_db_connection(self.db_path) as conn:
            self._ensure_trades_schema(conn)
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM trades WHERE session_id = ? ORDER BY entry_time ASC;", (session_id,))
            return [_row_to_dict(r) for r in cursor.fetchall()]

    # ---------------------------------------------------------
    # 5. Research Journal Entries Repository
    # ---------------------------------------------------------
    def _ensure_journal_schema(self, conn) -> None:
        cursor = conn.cursor()
        cols = [r[1] for r in cursor.execute("PRAGMA table_info(journal_entries);").fetchall()]
        new_cols = [
            ("symbol", "TEXT"),
            ("timeframe", "TEXT"),
            ("strategy_name", "TEXT"),
            ("status", "TEXT DEFAULT 'TESTING'"),
            ("setup_notes", "TEXT"),
            ("conclusion", "TEXT"),
            ("sharpe_recorded", "REAL"),
            ("win_rate_recorded", "REAL"),
        ]
        for col_name, col_type in new_cols:
            if col_name not in cols:
                try:
                    cursor.execute(f"ALTER TABLE journal_entries ADD COLUMN {col_name} {col_type};")
                except Exception:
                    pass
        conn.commit()

    def _resolve_user_id(self, cursor, user_id: Optional[str] = None) -> str:
        if user_id:
            cursor.execute("SELECT id FROM users WHERE id = ?;", (user_id,))
            row = cursor.fetchone()
            if row:
                return str(row[0])
        cursor.execute("SELECT id FROM users ORDER BY created_at ASC LIMIT 1;")
        row = cursor.fetchone()
        if row:
            return str(row[0])
        default_uid = "usr-system-default"
        cursor.execute(
            """
            INSERT OR IGNORE INTO users (id, email, password_hash, full_name, tier, role, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now', 'utc'), datetime('now', 'utc'));
            """,
            (default_uid, "system@backtestai.io", "dummy", "System User", "pro", "admin")
        )
        return default_uid

    def save_journal_entry(self, entry: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
        entry_id = entry.get("id") or f"JRN-{int(time.time() * 1000) % 100000000:08d}"
        tags_val = entry.get("tags")
        tags_str = json.dumps(tags_val) if isinstance(tags_val, list) else str(tags_val or "[]")

        if self.use_postgres:
            with engine.begin() as conn:
                resolved_uid = user_id or entry.get("user_id")
                if not resolved_uid:
                    resolved_uid = conn.execute(text("SELECT id FROM users ORDER BY created_at ASC LIMIT 1")).scalar() or "usr-system-default"

                sess_id = entry.get("session_id")
                if sess_id:
                    chk_sess = conn.execute(
                        text("SELECT id FROM backtest_sessions WHERE id = :sid"),
                        {"sid": sess_id}
                    ).scalar()
                    if not chk_sess:
                        conn.execute(
                            text("""
                                INSERT INTO backtest_sessions (
                                    id, user_id, name, symbol, timeframe, initial_capital, leverage,
                                    current_bar_index, status, created_at, updated_at
                                )
                                VALUES (
                                    :id, :user_id, :name, :symbol, :timeframe, 10000.0, 100.0,
                                    0, 'active', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                                )
                                ON CONFLICT (id) DO NOTHING
                            """),
                            {
                                "id": sess_id,
                                "user_id": resolved_uid,
                                "name": f"Session {sess_id}",
                                "symbol": entry.get("symbol") or "XAUUSD",
                                "timeframe": entry.get("timeframe") or "1h",
                            }
                        )

                run_id = entry.get("backtest_run_id")
                if run_id:
                    chk_run = conn.execute(
                        text("SELECT id FROM backtest_runs WHERE id = :rid"),
                        {"rid": run_id}
                    ).scalar()
                    if not chk_run:
                        run_id = None

                conn.execute(
                    text("""
                        INSERT INTO journal_entries (
                            id, user_id, session_id, backtest_run_id, title, hypothesis, setup_type,
                            market_conditions, notes, tags, outcome, symbol, timeframe, strategy_name,
                            status, setup_notes, conclusion, sharpe_recorded, win_rate_recorded, created_at, updated_at
                        )
                        VALUES (
                            :id, :user_id, :session_id, :backtest_run_id, :title, :hypothesis, :setup_type,
                            :market_conditions, :notes, :tags, :outcome, :symbol, :timeframe, :strategy_name,
                            :status, :setup_notes, :conclusion, :sharpe_recorded, :win_rate_recorded,
                            TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                        )
                        ON CONFLICT (id) DO UPDATE SET
                            title = EXCLUDED.title,
                            hypothesis = EXCLUDED.hypothesis,
                            setup_type = EXCLUDED.setup_type,
                            market_conditions = EXCLUDED.market_conditions,
                            notes = EXCLUDED.notes,
                            tags = EXCLUDED.tags,
                            outcome = EXCLUDED.outcome,
                            symbol = EXCLUDED.symbol,
                            timeframe = EXCLUDED.timeframe,
                            strategy_name = EXCLUDED.strategy_name,
                            status = EXCLUDED.status,
                            setup_notes = EXCLUDED.setup_notes,
                            conclusion = EXCLUDED.conclusion,
                            sharpe_recorded = EXCLUDED.sharpe_recorded,
                            win_rate_recorded = EXCLUDED.win_rate_recorded,
                            updated_at = TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                    """),
                    {
                        "id": entry_id,
                        "user_id": resolved_uid,
                        "session_id": sess_id,
                        "backtest_run_id": run_id,
                        "title": entry.get("title") or "Untitled Hypothesis",
                        "hypothesis": entry.get("hypothesis"),
                        "setup_type": entry.get("setup_type"),
                        "market_conditions": entry.get("market_conditions"),
                        "notes": entry.get("notes"),
                        "tags": tags_str,
                        "outcome": entry.get("outcome"),
                        "symbol": entry.get("symbol") or "XAUUSD",
                        "timeframe": entry.get("timeframe") or "1h",
                        "strategy_name": entry.get("strategy_name") or "Discretionary Replay",
                        "status": entry.get("status") or "TESTING",
                        "setup_notes": entry.get("setup_notes"),
                        "conclusion": entry.get("conclusion"),
                        "sharpe_recorded": entry.get("sharpe_recorded"),
                        "win_rate_recorded": entry.get("win_rate_recorded"),
                    }
                )
            saved = self.get_journal_entry(entry_id)
            return saved or {}

        with get_db_connection(self.db_path) as conn:
            self._ensure_journal_schema(conn)
            cursor = conn.cursor()
            resolved_uid = self._resolve_user_id(cursor, user_id or entry.get("user_id"))

            sess_id = entry.get("session_id")
            if sess_id:
                cursor.execute("SELECT id FROM backtest_sessions WHERE id = ?;", (sess_id,))
                if not cursor.fetchone():
                    cursor.execute(
                        """
                        INSERT OR IGNORE INTO backtest_sessions (
                            id, user_id, name, symbol, timeframe, initial_capital, leverage,
                            current_bar_index, status, created_at, updated_at
                        )
                        VALUES (?, ?, ?, ?, ?, 10000.0, 100.0, 0, 'active', datetime('now', 'utc'), datetime('now', 'utc'));
                        """,
                        (sess_id, resolved_uid, f"Session {sess_id}", entry.get("symbol") or "XAUUSD", entry.get("timeframe") or "1h")
                    )

            cursor.execute(
                """
                INSERT INTO journal_entries (
                    id, user_id, session_id, backtest_run_id, title, hypothesis, setup_type,
                    market_conditions, notes, tags, outcome, symbol, timeframe, strategy_name,
                    status, setup_notes, conclusion, sharpe_recorded, win_rate_recorded, created_at, updated_at
                )
                VALUES (
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, datetime('now', 'utc'), datetime('now', 'utc')
                )
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    hypothesis = excluded.hypothesis,
                    setup_type = excluded.setup_type,
                    market_conditions = excluded.market_conditions,
                    notes = excluded.notes,
                    tags = excluded.tags,
                    outcome = excluded.outcome,
                    symbol = excluded.symbol,
                    timeframe = excluded.timeframe,
                    strategy_name = excluded.strategy_name,
                    status = excluded.status,
                    setup_notes = excluded.setup_notes,
                    conclusion = excluded.conclusion,
                    sharpe_recorded = excluded.sharpe_recorded,
                    win_rate_recorded = excluded.win_rate_recorded,
                    updated_at = datetime('now', 'utc');
                """,
                (
                    entry_id,
                    resolved_uid,
                    entry.get("session_id"),
                    entry.get("backtest_run_id"),
                    entry.get("title") or "Untitled Hypothesis",
                    entry.get("hypothesis"),
                    entry.get("setup_type"),
                    entry.get("market_conditions"),
                    entry.get("notes"),
                    tags_str,
                    entry.get("outcome"),
                    entry.get("symbol") or "XAUUSD",
                    entry.get("timeframe") or "1h",
                    entry.get("strategy_name") or "Discretionary Replay",
                    entry.get("status") or "TESTING",
                    entry.get("setup_notes"),
                    entry.get("conclusion"),
                    entry.get("sharpe_recorded"),
                    entry.get("win_rate_recorded"),
                )
            )
            conn.commit()
            saved = self.get_journal_entry(entry_id)
            return saved or {}

    def get_journal_entry(self, entry_id: str) -> Optional[Dict[str, Any]]:
        if self.use_postgres:
            with engine.connect() as conn:
                row = conn.execute(text("SELECT * FROM journal_entries WHERE id = :id"), {"id": entry_id}).mappings().first()
                if not row:
                    return None
                d = _row_to_dict(row)
                try:
                    d["tags"] = json.loads(d["tags"]) if d.get("tags") else []
                except Exception:
                    d["tags"] = [t.strip() for t in str(d.get("tags", "")).split(",") if t.strip()]
                return d

        with get_db_connection(self.db_path) as conn:
            self._ensure_journal_schema(conn)
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM journal_entries WHERE id = ?;", (entry_id,))
            row = cursor.fetchone()
            if not row:
                return None
            d = _row_to_dict(row)
            try:
                d["tags"] = json.loads(d["tags"]) if d.get("tags") else []
            except Exception:
                d["tags"] = [t.strip() for t in str(d.get("tags", "")).split(",") if t.strip()]
            return d

    def list_journal_entries(
        self,
        user_id: Optional[str] = None,
        symbol: Optional[str] = None,
        status: Optional[str] = None,
        session_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        if self.use_postgres:
            with engine.connect() as conn:
                query = "SELECT * FROM journal_entries WHERE 1=1"
                pg_params: Dict[str, Any] = {}
                if user_id:
                    query += " AND user_id = :uid"
                    pg_params["uid"] = user_id
                if symbol:
                    query += " AND symbol = :sym"
                    pg_params["sym"] = symbol
                if status and status != "ALL":
                    query += " AND status = :st"
                    pg_params["st"] = status
                if session_id:
                    query += " AND session_id = :sid"
                    pg_params["sid"] = session_id
                query += " ORDER BY created_at DESC LIMIT :lim"
                pg_params["lim"] = limit
                rows = conn.execute(text(query), pg_params).mappings().all()
                results: List[Dict[str, Any]] = []
                for r in rows:
                    d = _row_to_dict(r)
                    try:
                        d["tags"] = json.loads(d["tags"]) if d.get("tags") else []
                    except Exception:
                        d["tags"] = [t.strip() for t in str(d.get("tags", "")).split(",") if t.strip()]
                    results.append(d)
                return results

        with get_db_connection(self.db_path) as conn:
            self._ensure_journal_schema(conn)
            cursor = conn.cursor()
            query = "SELECT * FROM journal_entries WHERE 1=1"
            sql_params: List[Any] = []
            if user_id:
                query += " AND user_id = ?"
                sql_params.append(user_id)
            if symbol:
                query += " AND symbol = ?"
                sql_params.append(symbol)
            if status and status != "ALL":
                query += " AND status = ?"
                sql_params.append(status)
            if session_id:
                query += " AND session_id = ?"
                sql_params.append(session_id)
            query += " ORDER BY created_at DESC LIMIT ?"
            sql_params.append(limit)

            cursor.execute(query, tuple(sql_params))
            results_sql: List[Dict[str, Any]] = []
            for r in cursor.fetchall():
                d = _row_to_dict(r)
                try:
                    d["tags"] = json.loads(d["tags"]) if d.get("tags") else []
                except Exception:
                    d["tags"] = [t.strip() for t in str(d.get("tags", "")).split(",") if t.strip()]
                results_sql.append(d)
            return results_sql

    def delete_journal_entry(self, entry_id: str) -> bool:
        if self.use_postgres:
            with engine.begin() as conn:
                res = conn.execute(text("DELETE FROM journal_entries WHERE id = :id"), {"id": entry_id})
                return res.rowcount > 0

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM journal_entries WHERE id = ?;", (entry_id,))
            conn.commit()
            return cursor.rowcount > 0

    def delete_all_journal_entries(self) -> int:
        if self.use_postgres:
            with engine.begin() as conn:
                res = conn.execute(text("DELETE FROM journal_entries"))
                return res.rowcount

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM journal_entries;")
            conn.commit()
            return cursor.rowcount


# Singleton repository instance
db_repo = DatabaseRepository()
