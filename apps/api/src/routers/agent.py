"""
FastAPI Router for Backtest-SI Agent Intelligence Layer (DSH Harness).
Provides Server-Sent Events (SSE) streaming for real-time Chain-of-Thought
and tool executions, session persistence, and Human-in-the-Loop interaction.
"""

from __future__ import annotations
import asyncio
from contextlib import asynccontextmanager
import json
import logging
import os
import re
import time
from typing import Any, AsyncGenerator, Dict, List, Optional
import uuid

from pathlib import Path
from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status, Request
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import redis.exceptions

from packages.agent.src.core.harness import AgentHarness, _safe_print
from packages.agent.src.core.types import AgentState, EventType, TrajectoryEvent, utc_now_iso
from packages.agent.src.adapters.llm import create_llm_adapter
from packages.agent.src.storage.postgres import PostgresSessionStorage
from packages.agent.src.tools.strategy import register_strategy_tools
from packages.agent.src.tools.execution import register_execution_tools
from packages.agent.src.tools.analytical import register_analytical_tools
from packages.agent.src.tools.research import register_research_tools
from packages.agent.src.tools.workspace import register_workspace_tools
from packages.agent.src.tools.mt5_mcp import register_mt5_mcp_tools
from packages.agent.src.sandbox.gates import ApprovalGateManager
from ..job_queue import job_queue

logger = logging.getLogger("backtest_si.api.agent")

router = APIRouter(prefix="/agent", tags=["SI Agent Intelligence"])

UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".webp", ".svg",
    ".csv", ".py", ".mq5", ".json", ".txt", ".md", ".parquet"
}

# Global storage and runtime registry
_storage = PostgresSessionStorage()
MAX_ACTIVE_HARNESSES = 50
HARNESS_IDLE_TTL_SECONDS = 1800.0  # 30 minutes

_active_harnesses: Dict[str, AgentHarness] = {}
_harness_last_accessed: Dict[str, float] = {}
_gate_manager = ApprovalGateManager()


def _evict_idle_harnesses() -> None:
    """
    Evicts idle harnesses from RAM to prevent unbounded memory growth in long-running production.
    Persisted state in SQLite remains intact and is seamlessly re-hydrated on demand via AgentHarness.restore.
    """
    now = time.time()
    # 1. TTL Eviction: any harness not accessed for > 30 mins
    stale_ids = [
        sid for sid, last_t in _harness_last_accessed.items()
        if (now - last_t) > HARNESS_IDLE_TTL_SECONDS
    ]
    for sid in stale_ids:
        _active_harnesses.pop(sid, None)
        _harness_last_accessed.pop(sid, None)
        _in_memory_locks.pop(sid, None)

    # 2. Capacity Cap (LRU): if active harnesses exceed MAX_ACTIVE_HARNESSES
    if len(_active_harnesses) > MAX_ACTIVE_HARNESSES:
        sorted_by_access = sorted(_harness_last_accessed.items(), key=lambda kv: kv[1])
        excess = len(_active_harnesses) - MAX_ACTIVE_HARNESSES
        for sid, _ in sorted_by_access[:excess]:
            _active_harnesses.pop(sid, None)
            _harness_last_accessed.pop(sid, None)
            _in_memory_locks.pop(sid, None)


class SessionBusyError(Exception):
    """Raised when a session lock cannot be acquired within the timeout window."""
    pass


# Fallback in-memory locks used only if Redis is unavailable
_in_memory_locks: Dict[str, asyncio.Lock] = {}
_active_session_tasks: Dict[str, asyncio.Task] = {}


def _get_fallback_lock(session_id: str) -> asyncio.Lock:
    if session_id not in _in_memory_locks:
        _in_memory_locks[session_id] = asyncio.Lock()
    return _in_memory_locks[session_id]


@asynccontextmanager
async def session_distributed_lock(session_id: str, timeout: float = 600.0, acquire_timeout: float = 5.0):
    """
    Distributed Redis Session Lock for multi-worker Uvicorn clustering.
    Ensures that concurrent requests (from rapid double-clicks or multiple tabs)
    cannot execute concurrent agent reasoning/file modifications on the same session.

    Features:
    - Distributed across all Uvicorn worker processes via Redis.
    - 600s TTL auto-expiry prevents permanent lockups if a worker crashes.
    - 5s wait-window: Queues rapid successive requests rather than immediately rejecting them.
    - Automatic recovery from cancelled or orphaned operations.
    - Gracefully falls back to local in-memory lock if Redis is unreachable.
    """
    lock_key = f"backtest_si:lock:session:{session_id}"
    redis_lock = None
    fallback_lock = None
    acquired = False

    try:
        pool = await job_queue.get_pool()
        if pool is not None:
            redis_lock = pool.lock(
                lock_key,
                timeout=timeout,
                blocking_timeout=acquire_timeout,
            )
            acquired = await redis_lock.acquire()
            if not acquired:
                # If acquire failed, check if the session task is no longer actively executing
                active_t = _active_session_tasks.get(session_id)
                if active_t is None or active_t.done():
                    logger.warning(f"[AGENT LOCK] Recovering orphaned Redis lock for session {session_id}")
                    await pool.delete(lock_key)
                    acquired = await redis_lock.acquire()
                if not acquired:
                    raise SessionBusyError(
                        f"Session '{session_id}' is currently busy with another operation. Please wait."
                    )
    except SessionBusyError:
        raise
    except (redis.exceptions.RedisError, ConnectionRefusedError, OSError) as err:
        logger.warning(
            f"[AGENT LOCK] Redis lock unavailable ({err}), falling back to in-memory lock for {session_id}"
        )
        redis_lock = None
    except Exception as exc:
        logger.warning(
            f"[AGENT LOCK] Unexpected error obtaining Redis lock ({exc}), falling back to in-memory lock"
        )
        redis_lock = None

    if redis_lock is None:
        fallback_lock = _get_fallback_lock(session_id)
        try:
            await asyncio.wait_for(fallback_lock.acquire(), timeout=acquire_timeout)
            acquired = True
        except asyncio.TimeoutError:
            active_t = _active_session_tasks.get(session_id)
            if active_t is None or active_t.done():
                logger.warning(f"[AGENT LOCK] Recovering orphaned in-memory lock for session {session_id}")
                _in_memory_locks[session_id] = asyncio.Lock()
                fallback_lock = _in_memory_locks[session_id]
                await fallback_lock.acquire()
                acquired = True
            else:
                raise SessionBusyError(
                    f"Session '{session_id}' is currently busy with another operation. Please wait."
                )

    current_task = asyncio.current_task()
    if current_task:
        _active_session_tasks[session_id] = current_task

    try:
        yield
    finally:
        _active_session_tasks.pop(session_id, None)
        if redis_lock is not None and acquired:
            try:
                await redis_lock.release()
            except (redis.exceptions.LockNotOwnedError, redis.exceptions.LockError):
                pass
            except Exception as e:
                logger.warning(f"[AGENT LOCK] Error releasing Redis lock for {session_id}: {e}")
        elif fallback_lock is not None and acquired and fallback_lock.locked():
            try:
                fallback_lock.release()
            except RuntimeError:
                pass


# --- Subject Titler (2 to 5 words) ---

STOP_WORDS = {
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your', 'yours',
    'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but',
    'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for',
    'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on',
    'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
    'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don',
    'should', 'now', 'need', 'want', 'please', 'make', 'create', 'write', 'build',
    'dev', 'give', 'show', 'tell', 'help', 'like', 'based', 'using', 'propose',
    'develop', 'search', 'across', 'best', 'verified', 'run', 'between', 'let', 'lets'
}

QUANT_KEYWORDS = {
    'smc', 'ict', 'fvg', 'ob', 'bos', 'choch', 'orderblock', 'imbalance',
    'atr', 'rsi', 'macd', 'ema', 'sma', 'vwap', 'bollinger', 'bands',
    'scalper', 'scalping', 'breakout', 'mean_reversion', 'grid', 'martingale',
    'gold', 'xauusd', 'btcusdt', 'btc', 'eth', 'eurusd', 'gbpusd',
    '1h', '4h', '15m', '5m', '1m', 'd1', 'h1', 'h4', 'm15', 'm5', 'm1',
    'ea', 'mql5', 'python', 'polars', 'backtest', 'sweep', 'matrix', 'transpile',
    'strategy', 'alpha', 'trailing', 'stop', 'risk', 'arbitrage'
}

ACRONYMS = {'smc', 'ict', 'fvg', 'ob', 'bos', 'choch', 'atr', 'rsi', 'macd', 'ema', 'sma', 'vwap', 'ea', 'mql5', 'btc', 'xauusd', 'btcusdt', 'eth', 'eurusd', 'gbpusd', '1h', '4h', '15m', '5m', '1m', 'd1', 'h1', 'h4', 'm15', 'm5', 'm1'}


def generate_conversation_title(prompt: str) -> str:
    """
    Generates a concise, subject-focused conversation title strictly of 2 to 5 words.
    """
    if not prompt or not prompt.strip():
        return "Quant Strategy Session"

    cleaned = prompt.strip()
    cleaned = re.sub(r'(\d+)\s*([hHmMdDsS])\b', r'\1\2', cleaned)
    cleaned = re.sub(r'[^\w\s]', ' ', cleaned)
    raw_words = cleaned.split()

    quant_tokens = []
    normal_tokens = []

    for w in raw_words:
        wl = w.lower()
        if wl in QUANT_KEYWORDS or re.match(r'^\d+[hmd]$', wl):
            quant_tokens.append(w)
        elif wl not in STOP_WORDS and len(wl) > 1 and not wl.isdigit():
            normal_tokens.append(w)

    selected = quant_tokens + [w for w in normal_tokens if w not in quant_tokens]

    formatted = []
    seen = set()
    for w in selected:
        wl = w.lower()
        if wl in seen:
            continue
        seen.add(wl)

        if wl in ACRONYMS or re.match(r'^\d+[hmd]$', wl):
            formatted.append(w.upper())
        elif wl in {'scalping', 'scalper'}:
            formatted.append('Scalper')
        elif wl in {'startegy', 'strategy'}:
            formatted.append('Strategy')
        else:
            formatted.append(w.capitalize())

        if len(formatted) == 5:
            break

    if len(formatted) < 2:
        for w in raw_words:
            wl = w.lower()
            if wl not in seen and len(wl) > 1:
                formatted.append(w.capitalize())
                seen.add(wl)
            if len(formatted) >= 2:
                break

    if len(formatted) < 2:
        formatted.append("Strategy")

    formatted = formatted[:5]
    return " ".join(formatted)


def build_context_envelope(
    strategy: str,
    version: Optional[str] = None,
    version_tests_count: int = 0,
    next_test_number: int = 1,
    telemetry: Optional[Dict[str, Any]] = None,
    manifest: Optional[Any] = None,
    viewing_file: Optional[str] = None,
) -> str:
    ver_clean = str(version).strip() if version and str(version).strip() else "v1"
    if not ver_clean.startswith("v") and ver_clean.isdigit():
        ver_clean = f"v{ver_clean}"

    header_prefix = f"\n\n{manifest.to_compact_header()}" if manifest and hasattr(manifest, "to_compact_header") else ""
    ctx_info = f"{header_prefix}\n\n[ACTIVE WORKSPACE CONTEXT: Strategy='{strategy}', Version='{ver_clean}', Version_Tests_Count={version_tests_count}, Next_Test_Number={next_test_number}]"
    ctx_info += "\n[IMPORTANT: This active strategy context applies strictly to modifications and tests for this specific strategy. If the user explicitly asks to brainstorm or develop a brand new, different strategy, synthesize a brand new distinct file and DO NOT overwrite this strategy.]"
    if viewing_file and viewing_file != strategy and viewing_file != f"{strategy}.mq5":
        ctx_info += f"\n[OPEN EDITOR REFERENCE: The trader currently has '{viewing_file}' open in their editor tab for reference, while actively developing '{strategy}'. Do NOT modify '{viewing_file}' unless explicitly requested.]"
    if telemetry:
        try:
            ctx_info += f"\n[RECENT TELEMETRY: {json.dumps(telemetry)}]"
        except Exception:
            pass
    return ctx_info


# --- Request & Response Models ---

class CreateSessionRequest(BaseModel):
    user_id: str = "default_user"
    title: Optional[str] = None


class UpdateSessionRequest(BaseModel):
    title: str


class SessionResponse(BaseModel):
    session_id: str
    user_id: str
    title: str
    state: str
    created_at: str
    updated_at: str
    message_count: int = 0


class ChatRequest(BaseModel):
    session_id: str
    prompt: str
    user_id: Optional[str] = "default_user"
    provider: Optional[str] = None  # "gemini" | "agentrouter" | "openrouter" | "anthropic"
    model: Optional[str] = None
    think_level: Optional[str] = None  # "low" | "medium" | "high"
    active_strategy: Optional[str] = None
    active_version: Optional[str] = None
    viewing_file: Optional[str] = None
    context_metadata: Optional[Dict[str, Any]] = None


class ResumeRequest(BaseModel):
    session_id: str
    user_response: str
    user_id: Optional[str] = "default_user"
    provider: Optional[str] = None
    model: Optional[str] = None
    think_level: Optional[str] = None


class CancelSessionRequest(BaseModel):
    session_id: Optional[str] = None


class UploadFileResponse(BaseModel):
    file_id: str
    filename: str
    file_type: str
    size_bytes: int
    url: str
    uploaded_at: str


class AsyncTurnRequest(BaseModel):
    prompt: str
    user_id: Optional[str] = "default_user"
    provider: Optional[str] = None
    model: Optional[str] = None
    think_level: Optional[str] = None


# --- Harness Helper ---

def _get_or_create_harness(
    session_id: str,
    user_id: str = "default_user",
    provider: Optional[str] = None,
    model: Optional[str] = None,
    think_level: Optional[str] = None,
) -> AgentHarness:
    """Retrieves or restores an active AgentHarness instance with domain tools registered."""
    if session_id in _active_harnesses:
        harness = _active_harnesses[session_id]
        fresh_session = _storage.load_session(session_id)
        if fresh_session:
            harness.session = fresh_session
            if user_id and user_id != "default_user":
                harness.session.user_id = user_id
                harness.user_id = user_id
        if user_id and user_id != "default_user" and getattr(harness, "user_id", None) != user_id:
            harness.user_id = user_id
            if hasattr(harness, "session") and harness.session:
                harness.session.user_id = user_id
            register_workspace_tools(harness, user_id=user_id)
            register_strategy_tools(harness, user_id=user_id)
        if provider or model or think_level:
            new_adapter = create_llm_adapter(
                provider=provider,
                model=model,
                think_level=think_level,
            )
            harness.llm = new_adapter
            harness.llm_adapter = new_adapter
            _safe_print(
                f"\033[92m[AGENT API] Dynamically switched active LLM for session {session_id} -> "
                f"Provider: {provider} | Adapter: {new_adapter.__class__.__name__} | "
                f"Model: {getattr(new_adapter, 'model', None)} | Think: {getattr(new_adapter, 'think_level', None)}\033[0m"
            )
        _harness_last_accessed[session_id] = time.time()
        _evict_idle_harnesses()
        return harness

    adapter = create_llm_adapter(
        provider=provider,
        model=model,
        think_level=think_level,
    )

    # Check if session exists in storage to restore
    existing = _storage.load_session(session_id)
    if existing:
        if user_id and user_id != "default_user":
            existing.user_id = user_id
        harness = AgentHarness.restore(
            session_id=session_id,
            storage=_storage,
            llm_adapter=adapter,
            max_turns=60,
        )
        if user_id and user_id != "default_user":
            harness.user_id = user_id
    else:
        harness = AgentHarness(
            session_id=session_id,
            user_id=user_id,
            llm_adapter=adapter,
            max_turns=60,
            storage=_storage,
        )

    # Register all domain, MT5 MCP, and workspace tools
    register_strategy_tools(harness, user_id=user_id)
    register_execution_tools(harness)
    register_analytical_tools(harness)
    register_research_tools(harness)
    register_workspace_tools(harness, user_id=user_id)
    register_mt5_mcp_tools(harness)

    _active_harnesses[session_id] = harness
    _harness_last_accessed[session_id] = time.time()
    _evict_idle_harnesses()
    return harness


# --- Endpoints ---

@router.get("/providers")
def get_available_providers():
    """Returns available LLM providers, models, and reasoning think levels."""
    return {
        "default_provider": os.environ.get("LLM_PROVIDER", "gemini"),
        "default_think_level": os.environ.get("THINK_LEVEL", "medium"),
        "providers": [
            {
                "id": "meta",
                "name": "Meta Model API",
                "badge": "Hackathon",
                "default_model": os.environ.get("META_MODEL_EXECUTOR", "muse-spark-1.3-contributor"),
                "models": [
                    {"id": "muse-spark-1.3-contributor", "name": "Muse Spark 1.3 Contributor", "description": "Fast multimodal vision & tool calling"},
                    {"id": "muse-spark-1.3", "name": "Muse Spark 1.3", "description": "High-throughput execution engine"},
                    {"id": "muse-wonder", "name": "Muse Wonder", "description": "Deep mathematical & quantitative reasoning"},
                ]
            },
            {
                "id": "gemini",
                "name": "Google Gemini",
                "badge": "Flagship",
                "default_model": "gemini-3.8-flash",
                "models": [
                    {"id": "gemini-3.8-flash", "name": "Gemini 3.8 Flash", "description": "Hybrid thinking flagship"},
                    {"id": "gemini-3.5-flash-lite", "name": "Gemini 3.5 Flash Lite", "description": "Ultra fast & reliable"},
                ]
            },
            {
                "id": "freeinference",
                "name": "FreeInference",
                "badge": "Free GPU",
                "default_model": "deepseek-v4-flash",
                "models": [
                    {"id": "deepseek-v4-flash", "name": "DeepSeek V4 Flash", "description": "Autonomous quant reasoning"},
                    {"id": "glm-5.3-flash", "name": "GLM-5.3 Flash", "description": "1M context always-on reasoning"},
                    {"id": "qwen3.6-35b", "name": "Qwen3.6 35B", "description": "High speed quantitative reasoning"},
                ]
            },
            {
                "id": "agentrouter",
                "name": "DeepSeek / AgentRouter",
                "badge": "Reasoning",
                "default_model": "deepseek-v4-flash",
                "models": [
                    {"id": "deepseek-v4-flash", "name": "DeepSeek V4 Flash", "description": "Autonomous quant reasoning"},
                ]
            },
            {
                "id": "openrouter",
                "name": "OpenRouter",
                "badge": "Multi-Model",
                "default_model": "nvidia/nemotron-3.5-lightning:free",
                "models": [
                    {"id": "nvidia/nemotron-3.5-lightning:free", "name": "Nemotron 3.5 Lightning", "description": "Free high parameter"},
                ]
            },
            {
                "id": "anthropic",
                "name": "Claude (Anthropic)",
                "badge": "Quant Grade",
                "default_model": "claude-opus-5.5",
                "models": [
                    {"id": "claude-opus-5.5", "name": "Claude Opus 5.5", "description": "Precision alpha modeling"},
                ]
            }
        ],
        "think_levels": [
            {"id": "low", "name": "Fast / Direct", "description": "Direct answers with minimal latency"},
            {"id": "medium", "name": "Balanced CoT", "description": "Structured quantitative reasoning"},
            {"id": "high", "name": "Deep Quant Rigor", "description": "Exhaustive math, risk & edge verification"},
        ]
    }


def _extract_effective_user(request: Request, user_id: Optional[str] = None) -> str:
    claims = getattr(request.state, "user_claims", None)
    uid = getattr(request.state, "user_id", None) or (claims.get("sub") if claims else None)
    if uid:
        return str(uid)
    return user_id or "default"


@router.post("/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(req: CreateSessionRequest, request: Request):
    """Creates a new agent intelligence session."""
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    effective_user = _extract_effective_user(request, req.user_id)
    harness = _get_or_create_harness(session_id, user_id=effective_user)
    harness.session.title = req.title or "New Strategy Session"
    _storage.save_session(harness.session)

    return SessionResponse(
        session_id=session_id,
        user_id=effective_user,
        title=harness.session.title,
        state=harness.session.state.value,
        created_at=harness.session.created_at,
        updated_at=harness.session.updated_at,
        message_count=len(harness.session.history),
    )


@router.get("/sessions", response_model=List[Dict[str, Any]])
def list_sessions(request: Request, user_id: Optional[str] = Query(None)):
    """Lists saved agent sessions (all if user_id is omitted or for specified user)."""
    effective_user = _extract_effective_user(request, user_id)
    return _storage.list_user_sessions(user_id=effective_user)


@router.patch("/sessions/{session_id}")
def update_session(session_id: str, req: UpdateSessionRequest, request: Request):
    """Updates session metadata such as conversation title."""
    session = _storage.load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    effective_user = _extract_effective_user(request)
    if session.user_id != effective_user and effective_user not in ("default", "default_user"):
        raise HTTPException(status_code=403, detail="Forbidden: Session belongs to another user.")
    success = _storage.update_session_title(session_id, req.title)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session_id in _active_harnesses:
        _active_harnesses[session_id].session.title = req.title
    return {"session_id": session_id, "title": req.title}


def sanitize_user_message_content(content: str) -> str:
    """Strips internal system envelopes and manifest tags from user messages."""
    if not content or not isinstance(content, str):
        return content or ""
    patterns = [
        r"\n*\[STRATEGY MANIFEST:[^\]]*\]",
        r"\n*\[OPEN EDITOR REFERENCE:[^\]]*\]",
        r"\n*\[REFERENCE CONTEXT:[^\]]*\]",
        r"\n*\[ACTIVE WORKSPACE CONTEXT:[^\]]*\]",
        r"\n*\[RECENT TELEMETRY:[^\]]*\]",
        r"\n*\[Target File:[^\]]*\]",
    ]
    cleaned = content
    for pat in patterns:
        cleaned = re.sub(pat, "", cleaned, flags=re.DOTALL | re.IGNORECASE)
    return cleaned.strip()


@router.get("/sessions/{session_id}")
def get_session(session_id: str, request: Request):
    """Retrieves full session history, CoT thoughts, and pending interactions."""
    session = _storage.load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    effective_user = _extract_effective_user(request)
    if session.user_id != effective_user and effective_user not in ("default", "default_user"):
        raise HTTPException(status_code=403, detail="Forbidden: Session belongs to another user.")

    sanitized_history = []
    for msg in session.history:
        d = msg.model_dump()
        if d.get("role") == "user" and isinstance(d.get("content"), str):
            d["content"] = sanitize_user_message_content(d["content"])
        sanitized_history.append(d)

    return {
        "session_id": session.session_id,
        "user_id": session.user_id,
        "title": session.title,
        "state": session.state.value,
        "pending_interaction": session.pending_interaction,
        "history": sanitized_history,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
    }


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: str, request: Request):
    """Permanently deletes an agent research session and its history."""
    session = _storage.load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    effective_user = _extract_effective_user(request)
    if session.user_id != effective_user and effective_user not in ("default", "default_user"):
        raise HTTPException(status_code=403, detail="Forbidden: Cannot delete another user's session.")
    _active_harnesses.pop(session_id, None)
    _harness_last_accessed.pop(session_id, None)
    _in_memory_locks.pop(session_id, None)
    success = _storage.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found.")
    return None


@router.post("/sessions/{session_id}/cancel")
@router.post("/cancel")
async def cancel_session_execution(
    session_id: Optional[str] = None,
    req: Optional[CancelSessionRequest] = None,
):
    """
    Cooperatively halts active LLM reasoning, event streams, and tool execution for a session.
    """
    target_id = session_id or (req.session_id if req else None)
    if not target_id:
        raise HTTPException(status_code=400, detail="session_id is required.")

    harness = _active_harnesses.get(target_id)
    if harness:
        harness.cancel()
        _safe_print(f"\033[93m[AGENT API] Cooperatively cancelled active harness for session: {target_id}\033[0m")
    else:
        session = _storage.load_session(target_id)
        if session:
            session.state = AgentState.DONE
            session.pending_interaction = None
            _storage.save_session(session)

    return {"status": "cancelled", "session_id": target_id}


async def pump_events_with_keepalive(
    generator: AsyncGenerator[TrajectoryEvent, None],
    keepalive_interval: float = 3.0,
) -> AsyncGenerator[str, None]:
    """
    Safely yields SSE data frames from an async event generator while pumping
    periodic SSE comment keep-alives (': keepalive\\n\\n') when the agent or
    long-running tools (like MT5 Strategy Tester or LLM reasoning) take time.

    CRITICAL ARCHITECTURAL DESIGN:
    Uses an internal queue and producer task so that timeout cancellations on
    queue.get() NEVER cancel or abort the underlying agent generator!
    """
    queue: asyncio.Queue[TrajectoryEvent | Exception | object] = asyncio.Queue()
    DONE_SENTINEL = object()

    async def producer():
        try:
            async for item in generator:
                await queue.put(item)
        except Exception as exc:
            await queue.put(exc)
        finally:
            await queue.put(DONE_SENTINEL)

    producer_task = asyncio.create_task(producer())

    try:
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=keepalive_interval)
                if item is DONE_SENTINEL:
                    break
                if isinstance(item, Exception):
                    raise item
                if isinstance(item, TrajectoryEvent):
                    event = item
                    payload_str = json.dumps({
                        "event_type": event.event_type.value,
                        "step_index": event.step_index,
                        "payload": event.payload,
                        "timestamp": event.timestamp_utc,
                    })
                    yield f"data: {payload_str}\n\n"
                    await asyncio.sleep(0.002)
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
    finally:
        if not producer_task.done():
            producer_task.cancel()
            try:
                await producer_task
            except (asyncio.CancelledError, Exception):
                pass


@router.post("/chat")
async def chat_stream(req: ChatRequest, request: Request):
    """
    Server-Sent Events (SSE) streaming endpoint for agent conversation.
    Streams thought deltas, assistant messages, and tool events in real time.
    """
    harness = _get_or_create_harness(
        req.session_id,
        user_id=_extract_effective_user(request, req.user_id),
        provider=req.provider,
        model=req.model,
        think_level=req.think_level,
    )

    # Auto-derive 2-5 word subject title from prompt if default title
    is_generic = (
        not harness.session.title
        or harness.session.title in (
            "New Strategy Session",
            "Quantitative Research Session",
            "Quant Studio Alpha Session",
            "New Session",
            "Strategy Session",
        )
        or harness.session.title.startswith("Strategy Session sess_")
    )
    title_updated: Optional[str] = None
    if (is_generic or len(harness.session.history) == 0) and req.prompt:
        derived = generate_conversation_title(req.prompt)
        harness.session.title = derived
        _storage.update_session_title(req.session_id, derived)
        title_updated = derived

    _safe_print(f"\n\033[96m{'='*80}\033[0m")
    _safe_print(
        f"\033[96m[AGENT API] POST /chat | Session: {req.session_id} | Title: {harness.session.title} | "
        f"Provider: {req.provider} | Model: {req.model} | Active LLM: {harness.llm.__class__.__name__}\033[0m"
    )
    _safe_print(f"\033[97m[AGENT API] User Prompt: \"{req.prompt}\"\033[0m")
    _safe_print(f"\033[96m{'='*80}\033[0m")

    async def event_generator():
        try:
            async with session_distributed_lock(req.session_id):
                harness.reset_cancellation()
                # Emit updated title if derived
                if title_updated:
                    title_payload = json.dumps({
                        "event_type": "SESSION_TITLE",
                        "step_index": 0,
                        "payload": {"title": harness.session.title, "session_id": req.session_id},
                        "timestamp": utc_now_iso(),
                    })
                    yield f"data: {title_payload}\n\n"

                harness.viewing_file = req.viewing_file
                # Context envelope injection for active strategy continuity
                ctx_info = None
                if req.active_strategy:
                    try:
                        harness.sync_strategy_manifest(req.active_strategy)
                    except Exception as e:
                        logger.warning(f"[AGENT API] Could not sync manifest for {req.active_strategy}: {e}")

                    meta = req.context_metadata or {}
                    v_tests_count = int(meta.get("version_tests_count", 0))
                    n_test_num = int(meta.get("next_test_number", v_tests_count + 1))
                    ctx_info = build_context_envelope(
                        strategy=req.active_strategy,
                        version=req.active_version,
                        version_tests_count=v_tests_count,
                        next_test_number=n_test_num,
                        telemetry=req.context_metadata,
                        manifest=getattr(harness.session, "strategy_manifest", None),
                        viewing_file=req.viewing_file,
                    )
                else:
                    harness.session.strategy_manifest = None
                    if req.viewing_file:
                        ctx_info = (
                            f"[OPEN EDITOR REFERENCE: The trader currently has '{req.viewing_file}' open in their editor tab for reference only. "
                            f"You are in New Strategy Synthesis mode. Do NOT modify, edit, or overwrite '{req.viewing_file}'. "
                            f"Synthesize a brand new distinct strategy file.]"
                        )

                # Ensure cancellation flag is reset so new turn runs cleanly
                harness.reset_cancellation()

                # If waiting for user interaction from ask_user, auto-resume with clean user response
                generator = (
                    harness.resume(user_response=req.prompt, context_envelope=ctx_info)
                    if harness.session.state == AgentState.WAITING_FOR_USER
                    else harness.run(user_prompt=req.prompt, context_envelope=ctx_info)
                )
                async for sse_frame in pump_events_with_keepalive(generator, keepalive_interval=3.0):
                    yield sse_frame
        except SessionBusyError as busy_err:
            logger.warning(f"[AGENT API] {busy_err}")
            err_payload = json.dumps({
                "event_type": EventType.AGENT_ERROR.value,
                "step_index": -1,
                "payload": {"error": str(busy_err)},
            })
            yield f"data: {err_payload}\n\n"
        except Exception as exc:
            err_msg = str(exc).strip() or f"{type(exc).__name__}: Agent stream failed"
            logger.error(f"[AGENT API] Stream exception: {err_msg}", exc_info=True)
            _safe_print(f"\033[91m[AGENT API ERROR] {err_msg}\033[0m")
            err_payload = json.dumps({
                "event_type": EventType.AGENT_ERROR.value,
                "step_index": -1,
                "payload": {"error": err_msg, "error_type": type(exc).__name__},
            })
            yield f"data: {err_payload}\n\n"
        finally:
            if harness and hasattr(harness, "session") and harness.session:
                if harness.session.state not in (AgentState.DONE, AgentState.WAITING_FOR_USER):
                    harness._set_state(AgentState.DONE)
                    harness._persist()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform", "Content-Type": "text/event-stream; charset=utf-8",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/resume")
async def resume_stream(req: ResumeRequest, request: Request):
    """
    Resumes an agent session waiting on Human-in-the-Loop user clarification or approval.
    """
    if not req.user_response or not req.user_response.strip():
        raise HTTPException(
            status_code=400,
            detail="User response cannot be empty.",
        )

    session_exists = (
        req.session_id in _active_harnesses
        or _storage.load_session(req.session_id) is not None
    )
    if not session_exists:
        raise HTTPException(
            status_code=404,
            detail=f"Session '{req.session_id}' not found.",
        )

    harness = _get_or_create_harness(
        req.session_id,
        user_id=_extract_effective_user(request, req.user_id),
        provider=req.provider,
        model=req.model,
        think_level=req.think_level,
    )
    if harness.session.state != AgentState.WAITING_FOR_USER:
        raise HTTPException(
            status_code=400,
            detail=f"Session is not waiting for user interaction (current state: {harness.session.state.value}).",
        )

    async def event_generator():
        try:
            async with session_distributed_lock(req.session_id):
                generator = harness.resume(user_response=req.user_response)
                async for sse_frame in pump_events_with_keepalive(generator, keepalive_interval=3.0):
                    yield sse_frame
        except SessionBusyError as busy_err:
            logger.warning(f"[AGENT API] {busy_err}")
            err_payload = json.dumps({
                "event_type": EventType.AGENT_ERROR.value,
                "step_index": -1,
                "payload": {"error": str(busy_err)},
            })
            yield f"data: {err_payload}\n\n"
        except Exception as exc:
            err_msg = str(exc).strip() or f"{type(exc).__name__}: Agent execution interrupted during resume."
            logger.error(f"[AGENT RESUME ERROR] {err_msg}", exc_info=True)
            _safe_print(f"\033[91m[AGENT RESUME ERROR] {err_msg}\033[0m")
            err_payload = json.dumps({
                "event_type": EventType.AGENT_ERROR.value,
                "step_index": -1,
                "payload": {"error": err_msg, "error_type": type(exc).__name__},
            })
            yield f"data: {err_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform", "Content-Type": "text/event-stream; charset=utf-8",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/sessions/{session_id}/cancel")
async def cancel_session(session_id: str):
    """
    Aborts active execution and tool running for the given session.
    Proactively cancels active asyncio task and clears distributed/in-memory locks.
    """
    harness = _active_harnesses.get(session_id)
    if harness:
        harness.cancel()
        _safe_print(f"\033[1;33m[AGENT API] Session {session_id} cancelled via API.\033[0m")
    
    # 1. Proactively cancel the running asyncio Task if any
    task = _active_session_tasks.pop(session_id, None)
    if task and not task.done():
        logger.info(f"[AGENT API] Proactively cancelling running task for session {session_id}")
        task.cancel()

    # 2. Reset in-memory fallback lock
    if session_id in _in_memory_locks:
        _in_memory_locks[session_id] = asyncio.Lock()

    # 3. Release any lingering distributed lock in Redis
    try:
        pool = await job_queue.get_pool()
        if pool is not None:
            await pool.delete(f"backtest_si:lock:session:{session_id}")
    except Exception:
        pass

    return {"status": "cancelled", "session_id": session_id}


@router.get("/tools")
def list_available_tools():
    """Lists all registered quant tools available to the SI agent."""
    dummy_harness = _get_or_create_harness("tools_meta_session")
    tools = []
    for t in dummy_harness._tools.values():
        tools.append({
            "name": t.name,
            "description": t.description,
            "parameters": t.parameters,
            "is_interactive": t.is_interactive,
        })
    return {"count": len(tools), "tools": tools}


@router.post("/upload", response_model=UploadFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(file: UploadFile = File(...)):
    """
    Uploads a code file, dataset, or chart image to provide multi-modal context to the SI agent.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename missing.")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File extension '{suffix}' not supported. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    file_id = f"upl_{uuid.uuid4().hex[:12]}"
    safe_filename = f"{file_id}_{Path(file.filename).name}"
    target_path = UPLOAD_DIR / safe_filename

    content = await file.read()
    size_bytes = len(content)

    with open(target_path, "wb") as f:
        f.write(content)

    logger.info(f"[Upload] Saved uploaded file {safe_filename} ({size_bytes} bytes)")

    return UploadFileResponse(
        file_id=file_id,
        filename=file.filename,
        file_type=file.content_type or suffix,
        size_bytes=size_bytes,
        url=f"/api/v1/agent/files/{file_id}",
        uploaded_at=utc_now_iso(),
    )


@router.get("/files/{file_id}")
async def get_uploaded_file(file_id: str):
    """Retrieves an uploaded asset or image by file_id."""
    matches = list(UPLOAD_DIR.glob(f"{file_id}_*"))
    if not matches:
        raise HTTPException(status_code=404, detail="File not found.")

    target = matches[0]
    return FileResponse(path=str(target), filename=target.name.split("_", 2)[-1])


@router.post("/sessions/{session_id}/turn/async", status_code=status.HTTP_202_ACCEPTED)
async def run_turn_async(session_id: str, req: AsyncTurnRequest, request: Request):
    """
    Dispatches a heavy agent reasoning turn to the ARQ Redis background worker pool.
    Returns immediately with a job_id for non-blocking client interaction.
    """
    try:
        effective_user = _extract_effective_user(request, req.user_id)
        job_id = await job_queue.enqueue(
            "run_agent_turn_job",
            session_id=session_id,
            prompt=req.prompt,
            user_id=effective_user,
            provider=req.provider,
        )
        return {
            "job_id": job_id,
            "session_id": session_id,
            "status": "queued",
            "message": "Agent turn dispatched to background worker.",
        }
    except Exception as e:
        logger.exception(f"Failed to enqueue async agent turn: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to queue agent turn: {str(e)}")
