"""
Unit tests for LLM Adapters in packages/agent.
"""

import os
import pytest
from packages.agent.src.adapters.llm import (
    OpenRouterAdapter,
    AnthropicAdapter,
    create_llm_adapter,
)
from packages.agent.src.core.types import Message, Role, ToolCall, ToolDefinition


def test_openrouter_format_messages_preserves_cot():
    adapter = OpenRouterAdapter(api_key="test_key", model="test_model")
    messages = [
        Message(role=Role.USER, content="Hello"),
        Message(
            role=Role.ASSISTANT,
            content="Visible answer",
            thought="Internal reasoning process",
        ),
    ]

    formatted = adapter._format_messages(messages)
    assert len(formatted) == 2
    assert formatted[0]["role"] == "user"
    assert formatted[0]["content"] == "Hello"
    assert formatted[1]["role"] == "assistant"
    # DSH Invariant: Reasoning preserved via <think> tag in assistant message
    assert "<think>\nInternal reasoning process\n</think>" in formatted[1]["content"]
    assert "Visible answer" in formatted[1]["content"]


def test_openrouter_format_tools():
    adapter = OpenRouterAdapter(api_key="test_key", model="test_model")
    tools = [
        ToolDefinition(
            name="test_tool",
            description="A test tool",
            parameters={"type": "object", "properties": {"val": {"type": "number"}}},
        )
    ]

    formatted = adapter._format_tools(tools)
    assert formatted is not None
    assert len(formatted) == 1
    assert formatted[0]["type"] == "function"
    assert formatted[0]["function"]["name"] == "test_tool"
    assert formatted[0]["function"]["description"] == "A test tool"


def test_create_llm_adapter_factory():
    os.environ["LLM_PROVIDER"] = "openrouter"
    adapter1 = create_llm_adapter()
    assert isinstance(adapter1, OpenRouterAdapter)

    os.environ["LLM_PROVIDER"] = "anthropic"
    adapter2 = create_llm_adapter()
    assert isinstance(adapter2, AnthropicAdapter)

    # Reset
    os.environ["LLM_PROVIDER"] = "openrouter"


@pytest.mark.asyncio
async def test_freeinference_adapter_resilience(monkeypatch):
    """Verifies that FreeInferenceAdapter catches connection timeouts and yields graceful error chunks."""
    from packages.agent.src.adapters.llm import FreeInferenceAdapter
    import httpx

    adapter = FreeInferenceAdapter(api_key="test", model="glm-5.3-flash")

    # Mock AsyncClient.stream to raise ReadTimeout
    class FailingStreamContext:
        async def __aenter__(self):
            raise httpx.ReadTimeout("Socket read timed out")
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    class MockFailingClient:
        def __init__(self, *args, **kwargs):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass
        def stream(self, *args, **kwargs):
            return FailingStreamContext()

    monkeypatch.setattr(httpx, "AsyncClient", MockFailingClient)

    chunks = []
    messages = [Message(role=Role.USER, content="Hello")]
    async for chunk in adapter.generate_turn(messages, []):
        chunks.append(chunk)

    assert len(chunks) > 0
    assert chunks[-1].is_finished is True
    assert "Timeout" in (chunks[-1].content_delta or "")

