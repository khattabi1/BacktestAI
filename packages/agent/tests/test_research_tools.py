"""
Unit Tests for Web Research Tool Plugin (search_web).
Verifies web querying, zero-key DuckDuckGo handling, and tool registration.
"""

import pytest
import asyncio
from packages.agent.src.tools.research import search_web, register_research_tools


class DummyHarness:
    def __init__(self):
        self.tools = {}

    def register_tool(self, name, description, parameters, handler, **kwargs):
        self.tools[name] = {"description": description, "parameters": parameters, "handler": handler}


@pytest.mark.asyncio
async def test_search_web_valid_query():
    """Verifies that search_web returns structured results."""
    res = await search_web("MQL5 Expert Advisor OnTick", max_results=3)
    assert res["success"] is True
    assert "query" in res
    assert "results" in res
    assert len(res["results"]) >= 1
    first = res["results"][0]
    assert "title" in first
    assert "url" in first
    assert "snippet" in first


@pytest.mark.asyncio
async def test_search_web_empty_query():
    """Verifies that search_web rejects empty queries."""
    res = await search_web("   ")
    assert res["success"] is False
    assert "error" in res


def test_register_research_tools():
    """Verifies that register_research_tools correctly attaches tool to harness."""
    harness = DummyHarness()
    register_research_tools(harness)
    assert "search_web" in harness.tools
    assert "query" in harness.tools["search_web"]["parameters"]["properties"]
