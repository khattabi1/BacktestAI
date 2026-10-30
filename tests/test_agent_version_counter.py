import pytest
from apps.api.src.routers.agent import ChatRequest, build_context_envelope


def test_chat_request_accepts_version_counter_fields():
    req = ChatRequest(
        session_id="test_sess",
        prompt="run a backtest",
        active_strategy="gold_scalper.mq5",
        active_version="v2",
        context_metadata={"version_tests_count": 2, "next_test_number": 3}
    )
    assert req.context_metadata is not None
    assert req.context_metadata["version_tests_count"] == 2
    assert req.context_metadata["next_test_number"] == 3


def test_context_envelope_formats_version_test_counts():
    envelope = build_context_envelope(
        strategy="gold_scalper.mq5",
        version="v2",
        version_tests_count=2,
        next_test_number=3,
        telemetry=None
    )
    assert "Strategy='gold_scalper.mq5'" in envelope
    assert "Version='v2'" in envelope
    assert "Version_Tests_Count=2" in envelope
    assert "Next_Test_Number=3" in envelope


def test_context_envelope_handles_defaults():
    envelope = build_context_envelope(
        strategy="scalper.py",
        version="",
        version_tests_count=0,
        next_test_number=1,
        telemetry={"win_rate": 65.0}
    )
    assert "Strategy='scalper.py'" in envelope
    assert "Version='v1'" in envelope
    assert "Version_Tests_Count=0" in envelope
    assert "Next_Test_Number=1" in envelope
    assert "win_rate" in envelope
