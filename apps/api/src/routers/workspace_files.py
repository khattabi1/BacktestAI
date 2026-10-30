import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

router = APIRouter(prefix="/workspace", tags=["Workspace Files"])

# Root directory for physical user files in project root data/users/
PROJECT_ROOT = Path(__file__).resolve().parents[4]
USERS_STORAGE_DIR = PROJECT_ROOT / "data" / "users"


class WorkspaceFileItem(BaseModel):
    id: str
    name: str
    language: str
    content: str
    size_bytes: int
    updated_at: str

class CreateFileRequest(BaseModel):
    filename: str
    content: Optional[str] = None

class UpdateFileRequest(BaseModel):
    content: str

class RenameFileRequest(BaseModel):
    new_filename: str

def _sanitize_username(username: str) -> str:
    cleaned = re.sub(r'[^a-zA-Z0-9_\-]', '', username.strip().lower())
    return cleaned or "default"

def _sanitize_filename(filename: str) -> str:
    # Disallow path traversal characters
    base = os.path.basename(filename.strip())
    cleaned = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', base)
    if not cleaned or cleaned.startswith('.'):
        raise HTTPException(status_code=400, detail="Invalid filename format")
    return cleaned

def _get_user_dir(request: Optional[Request] = None, username: Optional[str] = None) -> Path:
    # 1. First priority: Authenticated user from JWT token (UUID)
    safe_user = None
    if request:
        claims = getattr(request.state, "user_claims", None)
        uid = getattr(request.state, "user_id", None) or (claims.get("sub") if claims else None)
        if uid:
            safe_user = str(uid)

    if not safe_user and username:
        # 2. Fallback to username parameter if provided
        safe_user = _sanitize_username(username)

    if not safe_user or safe_user in ("default", "default_user"):
        safe_user = "default"

    user_dir = USERS_STORAGE_DIR / safe_user
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir

def _infer_language(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".mq5") or lower.endswith(".mqh") or lower.endswith(".cpp") or lower.endswith(".h"):
        return "mql5"
    if lower.endswith(".py"):
        return "python"
    if lower.endswith(".json"):
        return "json"
    if lower.endswith(".md"):
        return "markdown"
    if lower.endswith(".html"):
        return "html"
    if lower.endswith(".css"):
        return "css"
    if lower.endswith(".ts") or lower.endswith(".tsx"):
        return "typescript"
    if lower.endswith(".js") or lower.endswith(".jsx"):
        return "javascript"
    return "plaintext"

@router.get("/files", response_model=List[WorkspaceFileItem])
def list_workspace_files(request: Request, username: str = Query("default", description="Workspace username")):
    """List all physical files on disk in the user workspace directory."""
    user_dir = _get_user_dir(request=request, username=username)

    existing_files = [f for f in user_dir.iterdir() if f.is_file() and not f.name.startswith(".")]
    results: List[WorkspaceFileItem] = []
    for f in sorted(existing_files, key=lambda x: x.name):
        try:
            content = f.read_text(encoding="utf-8", errors="replace")
        except Exception:
            content = ""
        stat = f.stat()
        mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
        file_id = f"file_{re.sub(r'[^a-zA-Z0-9_]', '_', f.name)}"
        results.append(
            WorkspaceFileItem(
                id=file_id,
                name=f.name,
                language=_infer_language(f.name),
                content=content,
                size_bytes=stat.st_size,
                updated_at=mtime,
            )
        )
    return results

@router.get("/files/{filename}", response_model=WorkspaceFileItem)
def get_workspace_file(filename: str, request: Request, username: str = Query("default")):
    """Read a specific physical file from disk."""
    user_dir = _get_user_dir(request=request, username=username)
    safe_name = _sanitize_filename(filename)
    file_path = user_dir / safe_name

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail=f"File '{safe_name}' not found")

    content = file_path.read_text(encoding="utf-8", errors="replace")
    stat = file_path.stat()
    mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
    return WorkspaceFileItem(
        id=f"file_{re.sub(r'[^a-zA-Z0-9_]', '_', safe_name)}",
        name=safe_name,
        language=_infer_language(safe_name),
        content=content,
        size_bytes=stat.st_size,
        updated_at=mtime,
    )

@router.post("/files", response_model=WorkspaceFileItem)
def create_workspace_file(body: CreateFileRequest, request: Request, username: str = Query("default")):
    """Create a new physical file on disk."""
    user_dir = _get_user_dir(request=request, username=username)
    safe_name = _sanitize_filename(body.filename)

    # Enforce .mq5 for strategies (drop .py)
    if not Path(safe_name).suffix or safe_name.lower().endswith(".py"):
        safe_name = f"{Path(safe_name).stem}.mq5"

    file_path = user_dir / safe_name

    # Handle duplicate by appending number
    counter = 1
    stem = Path(safe_name).stem
    suffix = Path(safe_name).suffix
    while file_path.exists():
        new_name = f"{stem}_{counter}{suffix}"
        safe_name = new_name
        file_path = user_dir / safe_name
        counter += 1

    content = body.content
    if content is None:
        if safe_name.endswith(".mq5") or safe_name.endswith(".mqh"):
            content = f"""//+------------------------------------------------------------------+
//|                                                     {safe_name} |
//|                                  Copyright 2026, BacktestSI Quant |
//|                                             https://backtestsi.ai |
//+------------------------------------------------------------------+
#property copyright "BacktestSI Quant"
#property link      "https://backtestsi.ai"
#property version   "1.00"
#property strict

//--- input parameters
input double   InpLotSize        = 0.01;      // Lot Size
input int      InpStopLossPips   = 50;        // Stop Loss (pips)
input int      InpTakeProfitPips = 100;       // Take Profit (pips)

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {{
   return(INIT_SUCCEEDED);
  }}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {{
  }}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
  {{
  }}
//+------------------------------------------------------------------+
"""
        elif safe_name.endswith(".json"):
            content = '{\n  "name": "' + safe_name.replace('.json', '') + '"\n}\n'
        else:
            content = ""

    file_path.write_text(content, encoding="utf-8")
    stat = file_path.stat()
    mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
    return WorkspaceFileItem(
        id=f"file_{re.sub(r'[^a-zA-Z0-9_]', '_', safe_name)}",
        name=safe_name,
        language=_infer_language(safe_name),
        content=content,
        size_bytes=stat.st_size,
        updated_at=mtime,
    )

@router.put("/files/{filename}", response_model=WorkspaceFileItem)
def update_workspace_file(filename: str, body: UpdateFileRequest, request: Request, username: str = Query("default")):
    """Update content of a physical file on disk."""
    user_dir = _get_user_dir(request=request, username=username)
    safe_name = _sanitize_filename(filename)
    file_path = user_dir / safe_name

    file_path.write_text(body.content, encoding="utf-8")
    stat = file_path.stat()
    mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
    return WorkspaceFileItem(
        id=f"file_{re.sub(r'[^a-zA-Z0-9_]', '_', safe_name)}",
        name=safe_name,
        language=_infer_language(safe_name),
        content=body.content,
        size_bytes=stat.st_size,
        updated_at=mtime,
    )

@router.patch("/files/{filename}/rename", response_model=WorkspaceFileItem)
def rename_workspace_file(filename: str, body: RenameFileRequest, request: Request, username: str = Query("default")):
    """Rename a physical file on disk."""
    user_dir = _get_user_dir(request=request, username=username)
    old_safe = _sanitize_filename(filename)
    new_safe = _sanitize_filename(body.new_filename)

    # 1. Enforce original file extension: user cannot alter file extension
    old_suffix = Path(old_safe).suffix
    new_suffix = Path(new_safe).suffix
    if old_suffix and new_suffix != old_suffix:
        new_safe = f"{Path(new_safe).stem}{old_suffix}"

    old_path = user_dir / old_safe
    new_path = user_dir / new_safe

    if not old_path.exists():
        raise HTTPException(status_code=404, detail=f"File '{old_safe}' not found")

    # 2. Prevent collision / écrasement: auto-assign unique counter suffix if target exists
    if new_path.exists() and old_path != new_path:
        stem = Path(new_safe).stem
        counter = 1
        while new_path.exists() and old_path != new_path:
            new_safe = f"{stem}_{counter}{old_suffix}"
            new_path = user_dir / new_safe
            counter += 1

    old_path.rename(new_path)
    content = new_path.read_text(encoding="utf-8", errors="replace")
    stat = new_path.stat()
    mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()

    return WorkspaceFileItem(
        id=f"file_{re.sub(r'[^a-zA-Z0-9_]', '_', new_safe)}",
        name=new_safe,
        language=_infer_language(new_safe),
        content=content,
        size_bytes=stat.st_size,
        updated_at=mtime,
    )

@router.delete("/files/{filename}")
def delete_workspace_file(filename: str, request: Request, username: str = Query("default")):
    """
    Soft-delete a physical file by archiving it into the hidden .archive/ directory.
    Prevents accidental data loss and ensures historical strategy results never become orphaned.
    """
    user_dir = _get_user_dir(request=request, username=username)
    safe_name = _sanitize_filename(filename)
    file_path = user_dir / safe_name

    if file_path.exists() and file_path.is_file():
        archive_dir = user_dir / ".archive"
        archive_dir.mkdir(parents=True, exist_ok=True)
        archive_path = archive_dir / safe_name

        # If a prior version exists in archive, disambiguate with timestamp
        if archive_path.exists():
            stem = Path(safe_name).stem
            suffix = Path(safe_name).suffix
            ts = int(datetime.now(timezone.utc).timestamp())
            archive_path = archive_dir / f"{stem}_{ts}{suffix}"

        shutil.move(str(file_path), str(archive_path))
        return {
            "success": True,
            "deleted": safe_name,
            "archived": True,
            "archive_filename": archive_path.name,
        }
    raise HTTPException(status_code=404, detail=f"File '{safe_name}' not found")

@router.post("/files/{filename}/restore", response_model=WorkspaceFileItem)
def restore_workspace_file(filename: str, request: Request, username: str = Query("default")):
    """Restore a soft-deleted file from .archive back to the active workspace."""
    user_dir = _get_user_dir(request=request, username=username)
    safe_name = _sanitize_filename(filename)
    archive_dir = user_dir / ".archive"
    archive_path = archive_dir / safe_name
    target_path = user_dir / safe_name

    if not archive_path.exists() or not archive_path.is_file():
        raise HTTPException(status_code=404, detail=f"Archived file '{safe_name}' not found in archive")

    # Anti-collision: if a new file with same name was created, assign unique counter
    if target_path.exists():
        stem = Path(safe_name).stem
        suffix = Path(safe_name).suffix
        counter = 1
        while target_path.exists():
            safe_name = f"{stem}_{counter}{suffix}"
            target_path = user_dir / safe_name
            counter += 1

    shutil.move(str(archive_path), str(target_path))
    content = target_path.read_text(encoding="utf-8", errors="replace")
    stat = target_path.stat()
    mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()

    return WorkspaceFileItem(
        id=f"file_{re.sub(r'[^a-zA-Z0-9_]', '_', safe_name)}",
        name=safe_name,
        language=_infer_language(safe_name),
        content=content,
        size_bytes=stat.st_size,
        updated_at=mtime,
    )
