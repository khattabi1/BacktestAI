"""
Administrative Telemetry & User Management Router for Backtest-SI.
Provides real-time access to database-backed user records, cluster metrics,
and simulation queue telemetry.
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from apps.api.src.db.repository import db_repo

router = APIRouter(prefix="/admin", tags=["Admin Telemetry"])

class UserStatusUpdateRequest(BaseModel):
    is_active: bool

class AdminUserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    tier: str
    role: str
    is_active: int
    created_at: str
    updated_at: str
    last_login: Optional[str] = None

class AdminStatsResponse(BaseModel):
    total_users: int
    active_users: int
    total_strategies: int
    total_backtest_runs: int
    database_size_mb: float
    cluster_status: str
    active_workers: int

@router.get("/users", response_model=List[AdminUserResponse])
def get_all_users():
    """
    Fetch all registered quant users directly from the SQLite database.
    Eliminates static mock data and provides real database state.
    """
    users = db_repo.list_all_users()
    return users

@router.post("/users/{user_id}/status")
def update_user_status(user_id: str, payload: UserStatusUpdateRequest):
    """
    Toggle a user's active/suspended state in the database.
    """
    user = db_repo.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    success = db_repo.update_user_status(user_id, 1 if payload.is_active else 0)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update user status")
    
    return {
        "status": "success",
        "user_id": user_id,
        "is_active": payload.is_active,
        "message": f"User status updated to {'Active' if payload.is_active else 'Suspended'}"
    }

@router.get("/stats", response_model=AdminStatsResponse)
def get_admin_telemetry_stats():
    """
    Get live cluster and database footprint metrics.
    """
    return db_repo.get_admin_stats()
