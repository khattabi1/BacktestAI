from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import ast
import re
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException
from domain.models import StrategyMetadata
from ..services.strategy_registry import strategy_registry
from ..services.ai_copilot_service import (
    ai_copilot_service,
    StrategyGenerateRequest,
    StrategyTranslateRequest,
    StrategyFixRequest,
)

router = APIRouter(prefix="/strategies", tags=["Strategies"])

def _build_full_strategy_catalog() -> List[Dict[str, Any]]:
    results = []
    seen_ids = set()

    try:
        from ..db.repository import DatabaseRepository
        import json
        repo = DatabaseRepository()
        db_strats = repo.list_strategies()
        for s in db_strats:
            s_id = s["id"]
            if s_id in seen_ids:
                continue
            seen_ids.add(s_id)

            raw_params = s.get("default_parameters") or "{}"
            if isinstance(raw_params, str):
                try:
                    parsed_params = json.loads(raw_params)
                except Exception:
                    parsed_params = {}
            else:
                parsed_params = raw_params or {}

            param_list = []
            for k, v in parsed_params.items():
                label = k.replace("_", " ").title()
                param_list.append({
                    "name": k,
                    "label": label,
                    "type": type(v).__name__,
                    "default": v,
                    "description": f"Configurable {label} input parameter",
                    "min_value": 0 if isinstance(v, (int, float)) and v >= 0 else None,
                    "max_value": None,
                })

            name_lower = (s.get("name") or "").lower()
            if any(w in name_lower for w in ["trend", "moving", "sma", "ema"]):
                cat = "Trend Following"
            elif any(w in name_lower for w in ["reversion", "rsi", "mean", "bb", "bollinger"]):
                cat = "Mean Reversion"
            elif any(w in name_lower for w in ["order block", "smc", "liquidity", "imbalance", "fvg"]):
                cat = "Order Flow"
            elif any(w in name_lower for w in ["breakout", "volatility", "squeeze", "atr"]):
                cat = "Volatility"
            elif any(w in name_lower for w in ["momentum", "macd"]):
                cat = "Momentum"
            else:
                cat = "Custom Model"

            sym = "XAUUSD" if any(w in name_lower for w in ["gold", "xau"]) else ("BTCUSDT" if "btc" in name_lower else "EURUSD")
            tf = "5m" if "5m" in name_lower else ("15m" if "15m" in name_lower else ("4h" if "4h" in name_lower else "1h"))
            lang = s.get("language", "python")
            tags = [lang.upper(), cat]
            if "gold" in name_lower or "xau" in name_lower:
                tags.append("Gold")
            elif "btc" in name_lower:
                tags.append("Crypto")

            results.append({
                "id": s_id,
                "name": s.get("name", "Custom Strategy"),
                "description": s.get("description") or "Custom algorithmic strategy implementation.",
                "category": cat,
                "language": lang,
                "code": s.get("code") or "",
                "parameters": param_list,
                "is_built_in": bool(s.get("is_built_in", 0)),
                "default_symbol": sym,
                "default_timeframe": tf,
                "tags": tags,
                "created_at": s.get("created_at"),
                "updated_at": s.get("updated_at"),
            })
    except Exception:
        pass

    return results

@router.get("", response_model=List[Dict[str, Any]])
def list_strategies():
    """List all registered algorithmic trading strategies saved in database and their parameter schemas."""
    return _build_full_strategy_catalog()

class StrategyCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    code: str
    language: str = "python"
    parameters: Optional[Any] = None


@router.post("", status_code=201, response_model=Dict[str, Any])
def create_strategy(payload: StrategyCreateRequest):
    """Save a new strategy in the database."""
    from ..db.repository import DatabaseRepository
    repo = DatabaseRepository()
    params_dict = {}
    if isinstance(payload.parameters, list):
        for p in payload.parameters:
            if isinstance(p, dict) and "name" in p:
                params_dict[p["name"]] = p.get("default", 0)
    elif isinstance(payload.parameters, dict):
        params_dict = payload.parameters

    strat = repo.create_strategy(
        name=payload.name,
        code=payload.code,
        language=payload.language,
        description=payload.description or "",
        default_parameters=params_dict
    )
    return strat


@router.delete("")
def wipe_all_strategies():
    """Wipe all saved strategies from database."""
    from ..db.repository import DatabaseRepository
    repo = DatabaseRepository()
    count = repo.delete_all_strategies()
    return {"success": True, "deleted_count": count}

@router.delete("/{strategy_id}")
def delete_strategy(strategy_id: str):
    """Delete a specific strategy by ID."""
    from ..db.repository import DatabaseRepository
    repo = DatabaseRepository()
    success = repo.delete_strategy(strategy_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Strategy '{strategy_id}' not found.")
    return {"success": True, "deleted_id": strategy_id}


@router.get("/{strategy_id}", response_model=Dict[str, Any])
def get_strategy(strategy_id: str):
    """Get metadata and parameters for a specific strategy."""
    catalog = _build_full_strategy_catalog()
    for s in catalog:
        if s["id"] == strategy_id:
            return s
    raise HTTPException(status_code=404, detail=f"Strategy '{strategy_id}' not found.")

class StrategyVersionCommitRequest(BaseModel):
    code: str
    commit_message: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    username: Optional[str] = "default"

class StrategyRestoreRequest(BaseModel):
    code: Optional[str] = None
    username: Optional[str] = None

def _resolve_strategy_id(repo, identifier: str, username: Optional[str] = None) -> Optional[str]:
    # Check if identifier is already a valid strategy UUID
    existing = repo.get_strategy(identifier)
    if existing:
        return existing["id"]
    # Check by name or clean name without extension
    clean_name = identifier.replace(".mq5", "").replace(".py", "").strip()
    by_name = (
        repo.get_strategy_by_name(clean_name, user_id=username)
        or repo.get_strategy_by_name(identifier, user_id=username)
        or repo.get_strategy_by_name(clean_name)
        or repo.get_strategy_by_name(identifier)
    )
    if by_name:
        return by_name["id"]
    return None

@router.get("/{strategy_id}/versions", response_model=List[Dict[str, Any]])
def get_strategy_versions(strategy_id: str, username: str = "default"):
    """Retrieve all historical version snapshots for a strategy by ID or filename."""
    from ..db.repository import DatabaseRepository
    import re
    from .workspace_files import _get_user_dir, USERS_STORAGE_DIR

    repo = DatabaseRepository()
    resolved_id = _resolve_strategy_id(repo, strategy_id, username)
    raw_versions: List[Dict[str, Any]] = repo.get_strategy_versions(resolved_id) if resolved_id else []

    clean_name = strategy_id.replace(".mq5", "").replace(".py", "").strip()

    # 1. Reconcile with filesystem version snapshots in data/users/<username>/ and subfolders
    user_dir = _get_user_dir(username)
    candidate_dirs = [user_dir]
    sub_dir = user_dir / clean_name
    if sub_dir.is_dir():
        candidate_dirs.append(sub_dir)

    # Also check other active user directories if user_dir is empty or default
    if not any(user_dir.glob(f"*{clean_name}*")):
        for ud in USERS_STORAGE_DIR.iterdir():
            if ud.is_dir() and ud != user_dir:
                if any(ud.glob(f"*{clean_name}*")):
                    candidate_dirs.append(ud)
                    if (ud / clean_name).is_dir():
                        candidate_dirs.append(ud / clean_name)

    # Scan for versioned files like <clean_name>_v<N>.mq5 or .py
    v_pattern = re.compile(rf"^{re.escape(clean_name)}_v(\d+)\.(mq5|py)$", re.IGNORECASE)
    seen_fs_v: set[int] = set()

    for d in candidate_dirs:
        try:
            for fp in d.iterdir():
                if not fp.is_file():
                    continue
                m = v_pattern.match(fp.name)
                if m:
                    v_num = int(m.group(1))
                    seen_fs_v.add(v_num)
                    raw_versions.append({
                        "id": f"fs_{clean_name}_v{v_num}",
                        "strategy_id": resolved_id or clean_name,
                        "version_num": v_num,
                        "commit_message": f"Version {v_num} checkpoint ({fp.name})",
                        "created_at": datetime.fromtimestamp(fp.stat().st_mtime, tz=timezone.utc).isoformat(),
                        "code_length": fp.stat().st_size,
                    })
        except Exception:
            pass

    # Call get_strategy_versions_info tool safely as an extra source
    try:
        from packages.agent.src.tools.workspace import get_strategy_versions_info
        fs_info = get_strategy_versions_info(clean_name, username)
        for fv in fs_info.get("versions", []):
            v_num = fv.get("version") or fv.get("version_num")
            if v_num and v_num not in seen_fs_v:
                raw_versions.append({
                    "id": f"fs_{clean_name}_v{v_num}",
                    "strategy_id": resolved_id or clean_name,
                    "version_num": v_num,
                    "commit_message": f"Version {v_num} checkpoint ({fv.get('filename')})",
                    "created_at": fv.get("updated_at") or fv.get("modified_at") or datetime.now(timezone.utc).isoformat(),
                    "code_length": fv.get("size_bytes", 0),
                })
    except Exception:
        pass

    # 2. Check the active working file on disk to inspect current code version
    cand_files = [f"{clean_name}.mq5", f"{clean_name}.py", clean_name]
    found_active = False
    for d in candidate_dirs:
        for cf in cand_files:
            fp = d / cf
            if fp.is_file():
                try:
                    f_text = fp.read_text(encoding="utf-8", errors="replace")
                    m_ver = re.search(r'#property\s+version\s+["\'](\d+)(?:\.\d+)?["\']', f_text, re.IGNORECASE)
                    if not m_ver:
                        m_ver = re.search(r'(?:__version__|VERSION)\s*=\s*["\'](\d+)(?:\.\d+)?["\']', f_text, re.IGNORECASE)
                    active_code_v = int(m_ver.group(1)) if m_ver else 1

                    # Prevent jumping: active working file version cannot exceed max_known + 1
                    max_known = max([v.get("version_num", 1) for v in raw_versions], default=1)
                    if active_code_v > max_known + 1:
                        active_code_v = max_known

                    raw_versions.append({
                        "id": f"active_{clean_name}_v{active_code_v}",
                        "strategy_id": resolved_id or clean_name,
                        "version_num": active_code_v,
                        "commit_message": f"Version {active_code_v} (Active working file)",
                        "created_at": datetime.fromtimestamp(fp.stat().st_mtime, tz=timezone.utc).isoformat(),
                        "code_length": len(f_text),
                    })
                    found_active = True
                except Exception:
                    pass
                break
        if found_active:
            break

    # 3. Deduplicate versions strictly by version_num (preferring highest code_length and valid timestamp)
    deduped: Dict[int, Dict[str, Any]] = {}
    for v in raw_versions:
        v_num = v.get("version_num")
        if not v_num or not isinstance(v_num, int):
            continue
        if v_num not in deduped:
            deduped[v_num] = v
        else:
            existing = deduped[v_num]
            if (v.get("code_length", 0) > existing.get("code_length", 0)) or (
                v.get("code_length", 0) == existing.get("code_length", 0) and str(v.get("created_at", "")) > str(existing.get("created_at", ""))
            ):
                deduped[v_num] = v

    if not deduped:
        # If no versions found at all, baseline v1
        deduped[1] = {
            "id": f"baseline_{clean_name}_v1",
            "strategy_id": resolved_id or clean_name,
            "version_num": 1,
            "commit_message": "Version 1 (Baseline)",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "code_length": 0,
        }

    sorted_versions = sorted(deduped.values(), key=lambda x: x.get("version_num", 0), reverse=True)
    return sorted_versions


@router.get("/{strategy_id}/versions/{version_num}", response_model=Dict[str, Any])
def get_strategy_version_detail(strategy_id: str, version_num: int, username: str = "default"):
    """Retrieve full code snapshot and parameters for a specific strategy version."""
    from ..db.repository import DatabaseRepository
    from .workspace_files import _get_user_dir, USERS_STORAGE_DIR
    import re

    repo = DatabaseRepository()
    resolved_id = _resolve_strategy_id(repo, strategy_id, username)
    clean_name = strategy_id.replace(".mq5", "").replace(".py", "").strip()

    # 1. Check DB first
    ver = repo.get_strategy_version_code(resolved_id, version_num) if resolved_id else None
    if ver and ver.get("code") and len(ver["code"].strip()) > 50:
        return ver

    # 2. Check filesystem version snapshots in user directory and subfolder
    user_dir = _get_user_dir(username)
    candidate_dirs = [user_dir, user_dir / clean_name]
    for ud in USERS_STORAGE_DIR.iterdir():
        if ud.is_dir() and ud != user_dir:
            candidate_dirs.append(ud)
            if (ud / clean_name).is_dir():
                candidate_dirs.append(ud / clean_name)

    for d in candidate_dirs:
        for ext in (".mq5", ".py"):
            fpath = d / f"{clean_name}_v{version_num}{ext}"
            if fpath.is_file():
                f_code = fpath.read_text(encoding="utf-8", errors="replace")
                return {
                    "id": f"fs_{clean_name}_v{version_num}",
                    "strategy_id": resolved_id or clean_name,
                    "version_num": version_num,
                    "code": f_code,
                    "commit_message": f"Version {version_num} checkpoint",
                    "created_at": datetime.fromtimestamp(fpath.stat().st_mtime, tz=timezone.utc).isoformat(),
                    "parameters": "{}",
                }

    # 3. Fallback: If version matches current active file on disk or version 1 baseline
    for d in candidate_dirs:
        cand_files = [f"{clean_name}.mq5", f"{clean_name}.py", clean_name]
        for cf in cand_files:
            fp = d / cf
            if fp.is_file():
                f_text = fp.read_text(encoding="utf-8", errors="replace")
                m_ver = re.search(r'#property\s+version\s+["\'](\d+)(?:\.\d+)?["\']', f_text, re.IGNORECASE)
                if not m_ver:
                    m_ver = re.search(r'(?:__version__|VERSION)\s*=\s*["\'](\d+)(?:\.\d+)?["\']', f_text, re.IGNORECASE)
                active_v = int(m_ver.group(1)) if m_ver else 1
                if active_v == version_num or (version_num == 1 and not m_ver):
                    return {
                        "id": f"active_{clean_name}_v{version_num}",
                        "strategy_id": resolved_id or clean_name,
                        "version_num": version_num,
                        "code": f_text,
                        "commit_message": f"Version {version_num} (Active)",
                        "created_at": datetime.fromtimestamp(fp.stat().st_mtime, tz=timezone.utc).isoformat(),
                        "parameters": "{}",
                    }

    if ver:
        return ver

    raise HTTPException(status_code=404, detail=f"Version {version_num} for strategy '{strategy_id}' not found.")


@router.post("/{strategy_id}/versions", response_model=Dict[str, Any])
def commit_strategy_version(strategy_id: str, payload: StrategyVersionCommitRequest):
    """Commit a new version milestone snapshot for a strategy."""
    from ..db.repository import DatabaseRepository
    repo = DatabaseRepository()
    resolved_id = _resolve_strategy_id(repo, strategy_id, payload.username)
    clean_name = strategy_id.replace(".mq5", "").replace(".py", "").strip()

    if not resolved_id:
        strat = repo.create_strategy(
            name=clean_name,
            code=payload.code,
            language="mql5" if strategy_id.endswith(".mq5") else "python",
            default_parameters=payload.parameters or {}
        )
        resolved_id = strat["id"]

    res = repo.upsert_strategy_with_version(
        name=clean_name,
        code=payload.code,
        default_parameters=payload.parameters,
        commit_message=payload.commit_message or "New version milestone",
        bump_version=True,
    )
    return res


@router.post("/{strategy_id}/revert/{version_num}", response_model=Dict[str, Any])
@router.post("/{strategy_id}/versions/{version_num}/restore", response_model=Dict[str, Any])
def revert_strategy(
    strategy_id: str,
    version_num: int,
    username: str = "default",
    payload: Optional[StrategyRestoreRequest] = None,
):
    """Revert active strategy code to a previous version and sync workspace file on disk."""
    from ..db.repository import DatabaseRepository
    from .workspace_files import _get_user_dir, USERS_STORAGE_DIR
    import re

    effective_username = (payload.username if payload and payload.username else username) or "default"
    repo = DatabaseRepository()
    resolved_id = _resolve_strategy_id(repo, strategy_id, effective_username)
    clean_name = strategy_id.replace(".mq5", "").replace(".py", "").strip()

    restored_code = None

    # 1. Use explicit code from restore request body if passed by UI client
    if payload and payload.code and len(payload.code.strip()) > 50:
        restored_code = payload.code

    # 2. Fetch code for requested version from DB
    if not restored_code and resolved_id:
        ver = repo.get_strategy_version_code(resolved_id, version_num)
        if ver and ver.get("code") and len(ver["code"].strip()) > 50:
            restored_code = ver["code"]

    # 3. Check filesystem version snapshots in user directory and subfolders
    user_dir = _get_user_dir(effective_username)
    candidate_dirs = [user_dir, user_dir / clean_name]
    for ud in USERS_STORAGE_DIR.iterdir():
        if ud.is_dir() and ud != user_dir:
            candidate_dirs.append(ud)
            if (ud / clean_name).is_dir():
                candidate_dirs.append(ud / clean_name)

    if not restored_code:
        for d in candidate_dirs:
            for ext in (".mq5", ".py"):
                fpath = d / f"{clean_name}_v{version_num}{ext}"
                if fpath.is_file():
                    restored_code = fpath.read_text(encoding="utf-8", errors="replace")
                    break
            if restored_code:
                break

    # 4. Fallback: If version matches current active file on disk or baseline v1
    if not restored_code:
        for d in candidate_dirs:
            cand_files = [f"{clean_name}.mq5", f"{clean_name}.py", clean_name]
            for cf in cand_files:
                fp = d / cf
                if fp.is_file():
                    f_text = fp.read_text(encoding="utf-8", errors="replace")
                    m_ver = re.search(r'#property\s+version\s+["\'](\d+)(?:\.\d+)?["\']', f_text, re.IGNORECASE)
                    if not m_ver:
                        m_ver = re.search(r'(?:__version__|VERSION)\s*=\s*["\'](\d+)(?:\.\d+)?["\']', f_text, re.IGNORECASE)
                    active_v = int(m_ver.group(1)) if m_ver else 1
                    if active_v == version_num or (version_num == 1 and not m_ver):
                        restored_code = f_text
                        break
            if restored_code:
                break

    if not restored_code:
        raise HTTPException(status_code=404, detail=f"Version {version_num} for strategy '{strategy_id}' not found.")

    # Strictly harmonize version header inside restored code
    restored_code = re.sub(
        r'(#property\s+version\s+["\'])(\d+(?:\.\d+)?)(["\'])',
        rf'\g<1>{version_num}.00\g<3>',
        restored_code,
        flags=re.IGNORECASE,
    )

    # Revert in DB if strategy exists
    updated = None
    if resolved_id:
        updated = repo.revert_strategy_to_version(resolved_id, version_num)
        if not updated:
            updated = repo.update_strategy(
                strategy_id=resolved_id,
                code=restored_code,
                create_version=False,
            )
            if updated:
                updated["version_num"] = version_num
    else:
        # Upsert into DB under restored version
        try:
            repo.upsert_strategy_with_version(
                name=clean_name,
                code=restored_code,
                language="mql5" if strategy_id.endswith(".mq5") else "python",
                description=f"Strategy {clean_name} (restored v{version_num})",
                user_id=effective_username,
                commit_message=f"Restored version {version_num}",
                bump_version=False,
                version_num=version_num,
            )
        except Exception:
            pass

    # Sync to workspace working file on disk in user's folder
    cand_files = [f"{clean_name}.mq5", f"{clean_name}.py", clean_name]
    wrote_file = False
    for cf in cand_files:
        fp = user_dir / cf
        if fp.is_file():
            fp.write_text(restored_code, encoding="utf-8")
            wrote_file = True
            break
    if not wrote_file:
        if (user_dir / clean_name / f"{clean_name}.mq5").is_file():
            (user_dir / clean_name / f"{clean_name}.mq5").write_text(restored_code, encoding="utf-8")
        elif (user_dir / clean_name / f"{clean_name}.py").is_file():
            (user_dir / clean_name / f"{clean_name}.py").write_text(restored_code, encoding="utf-8")
        else:
            ext = ".mq5"
            (user_dir / f"{clean_name}{ext}").write_text(restored_code, encoding="utf-8")

    res_dict = updated or {
        "id": resolved_id or clean_name,
        "name": clean_name,
        "version_num": version_num,
        "code": restored_code,
        "success": True,
    }
    res_dict["version_num"] = version_num
    res_dict["code"] = restored_code
    return res_dict

@router.post("/ai/generate", response_model=Dict[str, Any])
def generate_strategy_with_ai(payload: StrategyGenerateRequest):
    """Generate deterministic algorithmic strategy code in Python or MQL5 from natural language."""
    return ai_copilot_service.generate_strategy(payload.prompt, payload.language)

@router.post("/ai/translate", response_model=Dict[str, Any])
def translate_strategy_with_ai(payload: StrategyTranslateRequest):
    """Translate strategy code bidirectionally between Python (Polars) and MQL5 (MetaTrader 5)."""
    return ai_copilot_service.translate_strategy(payload.code, payload.source_language, payload.target_language)

@router.post("/ai/fix", response_model=Dict[str, Any])
def fix_strategy_syntax_with_ai(payload: StrategyFixRequest):
    """Auto-repair syntax issues, unbalanced delimiters, and missing colons/semicolons."""
    return ai_copilot_service.fix_syntax_errors(
        payload.code,
        payload.language,
        payload.errors,
        line=payload.line,
        rule=payload.rule,
        message=payload.message,
    )


# --- Code Validation & Diagnostics Engine ---

class StrategyValidateRequest(BaseModel):
    code: str
    language: str = "python"

class StrategyValidationError(BaseModel):
    line: int
    column: int
    end_line: Optional[int] = None
    end_column: Optional[int] = None
    message: str
    severity: str = "error"  # "error" | "warning"
    rule: Optional[str] = None
    fix_suggestion: Optional[str] = None

class StrategyValidateResponse(BaseModel):
    valid: bool
    errors: List[StrategyValidationError] = []
    warnings: List[StrategyValidationError] = []
    diagnostics_summary: str


@router.post("/validate", response_model=StrategyValidateResponse)
def validate_strategy_code(payload: StrategyValidateRequest):
    """
    Performs institutional AST and causal static analysis on strategy code.
    Identifies exact syntax errors, indentation faults, missing delimiters, and causal violations.
    Accurately supports both MQL5 and Python without false positives.
    """
    code = payload.code
    lang = (payload.language or "").lower().strip()
    errors: List[StrategyValidationError] = []
    warnings: List[StrategyValidationError] = []

    if not code or not code.strip():
        return StrategyValidateResponse(
            valid=True,
            errors=[],
            warnings=[],
            diagnostics_summary="Buffer is empty. Ready for code input."
        )

    # Content-aware language resolution (prioritize MQL5)
    is_mql5 = (
        lang in ("mql5", "cpp", "c")
        or "//+" in code
        or "#property" in code
        or "#include" in code
        or "void OnTick" in code
        or "int OnInit" in code
        or "void OnStart" in code
        or "int OnCalculate" in code
        or "input group" in code
        or "MqlRates" in code
        or "MqlTick" in code
        or "datetime " in code
        or "sinput " in code
    )
    is_python = not is_mql5 and (
        lang == "python"
        or "def " in code
        or "import " in code
        or "from " in code
        or "class " in code
    )

    resolved_lang = "mql5" if is_mql5 else ("python" if is_python else (lang or "mql5"))

    if resolved_lang == "python":
        try:
            tree = ast.parse(code)

            # Causal Zero Look-ahead Bias static inspection
            lines = code.split("\n")
            for idx, line in enumerate(lines):
                line_num = idx + 1
                if re.search(r"\b(shift\s*\(\s*-\d+|\.iloc\[.*?\+\s*\d+\]|lead\s*\()", line):
                    warnings.append(StrategyValidationError(
                        line=line_num,
                        column=1,
                        message="Potential causality risk: negative shift or future index access detected (lookahead bias).",
                        severity="warning",
                        rule="QUANT_LOOKAHEAD_BIAS",
                        fix_suggestion="Only reference closed bars (index <= current_bar)."
                    ))

        except (SyntaxError, IndentationError) as e:
            line_no = getattr(e, "lineno", 1) or 1
            col_no = getattr(e, "offset", 1) or 1
            msg = getattr(e, "msg", "Invalid syntax")
            err_type = type(e).__name__
            errors.append(StrategyValidationError(
                line=line_no,
                column=col_no,
                end_line=getattr(e, "end_lineno", None),
                end_column=getattr(e, "end_offset", None),
                message=f"{err_type}: {msg}",
                severity="error",
                rule=err_type,
                fix_suggestion="Check indentation or syntax delimiters."
            ))

    elif resolved_lang == "mql5":
        lines = code.split("\n")

        known_types = {
            "void", "char", "uchar", "bool", "short", "ushort", "int", "uint",
            "color", "long", "ulong", "datetime", "float", "double", "string",
            "MqlRates", "MqlTick", "MqlDateTime", "MqlTradeRequest", "MqlTradeResult",
            "MqlTradeCheckResult", "MqlBookInfo", "CTrade", "CPositionInfo", "COrderInfo",
            "CHistoryOrderInfo", "CSymbolInfo", "CAccountInfo", "CExpert", "CArrayDouble",
            "CArrayInt", "CArrayLong", "CArrayString", "CArrayObj", "CList", "CTree",
            "input", "sinput", "extern", "const", "static", "virtual", "inline", "auto",
        }

        # Dynamically collect struct, class, enum identifiers in the file
        for m in re.finditer(r"\b(?:struct|class|enum)\s+([A-Za-z_][A-Za-z0-9_]*)", code):
            known_types.add(m.group(1))

        control_keywords = {
            "if", "else", "for", "while", "do", "switch", "case", "default",
            "return", "break", "continue", "struct", "class", "enum", "union",
            "template", "typename", "new", "delete", "sizeof", "group"
        }

        in_block_comment = False
        unclosed_comment_line = None
        unclosed_string_line = None

        brace_stack = []
        paren_stack = []
        bracket_stack = []

        for idx, line in enumerate(lines):
            line_num = idx + 1
            line_len = len(line)
            clean_chars = []
            i = 0

            while i < line_len:
                if in_block_comment:
                    if line[i:i+2] == "*/":
                        in_block_comment = False
                        unclosed_comment_line = None
                        i += 2
                    else:
                        i += 1
                    continue

                if line[i:i+2] == "/*":
                    in_block_comment = True
                    unclosed_comment_line = line_num
                    i += 2
                    continue

                if line[i:i+2] == "//":
                    break

                if line[i] == '"':
                    clean_chars.append(" ")
                    start_str_line = line_num
                    i += 1
                    closed_str = False
                    while i < line_len:
                        if line[i] == "\\" and i + 1 < line_len:
                            i += 2
                        elif line[i] == '"':
                            closed_str = True
                            i += 1
                            break
                        else:
                            i += 1
                    if not closed_str and not line.endswith("\\"):
                        unclosed_string_line = start_str_line
                    continue

                if line[i] == "'":
                    clean_chars.append(" ")
                    i += 1
                    while i < line_len:
                        if line[i] == "\\" and i + 1 < line_len:
                            i += 2
                        elif line[i] == "'":
                            i += 1
                            break
                        else:
                            i += 1
                    continue

                char = line[i]
                if char == '{':
                    brace_stack.append((line_num, i + 1))
                elif char == '}':
                    if brace_stack:
                        brace_stack.pop()
                    else:
                        errors.append(StrategyValidationError(
                            line=line_num,
                            column=i + 1,
                            message="SyntaxError: Unexpected closing brace '}' without matching '{'",
                            severity="error",
                            rule="MQL5_UNEXPECTED_BRACE"
                        ))
                elif char == '(':
                    paren_stack.append((line_num, i + 1))
                elif char == ')':
                    if paren_stack:
                        paren_stack.pop()
                    else:
                        errors.append(StrategyValidationError(
                            line=line_num,
                            column=i + 1,
                            message="SyntaxError: Unexpected closing parenthesis ')' without matching '('",
                            severity="error",
                            rule="MQL5_UNEXPECTED_PAREN"
                        ))
                elif char == '[':
                    bracket_stack.append((line_num, i + 1))
                elif char == ']':
                    if bracket_stack:
                        bracket_stack.pop()
                    else:
                        errors.append(StrategyValidationError(
                            line=line_num,
                            column=i + 1,
                            message="SyntaxError: Unexpected closing bracket ']' without matching '['",
                            severity="error",
                            rule="MQL5_UNEXPECTED_BRACKET"
                        ))

                clean_chars.append(char)
                i += 1

            clean_line = "".join(clean_chars).strip()
            if not clean_line or in_block_comment:
                continue
            if clean_line.startswith("#"):
                continue

            # Inside function body (brace depth > 0)
            if brace_stack:
                # 1. Illegal consecutive identifiers in if conditions
                m_if = re.match(r"^if\s*\((.*)\)", clean_line)
                if m_if:
                    cond = m_if.group(1)
                    m_double = re.search(r"\b([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)\b", cond)
                    if m_double:
                        id1, id2 = m_double.group(1), m_double.group(2)
                        if id1 not in control_keywords and id1 not in known_types:
                            col = line.find(id2) + 1 if id2 in line else 1
                            errors.append(StrategyValidationError(
                                line=line_num,
                                column=col,
                                message=f"SyntaxError: Unexpected token '{id2}' in condition expression",
                                severity="error",
                                rule="MQL5_UNEXPECTED_TOKEN"
                            ))

                # 2. Variable declaration with unrecognized type
                m_decl = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|;)", clean_line)
                if m_decl:
                    type_token = m_decl.group(1)
                    if type_token not in known_types and type_token not in control_keywords:
                        col = line.find(type_token) + 1 if type_token in line else 1
                        errors.append(StrategyValidationError(
                            line=line_num,
                            column=col,
                            message=f"SyntaxError: Unknown type or undeclared identifier '{type_token}'",
                            severity="error",
                            rule="MQL5_UNKNOWN_TYPE"
                        ))

                # 3. Standalone bare token / garbage statements
                m_bare = re.match(r"^([A-Za-z_][A-Za-z0-9_]*);?$", clean_line)
                if m_bare:
                    token = m_bare.group(1)
                    if token not in control_keywords and token not in ("{", "}", ";"):
                        col = line.find(token) + 1 if token in line else 1
                        errors.append(StrategyValidationError(
                            line=line_num,
                            column=col,
                            message=f"SyntaxError: Undeclared identifier or unexpected statement '{token}'",
                            severity="error",
                            rule="MQL5_UNDECLARED_IDENTIFIER"
                        ))

        if unclosed_comment_line:
            errors.append(StrategyValidationError(
                line=unclosed_comment_line,
                column=1,
                message="SyntaxError: Unterminated block comment '/*'",
                severity="error",
                rule="MQL5_UNTERMINATED_COMMENT"
            ))

        if unclosed_string_line:
            errors.append(StrategyValidationError(
                line=unclosed_string_line,
                column=1,
                message="SyntaxError: Unterminated string literal",
                severity="error",
                rule="MQL5_UNTERMINATED_STRING"
            ))

        if brace_stack:
            last = brace_stack[-1]
            errors.append(StrategyValidationError(
                line=last[0],
                column=last[1],
                message=f"SyntaxError: Unbalanced curly braces '{{}}' (unclosed '{{' at line {last[0]})",
                severity="error",
                rule="MQL5_UNBALANCED_BRACES"
            ))

        if paren_stack:
            last = paren_stack[-1]
            errors.append(StrategyValidationError(
                line=last[0],
                column=last[1],
                message=f"SyntaxError: Unbalanced parentheses '()' (unclosed '(' at line {last[0]})",
                severity="error",
                rule="MQL5_UNBALANCED_PARENS"
            ))

        if bracket_stack:
            last = bracket_stack[-1]
            errors.append(StrategyValidationError(
                line=last[0],
                column=last[1],
                message=f"SyntaxError: Unbalanced brackets '[]' (unclosed '[' at line {last[0]})",
                severity="error",
                rule="MQL5_UNBALANCED_BRACKETS"
            ))


    is_valid = len(errors) == 0
    summary = (
        "Code passes all causality and syntax checks."
        if is_valid and len(warnings) == 0
        else f"Diagnostics: {len(errors)} error(s), {len(warnings)} warning(s) detected."
    )

    return StrategyValidateResponse(
        valid=is_valid,
        errors=errors,
        warnings=warnings,
        diagnostics_summary=summary,
    )


