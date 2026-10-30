import pytest
from packages.agent.src.core.harness import DEFAULT_SYSTEM_PROMPT


def test_system_prompt_hygiene_and_blueprint():
    # 1. No debug tokens allowed in prompt instructions
    assert "-- test done" not in DEFAULT_SYSTEM_PROMPT
    assert "-- agent done" not in DEFAULT_SYSTEM_PROMPT

    # 2. Strict privacy & path hygiene invariant
    assert "PATH HYGIENE & INFORMATION SECURITY" in DEFAULT_SYSTEM_PROMPT
    assert "C:\\Users\\" not in DEFAULT_SYSTEM_PROMPT

    # 3. Streamlined Quant Strategy Blueprint replacing 17-section wall
    assert "QUANT STRATEGY BLUEPRINT" in DEFAULT_SYSTEM_PROMPT
    assert "17-Section" not in DEFAULT_SYSTEM_PROMPT
    assert "Parameters Matrix" in DEFAULT_SYSTEM_PROMPT
    assert "MQL5 `input`" in DEFAULT_SYSTEM_PROMPT or "input variables" in DEFAULT_SYSTEM_PROMPT

    # 4. Capabilities presentation instead of 29-tool dump
    assert "CAPABILITIES PRESENTATION" in DEFAULT_SYSTEM_PROMPT
    assert "29 tools" not in DEFAULT_SYSTEM_PROMPT
    assert "5 portable MetaTrader 5 worker terminals" not in DEFAULT_SYSTEM_PROMPT

    # 5. Single-variable & User Agency rule
    assert "SINGLE-VARIABLE HYPOTHESIS & USER AGENCY" in DEFAULT_SYSTEM_PROMPT

    # 6. Web research integration (search_web & read_web_page)
    assert "search_web" in DEFAULT_SYSTEM_PROMPT
    assert "read_web_page" in DEFAULT_SYSTEM_PROMPT

    # 7. Blueprint Approval Gate (Mandatory HITL review before writing code)
    assert "BLUEPRINT APPROVAL GATE (MANDATORY HITL REVIEW & APPROVAL)" in DEFAULT_SYSTEM_PROMPT
    assert "ask_user" in DEFAULT_SYSTEM_PROMPT
    assert "Blueprint Approval Gate Invariant" in DEFAULT_SYSTEM_PROMPT

    # 8. Strict HITL policy: strategic dilemmas only, zero generic fillers
    assert "HIGH-LEVEL STRATEGIC DILEMMAS ONLY" in DEFAULT_SYSTEM_PROMPT
    assert "ZERO GENERIC FILLERS" in DEFAULT_SYSTEM_PROMPT
    assert "DO NOT interrogate the user" in DEFAULT_SYSTEM_PROMPT


def test_ask_user_tool_definition_hygiene():
    from packages.agent.src.core.harness import AgentHarness
    from unittest.mock import MagicMock

    mock_llm = MagicMock()
    harness = AgentHarness(session_id="test-session", user_id="test-user", llm_adapter=mock_llm)
    ask_user_tool = harness._tools.get("ask_user")
    assert ask_user_tool is not None
    assert "critical, high-level strategic dilemmas" in ask_user_tool.description
    assert "pre-code confirmation" not in ask_user_tool.description.lower() or "do not use this tool for pre-code confirmation" in ask_user_tool.description.lower()
    assert "options" in ask_user_tool.parameters["required"]


def test_status_announcements_zero_host_path_leak():
    import re
    from pathlib import Path

    sample_args = {
        "filepath": "C:\\Users\\khatt\\OneDrive\\Desktop\\BacktestSI\\data\\users\\senior\\gold_5m_breakout_v2.mq5",
        "filename": "/var/backtest/data/users/senior/my_ea.mq5",
    }

    def _clean_arg_fn(key: str) -> str:
        val = str(sample_args.get(key, "")).strip().strip("'\"")
        return Path(val).name if val else ""

    text = f"🔨 [MetaEditor Compiler]: Compiling {_clean_arg_fn('filepath')}..."
    text = re.sub(r'[A-Za-z]:\\[^:\n\r\t]+?\\([^\s\\/]+)', r'\1', text)
    text = re.sub(r'(?:\/[a-zA-Z0-9_\-\.]+)+\/([^\s\\/]+)', r'\1', text)

    assert "C:\\Users" not in text
    assert "/data/users" not in text
    assert text == "🔨 [MetaEditor Compiler]: Compiling gold_5m_breakout_v2.mq5..."
