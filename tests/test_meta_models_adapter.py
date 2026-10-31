"""
Unit and Integration Tests for Meta Model API Client & LLM Adapter.
Covers:
- MetaModelAdapter initialization and environment loading.
- Request payload formatting for Muse Spark 1.3 (multimodal vision + text) and Muse Wonder 1.0 (deep reasoning).
- Audio transcription request formatting for Muse Voice Transcribe 1.0.
- Offline heuristic fallback mode when API key is missing.
- Registration in factory create_llm_adapter(provider="meta").
"""

import pytest
import os
from unittest.mock import AsyncMock, MagicMock, patch
from typing import List, Dict, Any

from packages.agent.src.core.types import (
    Message,
    Role,
    ToolCall,
    ToolDefinition,
    ModelChunk,
)
from packages.agent.src.adapters.meta_models import (
    MetaModelAdapter,
    DEFAULT_META_BASE_URL,
    MUSE_SPARK_CONTRIBUTOR_MODEL,
    MUSE_SPARK_MODEL,
    MUSE_WONDER_MODEL,
    MUSE_VOICE_MODEL,
)
from packages.agent.src.adapters.llm import create_llm_adapter, BaseLLMAdapter


def test_meta_model_adapter_constants():
    assert DEFAULT_META_BASE_URL == "https://api.meta.ai/v1"
    assert MUSE_SPARK_CONTRIBUTOR_MODEL in ("muse-spark-1.3-contributor", "muse-spark-1.3")
    assert "muse-wonder" in MUSE_WONDER_MODEL
    assert "muse-voice" in MUSE_VOICE_MODEL


def test_meta_model_adapter_initialization():
    adapter = MetaModelAdapter(
        api_key="test_meta_key_123",
        base_url="https://api.meta.ai/v1",
        default_model=MUSE_SPARK_CONTRIBUTOR_MODEL,
    )
    assert isinstance(adapter, BaseLLMAdapter)
    assert adapter.api_key == "test_meta_key_123"
    assert adapter.base_url == "https://api.meta.ai/v1"
    assert adapter.default_model == MUSE_SPARK_CONTRIBUTOR_MODEL


def test_meta_model_adapter_formats_multimodal_message():
    adapter = MetaModelAdapter(api_key="mock_key")
    
    # Text-only message
    msg_text = Message(role=Role.USER, content="Analyze this trade setup")
    formatted = adapter.format_message(msg_text)
    assert formatted["role"] == "user"
    assert formatted["content"] == "Analyze this trade setup"

    # Multimodal message with image attached
    msg_image = Message(
        role=Role.USER,
        content="Inspect the chart candles",
        media=[{"mime_type": "image/webp", "data": "UklGRkAAAABXRUJQVlA4ID..."}],
    )
    formatted_multi = adapter.format_message(msg_image)
    assert formatted_multi["role"] == "user"
    assert isinstance(formatted_multi["content"], list)
    assert formatted_multi["content"][0]["type"] == "text"
    assert formatted_multi["content"][0]["text"] == "Inspect the chart candles"
    assert formatted_multi["content"][1]["type"] == "image_url"
    assert "data:image/webp;base64,UklGRkAAAABXRUJQVlA4ID..." in formatted_multi["content"][1]["image_url"]["url"]


@pytest.mark.asyncio
async def test_meta_model_adapter_streaming_turn_mocked_http():
    adapter = MetaModelAdapter(api_key="test_key", default_model=MUSE_WONDER_MODEL)

    mock_chunks = [
        b'data: {"choices": [{"delta": {"reasoning_content": "Evaluating statistical variance..."}}]}\n\n',
        b'data: {"choices": [{"delta": {"content": "The trade entry shows valid momentum."}}]}\n\n',
        b'data: [DONE]\n\n',
    ]

    async def mock_aiter_bytes():
        for chunk in mock_chunks:
            yield chunk

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.aiter_bytes = mock_aiter_bytes

    messages = [Message(role=Role.USER, content="Review my trade")]
    tools: List[ToolDefinition] = []

    with patch.object(adapter, "_send_streaming_request", return_value=mock_response):
        chunks = []
        async for chunk in adapter.generate_turn(messages, tools):
            chunks.append(chunk)

        # Verify streamed thought and content
        thought_texts = [c.thought_delta for c in chunks if c.thought_delta]
        content_texts = [c.content_delta for c in chunks if c.content_delta]
        
        assert any("Evaluating statistical variance" in t for t in thought_texts)
        assert any("The trade entry shows valid momentum." in c for c in content_texts)
        assert any(c.is_finished for c in chunks)


@pytest.mark.asyncio
async def test_meta_voice_transcribe_audio_formatting():
    adapter = MetaModelAdapter(api_key="test_key")

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "text": "Entering buy order on gold at support level.",
        "language": "en",
        "duration": 3.4,
    }

    fake_audio = b"\x00\x01\x02\x03\x04FAKEWAVDATA"

    with patch.object(adapter, "_send_transcribe_request", return_value=mock_response):
        result = await adapter.transcribe_audio(
            audio_bytes=fake_audio,
            filename="trader_voice.wav",
            mime_type="audio/wav",
        )
        assert result["text"] == "Entering buy order on gold at support level."
        assert result["language"] == "en"


@pytest.mark.asyncio
async def test_meta_model_adapter_offline_heuristic_fallback():
    # When api_key is None or explicitly mock, fallback should yield non-crashing valid output
    adapter = MetaModelAdapter(api_key=None, is_mock=True)

    messages = [Message(role=Role.USER, content="Diagnose this session")]
    chunks = []
    async for chunk in adapter.generate_turn(messages, []):
        chunks.append(chunk)

    contents = "".join([c.content_delta for c in chunks if c.content_delta])
    assert len(contents) > 0
    assert any(c.is_finished for c in chunks)


def test_create_llm_adapter_factory_with_meta_provider():
    adapter = create_llm_adapter(provider="meta", model=MUSE_WONDER_MODEL)
    assert isinstance(adapter, MetaModelAdapter)
    assert adapter.default_model == MUSE_WONDER_MODEL

