from pathlib import Path
import pytest
from packages.agent.src.core.introspector import introspect_strategy_code
from packages.agent.src.core.types import StrategyManifest

def test_introspect_mql5_with_explicit_properties():
    code = """
    //+------------------------------------------------------------------+
    //|                           sk_gold_sequencer.mq5 |
    //|        SK System (Stefan Kassing) Sequencer - XAUUSD             |
    //+------------------------------------------------------------------+
    #property copyright "BacktestAI"
    #property version   "2.00"
    #property strict

    input double fib_min = 0.5;
    input double min_sl_pips = 50.0;
    int atrHandleM15 = INVALID_HANDLE;

    int OnInit() {
        atrHandleM15 = iATR("XAUUSD", PERIOD_M5, 14);
        return INIT_SUCCEEDED;
    }
    """
    manifest = introspect_strategy_code(Path("sk_gold_sequencer.mq5"), code)
    assert isinstance(manifest, StrategyManifest)
    assert manifest.strategy_name == "sk_gold_sequencer"
    assert manifest.version == 2
    assert manifest.target_symbol == "XAUUSD"
    assert manifest.native_timeframe == "M5"
    assert manifest.engine == "MT5"

def test_introspect_python_strategy():
    code = """
    \"\"\"
    BTCUSDT 15-Minute Momentum Strategy
    \"\"\"
    __version__ = "1.2"
    SYMBOL = "BTCUSDT"
    TIMEFRAME = "15m"

    class MomentumStrategy:
        pass
    """
    manifest = introspect_strategy_code(Path("btc_momentum.py"), code)
    assert manifest.strategy_name == "btc_momentum"
    assert manifest.version == 1
    assert manifest.target_symbol == "BTCUSDT"
    assert manifest.native_timeframe == "M15"
    assert manifest.engine == "Python"

def test_introspect_raw_uncommented_code_returns_pending_safely():
    raw_code = """
    void OnTick() {
        int a = 1;
    }
    """
    manifest = introspect_strategy_code(Path("arbitrary_bot.mq5"), raw_code)
    assert manifest.strategy_name == "arbitrary_bot"
    assert manifest.target_symbol == "PENDING"
    assert manifest.native_timeframe == "PENDING"
    assert manifest.version == 1

def test_introspect_empty_and_missing_file_never_crashes():
    manifest = introspect_strategy_code(Path("ghost_strategy.mq5"), "")
    assert manifest.strategy_name == "ghost_strategy"
    assert manifest.target_symbol == "PENDING"
    assert manifest.native_timeframe == "PENDING"
