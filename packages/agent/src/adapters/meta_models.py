"""
Meta Model API Client & Adapter for BacktestAI.
Integrates Meta's official model family:
- muse-spark-1.3-contributor / muse-spark-1.3: Fast Multimodal Vision, Tool Calling, and TradeCard extraction.
- muse-wonder / muse-wonder-1.0: Deep Quantitative & Behavioral Reasoning, MQL5 Code Synthesis.
- muse-voice-transcribe / muse-voice-transcribe-1.0: Spoken Audio Transcription.
"""

from __future__ import annotations
import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx

from ..core.types import Message, ModelChunk, Role, ToolCall, ToolDefinition
from ..core.parser import StreamThoughtParser
from .llm import (
    BaseLLMAdapter,
    _accumulate_tool_delta,
    _build_final_tool_calls,
    _format_openai_tools,
    _sanitize_message_content,
    load_env_file,
)

logger = logging.getLogger("backtest_ai.agent.adapters.meta")

load_env_file()

DEFAULT_META_BASE_URL = os.environ.get("META_BASE_URL", "https://api.meta.ai/v1").rstrip("/")
MUSE_SPARK_MODEL = os.environ.get("META_MODEL_EXECUTOR", "muse-spark-1.3")
MUSE_SPARK_CONTRIBUTOR_MODEL = os.environ.get("META_MODEL_ADVISER", "muse-spark-1.3-contributor")
MUSE_WONDER_MODEL = os.environ.get("META_MODEL_PLANNER", "muse-wonder")
MUSE_VOICE_MODEL = os.environ.get("META_MODEL_VOICE", "muse-voice-transcribe")


class MetaModelAdapter(BaseLLMAdapter):
    """
    Adapter communicating with the Meta Model API ecosystem.
    Supports multimodal chart vision (Spark), deep reasoning (Wonder), and voice transcription.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        default_model: Optional[str] = None,
        is_mock: bool = False,
        timeout: float = 60.0,
    ) -> None:
        self.api_key = api_key or os.environ.get("META_MODEL_API_KEY")
        self.base_url = (base_url or os.environ.get("META_BASE_URL") or DEFAULT_META_BASE_URL).rstrip("/")
        self.default_model = (
            default_model
            or os.environ.get("META_MODEL_EXECUTOR")
            or MUSE_SPARK_CONTRIBUTOR_MODEL
        )
        self.is_mock = is_mock or not bool(self.api_key)
        self.timeout = timeout

    def format_message(self, msg: Message) -> Dict[str, Any]:
        """
        Formats a Message into an OpenAI/Meta compatible message dictionary.
        Supports text content and multimodal media payloads (e.g. chart canvas screenshots).
        """
        role_str = msg.role.value if isinstance(msg.role, Role) else str(msg.role)
        content_text = msg.content or ""

        # Check for media attachments (e.g. base64 canvas images)
        if hasattr(msg, "media") and msg.media:
            parts: List[Dict[str, Any]] = []
            if content_text:
                parts.append({"type": "text", "text": _sanitize_message_content(role_str, content_text)})

            for item in msg.media:
                if isinstance(item, dict):
                    mime = item.get("mime_type", "image/webp")
                    raw_data = item.get("data") or item.get("base64") or item.get("url") or ""
                    if raw_data:
                        if not raw_data.startswith("data:") and not raw_data.startswith("http"):
                            raw_data = f"data:{mime};base64,{raw_data}"
                        parts.append({
                            "type": "image_url",
                            "image_url": {"url": raw_data},
                        })

            return {"role": role_str, "content": parts if parts else content_text}

        return {
            "role": role_str,
            "content": _sanitize_message_content(role_str, content_text),
        }

    async def _send_streaming_request(
        self,
        payload: Dict[str, Any],
        client: httpx.AsyncClient,
    ) -> httpx.Response:
        """Sends the HTTP POST streaming request to Meta Model API."""
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        req = client.build_request("POST", url, json=payload, headers=headers)
        return await client.send(req, stream=True)

    async def _send_transcribe_request(
        self,
        audio_bytes: bytes,
        filename: str,
        mime_type: str,
        client: httpx.AsyncClient,
    ) -> httpx.Response:
        """Sends audio file to Meta Voice Transcribe endpoint."""
        url = f"{self.base_url}/audio/transcriptions"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        files = {"file": (filename, audio_bytes, mime_type)}
        data = {"model": MUSE_VOICE_MODEL}
        return await client.post(url, headers=headers, files=files, data=data)

    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        filename: str = "audio.wav",
        mime_type: str = "audio/wav",
    ) -> Dict[str, Any]:
        """
        Transcribes spoken trader audio thoughts into text using muse-voice-transcribe.
        """
        if self.is_mock or not self.api_key:
            logger.info("[META VOICE MOCK] Returning simulated audio transcription.")
            return {
                "text": "Simulated transcription: Trader observed momentum expansion on Gold 15m.",
                "language": "en",
                "duration": 2.5,
            }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await self._send_transcribe_request(audio_bytes, filename, mime_type, client)
            if resp.status_code >= 400:
                logger.error(f"[META VOICE ERROR] HTTP {resp.status_code}: {resp.text}")
                return {
                    "text": "[Transcription unavailable: Meta Voice API error]",
                    "error": resp.text,
                }
            return resp.json()

    async def generate_turn(
        self,
        messages: List[Message],
        tools: List[ToolDefinition],
    ) -> AsyncGenerator[ModelChunk, None]:
        """
        Streams model response (thoughts, content delta, and tool calls) from Meta Model API.
        """
        # 1. Handle Mock / Offline Mode
        if self.is_mock or not self.api_key:
            logger.info(f"[META MOCK] Generating heuristic response using model {self.default_model}.")
            yield ModelChunk(
                thought_delta="[Meta Offline Heuristic Engine] Analyzing market structure and risk distribution...\n"
            )
            yield ModelChunk(
                content_delta="BacktestAI Meta Model Adapter active. Observation recorded with verified parameters.\n"
            )
            yield ModelChunk(is_finished=True)
            return

        # 2. Prepare Meta Model API Payload
        formatted_messages = [self.format_message(m) for m in messages]
        payload: Dict[str, Any] = {
            "model": self.default_model,
            "messages": formatted_messages,
            "stream": True,
        }

        if tools:
            payload["tools"] = _format_openai_tools(tools)
            payload["tool_choice"] = "auto"

        thought_parser = StreamThoughtParser()
        tool_call_accumulators: Dict[int, Dict[str, Any]] = {}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await self._send_streaming_request(payload, client)
                if resp.status_code >= 400:
                    err_body = await resp.aread()
                    logger.error(f"[META API ERROR] Status {resp.status_code}: {err_body.decode(errors='replace')}")
                    yield ModelChunk(
                        content_delta=f"\n[Meta Model API Error: HTTP {resp.status_code}]",
                        is_finished=True,
                    )
                    return

                async for raw_line in resp.aiter_bytes():
                    line = raw_line.decode("utf-8", errors="replace").strip()
                    if not line:
                        continue
                    if line == "data: [DONE]":
                        break
                    if not line.startswith("data:"):
                        continue

                    json_str = line[5:].strip()
                    try:
                        chunk_json = json.loads(json_str)
                    except json.JSONDecodeError:
                        continue

                    choices = chunk_json.get("choices", [])
                    if not choices:
                        continue

                    delta = choices[0].get("delta", {})

                    # Extract reasoning / CoT (if supported natively by model)
                    reasoning = delta.get("reasoning_content") or delta.get("reasoning")
                    if reasoning:
                        yield ModelChunk(thought_delta=reasoning)

                    # Extract content
                    content = delta.get("content")
                    if content:
                        for kind, text in thought_parser.feed(content):
                            if kind == "thought":
                                yield ModelChunk(thought_delta=text)
                            elif kind == "content":
                                yield ModelChunk(content_delta=text)

                    # Extract tool calls
                    tool_deltas = delta.get("tool_calls", [])
                    for td in tool_deltas:
                        _accumulate_tool_delta(tool_call_accumulators, td)

        except httpx.RequestError as exc:
            logger.error(f"[META API CONNECTION ERROR] {exc}")
            yield ModelChunk(content_delta=f"\n[Meta Connection Error: {exc}]", is_finished=True)
            return

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

