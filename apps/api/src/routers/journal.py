from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from ..db.repository import db_repo

router = APIRouter(prefix="/journal", tags=["Trading Journal"])

class JournalEntryCreate(BaseModel):
    id: Optional[str] = None
    session_id: Optional[str] = None
    backtest_run_id: Optional[str] = None
    title: str
    symbol: Optional[str] = "XAUUSD"
    timeframe: Optional[str] = "1h"
    strategy_name: Optional[str] = "Discretionary Replay"
    hypothesis: Optional[str] = None
    setup_type: Optional[str] = None
    setup_notes: Optional[str] = None
    market_conditions: Optional[str] = None
    notes: Optional[str] = None
    conclusion: Optional[str] = None
    status: Optional[str] = "TESTING"
    sharpe_recorded: Optional[float] = None
    win_rate_recorded: Optional[float] = None
    tags: Optional[List[str]] = Field(default_factory=list)

class JournalEntryUpdate(BaseModel):
    title: Optional[str] = None
    symbol: Optional[str] = None
    timeframe: Optional[str] = None
    strategy_name: Optional[str] = None
    hypothesis: Optional[str] = None
    setup_type: Optional[str] = None
    setup_notes: Optional[str] = None
    market_conditions: Optional[str] = None
    notes: Optional[str] = None
    conclusion: Optional[str] = None
    status: Optional[str] = None
    sharpe_recorded: Optional[float] = None
    win_rate_recorded: Optional[float] = None
    tags: Optional[List[str]] = None

@router.post("", status_code=status.HTTP_201_CREATED)
def create_journal_entry(entry: JournalEntryCreate):
    """Create or upsert a quantitative research journal entry."""
    data = entry.model_dump()
    saved = db_repo.save_journal_entry(data)
    return saved

@router.get("")
def list_journal_entries(
    symbol: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    session_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """Retrieve filtered research journal entries."""
    return db_repo.list_journal_entries(
        symbol=symbol,
        status=status,
        session_id=session_id,
        limit=limit
    )

@router.get("/{entry_id}")
def get_journal_entry(entry_id: str):
    """Retrieve a single research journal entry by ID."""
    entry = db_repo.get_journal_entry(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Journal entry '{entry_id}' not found")
    return entry

@router.put("/{entry_id}")
def update_journal_entry(entry_id: str, updates: JournalEntryUpdate):
    """Update hypothesis details, empirical metrics, or status of an existing entry."""
    existing = db_repo.get_journal_entry(entry_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Journal entry '{entry_id}' not found")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    merged = {**existing, **update_data}
    saved = db_repo.save_journal_entry(merged)
    return saved

@router.delete("/{entry_id}")
def delete_journal_entry(entry_id: str):
    """Delete a research journal entry."""
    deleted = db_repo.delete_journal_entry(entry_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Journal entry '{entry_id}' not found")
    return {"success": True, "id": entry_id}

@router.delete("")
def delete_all_journal_entries():
    """Clear all journal entries."""
    count = db_repo.delete_all_journal_entries()
    return {"success": True, "deleted_count": count}
