"""
Deterministic Static Code Introspector for BacktestAI Agent (DSH Architecture).
Extracts strategy identity, version, symbol, and timeframe from source code
without LLM hallucination or token expenditure.
"""

from __future__ import annotations
import re
from pathlib import Path
from typing import Optional
from .types import StrategyManifest, utc_now_iso

COMMON_SYMBOLS = [
    "XAUUSD", "GOLD", "BTCUSDT", "ETHUSDT", "EURUSD", 
    "GBPUSD", "USDJPY", "US30", "NAS100", "SPX500", "GER40"
]

TIMEFRAME_ENUM_MAP = {
    "PERIOD_M1": "M1",
    "PERIOD_M2": "M2",
    "PERIOD_M3": "M3",
    "PERIOD_M4": "M4",
    "PERIOD_M5": "M5",
    "PERIOD_M6": "M6",
    "PERIOD_M10": "M10",
    "PERIOD_M12": "M12",
    "PERIOD_M15": "M15",
    "PERIOD_M20": "M20",
    "PERIOD_M30": "M30",
    "PERIOD_H1": "H1",
    "PERIOD_H2": "H2",
    "PERIOD_H3": "H3",
    "PERIOD_H4": "H4",
    "PERIOD_H6": "H6",
    "PERIOD_H8": "H8",
    "PERIOD_H12": "H12",
    "PERIOD_D1": "D1",
    "PERIOD_W1": "W1",
    "PERIOD_MN1": "MN1",
}

ALIAS_TO_CANONICAL_TF = {
    "1M": "M1", "2M": "M2", "3M": "M3", "5M": "M5", "10M": "M10",
    "15M": "M15", "20M": "M20", "30M": "M30", "1H": "H1", "2H": "H2",
    "3H": "H3", "4H": "H4", "6H": "H6", "8H": "H8", "12H": "H12",
    "1D": "D1", "D": "D1", "1W": "W1", "W": "W1", "1MN": "MN1", "MN": "MN1"
}


def introspect_strategy_code(file_path: Path | str, code_content: Optional[str] = None) -> StrategyManifest:
    """
    Statically analyzes MQL5 and Python strategy source files to extract
    concrete operational dimensions into a StrategyManifest.
    """
    path_obj = Path(file_path) if isinstance(file_path, str) else file_path
    strategy_raw_name = path_obj.stem
    # Remove version suffix from root strategy name if present (e.g. sk_gold_v2 -> sk_gold)
    base_name = re.sub(r"_v\d+$", "", strategy_raw_name, flags=re.IGNORECASE)
    suffix = path_obj.suffix.lower()
    engine = "Python" if suffix == ".py" else "MT5"

    content = code_content
    if content is None and path_obj.is_file():
        try:
            content = path_obj.read_text(encoding="utf-8", errors="replace")
        except Exception:
            content = ""

    if not content or not content.strip():
        return StrategyManifest(
            strategy_name=base_name,
            version=1,
            target_symbol="PENDING",
            native_timeframe="PENDING",
            engine=engine,
            core_rules_summary="",
            test_status="NOT_TESTED",
            updated_at=utc_now_iso(),
        )

    # 1. Version Detection
    detected_version = 1
    # Check #property version "X.XX" in MQL5
    m_ver_mql = re.search(r'#property\s+version\s+["\'](\d+)(?:\.\d+)?["\']', content, re.IGNORECASE)
    if m_ver_mql:
        try:
            detected_version = int(m_ver_mql.group(1))
        except Exception:
            pass
    else:
        # Check __version__ = "X.X" in Python
        m_ver_py = re.search(r'(?:__version__|VERSION)\s*=\s*["\'](\d+)(?:\.\d+)?["\']', content, re.IGNORECASE)
        if m_ver_py:
            try:
                detected_version = int(m_ver_py.group(1))
            except Exception:
                pass
        else:
            # Fallback to filename version
            m_ver_fn = re.search(r'_v(\d+)', strategy_raw_name, re.IGNORECASE)
            if m_ver_fn:
                try:
                    detected_version = int(m_ver_fn.group(1))
                except Exception:
                    pass

    # 2. Symbol Detection
    detected_symbol = "PENDING"
    # A. Check explicit symbol inputs or assignments
    m_sym = re.search(r'(?:InpSymbol|symbol|target_symbol|SYMBOL)\s*=\s*["\']([A-Za-z0-9_]+)["\']', content, re.IGNORECASE)
    if m_sym and m_sym.group(1).upper() != "_SYMBOL":
        detected_symbol = m_sym.group(1).upper()
    else:
        # B. Check for standard financial instruments in the comments or code
        for sym in COMMON_SYMBOLS:
            if re.search(rf'\b{sym}\b', content, re.IGNORECASE):
                detected_symbol = "XAUUSD" if sym.upper() == "GOLD" else sym.upper()
                break

    # 3. Timeframe Detection
    detected_tf = "PENDING"
    # A. Check indicator calls (e.g. iATR, iRSI, iMA) with explicit PERIOD_XX
    m_ind_period = re.search(r'\b(PERIOD_[A-Z0-9]+)\b', content)
    if m_ind_period and m_ind_period.group(1) in TIMEFRAME_ENUM_MAP:
        detected_tf = TIMEFRAME_ENUM_MAP[m_ind_period.group(1)]
    else:
        # B. Check Python TIMEFRAME / timeframe strings (e.g. "15m", "1h", "5m")
        m_py_tf = re.search(r'(?:TIMEFRAME|timeframe|TimeFrame)\s*=\s*["\']([A-Za-z0-9]+)["\']', content)
        if m_py_tf:
            raw_tf = m_py_tf.group(1).upper()
            if raw_tf in ALIAS_TO_CANONICAL_TF:
                detected_tf = ALIAS_TO_CANONICAL_TF[raw_tf]
            elif raw_tf in TIMEFRAME_ENUM_MAP.values():
                detected_tf = raw_tf
        else:
            # C. Check general period inputs
            m_inp_period = re.search(r'input\s+ENUM_TIMEFRAMES\s+\w+\s*=\s*(PERIOD_[A-Z0-9]+)', content)
            if m_inp_period and m_inp_period.group(1) in TIMEFRAME_ENUM_MAP:
                detected_tf = TIMEFRAME_ENUM_MAP[m_inp_period.group(1)]

    # 4. Core Rules Summary
    rules: list[str] = []
    if "min_sl_pips" in content or "sl_atr_buffer" in content:
        rules.append("SL Protection")
    if "trailing" in content.lower():
        rules.append("Trailing Stop")
    if "sequencer" in content.lower():
        rules.append("Sequencer")
    rules_summary = " + ".join(rules) if rules else ""

    return StrategyManifest(
        strategy_name=base_name,
        version=detected_version,
        target_symbol=detected_symbol,
        native_timeframe=detected_tf,
        engine=engine,
        core_rules_summary=rules_summary,
        test_status="NOT_TESTED",
        updated_at=utc_now_iso(),
    )

