import pytest
import polars as pl
from apps.api.src.services.data_service import MarketDataService

@pytest.mark.unit
def test_data_service_available_symbols():
    service = MarketDataService()
    symbols = service.get_available_symbols()
    
    assert len(symbols) >= 2
    sym_names = [s["symbol"] for s in symbols]
    assert "US30" in sym_names
    assert "XAUUSD" in sym_names

@pytest.mark.unit
def test_data_service_query_btcusdt():
    service = MarketDataService()
    df = service.load_ohlcv("US30", timeframe="1m")
    
    assert len(df) >= 2880
    assert "timestamp" in df.columns
    assert "open" in df.columns
    assert "close" in df.columns
    assert "volume" in df.columns
    
    # Assert chronological sorting
    timestamps = df["timestamp"].to_list()
    assert timestamps == sorted(timestamps)

@pytest.mark.unit
def test_data_service_query_xauusd_domain_conversion():
    service = MarketDataService()
    df = service.load_ohlcv("XAUUSD", timeframe="1m", limit=3000)
    
    assert len(df) >= 2880
    bars = service.to_domain_bars(df)
    assert len(bars) == len(df)
    assert bars[0].symbol == "XAUUSD"
    assert bars[0].close > 0
