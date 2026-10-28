"""
Multi-provider LLM Adapter for DeepSeek Agent Harness (DSH).
Supports OpenRouter for Development and Anthropic (Claude Opus 5.5) for Production.
"""

from __future__ import annotations
import abc
import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx

from ..core.types import ModelChunk
from ..core.parser import StreamThoughtParser
from ..core.types import Message, Role, ToolCall, ToolDefinition

logger = logging.getLogger("backtest_ai.agent.adapters")


def load_env_file() -> None:
    """Loads variables from .env file if not already set in os.environ."""
    candidates = [
        Path.cwd() / ".env",
        Path.cwd().parent / ".env",
        Path(__file__).resolve().parents[4] / ".env",
    ]
    for p in candidates:
        if p.exists() and p.is_file():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            key, val = line.split("=", 1)
                            key = key.strip()
                            val = val.strip().strip("'\"")
                            if key not in os.environ:
                                os.environ[key] = val
            except Exception:
                pass


load_env_file()


class BaseLLMAdapter(abc.ABC):
    """Abstract base class for all LLM reasoning providers."""

    @abc.abstractmethod
    async def generate_turn(
        self,
        messages: List[Message],
        tools: List[ToolDefinition],
    ) -> AsyncGenerator[ModelChunk, None]:
        """Streams model thinking, visible content, and tool calls."""
        yield ModelChunk()


def _sanitize_message_content(role: str, content: Optional[str], max_chars: int = 16000) -> str:
    """
    Defensively prunes oversized message content before transmission to LLM APIs.
    Prevents HTTP 400 Context Length Overflow errors caused by bloated tool payloads,
    massive raw trade ledgers, or gigantic log dumps.
    """
    if not content:
        return ""

    # Special handling for oversized JSON tool outputs
    if role == "tool":
        try:
            data = json.loads(content)
            if isinstance(data, dict):
                modified = False
                for array_key in ("trades", "deals", "bars", "ticks", "sample_trades"):
                    if array_key in data and isinstance(data[array_key], list) and len(data[array_key]) > 10:
                        data[array_key] = data[array_key][:3] + data[array_key][-3:]
                        modified = True
                if modified:
                    content = json.dumps(data)
        except Exception:
            pass

    if len(content) > max_chars:
        half = max_chars // 2
        omitted = len(content) - max_chars
        content = (
            content[:half]
            + f"\n\n[... OMITTED {omitted} CHARACTERS FOR CONTEXT SAFETY ...]\n\n"
            + content[-half:]
        )

    return content


def _format_openai_messages(messages: List[Message]) -> List[Dict[str, Any]]:
    """
    Formats messages for OpenAI-compatible endpoints with strict sequence sanitization.
    Guarantees that role='tool' messages only follow an assistant message with matching tool_calls,
    synthesizing resolution for orphaned or misplaced calls to prevent API 400 errors.
    """
    raw_items: List[Dict[str, Any]] = []
    for msg in messages:
        content = msg.content
        # Preserve CoT in multi-turn context (DSH Invariant)
        if msg.thought and msg.role == Role.ASSISTANT:
            content = f"<think>\n{msg.thought}\n</think>\n{content or ''}".strip()

        sanitized_content = _sanitize_message_content(msg.role.value, content)
        item: Dict[str, Any] = {
            "role": msg.role.value,
            "content": sanitized_content,
        }

        if msg.role == Role.ASSISTANT and msg.tool_calls:
            item["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.name,
                        "arguments": json.dumps(tc.arguments) if isinstance(tc.arguments, dict) else str(tc.arguments),
                    },
                }
                for tc in msg.tool_calls
            ]

        if msg.role == Role.TOOL:
            item["tool_call_id"] = msg.tool_call_id or ""

        raw_items.append(item)

    sanitized: List[Dict[str, Any]] = []
    pending_tool_call_ids: set[str] = set()

    for item in raw_items:
        role = item.get("role")
        if role == "tool":
            tcid = item.get("tool_call_id", "")
            if tcid in pending_tool_call_ids:
                sanitized.append(item)
                pending_tool_call_ids.remove(tcid)
            else:
                # Orphaned tool message: convert to user message context to avoid breaking OpenAI schema
                sanitized.append({
                    "role": "user",
                    "content": f"[Tool Result ({tcid})]: {item.get('content', '')}",
                })
        else:
            # If previous assistant had unresolved tool calls before this non-tool message, synthesize resolution
            if pending_tool_call_ids:
                for missing_id in list(pending_tool_call_ids):
                    sanitized.append({
                        "role": "tool",
                        "tool_call_id": missing_id,
                        "content": json.dumps({"status": "completed"}),
                    })
                pending_tool_call_ids.clear()

            if role == "assistant" and item.get("tool_calls"):
                for tc in item["tool_calls"]:
                    pending_tool_call_ids.add(tc["id"])

            sanitized.append(item)

    # Guard against OpenAI/FreeInference 400: "No user query found in messages."
    if not any(m.get("role") == "user" for m in sanitized):
        insert_idx = 1 if (sanitized and sanitized[0].get("role") == "system") else 0
        sanitized.insert(insert_idx, {
            "role": "user",
            "content": "Please proceed with analyzing and developing the quantitative strategy.",
        })

    return sanitized


def _format_openai_tools(tools: List[ToolDefinition]) -> Optional[List[Dict[str, Any]]]:
    """
    Formats tool definitions for OpenAI-compatible schemas, ensuring valid object structure
    and an explicit 'required' array to prevent API 400 validation rejections.
    """
    if not tools:
        return None
    formatted = []
    for t in tools:
        params = dict(t.parameters) if t.parameters else {"type": "object", "properties": {}}
        if "type" not in params:
            params["type"] = "object"
        if "properties" not in params:
            params["properties"] = {}
        if "required" not in params or params["required"] is None:
            params["required"] = []
        formatted.append({
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": params,
            },
        })
    return formatted


def _accumulate_tool_delta(
    tool_call_accumulators: Dict[int, Dict[str, Any]],
    td: Dict[str, Any],
) -> None:
    """
    Safely accumulates streaming tool deltas from OpenAI, OpenRouter, DeepSeek, and Gemini.
    Detects boundaries between distinct tool calls even when streaming deltas omit
    or reuse tool call indices, preventing name and argument concatenation.
    """
    raw_idx = td.get("index")
    func = td.get("function", {}) if isinstance(td.get("function"), dict) else {}
    call_id = td.get("id")
    func_name = func.get("name", "")
    func_args = func.get("arguments", "")

    # Determine candidate slot
    if raw_idx is not None and isinstance(raw_idx, int):
        idx = raw_idx
        # If raw_idx points to an earlier accumulator, but a newer accumulator was already spawned
        # and has the matching id, or is waiting for its arguments:
        if tool_call_accumulators:
            latest_idx = max(tool_call_accumulators.keys())
            if latest_idx > idx:
                latest_cur = tool_call_accumulators[latest_idx]
                if (call_id and latest_cur.get("id") == call_id) or (not call_id and not func_name):
                    idx = latest_idx
    else:
        idx = max(tool_call_accumulators.keys()) if tool_call_accumulators else 0

    # Boundary detection: If this slot already exists, check if this delta represents a NEW tool call
    if idx in tool_call_accumulators:
        cur = tool_call_accumulators[idx]
        cur_has_args = bool(cur.get("arguments", "").strip())
        cur_has_name = bool(cur.get("name", "").strip())
        cur_id = cur.get("id", "")

        is_new_call = False
        # Condition A: A new distinct call_id arrived
        if call_id and cur_id and not cur_id.startswith("call_") and call_id != cur_id:
            is_new_call = True
        # Condition B: A function name arrived when arguments have already been accumulated for the current call
        elif func_name and cur_has_name and cur_has_args and func_name != cur["name"]:
            is_new_call = True

        if is_new_call:
            idx = max(tool_call_accumulators.keys()) + 1

    if idx not in tool_call_accumulators:
        tool_call_accumulators[idx] = {
            "id": call_id or f"call_{idx}",
            "name": func_name or "",
            "arguments": func_args or "",
        }
        return

    cur = tool_call_accumulators[idx]
    if call_id and (not cur["id"] or cur["id"].startswith("call_")):
        cur["id"] = call_id

    if func_name:
        if not cur["name"]:
            cur["name"] = func_name
        elif cur["name"] == func_name:
            pass
        elif cur["name"].endswith(func_name):
            pass
        else:
            cur["name"] += func_name

    if func_args:
        cur["arguments"] += func_args


def _parse_possibly_concatenated_json(raw_str: str) -> List[Dict[str, Any]]:
    """
    Parses a string that may contain one or multiple concatenated JSON objects.
    e.g. '{"a": 1}{"b": 2}' -> [{'a': 1}, {'b': 2}]
    """
    cleaned = raw_str.strip()
    if not cleaned:
        return []

    try:
        single = json.loads(cleaned)
        if isinstance(single, dict):
            return [single]
    except Exception:
        pass

    decoder = json.JSONDecoder()
    results = []
    idx = 0
    length = len(cleaned)

    while idx < length:
        while idx < length and cleaned[idx].isspace():
            idx += 1
        if idx >= length:
            break
        try:
            obj, end_idx = decoder.raw_decode(cleaned, idx)
            if isinstance(obj, dict):
                results.append(obj)
            idx = end_idx
        except Exception:
            break

    return results


def _build_final_tool_calls(
    tool_call_accumulators: Dict[int, Dict[str, Any]],
) -> List[ToolCall]:
    """Builds clean ToolCall objects, resolving glued names and multi-object JSON payloads."""
    final_tool_calls: List[ToolCall] = []

    for idx in sorted(tool_call_accumulators.keys()):
        raw = tool_call_accumulators[idx]
        name = raw["name"].strip()
        raw_args = raw["arguments"].strip()
        call_id = raw.get("id", f"call_{idx}")

        if not name and not raw_args:
            continue

        parsed_objects = _parse_possibly_concatenated_json(raw_args) if raw_args else []

        if len(parsed_objects) > 1:
            for p_idx, p_args in enumerate(parsed_objects):
                sub_id = f"{call_id}_{p_idx}" if p_idx > 0 else call_id
                final_tool_calls.append(
                    ToolCall(id=sub_id, name=name, arguments=p_args)
                )
        elif len(parsed_objects) == 1:
            final_tool_calls.append(
                ToolCall(id=call_id, name=name, arguments=parsed_objects[0])
            )
        else:
            parsed_args: Dict[str, Any] = {}
            if raw_args:
                try:
                    parsed_args = json.loads(raw_args)
                except Exception:
                    parsed_args = {"raw_arguments": raw_args}
            final_tool_calls.append(
                ToolCall(id=call_id, name=name, arguments=parsed_args)
            )

    return final_tool_calls


class OpenRouterAdapter(BaseLLMAdapter):
    """
    Adapter for OpenRouter API (OpenAI-compatible format).
    Used during development for free and cost-efficient models.
    """

    DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
    DEFAULT_MODEL = "nvidia/nemotron-3.5-lightning:free"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        temperature: float = 0.2,
        timeout: float = 90.0,
    ) -> None:
        self.api_key = api_key or os.environ.get("OPENROUTER_API_KEY", "")
        self.model = model or os.environ.get("OPENROUTER_MODEL", self.DEFAULT_MODEL)
        self.base_url = (base_url or os.environ.get("OPENROUTER_BASE_URL", self.DEFAULT_BASE_URL)).rstrip("/")
        self.temperature = temperature
        self.timeout = timeout

        if not self.api_key:
            logger.warning("OPENROUTER_API_KEY is not set. Requests will fail if unauthorized.")

    def _format_messages(self, messages: List[Message]) -> List[Dict[str, Any]]:
        return _format_openai_messages(messages)

    def _format_tools(self, tools: List[ToolDefinition]) -> Optional[List[Dict[str, Any]]]:
        return _format_openai_tools(tools)

    async def generate_turn(
        self,
        messages: List[Message],
        tools: List[ToolDefinition],
    ) -> AsyncGenerator[ModelChunk, None]:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://backtest-si.internal",
            "X-Title": "Backtest-SI Quantitative Agent",
        }

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": self._format_messages(messages),
            "temperature": self.temperature,
            "stream": True,
        }

        formatted_tools = self._format_tools(tools)
        if formatted_tools:
            payload["tools"] = formatted_tools

        thought_parser = StreamThoughtParser()
        tool_call_accumulators: Dict[int, Dict[str, Any]] = {}
        yielded_any_chunk = False

        max_retries = 3
        backoff_delays = [1.5, 3.0, 5.0]

        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    async with client.stream("POST", url, headers=headers, json=payload) as response:
                        if response.status_code in (429, 502, 503, 504) and attempt < max_retries - 1:
                            wait_sec = backoff_delays[attempt]
                            logger.warning(
                                f"[OpenAIAdapter] HTTP {response.status_code} received on attempt {attempt+1}/{max_retries}. "
                                f"Retrying in {wait_sec}s..."
                            )
                            await asyncio.sleep(wait_sec)
                            continue

                        if response.status_code != 200:
                            err_body = await response.aread()
                            err_msg = f"OpenRouter API error {response.status_code}: {err_body.decode('utf-8', errors='ignore')}"
                            logger.error(err_msg)
                            yield ModelChunk(content_delta=f"\n[LLM Error: {err_msg}]", is_finished=True)
                            return

                        async for line in response.aiter_lines():
                            line = line.strip()
                            if not line or not line.startswith("data:"):
                                continue

                            data_str = line[5:].strip()
                            if data_str == "[DONE]":
                                break

                            try:
                                chunk_json = json.loads(data_str)
                            except json.JSONDecodeError:
                                continue

                            if not isinstance(chunk_json, dict):
                                continue

                            # Catch in-stream errors (e.g. 503 upstream provider overloaded)
                            if "error" in chunk_json:
                                err_msg = chunk_json["error"].get("message", "Upstream AI provider error")
                                print(f"\033[1;31m[OPENROUTER ERROR] {err_msg}\033[0m", flush=True)
                                yield ModelChunk(content_delta=f"\n[AI Provider Error: {err_msg}]", is_finished=True)
                                return

                            choices = chunk_json.get("choices", [])
                            if not choices:
                                continue

                            delta = choices[0].get("delta", {})

                            # 1. Native reasoning tokens (DeepSeek-R1, Nemotron reasoning delta)
                            native_reasoning = delta.get("reasoning") or delta.get("reasoning_content")
                            if native_reasoning:
                                yielded_any_chunk = True
                                yield ModelChunk(thought_delta=native_reasoning)

                            # 2. Content tokens (which may include <think>...</think> tags)
                            content_chunk = delta.get("content")
                            if content_chunk:
                                for kind, text in thought_parser.feed(content_chunk):
                                    yielded_any_chunk = True
                                    if kind == "thought":
                                        yield ModelChunk(thought_delta=text)
                                    elif kind == "content":
                                        yield ModelChunk(content_delta=text)

                            # 3. Incremental Tool Calls
                            tool_deltas = delta.get("tool_calls", [])
                            for td in tool_deltas:
                                _accumulate_tool_delta(tool_call_accumulators, td)

                # Successful stream completion
                break

            except (httpx.TimeoutException, httpx.RemoteProtocolError, httpx.ConnectError, httpx.NetworkError) as net_err:
                if yielded_any_chunk or tool_call_accumulators:
                    err_msg = f"AI connection interrupted mid-stream ({type(net_err).__name__})."
                    logger.error(f"[OpenAIAdapter Stream Dropped] {err_msg}")
                    yield ModelChunk(
                        content_delta=f"\n\n⚠️ [{err_msg} Please continue or retry your prompt.]",
                        is_finished=True,
                    )
                    return

                if attempt < max_retries - 1:
                    wait_sec = backoff_delays[attempt]
                    logger.warning(
                        f"[OpenAIAdapter] Network error '{type(net_err).__name__}: {net_err}' on attempt {attempt+1}/{max_retries}. "
                        f"Retrying in {wait_sec}s..."
                    )
                    await asyncio.sleep(wait_sec)
                    continue
                else:
                    err_msg = f"AI connection timed out after {max_retries} attempts ({type(net_err).__name__})."
                    logger.error(f"[OpenAIAdapter Timeout] {err_msg}")
                    yield ModelChunk(
                        content_delta=f"\n[AI Connection Timeout: Unable to get response from AI endpoint after {max_retries} attempts ({type(net_err).__name__}). Please retry.]",
                        is_finished=True,
                    )
                    return
            except Exception as exc:
                logger.error(f"[OpenAIAdapter Unexpected Error] {type(exc).__name__}: {exc}", exc_info=True)
                yield ModelChunk(
                    content_delta=f"\n[AI Provider Error: {type(exc).__name__}: {exc}]",
                    is_finished=True,
                )
                return

        # Flush any remaining parser buffer
        for kind, text in thought_parser.finalize():
            if kind == "thought":
                yield ModelChunk(thought_delta=text)
            elif kind == "content":
                yield ModelChunk(content_delta=text)

        # Build parsed tool calls
        final_tool_calls = _build_final_tool_calls(tool_call_accumulators)
        if final_tool_calls:
            yield ModelChunk(tool_calls=final_tool_calls, is_finished=True)
        else:
            yield ModelChunk(is_finished=True)


class AgentRouterAdapter(BaseLLMAdapter):
    """
    Adapter for AgentRouter API (OpenAI-compatible format).
    Uses allowlisted opencode client profile headers to satisfy WAF verification.
    """

    DEFAULT_BASE_URL = "https://agentrouter.org/v1"
    DEFAULT_MODEL = "deepseek-v4-flash"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        temperature: float = 0.2,
        timeout: float = 180.0,
    ) -> None:
        self.api_key = api_key or os.environ.get("AGENTROUTER_API_KEY", "")
        self.model = model or os.environ.get("AGENTROUTER_MODEL", self.DEFAULT_MODEL)
        self.base_url = (base_url or os.environ.get("AGENTROUTER_BASE_URL", self.DEFAULT_BASE_URL)).rstrip("/")
        self.temperature = temperature
        self.timeout = timeout

        if not self.api_key:
            logger.warning("AGENTROUTER_API_KEY is not set. Requests will fail if unauthorized.")

    def _format_messages(self, messages: List[Message]) -> List[Dict[str, Any]]:
        return _format_openai_messages(messages)

    def _format_tools(self, tools: List[ToolDefinition]) -> Optional[List[Dict[str, Any]]]:
        return _format_openai_tools(tools)

    async def generate_turn(
        self,
        messages: List[Message],
        tools: List[ToolDefinition],
    ) -> AsyncGenerator[ModelChunk, None]:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "opencode/1.18.25",
            "X-App": "opencode",
        }

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": self._format_messages(messages),
            "temperature": self.temperature,
            "stream": True,
        }

        formatted_tools = self._format_tools(tools)
        if formatted_tools:
            payload["tools"] = formatted_tools

        thought_parser = StreamThoughtParser()
        tool_call_accumulators: Dict[int, Dict[str, Any]] = {}
        yielded_any_chunk = False

        max_retries = 3
        backoff_delays = [1.5, 3.0, 5.0]

        for attempt in range(max_retries):
            try:
                client_timeout = httpx.Timeout(timeout=self.timeout, connect=30.0, read=self.timeout, write=30.0)
                async with httpx.AsyncClient(timeout=client_timeout) as client:
                    async with client.stream("POST", url, headers=headers, json=payload) as response:
                        if response.status_code in (429, 502, 503, 504) and attempt < max_retries - 1:
                            wait_sec = backoff_delays[attempt]
                            logger.warning(
                                f"[AgentRouter] HTTP {response.status_code} received on attempt {attempt+1}/{max_retries}. "
                                f"Retrying in {wait_sec}s..."
                            )
                            await asyncio.sleep(wait_sec)
                            continue

                        if response.status_code != 200:
                            err_body = await response.aread()
                            err_msg = f"AgentRouter API error {response.status_code}: {err_body.decode('utf-8', errors='ignore')}"
                            logger.error(err_msg)
                            yield ModelChunk(content_delta=f"\n[LLM Error: {err_msg}]", is_finished=True)
                            return

                        async for line in response.aiter_lines():
                            line = line.strip()
                            if not line or not line.startswith("data:"):
                                continue

                            data_str = line[5:].strip()
                            if data_str == "[DONE]":
                                break

                            try:
                                chunk_json = json.loads(data_str)
                            except json.JSONDecodeError:
                                continue

                            if not isinstance(chunk_json, dict):
                                continue

                            if "error" in chunk_json:
                                err_msg = chunk_json["error"].get("message", "Upstream AI provider error")
                                print(f"\033[1;31m[AGENTROUTER ERROR] {err_msg}\033[0m", flush=True)
                                yield ModelChunk(content_delta=f"\n[AI Provider Error: {err_msg}]", is_finished=True)
                                return

                            choices = chunk_json.get("choices", [])
                            if not choices:
                                continue

                            delta = choices[0].get("delta", {})

                            # 1. Native reasoning tokens (DeepSeek reasoning_content or reasoning)
                            native_reasoning = delta.get("reasoning_content") or delta.get("reasoning")
                            if native_reasoning:
                                yielded_any_chunk = True
                                yield ModelChunk(thought_delta=native_reasoning)

                            # 2. Content tokens
                            content_chunk = delta.get("content")
                            if content_chunk:
                                for kind, text in thought_parser.feed(content_chunk):
                                    yielded_any_chunk = True
                                    if kind == "thought":
                                        yield ModelChunk(thought_delta=text)
                                    elif kind == "content":
                                        yield ModelChunk(content_delta=text)

                            # 3. Incremental Tool Calls
                            tool_deltas = delta.get("tool_calls", [])
                            for td in tool_deltas:
                                _accumulate_tool_delta(tool_call_accumulators, td)

                # Successful stream completion
                break

            except (httpx.TimeoutException, httpx.RemoteProtocolError, httpx.ConnectError, httpx.NetworkError) as net_err:
                if yielded_any_chunk or tool_call_accumulators:
                    err_msg = f"AI connection interrupted mid-stream ({type(net_err).__name__})."
                    logger.error(f"[AgentRouter Stream Dropped] {err_msg}")
                    yield ModelChunk(
                        content_delta=f"\n\n⚠️ [{err_msg} Please continue or retry your prompt.]",
                        is_finished=True,
                    )
                    return

                if attempt < max_retries - 1:
                    wait_sec = backoff_delays[attempt]
                    logger.warning(
                        f"[AgentRouter] Network error '{type(net_err).__name__}: {net_err}' on attempt {attempt+1}/{max_retries}. "
                        f"Retrying in {wait_sec}s..."
                    )
                    await asyncio.sleep(wait_sec)
                    continue
                else:
                    err_msg = f"AI connection timed out after {max_retries} attempts ({type(net_err).__name__})."
                    logger.error(f"[AgentRouter Timeout] {err_msg}")
                    yield ModelChunk(
                        content_delta=f"\n[AI Connection Timeout: Unable to get response from AI endpoint after {max_retries} attempts ({type(net_err).__name__}). Please retry.]",
                        is_finished=True,
                    )
                    return
            except Exception as exc:
                logger.error(f"[AgentRouter Unexpected Error] {type(exc).__name__}: {exc}", exc_info=True)
                yield ModelChunk(
                    content_delta=f"\n[AI Provider Error: {type(exc).__name__}: {exc}]",
                    is_finished=True,
                )
                return

        # Flush any remaining parser buffer
        for kind, text in thought_parser.finalize():
            if kind == "thought":
                yield ModelChunk(thought_delta=text)
            elif kind == "content":
                yield ModelChunk(content_delta=text)

        # Build parsed tool calls
        final_tool_calls = _build_final_tool_calls(tool_call_accumulators)
        if final_tool_calls:
            yield ModelChunk(tool_calls=final_tool_calls, is_finished=True)
        else:
            yield ModelChunk(is_finished=True)


class FreeInferenceAdapter(BaseLLMAdapter):
    """
    Adapter for FreeInference API (https://freeinference.org/v1).
    Provides OpenAI-compatible inference with full streaming CoT reasoning tokens
    and function calling for models like deepseek-v4-flash, glm-5.3-flash, and qwen3.6-35b.
    """

    DEFAULT_BASE_URL = "https://freeinference.org/v1"
    DEFAULT_MODEL = "deepseek-v4-flash"
    MODEL_MAP = {
        "deepseek-v4-b": "deepseek-v4-flash",
        "deepseek-v4": "deepseek-v4-flash",
        "deepseek-v4-flash": "deepseek-v4-flash",
        "glm-5.3-flash": "glm-5.3-flash",
        "glm-5.3": "glm-5.3-flash",
        "qwen3.6-35b": "qwen3.6-35b",
        "qwen3.6-35B": "qwen3.6-35b",
    }

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        temperature: float = 0.2,
        timeout: float = 120.0,
    ) -> None:
        self.api_key = api_key or os.environ.get("FREEINFERENCE_API_KEY", "")
        raw_model = (model or os.environ.get("FREEINFERENCE_MODEL", self.DEFAULT_MODEL)).strip()
        self.model = self.MODEL_MAP.get(raw_model.lower(), self.MODEL_MAP.get(raw_model, raw_model))
        self.base_url = (base_url or os.environ.get("FREEINFERENCE_BASE_URL", self.DEFAULT_BASE_URL)).rstrip("/")
        self.temperature = temperature
        self.timeout = timeout

        if not self.api_key:
            logger.warning("FREEINFERENCE_API_KEY is not set. Requests will fail if unauthorized.")

    def _format_messages(self, messages: List[Message]) -> List[Dict[str, Any]]:
        return _format_openai_messages(messages)

    def _format_tools(self, tools: List[ToolDefinition]) -> Optional[List[Dict[str, Any]]]:
        return _format_openai_tools(tools)

    async def generate_turn(
        self,
        messages: List[Message],
        tools: List[ToolDefinition],
    ) -> AsyncGenerator[ModelChunk, None]:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": self._format_messages(messages),
            "temperature": self.temperature,
            "stream": True,
        }

        formatted_tools = self._format_tools(tools)
        if formatted_tools:
            payload["tools"] = formatted_tools

        thought_parser = StreamThoughtParser()
        tool_call_accumulators: Dict[int, Dict[str, Any]] = {}
        yielded_any_chunk = False

        max_retries = 3
        backoff_delays = [1.5, 3.0, 5.0]

        for attempt in range(max_retries):
            try:
                client_timeout = httpx.Timeout(timeout=self.timeout, connect=30.0, read=self.timeout, write=30.0)
                async with httpx.AsyncClient(timeout=client_timeout) as client:
                    async with client.stream("POST", url, headers=headers, json=payload) as response:
                        if response.status_code in (429, 502, 503, 504) and attempt < max_retries - 1:
                            wait_sec = backoff_delays[attempt]
                            logger.warning(
                                f"[FreeInference] HTTP {response.status_code} received on attempt {attempt+1}/{max_retries}. "
                                f"Retrying in {wait_sec}s..."
                            )
                            await asyncio.sleep(wait_sec)
                            continue

                        if response.status_code != 200:
                            err_body = await response.aread()
                            err_msg = f"FreeInference API error {response.status_code}: {err_body.decode('utf-8', errors='ignore')}"
                            logger.error(err_msg)
                            yield ModelChunk(content_delta=f"\n[LLM Error: {err_msg}]", is_finished=True)
                            return

                        async for line in response.aiter_lines():
                            line = line.strip()
                            if not line or not line.startswith("data:"):
                                continue

                            data_str = line[5:].strip()
                            if data_str == "[DONE]":
                                break

                            try:
                                chunk_json = json.loads(data_str)
                            except json.JSONDecodeError:
                                continue

                            if not isinstance(chunk_json, dict):
                                continue

                            if "error" in chunk_json:
                                err_msg = chunk_json["error"].get("message", "Upstream AI provider error")
                                print(f"\033[1;31m[FREEINFERENCE ERROR] {err_msg}\033[0m", flush=True)
                                yield ModelChunk(content_delta=f"\n[AI Provider Error: {err_msg}]", is_finished=True)
                                return

                            choices = chunk_json.get("choices", [])
                            if not choices:
                                continue

                            delta = choices[0].get("delta", {})

                            # 1. Native reasoning tokens (DeepSeek / GLM reasoning)
                            native_reasoning = delta.get("reasoning_content") or delta.get("reasoning")
                            if native_reasoning:
                                yielded_any_chunk = True
                                yield ModelChunk(thought_delta=native_reasoning)

                            # 2. Content tokens
                            content_chunk = delta.get("content")
                            if content_chunk:
                                for kind, text in thought_parser.feed(content_chunk):
                                    yielded_any_chunk = True
                                    if kind == "thought":
                                        yield ModelChunk(thought_delta=text)
                                    elif kind == "content":
                                        yield ModelChunk(content_delta=text)

                            # 3. Incremental Tool Calls
                            tool_deltas = delta.get("tool_calls", [])
                            for td in tool_deltas:
                                _accumulate_tool_delta(tool_call_accumulators, td)

                # Successful turn stream completion
                break

            except (httpx.TimeoutException, httpx.RemoteProtocolError, httpx.ConnectError, httpx.NetworkError) as net_err:
                if yielded_any_chunk or tool_call_accumulators:
                    err_msg = f"FreeInference connection interrupted mid-stream ({type(net_err).__name__})."
                    logger.error(f"[FreeInference Stream Dropped] {err_msg}")
                    yield ModelChunk(
                        content_delta=f"\n\n⚠️ [{err_msg} Please send a message to continue or re-run the step.]",
                        is_finished=True,
                    )
                    return

                if attempt < max_retries - 1:
                    wait_sec = backoff_delays[attempt]
                    logger.warning(
                        f"[FreeInference] Network error '{type(net_err).__name__}: {net_err}' on attempt {attempt+1}/{max_retries}. "
                        f"Retrying in {wait_sec}s..."
                    )
                    await asyncio.sleep(wait_sec)
                    continue
                else:
                    err_msg = f"FreeInference connection timed out or closed after {max_retries} attempts ({type(net_err).__name__})."
                    logger.error(f"[FreeInference Timeout] {err_msg}")
                    yield ModelChunk(
                        content_delta=f"\n[AI Provider Timeout: FreeInference API unreachable ({type(net_err).__name__}). Please retry or switch model in the bottom selector.]",
                        is_finished=True,
                    )
                    return
            except Exception as exc:
                logger.error(f"[FreeInference Unexpected Error] {type(exc).__name__}: {exc}", exc_info=True)
                yield ModelChunk(
                    content_delta=f"\n[AI Provider Error: {type(exc).__name__}: {exc}]",
                    is_finished=True,
                )
                return

        # Flush any remaining parser buffer
        for kind, text in thought_parser.finalize():
            if kind == "thought":
                yield ModelChunk(thought_delta=text)
            elif kind == "content":
                yield ModelChunk(content_delta=text)

        # Build parsed tool calls
        final_tool_calls = _build_final_tool_calls(tool_call_accumulators)
        if final_tool_calls:
            yield ModelChunk(tool_calls=final_tool_calls, is_finished=True)
        else:
            yield ModelChunk(is_finished=True)


class AnthropicAdapter(BaseLLMAdapter):
    """
    Adapter for Anthropic Claude Opus 5.5 API.
    Used for production-grade high-precision reasoning and algorithmic trading generation.
    """

    DEFAULT_MODEL = "claude-opus-5.5"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 120.0,
    ) -> None:
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        self.model = model or os.environ.get("ANTHROPIC_MODEL", self.DEFAULT_MODEL)
        self.timeout = timeout

    async def generate_turn(
        self,
        messages: List[Message],
        tools: List[ToolDefinition],
    ) -> AsyncGenerator[ModelChunk, None]:
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        # System message separation
        system_content = ""
        claude_messages: List[Dict[str, Any]] = []
        for m in messages:
            sanitized_text = _sanitize_message_content(m.role.value, m.content)
            if m.role == Role.SYSTEM:
                system_content = sanitized_text
            elif m.role == Role.TOOL:
                claude_messages.append({
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": m.tool_call_id or "",
                            "content": sanitized_text,
                        }
                    ],
                })
            elif m.role == Role.ASSISTANT and m.tool_calls:
                content_blocks: List[Dict[str, Any]] = []
                if sanitized_text:
                    content_blocks.append({"type": "text", "text": sanitized_text})
                for tc in m.tool_calls:
                    content_blocks.append({
                        "type": "tool_use",
                        "id": tc.id,
                        "name": tc.name,
                        "input": tc.arguments,
                    })
                claude_messages.append({"role": "assistant", "content": content_blocks})
            else:
                claude_messages.append({
                    "role": "user" if m.role == Role.USER else "assistant",
                    "content": sanitized_text,
                })

        claude_tools = [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": t.parameters,
            }
            for t in tools
        ] if tools else []

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": claude_messages,
            "max_tokens": 4096,
            "stream": True,
        }
        if system_content:
            payload["system"] = system_content
        if claude_tools:
            payload["tools"] = claude_tools

        current_tool_id = ""
        current_tool_name = ""
        current_tool_input_json = ""
        completed_tool_calls: List[ToolCall] = []

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    err_body = await response.aread()
                    yield ModelChunk(
                        content_delta=f"\n[Anthropic API Error {response.status_code}: {err_body.decode('utf-8', errors='ignore')}]",
                        is_finished=True,
                    )
                    return

                async for line in response.aiter_lines():
                    line = line.strip()
                    if not line.startswith("data:"):
                        continue
                    data_str = line[5:].strip()
                    try:
                        event = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    event_type = event.get("type")
                    if event_type == "content_block_start":
                        block = event.get("content_block", {})
                        if block.get("type") == "tool_use":
                            current_tool_id = block.get("id", "")
                            current_tool_name = block.get("name", "")
                            current_tool_input_json = ""
                    elif event_type == "content_block_delta":
                        delta = event.get("delta", {})
                        delta_type = delta.get("type")
                        if delta_type == "text_delta":
                            yield ModelChunk(content_delta=delta.get("text", ""))
                        elif delta_type == "thinking_delta":
                            yield ModelChunk(thought_delta=delta.get("thinking", ""))
                        elif delta_type == "input_json_delta":
                            current_tool_input_json += delta.get("partial_json", "")
                    elif event_type == "content_block_stop":
                        if current_tool_id and current_tool_name:
                            try:
                                args = json.loads(current_tool_input_json) if current_tool_input_json else {}
                            except json.JSONDecodeError:
                                args = {"raw": current_tool_input_json}
                            completed_tool_calls.append(
                                ToolCall(id=current_tool_id, name=current_tool_name, arguments=args)
                            )
                            current_tool_id = ""
                            current_tool_name = ""
                            current_tool_input_json = ""

        if completed_tool_calls:
            yield ModelChunk(tool_calls=completed_tool_calls, is_finished=True)
        else:
            yield ModelChunk(is_finished=True)


class GeminiAdapter(BaseLLMAdapter):
    """
    Adapter for Google Gemini API via high-performance OpenAI-compatible endpoint.
    Supports streaming Chain-of-Thought reasoning tokens, function calling,
    and configurable thinking levels (low, medium, high).
    """

    DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"
    DEFAULT_MODEL = "gemini-3.8-flash"
    FALLBACK_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.7-flash"]

    MODEL_MAP = {
        "gemini-3.8-flash": "gemini-3.8-flash",
        "gemini 3.8 flash": "gemini-3.8-flash",
        "demini 3.8 flash": "gemini-3.8-flash",
        "demini-3.8-flash": "gemini-3.8-flash",
        "gemini-3.5-flash-lite": "gemini-3.5-flash-lite",
        "gemini 3.5 flash lite": "gemini-3.5-flash-lite",
        "gemini 3.5 flash": "gemini-3.5-flash-lite",
        "gemini-3.7-flash": "gemini-3.7-flash",
    }

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        think_level: str = "medium",
        temperature: float = 0.2,
        timeout: float = 90.0,
    ) -> None:
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        raw_model = (model or os.environ.get("GEMINI_MODEL", self.DEFAULT_MODEL)).strip()
        norm_key = raw_model.lower()
        if norm_key in self.MODEL_MAP:
            self.model = self.MODEL_MAP[norm_key]
        elif "3.8" in norm_key:
            self.model = "gemini-3.8-flash"
        elif "3.5" in norm_key:
            self.model = "gemini-3.5-flash-lite"
        else:
            self.model = raw_model
        self.base_url = (base_url or os.environ.get("GEMINI_BASE_URL", self.DEFAULT_BASE_URL)).rstrip("/")
        self.think_level = (think_level or "medium").lower().strip()
        self.temperature = temperature
        self.timeout = timeout

        if not self.api_key:
            logger.warning("GEMINI_API_KEY is not set. Requests will fail if unauthorized.")

    def _format_messages(self, messages: List[Message]) -> List[Dict[str, Any]]:
        raw_formatted = _format_openai_messages(messages)
        formatted: List[Dict[str, Any]] = []

        # Gemini 2.5/3.5/3.7 strict thought-signature compliance:
        # Prior turns with tool_calls in assistant messages must be converted to text context
        # to avoid Google API 400: 'Function call is missing a thought_signature in functionCall parts'
        for item in raw_formatted:
            clean_item = dict(item)
            if clean_item.get("role") == "assistant" and clean_item.get("tool_calls"):
                calls_desc = "\n".join(
                    f"(Executed action '{tc.get('function', {}).get('name', 'action')}' with arguments {tc.get('function', {}).get('arguments', '')})"
                    for tc in clean_item.get("tool_calls", [])
                )
                existing = clean_item.get("content") or ""
                clean_item["content"] = f"{existing}\n{calls_desc}".strip() if existing else calls_desc
                clean_item.pop("tool_calls", None)
            elif clean_item.get("role") == "tool":
                clean_item["role"] = "user"
                tcid = clean_item.get("tool_call_id", "tool")
                clean_item["content"] = f"(Action Result for {tcid}): {clean_item.get('content', '')}"
                clean_item.pop("tool_call_id", None)
            formatted.append(clean_item)

        tool_rule = "\n\nCRITICAL INSTRUCTION: Invoke all tools strictly via native function calling tool_calls. NEVER output plain text pseudo actions like (Executed action '...' with arguments ...)."

        if self.think_level == "high":
            instruction = (
                "[Deep Quantitative Reasoning Protocol]\n"
                "Before providing any trading logic, MQL5/Python code, or alpha synthesis, you MUST first perform exhaustive "
                "mathematical analysis strictly inside <think>...</think> tags. "
                "Analyze: zero look-ahead data hygiene, slippage and spread modeling, Sharpe/Sortino distribution, "
                "drawdown containment, and edge statistical significance."
            ) + tool_rule
            if formatted and formatted[0].get("role") == "system":
                formatted[0]["content"] += f"\n\n{instruction}"
            else:
                formatted.insert(0, {"role": "system", "content": instruction})
        elif self.think_level == "medium":
            instruction = (
                "[Quantitative Reasoning Protocol]\n"
                "Analyze the trading strategy requirements, risk parameters, and logic in <think>...</think> tags before answering."
            ) + tool_rule
            if formatted and formatted[0].get("role") == "system":
                formatted[0]["content"] += f"\n\n{instruction}"
            else:
                formatted.insert(0, {"role": "system", "content": instruction})
        else:
            if formatted and formatted[0].get("role") == "system":
                formatted[0]["content"] += tool_rule
            else:
                formatted.insert(0, {"role": "system", "content": tool_rule.strip()})
        return formatted

    def _format_tools(self, tools: List[ToolDefinition]) -> Optional[List[Dict[str, Any]]]:
        return _format_openai_tools(tools)

    async def generate_turn(
        self,
        messages: List[Message],
        tools: List[ToolDefinition],
    ) -> AsyncGenerator[ModelChunk, None]:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        candidate_models = [self.model]
        for fb in self.FALLBACK_MODELS:
            if fb not in candidate_models:
                candidate_models.append(fb)

        thought_parser = StreamThoughtParser()
        tool_call_accumulators: Dict[int, Dict[str, Any]] = {}
        formatted_messages = self._format_messages(messages)
        formatted_tools = self._format_tools(tools)

        for attempt_model in candidate_models:
            payload: Dict[str, Any] = {
                "model": attempt_model,
                "messages": formatted_messages,
                "temperature": self.temperature,
                "stream": True,
            }
            if formatted_tools:
                payload["tools"] = formatted_tools

            success = False
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                try:
                    async with client.stream("POST", url, headers=headers, json=payload) as response:
                        if response.status_code == 503:
                            logger.warning(f"[GEMINI] Model {attempt_model} returned 503. Falling back to alternative...")
                            continue
                        elif response.status_code != 200:
                            err_body = await response.aread()
                            err_msg = f"Gemini API error {response.status_code}: {err_body.decode('utf-8', errors='ignore')}"
                            logger.error(err_msg)
                            yield ModelChunk(content_delta=f"\n[LLM Error: {err_msg}]", is_finished=True)
                            return

                        success = True
                        async for line in response.aiter_lines():
                            line = line.strip()
                            if not line or not line.startswith("data:"):
                                continue

                            data_str = line[5:].strip()
                            if data_str == "[DONE]":
                                break

                            try:
                                chunk_json = json.loads(data_str)
                            except json.JSONDecodeError:
                                continue

                            if not isinstance(chunk_json, dict):
                                continue

                            if "error" in chunk_json:
                                err_msg = chunk_json["error"].get("message", "Upstream Gemini error")
                                logger.error(f"[GEMINI ERROR] {err_msg}")
                                yield ModelChunk(content_delta=f"\n[Gemini Provider Error: {err_msg}]", is_finished=True)
                                return

                            choices = chunk_json.get("choices", [])
                            if not choices:
                                continue

                            delta = choices[0].get("delta", {})

                            native_reasoning = delta.get("reasoning_content") or delta.get("reasoning")
                            if native_reasoning:
                                yield ModelChunk(thought_delta=native_reasoning)

                            content_chunk = delta.get("content")
                            if content_chunk:
                                for kind, text in thought_parser.feed(content_chunk):
                                    if kind == "thought":
                                        yield ModelChunk(thought_delta=text)
                                    elif kind == "content":
                                        yield ModelChunk(content_delta=text)

                            tool_deltas = delta.get("tool_calls", [])
                            for td in tool_deltas:
                                _accumulate_tool_delta(tool_call_accumulators, td)
                except httpx.RequestError as exc:
                    logger.warning(f"[GEMINI] Connection issue on {attempt_model}: {exc}. Trying fallback...")
                    continue

            if success:
                break

        for kind, text in thought_parser.finalize():
            if kind == "thought":
                yield ModelChunk(thought_delta=text)
            elif kind == "content":
                yield ModelChunk(content_delta=text)

        final_tool_calls = _build_final_tool_calls(tool_call_accumulators)
        if final_tool_calls:
            yield ModelChunk(tool_calls=final_tool_calls, is_finished=True)
        else:
            yield ModelChunk(is_finished=True)


def create_llm_adapter(
    provider: Optional[str] = None,
    model: Optional[str] = None,
    think_level: Optional[str] = None,
) -> BaseLLMAdapter:
    """
    Factory creating the configured LLM adapter from parameters or environment.
    Supports Google Gemini (default), FreeInference, AgentRouter (DeepSeek), OpenRouter, and Anthropic.
    """
    load_env_file()
    selected_provider = (provider or os.environ.get("LLM_PROVIDER", "gemini")).lower().strip()
    selected_think = (think_level or os.environ.get("THINK_LEVEL", "medium")).lower().strip()

    if selected_provider == "gemini":
        target_model = model or os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
        norm = target_model.lower().replace(" ", "-")
        if "3.8" in norm:
            target_model = "gemini-3.8-flash"
        elif "3.5" in norm:
            target_model = "gemini-3.5-flash-lite"
        logger.info(f"Initializing Google Gemini Adapter with model: {target_model} (think: {selected_think})")
        return GeminiAdapter(model=target_model, think_level=selected_think)
    elif selected_provider in ("freeinference", "glm", "zhipu"):
        target_model = model or os.environ.get("FREEINFERENCE_MODEL", "deepseek-v4-flash")
        logger.info(f"Initializing FreeInference Adapter with model: {target_model}")
        return FreeInferenceAdapter(model=target_model)
    elif selected_provider == "agentrouter":
        target_model = model or os.environ.get("AGENTROUTER_MODEL", "deepseek-v4-flash")
        logger.info(f"Initializing AgentRouter Adapter with model: {target_model}")
        return AgentRouterAdapter(model=target_model)
    elif selected_provider == "openrouter":
        target_model = model or os.environ.get("OPENROUTER_MODEL", "nvidia/nemotron-3.5-lightning:free")
        logger.info(f"Initializing OpenRouter Adapter with model: {target_model}")
        return OpenRouterAdapter(model=target_model)
    elif selected_provider == "anthropic":
        target_model = model or os.environ.get("ANTHROPIC_MODEL", "claude-opus-5.5")
        logger.info(f"Initializing Anthropic Claude Adapter with model: {target_model}")
        return AnthropicAdapter(model=target_model)
    else:
        m_lower = (model or "").lower()
        if any(k in m_lower for k in ("glm", "deepseek", "qwen")):
            target_model = model or "deepseek-v4-flash"
            logger.info(f"Routing model {target_model} to FreeInference Adapter")
            return FreeInferenceAdapter(model=target_model)
        target_model = model or os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
        logger.info(f"Defaulting to Google Gemini Adapter with model: {target_model}")
        return GeminiAdapter(model=target_model, think_level=selected_think)

