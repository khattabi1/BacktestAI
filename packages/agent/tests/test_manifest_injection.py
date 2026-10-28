from pathlib import Path
from typing import AsyncGenerator, List
import pytest
from packages.agent.src.core.types import StrategyManifest, AgentSessionState, Message, ToolDefinition
from packages.agent.src.core.harness import AgentHarness, ModelChunk

class MockLLM:
    async def generate_turn(
        self,
        messages: List[Message],
        tools: List[ToolDefinition],
    ) -> AsyncGenerator[ModelChunk, None]:
        yield ModelChunk(content_delta="ok")

def test_manifest_rendered_in_effective_system_prompt():
    session = AgentSessionState(session_id="s1", user_id="u1")
    session.strategy_manifest = StrategyManifest(
        strategy_name="sk_gold_sequencer",
        version=2,
        target_symbol="XAUUSD",
        native_timeframe="M5"
    )
    harness = AgentHarness(session_id="s1", user_id="u1", llm_adapter=MockLLM(), session=session)
    prompt = harness._build_effective_system_prompt()
    assert "[STRATEGY MANIFEST:" in prompt
    assert "Strategy='sk_gold_sequencer'" in prompt
    assert "Symbol='XAUUSD'" in prompt
    assert "TF='M5'" in prompt
    assert "v2" in prompt

def test_manifest_sync_from_code_file(tmp_path):
    user_file = tmp_path / "ict_gold_scalper.mq5"
    user_file.write_text("""
    #property version "3.00"
    int handle = iRSI("XAUUSD", PERIOD_M15, 14);
    """, encoding="utf-8")

    session = AgentSessionState(session_id="s2", user_id="u1")
    harness = AgentHarness(session_id="s2", user_id="u1", llm_adapter=MockLLM(), session=session)
    manifest = harness.sync_strategy_manifest(user_file)

    assert manifest.strategy_name == "ict_gold_scalper"
    assert manifest.version == 3
    assert manifest.target_symbol == "XAUUSD"
    assert manifest.native_timeframe == "M15"
    assert harness.session.strategy_manifest == manifest
