import pytest
from packages.agent.src.core.types import StrategyManifest
from packages.agent.src.tools.mt5_mcp import _preflight_check_tester_args

def test_preflight_intercepts_timeframe_mismatch():
    manifest = StrategyManifest(
        strategy_name="sk_gold_sequencer",
        target_symbol="XAUUSD",
        native_timeframe="M5"
    )
    # Model mistakenly calls tester with H1 on an M5 strategy
    valid, err, fixed_args = _preflight_check_tester_args(
        ea_name="sk_gold_sequencer.ex5",
        symbol="XAUUSD",
        period="H1",
        manifest=manifest
    )
    assert not valid
    assert "PRE-FLIGHT VALIDATION REJECTED" in err
    assert "M5" in err and "H1" in err

def test_preflight_intercepts_symbol_mismatch():
    manifest = StrategyManifest(
        strategy_name="sk_gold_sequencer",
        target_symbol="XAUUSD",
        native_timeframe="M5"
    )
    # Model mistakenly calls tester with EURUSD on an XAUUSD strategy
    valid, err, fixed_args = _preflight_check_tester_args(
        ea_name="sk_gold_sequencer.ex5",
        symbol="EURUSD",
        period="M5",
        manifest=manifest
    )
    assert not valid
    assert "PRE-FLIGHT VALIDATION REJECTED" in err
    assert "XAUUSD" in err and "EURUSD" in err

def test_preflight_inherits_verified_dimensions_when_omitted():
    manifest = StrategyManifest(
        strategy_name="sk_gold_sequencer",
        target_symbol="XAUUSD",
        native_timeframe="M5"
    )
    # Model omitted period, should inherit verified M5 from manifest
    valid, err, fixed_args = _preflight_check_tester_args(
        ea_name="sk_gold_sequencer.ex5",
        symbol="XAUUSD",
        period=None,
        manifest=manifest
    )
    assert valid
    assert fixed_args["period"] == "M5"
    assert fixed_args["symbol"] == "XAUUSD"

def test_preflight_rejects_when_manifest_is_pending_and_args_omitted():
    manifest = StrategyManifest(
        strategy_name="uncommented_bot",
        target_symbol="PENDING",
        native_timeframe="PENDING"
    )
    valid, err, fixed_args = _preflight_check_tester_args(
        ea_name="uncommented_bot.ex5",
        symbol=None,
        period=None,
        manifest=manifest
    )
    assert not valid
    assert "PRE-FLIGHT VALIDATION REJECTED" in err
    assert "PENDING" in err or "clarify" in err.lower()
