from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Query, HTTPException, Response
from domain.models import BarModel, MarketSymbolInfo
from ..services.data_service import MarketDataService

try:
    import polars as pl
except ImportError:
    pl = None

router = APIRouter(prefix="/market-data", tags=["Market Data"])
data_service = MarketDataService()

@router.get("/symbols", response_model=List[MarketSymbolInfo])
def get_symbols():
    """Retrieve all available symbols, markets, and timeframes from partitioned Parquet storage."""
    symbols = data_service.get_available_symbols()
    return [
        MarketSymbolInfo(
            market=s["market"],
            symbol=s["symbol"],
            timeframe=s["timeframe"],
            file_count=s["file_count"]
        )
        for s in symbols
    ]

_BROKER_CATALOG_CACHE = None

@router.get("/broker-symbols-catalog")
def get_broker_symbols_catalog():
    """
    Returns institutional broker instruments grouped by category:
    - FX: Major Pairs, Minor Pairs, Exotics
    - Commodities: Metals, Energies & Softs
    - Indices: Global Spot & Futures
    - Crypto
    - Equities & ETFs
    """
    global _BROKER_CATALOG_CACHE
    if _BROKER_CATALOG_CACHE:
        return _BROKER_CATALOG_CACHE

    catalog = {
        "FX - Major Pairs": [],
        "FX - Minor Pairs": [],
        "FX - Exotics": [],
        "Commodities - Metals": [],
        "Commodities - Energies & Softs": [],
        "Indices - Global": [],
        "Crypto": [],
        "US Equities (Top Liquid)": [],
        "ETFs & Funds": []
    }

    majors = {"EURUSD", "GBPUSD", "USDJPY", "USDCHF", "USDCAD", "AUDUSD", "NZDUSD"}
    liquid_equities = {
        "AAPL.NAS", "NVDA.NAS", "MSFT.NAS", "AMZN.NAS", "GOOG.NAS", "TSLA.NAS",
        "META.NAS", "AMD.NAS", "NFLX.NAS", "JPM.NYSE", "BAC.NYSE", "V.NYSE",
        "MA.NYSE", "XOM.NYSE", "CVX.NYSE", "WMT.NYSE", "DIS.NYSE", "BA.NYSE",
        "COIN.NAS", "PLTR.NAS", "MSTR.NAS", "SMCI.NAS", "INTC.NAS", "CRM.NYSE"
    }

    try:
        import MetaTrader5 as mt5
        if mt5.initialize():
            symbols = mt5.symbols_get()
            mt5.shutdown()
            if symbols:
                for s in symbols:
                    name = s.name
                    path = s.path.lower()
                    desc = s.description or name
                    item = {"symbol": name, "description": desc, "category": s.path.split("\\")[0]}

                    if name in majors:
                        catalog["FX - Major Pairs"].append(item)
                    elif "forex\\minors" in path or (path.startswith("forex") and any(c in name for c in ["EUR","GBP","AUD","NZD","CAD","CHF","JPY"]) and len(name)==6 and not any(x in name for x in ["SGD","TRY","ZAR","PLN","SEK","NOK","DKK","HKD","CZK","CNH","HUF","MXN","THB"])):
                        catalog["FX - Minor Pairs"].append(item)
                    elif "forex\\exotics" in path or (path.startswith("forex") and any(x in name for x in ["SGD","TRY","ZAR","PLN","SEK","NOK","DKK","HKD","CZK","CNH","HUF","MXN","THB"])):
                        catalog["FX - Exotics"].append(item)
                    elif any(name.startswith(x) for x in ["XAU", "XAG", "XPT", "XPD"]):
                        catalog["Commodities - Metals"].append(item)
                    elif any(name.startswith(x) for x in ["XTI", "XBR", "XNG", "BRENT", "WTI", "Cotton", "OJ"]):
                        catalog["Commodities - Energies & Softs"].append(item)
                    elif "indices" in path or any(name.startswith(x) for x in ["US30", "US500", "USTEC", "US2000", "UK100", "DE40", "JP225", "AUS200", "CHINA50", "ES35", "STOXX50", "F40", "HK50", "IT40"]):
                        catalog["Indices - Global"].append(item)
                    elif "crypto" in path or any(name.startswith(x) for x in ["BTC", "ETH", "SOL", "LTC", "XRP", "ADA", "DOG", "BNB", "DOT", "LNK", "AVX", "XTZ"]):
                        catalog["Crypto"].append(item)
                    elif "etf" in path or any(name.endswith(x) for x in [".ETF", "SPY.NYSE", "QQQ.NAS", "IWM.NYSE", "GLD.NYSE", "TLT.NAS", "BITO.NYSE"]):
                        catalog["ETFs & Funds"].append(item)
                    elif name in liquid_equities:
                        catalog["US Equities (Top Liquid)"].append(item)
    except Exception as e:
        pass

    # Ensure baseline fallback if MT5 not connected
    if not catalog["FX - Major Pairs"]:
        catalog["FX - Major Pairs"] = [
            {"symbol": "EURUSD", "description": "Euro vs US Dollar", "category": "Forex"},
            {"symbol": "GBPUSD", "description": "Great Britain Pound vs US Dollar", "category": "Forex"},
            {"symbol": "USDJPY", "description": "US Dollar vs Japanese Yen", "category": "Forex"},
            {"symbol": "USDCHF", "description": "US Dollar vs Swiss Franc", "category": "Forex"},
            {"symbol": "USDCAD", "description": "US Dollar vs Canadian Dollar", "category": "Forex"},
            {"symbol": "AUDUSD", "description": "Australian Dollar vs US Dollar", "category": "Forex"},
            {"symbol": "NZDUSD", "description": "New Zealand Dollar vs US Dollar", "category": "Forex"},
        ]
    if not catalog["Commodities - Metals"]:
        catalog["Commodities - Metals"] = [
            {"symbol": "XAUUSD", "description": "Gold vs US Dollar", "category": "Commodities"},
            {"symbol": "XAGUSD", "description": "Silver vs US Dollar", "category": "Commodities"},
            {"symbol": "XAUEUR", "description": "Gold vs Euro", "category": "Commodities"},
            {"symbol": "XPDUSD", "description": "Palladium vs US Dollar", "category": "Commodities"},
            {"symbol": "XPTUSD", "description": "Platinum vs US Dollar", "category": "Commodities"},
        ]
    if not catalog["Indices - Global"]:
        catalog["Indices - Global"] = [
            {"symbol": "US500", "description": "S&P 500 Index", "category": "Indices"},
            {"symbol": "US30", "description": "Dow Jones 30 Index", "category": "Indices"},
            {"symbol": "USTEC", "description": "Nasdaq 100 Index", "category": "Indices"},
            {"symbol": "DE40", "description": "Germany DAX 40", "category": "Indices"},
            {"symbol": "UK100", "description": "FTSE 100 Index", "category": "Indices"},
            {"symbol": "JP225", "description": "Nikkei 225 Index", "category": "Indices"},
        ]
    if not catalog["Crypto"]:
        catalog["Crypto"] = [
            {"symbol": "BTCUSD", "description": "Bitcoin vs USD", "category": "Crypto"},
            {"symbol": "ETHUSD", "description": "Ethereum vs USD", "category": "Crypto"},
            {"symbol": "SOLUSD", "description": "Solana vs USD", "category": "Crypto"},
            {"symbol": "XRPUSD", "description": "Ripple vs USD", "category": "Crypto"},
        ]

    _BROKER_CATALOG_CACHE = catalog
    return catalog

@router.get("/range")
def get_symbol_range(symbol: str = Query(..., description="Ticker symbol (e.g. XAUUSD)")):
    """Retrieve the available date range for a given symbol."""
    return data_service.get_date_range(symbol)

@router.get("/verify")
def verify_market_data(
    symbol: str = Query(..., description="Ticker symbol (e.g. XAUUSD)"),
    timeframe: str = Query("15m", description="Bar resolution (1m, 5m, 15m, 1h, 4h, 1d)"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY or YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY or YYYY-MM-DD)"),
):
    """
    Checks that local Parquet partitions for the given symbol, timeframe, and date range
    exist, counts bars, and reports readiness for sandbox simulation.
    """
    import os
    import re
    from datetime import timezone

    def parse_bound(val: Optional[str], is_end: bool = False) -> Optional[datetime]:
        if not val:
            return None
        s = val.strip()
        if re.match(r"^\d{4}$", s):
            y = int(s)
            return datetime(y, 12, 31, 23, 59, 59, tzinfo=timezone.utc) if is_end else datetime(y, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        try:
            dt = datetime.fromisoformat(s)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if is_end and dt.hour == 0 and dt.minute == 0 and dt.second == 0:
                dt = dt.replace(hour=23, minute=59, second=59)
            return dt
        except Exception:
            return None

    start_dt = parse_bound(start_date, is_end=False)
    end_dt = parse_bound(end_date, is_end=True)

    # If single year given (e.g. 2025)
    if start_date and not end_date and re.match(r"^\d{4}$", start_date.strip()):
        end_dt = datetime(start_dt.year, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
    elif end_date and not start_date and re.match(r"^\d{4}$", end_date.strip()):
        start_dt = datetime(end_dt.year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    # Defaults if unbounded
    if not start_dt and not end_dt:
        start_dt = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        end_dt = datetime(2026, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
    elif not start_dt:
        start_dt = datetime(max(2010, end_dt.year - 2), 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    elif not end_dt:
        end_dt = datetime(2026, 12, 31, 23, 59, 59, tzinfo=timezone.utc)

    files = data_service._select_parquet_files(symbol, timeframe, start_dt, end_dt)
    if not files:
        return {
            "ready": False,
            "status": "missing_data",
            "symbol": symbol,
            "timeframe": timeframe,
            "start_date": start_dt.strftime("%Y-%m-%d"),
            "end_date": end_dt.strftime("%Y-%m-%d"),
            "files": [],
            "file_count": 0,
            "total_bars": 0,
            "message": f"No parquet partitions found on disk for {symbol} ({timeframe}).",
        }

    file_list = ", ".join(f"'{f.replace(os.sep, '/')}'" for f in files)
    try:
        sql = f"""
            SELECT count(*), MIN(timestamp), MAX(timestamp) 
            FROM read_parquet([{file_list}]) 
            WHERE timestamp >= '{start_dt.strftime('%Y-%m-%d %H:%M:%S')}' 
              AND timestamp <= '{end_dt.strftime('%Y-%m-%d %H:%M:%S')}'
        """
        res = data_service.conn.execute(sql).fetchall()
        total_bars = int(res[0][0]) if res and res[0] and res[0][0] is not None else 0
        first_bar = str(res[0][1])[:16] if res and res[0] and res[0][1] else None
        last_bar = str(res[0][2])[:16] if res and res[0] and res[0][2] else None

        if total_bars == 0:
            msg = f"No candle data found for {symbol} ({timeframe}) between {start_dt.strftime('%Y-%m-%d')} and {end_dt.strftime('%Y-%m-%d')}. Available partitions: 2010 to 2026."
        else:
            first_f = os.path.basename(files[0])
            last_f = os.path.basename(files[-1])
            msg = f"Verified {total_bars:,} bars across {len(files)} partition file(s) ({first_f} to {last_f}). Ready for sandbox execution."

        return {
            "ready": total_bars > 0,
            "status": "ready" if total_bars > 0 else "empty_range",
            "symbol": symbol,
            "timeframe": timeframe,
            "start_date": start_dt.strftime("%Y-%m-%d"),
            "end_date": end_dt.strftime("%Y-%m-%d"),
            "files": [os.path.basename(f) for f in files],
            "file_count": len(files),
            "total_bars": total_bars,
            "first_bar": first_bar,
            "last_bar": last_bar,
            "message": msg,
        }
    except Exception as err:
        return {
            "ready": False,
            "status": "error",
            "symbol": symbol,
            "timeframe": timeframe,
            "start_date": start_dt.strftime("%Y-%m-%d"),
            "end_date": end_dt.strftime("%Y-%m-%d"),
            "files": [os.path.basename(f) for f in files],
            "file_count": len(files),
            "total_bars": 0,
            "message": f"Error verifying parquet partitions: {err}",
        }

@router.get("/bars", responses={200: {"model": List[BarModel]}})
def get_bars(
    symbol: str = Query(..., description="Ticker symbol (e.g. BTCUSDT, XAUUSD)"),
    timeframe: str = Query("1m", description="Bar timeframe (e.g. 1m, 5m, 1h, 1d)"),
    start_date: Optional[datetime] = Query(None, description="Start date filter (UTC)"),
    end_date: Optional[datetime] = Query(None, description="End date filter (UTC)"),
    limit: Optional[int] = Query(50000, description="Max bars to return", ge=1, le=500000),
    direction: Optional[str] = Query(None, description="Load direction: 'head' (forward from start_date) or 'tail' (backward from end_date)")
):
    """Query OHLCV historical candlestick bars via high-speed DuckDB + Polars zero-copy serialization."""
    try:
        # Determine direction:
        # If explicitly passed, use it.
        # If start_date is set (whether end_date is set or not), default to "head" so replay starts at start_date.
        # Otherwise, default to "tail" (latest current price bars).
        if direction:
            actual_direction = direction
        elif start_date:
            actual_direction = "head"
        else:
            actual_direction = "tail"

        df = data_service.load_ohlcv(
            symbol=symbol,
            timeframe=timeframe,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            limit_direction=actual_direction,
        )
        if df.is_empty():
            return Response(content="[]", media_type="application/json")

        # High-speed serialization: format timestamp to ISO 8601 UTC and dump directly to JSON via Polars
        if "timestamp" in df.columns and df["timestamp"].dtype == pl.Datetime:
            df = df.with_columns(pl.col("timestamp").dt.to_string("%Y-%m-%dT%H:%M:%SZ"))

        json_bytes = df.write_json()
        headers = {}
        now_utc = datetime.now(timezone.utc)
        if end_date:
            end_utc = end_date if end_date.tzinfo is not None else end_date.replace(tzinfo=timezone.utc)
            if end_utc < now_utc:
                headers["Cache-Control"] = "public, max-age=604800, immutable"
        elif start_date:
            headers["Cache-Control"] = "public, max-age=86400"

        return Response(content=json_bytes, media_type="application/json", headers=headers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query market bars: {str(e)}")
