"""
Unit tests for Strategy Inception State Machine and Naming Validation.
"""

import pytest
from pathlib import Path
import tempfile

from packages.agent.src.core.types import (
    AgentSessionState,
    AgentState,
    EventType,
    StrategyInceptionState,
    format_strategy_filename,
    validate_strategy_name,
)
from packages.agent.src.core.harness import AgentHarness, LLMAdapterProtocol, ModelChunk
from packages.agent.src.storage.sqlite import SQLiteSessionStorage


class MockLLMAdapter(LLMAdapterProtocol):
    async def generate_turn(self, messages, tools):
        yield ModelChunk(content_delta="Understood.")


def test_validate_strategy_name():
    # Valid 2-word names
    ok, norm, err = validate_strategy_name("gold_scalper")
    assert ok is True
    assert norm == "gold_scalper"
    assert err == ""

    # Valid 3-word names
    ok, norm, err = validate_strategy_name("ict_gold_scalper")
    assert ok is True
    assert norm == "ict_gold_scalper"
    assert err == ""

    # Valid with file extension and version suffix
    ok, norm, err = validate_strategy_name("ict_gold_scalper_v1.py")
    assert ok is True
    assert norm == "ict_gold_scalper"

    # Valid with spaces / dashes to be normalized
    ok, norm, err = validate_strategy_name("ICT Gold Scalper")
    assert ok is True
    assert norm == "ict_gold_scalper"

    # Valid 4-word names (e.g. gold_m1_liquidity_scalper)
    ok, norm, err = validate_strategy_name("gold_m1_liquidity_scalper")
    assert ok is True
    assert norm == "gold_m1_liquidity_scalper"
    assert err == ""

    # Valid 5-word names
    ok, norm, err = validate_strategy_name("ict_gold_scalper_london_open")
    assert ok is True
    assert norm == "ict_gold_scalper_london_open"
    assert err == ""

    # Valid 6-word names
    ok, norm, err = validate_strategy_name("gold_m1_liquidity_sweep_scalper_pro")
    assert ok is True
    assert norm == "gold_m1_liquidity_sweep_scalper_pro"
    assert err == ""

    # Invalid: 1 word
    ok, norm, err = validate_strategy_name("scalper")
    assert ok is False
    assert "between 2 and 6 words" in err

    # Invalid: > 6 words (7 words)
    ok, norm, err = validate_strategy_name("too_many_words_in_this_strategy_name_here")
    assert ok is False
    assert "between 2 and 6 words" in err

    # Invalid: empty string
    ok, norm, err = validate_strategy_name("")
    assert ok is False

    # Invalid: special characters
    ok, norm, err = validate_strategy_name("ict$gold@scalper")
    assert ok is False


def test_format_strategy_filename():
    fn1 = format_strategy_filename("ict_gold_scalper", version=1)
    assert fn1 == "ict_gold_scalper_v1.py"

    fn2 = format_strategy_filename("ict_gold_scalper", version=2)
    assert fn2 == "ict_gold_scalper_v2.py"

    fn_mq5 = format_strategy_filename("ict_gold_scalper", version=1, ext="mq5")
    assert fn_mq5 == "ict_gold_scalper_v1.mq5"


def test_harness_inception_state_progression():
    harness = AgentHarness(
        session_id="test_inception_sess",
        user_id="trader_1",
        llm_adapter=MockLLMAdapter(),
    )

    # Initial state must be DISCUSSING
    assert harness.session.inception_state == StrategyInceptionState.DISCUSSING
    assert harness.session.active_strategy_name is None
    assert harness.session.active_strategy_version == 1
    assert harness.session.preset_approved is False

    # 1. Move to PRESET_REVIEW
    evt1 = harness.set_inception_state(
        StrategyInceptionState.PRESET_REVIEW,
        strategy_name="ict_gold_scalper",
    )
    assert evt1.event_type == EventType.INCEPTION_STATE_CHANGED
    assert harness.session.inception_state == StrategyInceptionState.PRESET_REVIEW
    assert harness.session.active_strategy_name == "ict_gold_scalper"

    # 2. Trader approves preset -> CODE_PROPOSED
    evt2 = harness.set_inception_state(
        StrategyInceptionState.CODE_PROPOSED,
        preset_approved=True,
    )
    assert harness.session.inception_state == StrategyInceptionState.CODE_PROPOSED
    assert harness.session.preset_approved is True

    # 3. Code saved and validated -> READY_FOR_TEST
    evt3 = harness.set_inception_state(StrategyInceptionState.READY_FOR_TEST)
    assert harness.session.inception_state == StrategyInceptionState.READY_FOR_TEST

    # 4. Strategy tested in sandbox or backtest -> TESTED
    evt4 = harness.set_inception_state(StrategyInceptionState.TESTED)
    assert harness.session.inception_state == StrategyInceptionState.TESTED

    # 5. Dedicated folder and versioning post-test -> VERSIONED
    evt5 = harness.set_inception_state(
        StrategyInceptionState.VERSIONED,
        strategy_version=1,
    )
    assert harness.session.inception_state == StrategyInceptionState.VERSIONED
    assert len(harness.session.trajectory) >= 5


@pytest.mark.asyncio
async def test_lifecycle_strategy_versioning_and_folder_creation():
    """
    Verifies that create_file, create_folder, and save_strategy_version execute cleanly,
    dual-writing to filesystem and SQLite without premature rejection roadblocks.
    """
    import shutil
    from packages.agent.src.tools.workspace import register_workspace_tools, create_file, USERS_STORAGE_DIR

    test_user_dir = USERS_STORAGE_DIR / "trader_guard_user"
    if test_user_dir.exists():
        shutil.rmtree(test_user_dir, ignore_errors=True)

    harness = AgentHarness(
        session_id="sess_lifecycle_guard_test",
        user_id="trader_guard_user",
        llm_adapter=MockLLMAdapter(),
    )
    register_workspace_tools(harness, user_id="trader_guard_user")

    # Inception state is DISCUSSING -> Move to PRESET_REVIEW -> CODE_PROPOSED
    harness.set_inception_state(
        StrategyInceptionState.PRESET_REVIEW,
        strategy_name="gold_smc_scalper",
    )
    harness.set_inception_state(
        StrategyInceptionState.CODE_PROPOSED,
        preset_approved=True,
    )

    code = (
        "from backtest_si.strategy import BaseStrategy\n"
        "class GoldSMCScalper(BaseStrategy):\n"
        "    pass\n"
    )

    # 1. create_file creates unversioned file cleanly
    create_file_handler = harness._tool_handlers["create_file"]
    res_proper_file = await create_file_handler(
        filename="gold_smc_scalper.py",
        content=code,
    )
    assert res_proper_file["success"] is True
    assert harness.session.inception_state == StrategyInceptionState.READY_FOR_TEST

    # 2. Folder creation works without rejection
    create_folder_handler = harness._tool_handlers["create_folder"]
    res_folder = await create_folder_handler(folder_name="gold_smc_scalper")
    assert res_folder["success"] is True

    # 3. Strategy is tested
    harness.set_inception_state(StrategyInceptionState.TESTED)
    assert harness.session.inception_state == StrategyInceptionState.TESTED

    # 4. save_strategy_version saves version 1 and syncs to SQLite DB
    save_version_handler = harness._tool_handlers["save_strategy_version"]
    res_version = await save_version_handler(
        strategy_name="gold_smc_scalper",
        code=code,
        bump_version=False,
    )
    assert res_version["success"] is True
    assert res_version["version"] == 1
    assert res_version["filename"] == "gold_smc_scalper_v1.py"
    assert res_version["db_synced"] is True
    assert harness.session.inception_state == StrategyInceptionState.VERSIONED

    # 5. Bump version to v2 creates next snapshot
    res_v2 = await save_version_handler(
        strategy_name="gold_smc_scalper",
        code=code + "\n# revision v2",
        bump_version=True,
    )
    assert res_v2["success"] is True
    assert res_v2["version"] == 2
    assert res_v2["filename"] == "gold_smc_scalper_v2.py"
    assert res_v2["db_synced"] is True

    if test_user_dir.exists():
        shutil.rmtree(test_user_dir, ignore_errors=True)


def test_sqlite_storage_persists_inception_state():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_memory.db"
        storage = SQLiteSessionStorage(db_path=db_path)

        session = AgentSessionState(
            session_id="sess_inc_persist",
            user_id="user_alpha",
            inception_state=StrategyInceptionState.PRESET_REVIEW,
            active_strategy_name="ict_gold_scalper",
            active_strategy_version=2,
            preset_approved=True,
        )

        storage.save_session(session)

        # Restore from DB
        loaded = storage.load_session("sess_inc_persist")
        assert loaded is not None
        assert loaded.inception_state == StrategyInceptionState.PRESET_REVIEW
        assert loaded.active_strategy_name == "ict_gold_scalper"
        assert loaded.active_strategy_version == 2
        assert loaded.preset_approved is True
