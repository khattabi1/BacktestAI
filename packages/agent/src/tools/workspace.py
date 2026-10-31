"""
Quantitative Workspace File & Code Editing Plugin for BacktestAI Agent Harness (DSH).
Provides direct physical disk file creation, line-level inspection, full/partial editing,
file searching, and sandboxed test execution for files loaded into Monaco Editor.
"""

from __future__ import annotations
import ast
import difflib
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Coroutine, Dict, List, Optional

from packages.agent.src.core.types import StrategyInceptionState, format_strategy_filename, validate_strategy_name

logger = logging.getLogger("backtest_ai.agent.tools.workspace")

# Resolve repository data/users directory
PROJECT_ROOT = Path(__file__).resolve().parents[4]
USERS_STORAGE_DIR = PROJECT_ROOT / "data" / "users"
USERS_STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def _sanitize_username(username: Optional[str]) -> str:
    if not username:
        return "default"
    cleaned = re.sub(r"[^a-zA-Z0-9_\-]", "", username.strip().lower())
    return cleaned or "default"


def _sanitize_filename(filename: str) -> str:
    # Prevent directory traversal attacks
    base = os.path.basename(filename.strip())
    cleaned = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", base)
    if not cleaned or cleaned.startswith("."):
        raise ValueError(f"Invalid filename: '{filename}'. Filenames cannot start with '.' or be empty.")
    return cleaned


def _sanitize_folder_name(folder_name: str) -> str:
    # Prevent directory traversal attacks, allow clean sub-paths within user directory
    cleaned = folder_name.strip().replace("\\", "/").strip("/")
    parts = [p.strip() for p in cleaned.split("/") if p.strip() and p.strip() != "."]
    for p in parts:
        if p == ".." or not re.match(r"^[a-zA-Z0-9_\-]+$", p):
            raise ValueError(f"Invalid folder component: '{p}'. Use alphanumeric characters, dashes, and underscores.")
    if not parts:
        raise ValueError("Folder name cannot be empty.")
    return "/".join(parts)


def _get_user_dir(username: Optional[str] = None) -> Path:
    safe_user = _sanitize_username(username)
    user_dir = USERS_STORAGE_DIR / safe_user
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir


def _resolve_file_path(filename: str, username: Optional[str] = None) -> Path:
    safe_name = _sanitize_filename(filename)
    user_dir = _get_user_dir(username)
    target = user_dir / safe_name
    
    # 1. Direct file in user directory
    if target.exists():
        return target

    # 2. Check immediate strategy subdirectories within user_dir
    try:
        for sub in user_dir.iterdir():
            if sub.is_dir() and (sub / safe_name).is_file():
                return sub / safe_name
    except Exception:
        pass



    return target


def _infer_language(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".py"):
        return "python"
    if lower.endswith(".mq5") or lower.endswith(".cpp") or lower.endswith(".h"):
        return "mql5"
    if lower.endswith(".json"):
        return "json"
    if lower.endswith(".md"):
        return "markdown"
    return "plaintext"


async def list_workspace_files(username: Optional[str] = None) -> Dict[str, Any]:
    """
    Lists all workspace files in the user's project workspace with metadata.
    Traverses both root workspace and strategy-specific subfolders.
    """
    user_dir = _get_user_dir(username)
    files: List[Dict[str, Any]] = []

    # Collect strictly from user directory (no cross-user leaking)
    candidate_dirs = [user_dir]

    seen_names = set()
    for c_dir in candidate_dirs:
        # Collect root files and files within immediate subdirectories
        items_to_scan: List[Path] = []
        try:
            for item in sorted(c_dir.iterdir(), key=lambda x: x.name):
                if item.is_file():
                    items_to_scan.append(item)
                elif item.is_dir():
                    for sub_item in sorted(item.iterdir(), key=lambda x: x.name):
                        if sub_item.is_file():
                            items_to_scan.append(sub_item)
        except Exception:
            pass

        for f in items_to_scan:
            if f.name not in seen_names:
                seen_names.add(f.name)
                stat = f.stat()
                mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
                try:
                    lines_count = sum(1 for _ in f.open("r", encoding="utf-8", errors="ignore"))
                except Exception:
                    lines_count = 0
                files.append({
                    "name": f.name,
                    "language": _infer_language(f.name),
                    "size_bytes": stat.st_size,
                    "line_count": lines_count,
                    "updated_at": mtime,
                    "folder": f.parent.name if f.parent != user_dir else None,
                })

    return {
        "success": True,
        "workspace_directory": str(user_dir),
        "total_files": len(files),
        "files": files,
    }


async def read_file(
    filename: str,
    start_line: Optional[int] = None,
    end_line: Optional[int] = None,
    username: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Reads the contents of a workspace file, optionally slicing specific lines.
    """
    try:
        path = _resolve_file_path(filename, username)
        if not path.exists() or not path.is_file():
            return {
                "success": False,
                "error": f"File '{filename}' does not exist in workspace. Call 'list_workspace_files' to inspect existing files.",
            }

        content = path.read_text(encoding="utf-8", errors="replace")
        lines = content.splitlines()
        total_lines = len(lines)

        if start_line is not None or end_line is not None:
            s = max(1, start_line or 1)
            e = min(total_lines, end_line or total_lines)
            sliced_lines = lines[s - 1:e]
            sliced_content = "\n".join(
                f"{s + idx:4d} | {line}" for idx, line in enumerate(sliced_lines)
            )
            return {
                "success": True,
                "filename": path.name,
                "total_lines": total_lines,
                "range": f"L {s}-{e}",
                "start_line": s,
                "end_line": e,
                "lines_read": len(sliced_lines),
                "content": sliced_content,
            }

        return {
            "success": True,
            "filename": path.name,
            "total_lines": total_lines,
            "content": content,
            "size_bytes": path.stat().st_size,
        }
    except Exception as err:
        logger.exception(f"Error reading file '{filename}': {err}")
        return {"success": False, "error": str(err)}


async def create_file(
    filename: str,
    content: str = "",
    username: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Creates a new physical file in the user's workspace directory.
    """
    try:
        safe_name = _sanitize_filename(filename)
        # Default to .mq5 if no extension is provided
        if not Path(safe_name).suffix:
            safe_name = f"{Path(safe_name).stem}.mq5"

        # STRICT VERSIONING INVARIANT: Disallow creating versioned files like *_v2.mq5 or *_v3.mq5
        stem = Path(safe_name).stem
        if re.search(r'_v\d+$', stem, re.IGNORECASE):
            base_clean = re.sub(r'_v\d+$', '', stem, flags=re.IGNORECASE)
            ext = Path(safe_name).suffix or ".mq5"
            return {
                "success": False,
                "error": (
                    f"REJECTED: Creating separate versioned files like '{safe_name}' in the workspace is strictly prohibited by BacktestAI architecture. "
                    f"Each strategy has exactly one physical working file: '{base_clean}{ext}'. "
                    f"All parameter adjustments, logic enhancements, and compiler error fixes for this strategy MUST be made directly in '{base_clean}{ext}' using 'edit_file'. "
                    f"Do NOT call create_file; call edit_file('{base_clean}{ext}', content=...) instead."
                ),
            }

        user_dir = _get_user_dir(username)
        path = user_dir / safe_name

        if path.exists():
            return {
                "success": False,
                "error": (
                    f"File '{safe_name}' already exists in workspace. "
                    f"CRITICAL: If you are synthesizing a NEW strategy, DO NOT edit or overwrite this existing file! Pick a distinct descriptive name for the new strategy (e.g. '{stem}_scalper.mq5' or '{stem}_ea.mq5'). "
                    f"Only use 'edit_file(\"{safe_name}\", content=...)' if the trader explicitly instructed you to modify '{safe_name}'. "
                    f"NEVER append version suffixes like '_v2' to create separate files."
                ),
            }

        if not content and (safe_name.endswith(".mq5") or safe_name.endswith(".mqh")):
            content = f"""//+------------------------------------------------------------------+
//|                                                     {safe_name} |
//|                                  Copyright 2026, BacktestAI Quant |
//|                                             https://backtestsi.ai |
//+------------------------------------------------------------------+
#property copyright "BacktestAI Quant"
#property link      "https://backtestsi.ai"
#property version   "1.00"
#property strict

//--- input parameters
input double   InpLotSize        = 0.01;      // Lot Size
input int      InpStopLossPips   = 50;        // Stop Loss (pips)
input int      InpTakeProfitPips = 100;       // Take Profit (pips)

int OnInit()
  {{
   return(INIT_SUCCEEDED);
  }}

void OnDeinit(const int reason)
  {{
  }}

void OnTick()
  {{
  }}
//+------------------------------------------------------------------+
"""

        path.write_text(content, encoding="utf-8")
        stat = path.stat()
        lines_count = len(content.splitlines())

        return {
            "success": True,
            "filename": safe_name,
            "path": safe_name,
            "content": content,
            "size_bytes": stat.st_size,
            "lines_count": lines_count,
            "lines_added": lines_count,
            "lines_removed": 0,
            "message": f"Successfully created file '{safe_name}'. It is now ready in the workspace.",
        }
    except Exception as err:
        logger.exception(f"Error creating file '{filename}': {err}")
        return {"success": False, "error": str(err)}


def _sync_strategy_code_and_version(
    filename: str,
    original_code: str,
    updated_code: str,
    username: Optional[str] = None,
) -> Optional[int]:
    """
    Automatically reconciles strategy evolution milestones into dedicated filesystem snapshots
    and SQLite database records whenever code is edited.
    Guarantees that a newly created strategy starts at Version 1 and subsequent versions increment sequentially.
    """
    ext = "mq5" if filename.lower().endswith(".mq5") else ("py" if filename.lower().endswith(".py") else None)
    if not ext:
        return None

    clean_name = filename
    for sfx in (".mq5", ".py", ".ex5", ".json"):
        if clean_name.lower().endswith(sfx):
            clean_name = clean_name[:-len(sfx)]
    clean_name = re.sub(r"_v\d+$", "", clean_name).strip()

    user_dir = _get_user_dir(username)
    strat_folder = user_dir / clean_name
    strat_folder.mkdir(parents=True, exist_ok=True)

    from apps.api.src.db.repository import DatabaseRepository
    repo = DatabaseRepository()
    existing_strat = repo.get_strategy_by_name(clean_name, user_id=username)

    # 1. INITIAL CREATION: If strategy has no database record or original_code was empty, it is ALWAYS Version 1!
    if not existing_strat or not original_code or len(original_code.strip()) <= 30:
        norm_code = re.sub(
            r'(#property\s+version\s+["\'])(\d+(?:\.\d+)?)(["\'])',
            r'\g<1>1.00\g<3>',
            updated_code,
            flags=re.IGNORECASE,
        )
        if norm_code != updated_code:
            try:
                (user_dir / filename).write_text(norm_code, encoding="utf-8")
                updated_code = norm_code
            except Exception:
                pass

        # Archive initial Version 1 snapshot file on disk
        v1_snap = strat_folder / f"{clean_name}_v1.{ext}"
        try:
            v1_snap.write_text(updated_code, encoding="utf-8")
        except Exception:
            pass

        try:
            repo.upsert_strategy_with_version(
                name=clean_name,
                code=updated_code,
                language=_infer_language(filename),
                description=f"Strategy {clean_name} (version 1)",
                user_id=username,
                commit_message="Initial commit",
                version_num=1,
                bump_version=False,
            )
        except Exception as e:
            logger.warning(f"Error creating initial version in repo: {e}")
        return 1

    # 2. EXISTING STRATEGY: Determine highest version recorded
    existing_versions = repo.get_strategy_versions(existing_strat["id"])
    max_v = max([v.get("version_num", 1) for v in existing_versions], default=1)

    m_old = re.search(r'#property\s+version\s+["\'](\d+)(?:\.\d+)?["\']', original_code, re.IGNORECASE)
    if not m_old:
        m_old = re.search(r'(?:__version__|VERSION)\s*=\s*["\'](\d+)(?:\.\d+)?["\']', original_code, re.IGNORECASE)
    old_v = int(m_old.group(1)) if m_old else max_v

    m_new = re.search(r'#property\s+version\s+["\'](\d+)(?:\.\d+)?["\']', updated_code, re.IGNORECASE)
    if not m_new:
        m_new = re.search(r'(?:__version__|VERSION)\s*=\s*["\'](\d+)(?:\.\d+)?["\']', updated_code, re.IGNORECASE)
    new_v = int(m_new.group(1)) if m_new else old_v

    # CRITICAL: ONLY bump if the code explicitly declared a strictly higher version number!
    # Normal edits (syntax corrections, parameter tweaks, partial edits) NEVER bump the version.
    is_bump = (new_v > old_v) and (new_v > max_v)

    if is_bump:
        target_v = max_v + 1  # Strictly consecutive increment: 1 -> 2 -> 3
        norm_code = re.sub(
            r'(#property\s+version\s+["\'])(\d+(?:\.\d+)?)(["\'])',
            rf'\g<1>{target_v}.00\g<3>',
            updated_code,
            flags=re.IGNORECASE,
        )
        if norm_code != updated_code:
            try:
                (user_dir / filename).write_text(norm_code, encoding="utf-8")
                updated_code = norm_code
            except Exception:
                pass

        # Archive previous version snapshot if not already existing
        old_snap = strat_folder / f"{clean_name}_v{max_v}.{ext}"
        if not old_snap.exists() and len(original_code.strip()) > 30:
            try:
                old_snap.write_text(original_code, encoding="utf-8")
            except Exception:
                pass

        # Archive new version snapshot
        new_snap = strat_folder / f"{clean_name}_v{target_v}.{ext}"
        try:
            new_snap.write_text(updated_code, encoding="utf-8")
        except Exception:
            pass

        try:
            repo.upsert_strategy_with_version(
                name=clean_name,
                code=updated_code,
                language=_infer_language(filename),
                description=f"Strategy {clean_name} (version {target_v})",
                user_id=username,
                commit_message=f"Version {target_v} milestone",
                version_num=target_v,
                bump_version=True,
            )
        except Exception as db_err:
            logger.warning(f"Could not dual-write version {target_v} to DB: {db_err}")
        return target_v
    else:
        # Update current version snapshot on disk so it reflects active edits
        curr_snap = strat_folder / f"{clean_name}_v{max_v}.{ext}"
        if curr_snap.exists():
            try:
                curr_snap.write_text(updated_code, encoding="utf-8")
            except Exception:
                pass

        try:
            repo.upsert_strategy_with_version(
                name=clean_name,
                code=updated_code,
                language=_infer_language(filename),
                description=f"Strategy {clean_name} (version {max_v})",
                user_id=username,
                commit_message=f"Version {max_v} (Active)",
                version_num=max_v,
                bump_version=False,
            )
        except Exception as e:
            logger.warning(f"Could not update active version {max_v} in DB: {e}")
        return max_v


async def append_to_file(
    filename: str,
    content: str,
    username: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Appends code or text to an existing workspace file.
    Ideal for incrementally building large strategies chunk-by-chunk.
    Performs real-time syntax checking for Python files.
    """
    try:
        path = _resolve_file_path(filename, username)
        if not path.exists():
            user_dir = _get_user_dir(username)
            safe_name = _sanitize_filename(filename)
            path = user_dir / safe_name
            original = ""
        else:
            original = path.read_text(encoding="utf-8", errors="replace")

        updated = original + ("\n" if original and not original.endswith("\n") else "") + content

        syntax_warnings = []
        if path.suffix.lower() == ".py":
            try:
                ast.parse(updated)
            except SyntaxError as e:
                syntax_warnings.append(f"Python Syntax Warning on line {e.lineno}: {e.msg}")

        path.write_text(updated, encoding="utf-8")
        stat = path.stat()

        diff_lines = list(difflib.unified_diff(
            original.splitlines(),
            updated.splitlines(),
            fromfile=f"a/{path.name}",
            tofile=f"b/{path.name}",
            lineterm="",
        ))
        lines_added = sum(1 for l in diff_lines if l.startswith("+") and not l.startswith("+++"))
        lines_removed = sum(1 for l in diff_lines if l.startswith("-") and not l.startswith("---"))

        detected_v = _sync_strategy_code_and_version(filename, original, updated, username)

        return {
            "success": True,
            "filename": path.name,
            "size_bytes": stat.st_size,
            "lines_count": len(updated.splitlines()),
            "lines_appended": len(content.splitlines()),
            "lines_added": lines_added,
            "lines_removed": lines_removed,
            "original": original,
            "content": updated,
            "version": detected_v,
            "diff": "\n".join(diff_lines[:40]),
            "syntax_warnings": syntax_warnings,
            "message": f"Successfully appended {len(content.splitlines())} lines to '{path.name}'.",
        }
    except Exception as err:
        logger.exception(f"Error appending to file '{filename}': {err}")
        return {"success": False, "error": str(err)}


async def create_folder(
    folder_name: str,
    username: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Creates a new physical directory/folder on disk in the user's workspace.
    """
    try:
        clean_name = _sanitize_folder_name(folder_name)
        user_dir = _get_user_dir(username)
        target = user_dir / clean_name
        is_new = not target.exists()
        target.mkdir(parents=True, exist_ok=True)
        return {
            "success": True,
            "folder_name": clean_name,
            "path": str(target),
            "created": is_new,
            "message": f"Folder '{clean_name}' is ready in the workspace.",
        }
    except Exception as err:
        logger.exception(f"Error creating folder '{folder_name}': {err}")
        return {"success": False, "error": str(err)}


async def edit_file(
    filename: str,
    content: str,
    username: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Overwrites the full content of an existing workspace file.
    Performs real-time syntax checking for Python files.
    """
    try:
        path = _resolve_file_path(filename, username)
        if not path.exists():
            # Create if doesn't exist
            user_dir = _get_user_dir(username)
            safe_name = _sanitize_filename(filename)
            path = user_dir / safe_name

        # Validate python syntax if saving python code
        syntax_warnings = []
        if path.suffix.lower() == ".py":
            try:
                ast.parse(content)
            except SyntaxError as e:
                syntax_warnings.append(f"Python Syntax Warning on line {e.lineno}: {e.msg}")

        original = path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""
        path.write_text(content, encoding="utf-8")
        stat = path.stat()

        diff_lines = list(difflib.unified_diff(
            original.splitlines(),
            content.splitlines(),
            fromfile=f"a/{path.name}",
            tofile=f"b/{path.name}",
            lineterm="",
        ))
        lines_added = sum(1 for l in diff_lines if l.startswith("+") and not l.startswith("+++"))
        lines_removed = sum(1 for l in diff_lines if l.startswith("-") and not l.startswith("---"))

        detected_v = _sync_strategy_code_and_version(filename, original, content, username)

        return {
            "success": True,
            "filename": path.name,
            "size_bytes": stat.st_size,
            "lines_count": len(content.splitlines()),
            "lines_added": lines_added,
            "lines_removed": lines_removed,
            "original": original,
            "content": content,
            "version": detected_v,
            "diff": "\n".join(diff_lines[:40]),
            "syntax_warnings": syntax_warnings,
            "message": f"Successfully updated '{path.name}'.",
        }
    except Exception as err:
        logger.exception(f"Error editing file '{filename}': {err}")
        return {"success": False, "error": str(err)}


async def edit_file_partially(
    filename: str,
    target_content: str,
    replacement_content: str,
    username: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Performs a surgical find-and-replace of an exact target content block
    within an existing workspace file, preserving surrounding code.
    """
    try:
        path = _resolve_file_path(filename, username)
        if not path.exists() or not path.is_file():
            return {"success": False, "error": f"File '{filename}' not found in workspace."}

        original = path.read_text(encoding="utf-8", errors="replace")

        # Normalize line endings
        norm_orig = original.replace("\r\n", "\n")
        norm_target = target_content.replace("\r\n", "\n")
        norm_replacement = replacement_content.replace("\r\n", "\n")

        count = norm_orig.count(norm_target)
        if count == 0:
            # Attempt trimmed line match fallback
            stripped_target = norm_target.strip()
            if stripped_target and stripped_target in norm_orig:
                norm_target = stripped_target
                count = norm_orig.count(norm_target)
            else:
                return {
                    "success": False,
                    "error": f"Target content not found in '{path.name}'. Verify exact indentation and lines with 'read_file'.",
                }

        if count > 1:
            return {
                "success": False,
                "error": f"Target content occurs {count} times in '{path.name}'. Provide more surrounding context lines to disambiguate.",
            }

        updated = norm_orig.replace(norm_target, norm_replacement, 1)

        # Syntax check for Python
        syntax_warnings = []
        if path.suffix.lower() == ".py":
            try:
                ast.parse(updated)
            except SyntaxError as e:
                syntax_warnings.append(f"Python Syntax Warning on line {e.lineno}: {e.msg}")

        path.write_text(updated, encoding="utf-8")

        # Generate a concise unified diff
        diff_lines = list(difflib.unified_diff(
            norm_orig.splitlines(),
            updated.splitlines(),
            fromfile=f"a/{path.name}",
            tofile=f"b/{path.name}",
            lineterm="",
        ))
        lines_added = sum(1 for l in diff_lines if l.startswith("+") and not l.startswith("+++"))
        lines_removed = sum(1 for l in diff_lines if l.startswith("-") and not l.startswith("---"))

        detected_v = _sync_strategy_code_and_version(filename, norm_orig, updated, username)

        return {
            "success": True,
            "filename": path.name,
            "original": norm_orig,
            "content": updated,
            "version": detected_v,
            "lines_changed": len([l for l in diff_lines if l.startswith("+") or l.startswith("-")]),
            "lines_added": lines_added,
            "lines_removed": lines_removed,
            "diff": "\n".join(diff_lines[:40]),
            "syntax_warnings": syntax_warnings,
            "message": f"Successfully applied partial edit to '{path.name}'.",
        }
    except Exception as err:
        logger.exception(f"Error partially editing file '{filename}': {err}")
        return {"success": False, "error": str(err)}


async def delete_file(
    filename: str,
    username: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Deletes a file from the user's workspace directory.
    """
    try:
        path = _resolve_file_path(filename, username)
        if not path.exists() or not path.is_file():
            return {"success": False, "error": f"File '{filename}' does not exist."}

        path.unlink()
        return {"success": True, "filename": filename, "message": f"File '{filename}' deleted."}
    except Exception as err:
        logger.exception(f"Error deleting file '{filename}': {err}")
        return {"success": False, "error": str(err)}


async def search_in_files(
    query: str,
    username: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Searches across all workspace files for matching keywords or functions.
    """
    try:
        user_dir = _get_user_dir(username)
        matches: List[Dict[str, Any]] = []

        files_to_check = [f for f in user_dir.glob("*") if f.is_file()]

        q_lower = query.lower()
        for f in files_to_check:
            try:
                content = f.read_text(encoding="utf-8", errors="ignore")
                for line_idx, line in enumerate(content.splitlines(), start=1):
                    if q_lower in line.lower():
                        matches.append({
                            "filename": f.name,
                            "line_number": line_idx,
                            "line_content": line.strip()[:140],
                        })
            except Exception:
                continue

        return {
            "success": True,
            "query": query,
            "matches_count": len(matches),
            "matches": matches[:25],
        }
    except Exception as err:
        logger.exception(f"Error searching files for '{query}': {err}")
        return {"success": False, "error": str(err)}


def register_workspace_tools(harness: Any, user_id: Optional[str] = None) -> None:
    """
    Registers the 8 physical workspace file and code editing tools into an AgentHarness.
    """
    async def _bound_list(username: Optional[str] = None) -> dict:
        return await list_workspace_files(username or user_id)

    harness.register_tool(
        name="list_workspace_files",
        description="Lists all files currently in the active user workspace / Monaco Editor file tree, with sizes and languages.",
        parameters={
            "type": "object",
            "properties": {
                "username": {"type": "string", "description": "Optional user handle override."},
            },
            "required": [],
        },
        handler=_bound_list,
    )

    async def _bound_read(filename: str, start_line: Optional[int] = None, end_line: Optional[int] = None, username: Optional[str] = None) -> dict:
        return await read_file(filename, start_line, end_line, username or user_id)

    harness.register_tool(
        name="read_file",
        description="Reads full content or specific line ranges (start_line to end_line) of an existing workspace file.",
        parameters={
            "type": "object",
            "properties": {
                "filename": {"type": "string", "description": "Target filename (e.g. 'strategy.py', 'params.json')."},
                "start_line": {"type": "integer", "description": "1-indexed starting line to read."},
                "end_line": {"type": "integer", "description": "1-indexed ending line to read."},
            },
            "required": ["filename"],
        },
        handler=_bound_read,
    )

    async def _bound_create(filename: str, content: str = "", username: Optional[str] = None, **kwargs) -> dict:
        initial_content = content or kwargs.get("content", "")
        res = await create_file(filename, initial_content, username or user_id)
        if res.get("success") and hasattr(harness, "set_inception_state"):
            if filename.endswith(".py") and hasattr(harness, "session") and harness.session:
                curr_state = getattr(harness.session, "inception_state", None)
                if curr_state in (StrategyInceptionState.PRESET_REVIEW, StrategyInceptionState.CODE_PROPOSED):
                    clean_name = filename[:-3]
                    harness.set_inception_state(
                        StrategyInceptionState.READY_FOR_TEST,
                        strategy_name=clean_name,
                    )
        return res

    harness.register_tool(
        name="create_file",
        description="Creates a new empty physical file on disk in the user workspace (e.g. 'gold_smc_scalper.py'). STEP 1 of strategy synthesis: ALWAYS call create_file with ONLY filename to initialize the empty file first. Then call edit_file (or append_to_file) as STEP 2 to populate the strategy logic. Creating the file and writing code are two distinct steps.",
        parameters={
            "type": "object",
            "properties": {
                "filename": {"type": "string", "description": "Name of the file to create (e.g. 'gold_smc_scalper.py'). Strictly unversioned."},
            },
            "required": ["filename"],
        },
        handler=_bound_create,
    )

    async def _bound_append(filename: str, content: str, username: Optional[str] = None) -> dict:
        return await append_to_file(filename, content, username or user_id)

    harness.register_tool(
        name="append_to_file",
        description="Appends code chunks to an existing workspace file. Use this to construct large strategies incrementally in sections (e.g. imports, parameters, indicators, on_bar execution, risk management).",
        parameters={
            "type": "object",
            "properties": {
                "filename": {"type": "string", "description": "Target workspace file to append to."},
                "content": {"type": "string", "description": "Code chunk to append to the file."},
            },
            "required": ["filename", "content"],
        },
        handler=_bound_append,
    )

    async def _bound_create_folder(folder_name: str, username: Optional[str] = None) -> dict:
        return await create_folder(folder_name, username or user_id)

    harness.register_tool(
        name="create_folder",
        description="Creates a physical folder/directory in the user workspace for organizing strategies or assets.",
        parameters={
            "type": "object",
            "properties": {
                "folder_name": {"type": "string", "description": "Folder or directory name to create."},
            },
            "required": ["folder_name"],
        },
        handler=_bound_create_folder,
    )

    async def _bound_edit(filename: str, content: str, username: Optional[str] = None) -> dict:
        return await edit_file(filename, content, username or user_id)

    harness.register_tool(
        name="edit_file",
        description="Completely overwrites/updates the content of an existing workspace file on disk.",
        parameters={
            "type": "object",
            "properties": {
                "filename": {"type": "string", "description": "Target file to update."},
                "content": {"type": "string", "description": "Complete new content for the file."},
            },
            "required": ["filename", "content"],
        },
        handler=_bound_edit,
    )

    async def _bound_edit_partial(filename: str, target_content: str, replacement_content: str, username: Optional[str] = None) -> dict:
        return await edit_file_partially(filename, target_content, replacement_content, username or user_id)

    harness.register_tool(
        name="edit_file_partially",
        description="Surgically replaces a specific, exact target code block in a workspace file without rewriting the entire file. Use this for targeted bug fixes, parameter changes, or refactoring.",
        parameters={
            "type": "object",
            "properties": {
                "filename": {"type": "string", "description": "Target file to modify."},
                "target_content": {"type": "string", "description": "The exact existing text block to be replaced (must match uniquely)."},
                "replacement_content": {"type": "string", "description": "The new replacement text block."},
            },
            "required": ["filename", "target_content", "replacement_content"],
        },
        handler=_bound_edit_partial,
    )

    async def _bound_delete(filename: str, username: Optional[str] = None) -> dict:
        return await delete_file(filename, username or user_id)

    harness.register_tool(
        name="delete_file",
        description="Deletes a file from the user's workspace directory.",
        parameters={
            "type": "object",
            "properties": {
                "filename": {"type": "string", "description": "Filename to delete."},
            },
            "required": ["filename"],
        },
        handler=_bound_delete,
    )

    async def _bound_search(query: str, username: Optional[str] = None) -> dict:
        return await search_in_files(query, username or user_id)

    harness.register_tool(
        name="search_in_files",
        description="Searches for strings, method names, or indicators across all files in the active workspace.",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search term or function name."},
            },
            "required": ["query"],
        },
        handler=_bound_search,
    )

    async def _bound_save_version(
        strategy_name: str,
        code: str,
        bump_version: bool = False,
        username: Optional[str] = None,
        ext: Optional[str] = None,
    ) -> dict:
        res = await save_strategy_version(
            strategy_name=strategy_name,
            code=code,
            username=username or user_id,
            bump_version=bump_version,
            ext=ext or "auto",
        )
        if res.get("success") and hasattr(harness, "set_inception_state"):
            harness.set_inception_state(
                StrategyInceptionState.VERSIONED,
                strategy_name=strategy_name,
                strategy_version=res.get("version", 1),
            )
        return res

    harness.register_tool(
        name="save_strategy_version",
        description="Saves and checkpoints strategy code (MQL5 or Python) both to workspace disk and the SQLite database. Creates new version (_v1, _v2, etc.) and keeps the working file synchronized.",
        parameters={
            "type": "object",
            "properties": {
                "strategy_name": {
                    "type": "string",
                    "description": "Strategy file or base name (e.g. 'gold_fibo_retrace.mq5' or 'ict_gold_scalper').",
                },
                "code": {"type": "string", "description": "Strategy source code (MQL5 or Python)."},
                "bump_version": {
                    "type": "boolean",
                    "default": False,
                    "description": "Set to true to bump to next version (_v2, _v3) after running tests or autopsies.",
                },
                "ext": {
                    "type": "string",
                    "description": "Optional file extension ('mq5' or 'py'). Defaults to auto-detection from code and existing files.",
                },
            },
            "required": ["strategy_name", "code"],
        },
        handler=_bound_save_version,
    )

    async def _bound_list_versions(strategy_name: str, username: Optional[str] = None) -> dict:
        return await list_strategy_versions(strategy_name, username or user_id)

    harness.register_tool(
        name="list_strategy_versions",
        description="Lists all saved versions (_v1.py, _v2.py, etc.) and associated simulation autopsy files for a strategy.",
        parameters={
            "type": "object",
            "properties": {
                "strategy_name": {
                    "type": "string",
                    "description": "Short 2 to 3 words strategy name in lowercase snake_case (e.g. 'ict_gold_scalper').",
                },
            },
            "required": ["strategy_name"],
        },
        handler=_bound_list_versions,
    )


def resolve_strategy_folder(strategy_name: str, username: Optional[str] = None) -> tuple[Path, str]:
    """
    Resolves the physical strategy folder under data/users/<username>/<strategy_name>/.
    Validates the 2-3 word snake_case strategy name constraint, falling back safely for arbitrary names.
    """
    is_valid, clean_name, err = validate_strategy_name(strategy_name)
    if not is_valid:
        clean = re.sub(r"[^a-zA-Z0-9_]", "_", str(strategy_name).lower().strip())
        clean = re.sub(r"_+", "_", clean).strip("_")
        clean_name = clean or "custom_strategy"

    user_dir = _get_user_dir(username)
    folder = user_dir / clean_name
    folder.mkdir(parents=True, exist_ok=True)
    return folder, clean_name


def get_strategy_versions_info(strategy_name: str, username: Optional[str] = None) -> Dict[str, Any]:
    """
    Scans a strategy directory and returns all present versions, autopsies, and the next version number.
    """
    folder, clean_name = resolve_strategy_folder(strategy_name, username)
    user_dir = _get_user_dir(username)

    versions: List[Dict[str, Any]] = []
    version_regex = re.compile(rf"^{re.escape(clean_name)}_v(\d+)\.(py|mq5)$")

    candidate_files: List[Path] = []
    if folder.exists():
        candidate_files.extend(folder.glob(f"{clean_name}_v*.*"))
    if user_dir.exists():
        candidate_files.extend(user_dir.glob(f"{clean_name}_v*.*"))

    seen_versions = set()
    for f in candidate_files:
        match = version_regex.match(f.name)
        if match:
            v_num = int(match.group(1))
            ext = match.group(2)
            if v_num not in seen_versions:
                seen_versions.add(v_num)
                stat = f.stat()
                mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()

                autopsy_file = folder / f"{clean_name}_v{v_num}_autopsy.json"
                if not autopsy_file.exists():
                    autopsy_file = folder / f"{clean_name}_autopsy.json"
                if not autopsy_file.exists():
                    autopsy_file = user_dir / f"{clean_name}_autopsy.json"

                has_autopsy = autopsy_file.exists()
                autopsy_path = str(autopsy_file) if has_autopsy else None

                versions.append({
                    "version": v_num,
                    "version_num": v_num,
                    "filename": f.name,
                    "path": str(f),
                    "ext": ext,
                    "size_bytes": stat.st_size,
                    "updated_at": mtime,
                    "modified_at": mtime,
                    "has_autopsy": has_autopsy,
                    "autopsy_path": autopsy_path,
                })
    versions.sort(key=lambda x: x["version"])
    latest_v = max([v["version"] for v in versions], default=0)
    # If no versioned files exist yet, but the strategy working file exists in user workspace, baseline is 1
    if latest_v == 0:
        if (user_dir / f"{clean_name}.mq5").exists() or (user_dir / f"{clean_name}.py").exists() or (folder.exists() and any(folder.glob(f"{clean_name}.*"))):
            latest_v = 1
    next_v = latest_v + 1

    return {
        "strategy_name": clean_name,
        "folder": str(folder),
        "versions": versions,
        "latest_version": latest_v,
        "next_version": next_v,
    }


def _detect_strategy_ext(strategy_name: str, code: str, username: Optional[str] = None) -> str:
    """Intelligently infers whether a strategy is MQL5 or Python based on name, disk, and code tokens."""
    low_name = strategy_name.lower()
    if low_name.endswith(".mq5"):
        return "mq5"
    if low_name.endswith(".py"):
        return "py"

    clean = strategy_name.strip()
    for sfx in (".mq5", ".py", ".ex5", ".json"):
        if clean.lower().endswith(sfx):
            clean = clean[:-len(sfx)]

    # Check existing physical files in this user's workspace
    user_dir = _get_user_dir(username)
    if (user_dir / f"{clean}.mq5").exists():
        return "mq5"
    if (user_dir / f"{clean}.py").exists():
        return "py"
    strat_folder = user_dir / clean
    if strat_folder.is_dir():
        if any(strat_folder.glob("*.mq5")):
            return "mq5"
        if any(strat_folder.glob("*.py")):
            return "py"

    # Inspect code markers (including comments '//' typical of MQL5/C++)
    mql5_markers = (
        "#property", "OnInit", "OnTick", "OnDeinit", "CPositionInfo", "CTrade",
        "input int", "input double", "input string", "input bool", "datetime",
        "ulong", "ENUM_TIMEFRAMES", "ORDER_TYPE", "void OnTick", "//+---",
        "// v", "// checkpoint", "//"
    )
    if any(m in code for m in mql5_markers):
        return "mq5"

    return "py"


async def save_strategy_version(
    strategy_name: str,
    code: str,
    username: Optional[str] = None,
    bump_version: bool = False,
    ext: str = "auto",
) -> Dict[str, Any]:
    """
    Saves strategy code into its dedicated folder (data/users/<username>/<strategy_name>/).
    Intelligently detects whether the strategy is MQL5 or Python and guarantees no stray files.
    If bump_version is True, strictly creates the next sequential version (_v2, _v3).
    If bump_version is False, updates the current latest version or creates _v1 if none exists.
    Never autonomously jumps versions.
    """
    is_valid, clean_name, err = validate_strategy_name(strategy_name)
    if not is_valid:
        return {"success": False, "error": err}

    try:
        # Determine actual extension
        effective_ext = ext if ext in ("mq5", "py") else _detect_strategy_ext(strategy_name, code, username)

        folder, _ = resolve_strategy_folder(clean_name, username)
        v_info = get_strategy_versions_info(clean_name, username)

        # Strictly sequential version assignment controlled by user request
        if v_info["latest_version"] == 0:
            target_version = 1
        elif bump_version:
            target_version = v_info["latest_version"] + 1
        else:
            target_version = max(1, v_info["latest_version"])

        # Strictly synchronize version header inside the code
        code = re.sub(
            r'(#property\s+version\s+["\'])(\d+(?:\.\d+)?)(["\'])',
            rf'\g<1>{target_version}.00\g<3>',
            code,
            flags=re.IGNORECASE,
        )

        filename = format_strategy_filename(clean_name, version=target_version, ext=effective_ext)
        file_path = folder / filename

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)

        # Also sync clean unversioned working file (<strategy_name>.<ext>) to root directory
        root_base_name = f"{clean_name}.{effective_ext.lstrip('.')}"
        root_path = _get_user_dir(username) / root_base_name
        try:
            with open(root_path, "w", encoding="utf-8") as f:
                f.write(code)
        except Exception:
            pass

        # Cleanup stray duplicate files of the wrong extension (e.g. accidental .py for MQL5)
        if effective_ext == "mq5":
            stray_py = _get_user_dir(username) / f"{clean_name}.py"
            if stray_py.exists():
                try:
                    stray_py.unlink(missing_ok=True)
                except Exception:
                    pass
            for stray_v in folder.glob(f"{clean_name}_v*.py"):
                try:
                    stray_v.unlink(missing_ok=True)
                except Exception:
                    pass

        stat = file_path.stat()
        mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()

        # Dual-write into persistent SQLite database (strategies + strategy_versions)
        db_strat_id = None
        db_version = target_version
        try:
            from apps.api.src.db.repository import DatabaseRepository
            repo = DatabaseRepository()
            db_res = repo.upsert_strategy_with_version(
                name=clean_name,
                code=code,
                language=_infer_language(filename),
                description=f"Strategy {clean_name} (version {target_version})",
                user_id=username,
                commit_message=f"Version {target_version} ({'bumped' if bump_version else 'snapshot'})",
                bump_version=bump_version,
                version_num=target_version,
            )
            if db_res:
                db_strat_id = db_res.get("id")
        except Exception as db_err:
            logger.warning(f"Could not sync strategy '{clean_name}' to SQLite: {db_err}")

        return {
            "success": True,
            "strategy_name": clean_name,
            "version": target_version,
            "strategy_id": db_strat_id,
            "db_synced": db_strat_id is not None,
            "filename": filename,
            "folder": str(folder),
            "file_path": str(file_path),
            "bumped": bump_version,
            "bytes_written": len(code.encode("utf-8")),
            "language": _infer_language(filename),
            "ext": effective_ext,
            "content": code,
            "updated_at": mtime,
        }
    except Exception as err:
        logger.exception(f"Error saving strategy version for '{strategy_name}': {err}")
        return {"success": False, "error": str(err)}


async def list_strategy_versions(
    strategy_name: str,
    username: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Lists all physical versions and associated autopsies for a strategy.
    """
    is_valid, clean_name, err = validate_strategy_name(strategy_name)
    if not is_valid:
        return {"success": False, "error": err}

    try:
        v_info = get_strategy_versions_info(clean_name, username)
        return {
            "success": True,
            **v_info,
        }
    except Exception as err:
        logger.exception(f"Error listing strategy versions for '{strategy_name}': {err}")
        return {"success": False, "error": str(err)}
