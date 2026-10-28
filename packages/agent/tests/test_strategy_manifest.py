import tempfile
from pathlib import Path
import pytest
from packages.agent.src.core.types import StrategyManifest, AgentSessionState
from packages.agent.src.storage.sqlite import SQLiteSessionStorage

def test_strategy_manifest_serialization_and_db():
    with tempfile.TemporaryDirectory() as tmp_dir:
        db_path = Path(tmp_dir) / "test_manifest.db"
        storage = SQLiteSessionStorage(db_path=db_path)
        session = AgentSessionState(session_id="test_sess", user_id="senior", title="Test Session")
        manifest = StrategyManifest(
            strategy_name="sk_gold_sequencer",
            version=2,
            target_symbol="XAUUSD",
            native_timeframe="M5",
            engine="MQL5",
            core_rules_summary="3-wave sequencer + 50-pip floor",
            test_status="TESTED_PASSED",
            last_test_metrics={"win_rate": 64.0, "sharpe": 3.84}
        )
        session.strategy_manifest = manifest
        storage.save_session(session)

        restored = storage.load_session("test_sess")
        assert restored is not None
        assert restored.strategy_manifest is not None
        assert restored.strategy_manifest.strategy_name == "sk_gold_sequencer"
        assert restored.strategy_manifest.native_timeframe == "M5"
        assert restored.strategy_manifest.target_symbol == "XAUUSD"
        compact_hdr = restored.strategy_manifest.to_compact_header()
        assert "M5" in compact_hdr
        assert "XAUUSD" in compact_hdr
        assert "sk_gold_sequencer" in compact_hdr
