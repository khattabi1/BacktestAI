import os
import glob
import time
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import duckdb
import polars as pl
from backtest_si.types import Bar

logger = logging.getLogger("backtest_si.api.market_data")

class MarketDataService:
    def __init__(self, data_root: str = "data"):
        self.data_root = data_root
        self.parquet_root = os.path.join(data_root, "parquet")
        self.duckdb_path = os.path.join(data_root, "duckdb", "backtest_si.duckdb")
        # Keep a warm DuckDB connection with progress bar disabled for sub-100ms queries
        self.conn = duckdb.connect()
        try:
            self.conn.execute("SET enable_progress_bar = false")
        except Exception:
            pass

    def get_available_symbols(self) -> List[Dict[str, Any]]:
        """Scans the partitioned parquet hierarchy for available markets and symbols."""
        results = []
        if not os.path.exists(self.parquet_root):
            return results

        pattern = os.path.join(self.parquet_root, "*", "*", "*", "*.parquet")
        files = glob.glob(pattern)
        
        discovered = {}
        for f in files:
            # path structure: data/parquet/{market}/{symbol}/{timeframe}/{year}.parquet
            parts = os.path.normpath(f).split(os.sep)
            if len(parts) >= 5:
                market = parts[-4]
                symbol = parts[-3]
                tf = parts[-2]
                key = f"{market}:{symbol}:{tf}"
                if key not in discovered:
                    discovered[key] = {
                        "market": market,
                        "symbol": symbol,
                        "timeframe": tf,
                        "file_count": 0
                    }
                discovered[key]["file_count"] += 1

        return list(discovered.values())

    def get_date_range(self, symbol: str) -> Dict[str, str]:
        """Returns the earliest and latest available dates for a given symbol."""
        # Check 1d files first for near-instant scan
        files = glob.glob(os.path.join(self.parquet_root, "*", symbol, "1d", "*.parquet"))
        if not files:
            files = glob.glob(os.path.join(self.parquet_root, "*", symbol, "*", "*.parquet"))
        if not files:
            return {"start_date": "2010-01-01", "end_date": "2026-10-02"}

        file_list = ", ".join(f"'{f.replace(os.sep, '/')}'" for f in files)
        try:
            res = self.conn.execute(
                f"SELECT MIN(timestamp), MAX(timestamp) FROM read_parquet([{file_list}])"
            ).fetchall()
            if res and res[0] and res[0][0] and res[0][1]:
                start_dt = res[0][0].strftime("%Y-%m-%d")
                end_dt = res[0][1].strftime("%Y-%m-%d")
                return {"start_date": start_dt, "end_date": end_dt}
        except Exception as e:
            print(f"Error checking date range for {symbol}: {e}")
        return {"start_date": "2010-01-01", "end_date": "2026-10-02"}

    def _select_parquet_files(
        self,
        symbol: str,
        base_tf: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: Optional[int] = None,
        limit_direction: str = "tail",
    ) -> List[str]:
        """
        Smart file selection: dynamically selects only the parquet files
        covering the requested date range and limit window. Avoids scanning all 17+
        files when only 1-2 years are needed.
        """
        all_files = sorted(
            glob.glob(os.path.join(self.parquet_root, "*", symbol, base_tf, "*.parquet"))
        )
        if not all_files:
            return []

        def get_year(filepath: str) -> Optional[int]:
            basename = os.path.splitext(os.path.basename(filepath))[0]
            try:
                return int(basename)
            except ValueError:
                return None

        year_map = {}
        for f in all_files:
            y = get_year(f)
            if y is not None:
                year_map[y] = f

        available_years = sorted(year_map.keys())
        if not available_years:
            return all_files

        # Case 1: Both start_date and end_date provided
        if start_date and end_date:
            sel = [year_map[y] for y in available_years if start_date.year <= y <= end_date.year]
            return sel if sel else all_files

        minutes_map = {
            "1m": 1,
            "5m": 5,
            "15m": 15,
            "30m": 30,
            "1h": 60,
            "4h": 240,
            "1d": 1440,
            "d": 1440,
            "1w": 10080,
            "w": 10080,
        }
        bar_mins = minutes_map.get(base_tf.lower(), 1)

        # Case 2: Only end_date provided (scrolling backwards into history / LoD paging)
        if end_date and not start_date:
            valid_years = [y for y in available_years if y <= end_date.year]
            if not valid_years:
                return all_files
            if limit is not None and limit_direction == "tail":
                # Compute estimated days needed (trading days + weekends factor + 45 days buffer)
                needed_days = int((limit * bar_mins / 1440.0) * 1.5) + 45
                needed_years_count = max(1, (needed_days // 365) + 1)
                min_year = end_date.year - needed_years_count
                sel = [y for y in valid_years if y >= min_year]
                return [year_map[y] for y in sel] if sel else [year_map[valid_years[-1]]]
            return [year_map[y] for y in valid_years]

        # Case 3: Only start_date provided (scrolling forward toward current price / newer bars)
        if start_date and not end_date:
            valid_years = [y for y in available_years if y >= start_date.year]
            if not valid_years:
                return all_files
            if limit is not None and limit_direction == "head":
                needed_days = int((limit * bar_mins / 1440.0) * 1.5) + 45
                needed_years_count = max(1, (needed_days // 365) + 1)
                max_year = start_date.year + needed_years_count
                sel = [y for y in valid_years if y <= max_year]
                return [year_map[y] for y in sel] if sel else [year_map[valid_years[0]]]
            return [year_map[y] for y in valid_years]

        # Case 4: Neither start_date nor end_date provided
        if limit is not None and limit_direction == "tail":
            needed_days = int((limit * bar_mins / 1440.0) * 1.5) + 45
            needed_years_count = max(1, (needed_days // 365) + 1)
            sel = available_years[-needed_years_count:]
            return [year_map[y] for y in sel]

        return all_files

    def _resolve_market(self, symbol: str) -> str:
        """Determines market category (forex or crypto) based on existing path or symbol name."""
        matches = glob.glob(os.path.join(self.parquet_root, "*", symbol))
        if matches:
            parts = os.path.normpath(matches[0]).split(os.sep)
            return parts[-2]
        sym_clean = symbol.upper()
        if any(c in sym_clean for c in ("BTC", "ETH", "SOL", "USDT", "CRYPTO")):
            return "crypto"
        return "forex"

    def _is_year_complete(self, symbol: str, market: str, year: int, end_date: Optional[datetime] = None) -> bool:
        """Checks if a year partition exists and contains complete coverage."""
        m1_file = os.path.join(self.parquet_root, market, symbol, "1m", f"{year}.parquet")
        if not os.path.exists(m1_file):
            return False

        try:
            m1_path_sql = m1_file.replace(os.sep, '/')
            res = self.conn.execute(
                f"SELECT MIN(timestamp), MAX(timestamp), COUNT(*) FROM read_parquet('{m1_path_sql}')"
            ).fetchone()
            if not res or res[2] == 0:
                return False

            min_ts, max_ts, count = res[0], res[1], res[2]
            current_year = datetime.now().year

            # Past year: should cover early January through late December
            if year < current_year:
                if count < 10000:
                    return False
                if min_ts.month > 1 or min_ts.day > 15:
                    return False
                if max_ts.month < 12 or max_ts.day < 15:
                    return False
                return True

            # Current year: check if requested end_date is beyond max_ts
            if end_date and end_date.year == year:
                now_dt = datetime.now()
                target_check = min(end_date, now_dt)
                if (target_check - max_ts).days > 3:
                    return False

            return True
        except Exception:
            return False

    def _build_pyramids_for_year(self, symbol: str, market: str, year: int) -> None:
        """Generates 5m, 15m, 1h, 4h, 1d pyramids for a specific year using DuckDB zero-copy."""
        m1_file = os.path.join(self.parquet_root, market, symbol, "1m", f"{year}.parquet")
        if not os.path.exists(m1_file):
            return

        timeframes = {
            "5m": "INTERVAL '5 minutes'",
            "15m": "INTERVAL '15 minutes'",
            "1h": "INTERVAL '1 hour'",
            "4h": "INTERVAL '4 hours'",
            "1d": "INTERVAL '1 day'",
        }

        m1_path_sql = m1_file.replace(os.sep, '/')
        for tf_name, bucket_sql in timeframes.items():
            tf_dir = os.path.join(self.parquet_root, market, symbol, tf_name)
            os.makedirs(tf_dir, exist_ok=True)
            out_file = os.path.join(tf_dir, f"{year}.parquet").replace(os.sep, '/')

            query = f"""
            COPY (
                SELECT 
                    time_bucket({bucket_sql}, timestamp) AS timestamp,
                    arg_min(open, timestamp) AS open,
                    max(high) AS high,
                    min(low) AS low,
                    arg_max(close, timestamp) AS close,
                    round(sum(volume), 4) AS volume,
                    round(avg(spread), 2) AS spread,
                    '{symbol}' AS symbol
                FROM read_parquet('{m1_path_sql}')
                GROUP BY 1
                ORDER BY 1 ASC
            ) TO '{out_file}' (FORMAT PARQUET, COMPRESSION ZSTD);
            """
            try:
                self.conn.execute(query)
            except Exception as e:
                print(f"[MarketDataService] Error building {tf_name} pyramid for {symbol} {year}: {e}")

    def ensure_parquet_coverage(
        self,
        symbol: str,
        start_date: datetime,
        end_date: datetime,
        terminal_path: Optional[str] = None,
    ) -> List[int]:
        """
        JIT Auto-Sync: Guarantees that full partitioned Parquet files exist
        for [start_date, end_date] with 1-minute accuracy and multi-timeframe pyramids.
        
        If any year in the range is missing or truncated, leases/initializes MT5,
        extracts rates via copy_rates_range, saves {year}.parquet, and generates pyramids.
        """
        if not start_date or not end_date:
            return []

        if start_date.tzinfo is not None:
            start_date = start_date.astimezone(timezone.utc).replace(tzinfo=None)
        if end_date.tzinfo is not None:
            end_date = end_date.astimezone(timezone.utc).replace(tzinfo=None)

        market = self._resolve_market(symbol)
        start_year = start_date.year
        end_year = end_date.year

        years_to_sync = []
        for y in range(start_year, end_year + 1):
            if not self._is_year_complete(symbol, market, y, end_date):
                years_to_sync.append(y)

        if not years_to_sync:
            return []

        logger.info(
            f"[JIT Data Sync] Missing/incomplete Parquet detected for {symbol} ({start_date.strftime('%Y-%m-%d')} -> {end_date.strftime('%Y-%m-%d')}). Syncing years: {years_to_sync}"
        )

        # Find terminal path
        term_exe = None
        if terminal_path and os.path.isfile(terminal_path):
            term_exe = terminal_path
        else:
            try:
                from .mt5_pool_service import mt5_pool
                if mt5_pool.workers and mt5_pool.workers[0].terminal_path.is_file():
                    term_exe = str(mt5_pool.workers[0].terminal_path)
            except Exception:
                pass

        if not term_exe:
            default_p = os.path.abspath("mt5_workers/worker_1/terminal64.exe")
            if os.path.isfile(default_p):
                term_exe = default_p

        if not term_exe:
            logger.error(f"[JIT Data Sync] No MT5 terminal available to sync missing years {years_to_sync} for {symbol}")
            return []

        try:
            import MetaTrader5 as mt5
            import pandas as pd
        except ImportError:
            logger.error("[JIT Data Sync] MetaTrader5 or pandas not available for JIT sync")
            return []

        if not mt5.initialize(term_exe, portable=True):
            logger.error(f"[JIT Data Sync] Failed to initialize MT5 at {term_exe}: {mt5.last_error()}")
            return []

        synced_years = []
        try:
            mt5.symbol_select(symbol, True)
            now_dt = datetime.now()

            for idx, y in enumerate(years_to_sync, 1):
                t0 = time.time()
                logger.info(f"[JIT Data Sync] [{idx}/{len(years_to_sync)}] Fetching native M1 rates from MT5 for {symbol} {y}...")
                
                y_start = datetime(y, 1, 1, 0, 0, 0)
                if y == now_dt.year:
                    y_end = datetime(y, now_dt.month, now_dt.day, 23, 59, 59)
                else:
                    y_end = datetime(y, 12, 31, 23, 59, 59)

                rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_M1, y_start, y_end)
                if rates is None or len(rates) == 0:
                    logger.warning(f"[JIT Data Sync] No rates returned from MT5 for {symbol} {y}")
                    continue

                df_pd = pd.DataFrame(rates)
                df_pd["timestamp"] = pd.to_datetime(df_pd["time"], unit="s")
                df_pd["symbol"] = symbol
                df_pd.rename(columns={"tick_volume": "volume"}, inplace=True)
                df_pd = df_pd[["timestamp", "open", "high", "low", "close", "volume", "spread", "symbol"]]
                df_pd["volume"] = df_pd["volume"].astype("uint64")
                df_pd["spread"] = df_pd["spread"].astype("int32")

                out_dir = os.path.join(self.parquet_root, market, symbol, "1m")
                os.makedirs(out_dir, exist_ok=True)
                out_file = os.path.join(out_dir, f"{y}.parquet")
                df_pd.to_parquet(out_file, engine="pyarrow", compression="zstd")

                # Build multi-timeframe pyramids
                t_pyr = time.time()
                self._build_pyramids_for_year(symbol, market, y)
                synced_years.append(y)
                elapsed = time.time() - t0
                pyr_elapsed = time.time() - t_pyr
                logger.info(
                    f"[JIT Data Sync] Successfully stored {symbol} {y}: {len(df_pd):,} bars (1m + pyramids in {elapsed:.2f}s, pyramids={pyr_elapsed:.2f}s)"
                )
        finally:
            mt5.shutdown()

        logger.info(f"[JIT Data Sync] Completed JIT synchronization for {symbol}. Total years synced: {synced_years}")
        return synced_years

    def load_ohlcv(
        self,
        symbol: str,
        timeframe: str = "1m",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: Optional[int] = None,
        limit_direction: str = "tail",
    ) -> pl.DataFrame:
        """
        Directly queries Parquet files using DuckDB with zero memory copying.
        Supports automatic sub-second resampling from base 1m candles into 5m, 15m, 30m, 1h, 4h, 1d, 1w.
        Returns a Polars DataFrame ordered chronologically by timestamp.
        
        Args:
            limit: Max number of bars to return. Applied at SQL level for speed.
            limit_direction: "tail" returns the most recent N bars, "head" returns the oldest N bars.
        """
        # CRITICAL FIX: Ensure start_date and end_date are timezone-naive UTC.
        # If timezone-aware datetimes are passed, DuckDB converts them to local system time,
        # causing a 1-hour or multi-hour shift against UTC parquet timestamps!
        if start_date and start_date.tzinfo is not None:
            start_date = start_date.astimezone(timezone.utc).replace(tzinfo=None)
        if end_date:
            if end_date.tzinfo is not None:
                end_date = end_date.astimezone(timezone.utc).replace(tzinfo=None)
            # If end_date is specified with 00:00:00 (e.g. YYYY-MM-DD date filter), extend to 23:59:59 to include full day
            if end_date.hour == 0 and end_date.minute == 0 and end_date.second == 0 and end_date.microsecond == 0:
                end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)

        # Automatic JIT Gap Filling: ensure parquet coverage on disk
        if start_date and end_date:
            try:
                self.ensure_parquet_coverage(symbol, start_date, end_date)
            except Exception as e:
                print(f"[MarketDataService] Coverage check warning: {e}")

        tf_clean = timeframe.lower()
        bucket_map = {
            "5m": "INTERVAL '5 minutes'",
            "15m": "INTERVAL '15 minutes'",
            "30m": "INTERVAL '30 minutes'",
            "1h": "INTERVAL '1 hour'",
            "4h": "INTERVAL '4 hours'",
            "1d": "INTERVAL '1 day'",
            "d": "INTERVAL '1 day'",
            "1w": "INTERVAL '1 week'",
            "w": "INTERVAL '1 week'",
        }

        # Check for dedicated parquet partition first, otherwise fallback to 1m base
        pattern = os.path.join(self.parquet_root, "*", symbol, timeframe, "*.parquet")
        matching = glob.glob(pattern)
        base_tf = timeframe if matching else "1m"

        selected_files = self._select_parquet_files(
            symbol, base_tf, start_date, end_date, limit, limit_direction
        )
        if not selected_files:
            return self.load_mt5_bars(symbol, timeframe, start_date, end_date, limit)

        def _execute_query(files: List[str]) -> pl.DataFrame:
            file_list = ", ".join(f"'{f.replace(os.sep, '/')}'" for f in files)
            read_expr = f"read_parquet([{file_list}])"

            params = []
            date_filters = ""
            if start_date:
                date_filters += " AND timestamp >= ?"
                params.append(start_date)
            if end_date:
                date_filters += " AND timestamp <= ?"
                params.append(end_date)

            limit_clause = ""
            order_dir = "ASC"
            needs_reorder = False

            if limit:
                if limit_direction == "tail":
                    order_dir = "DESC"
                    needs_reorder = True
                limit_clause = f"LIMIT {int(limit)}"

            if base_tf == "1m" and tf_clean in bucket_map:
                bucket = bucket_map[tf_clean]
                query = f"""
                SELECT 
                    time_bucket({bucket}, timestamp) AS timestamp,
                    arg_min(open, timestamp) AS open,
                    max(high) AS high,
                    min(low) AS low,
                    arg_max(close, timestamp) AS close,
                    round(sum(volume), 4) AS volume,
                    round(avg(spread), 2) AS spread,
                    first(symbol) AS symbol
                FROM {read_expr}
                WHERE 1=1 {date_filters}
                GROUP BY 1
                ORDER BY 1 {order_dir}
                {limit_clause}
                """
            else:
                query = f"""
                SELECT timestamp, open, high, low, close, volume, spread, symbol 
                FROM {read_expr}
                WHERE 1=1 {date_filters}
                ORDER BY timestamp {order_dir}
                {limit_clause}
                """

            try:
                res = self.conn.sql(query, params=params).pl()
            except Exception:
                cursor = self.conn.cursor()
                cursor.execute(query, params)
                try:
                    import polars as pl
                    res = pl.from_arrow(cursor.to_arrow_table())
                except Exception:
                    import polars as pl
                    res = pl.from_pandas(cursor.df())
            if needs_reorder and not res.is_empty():
                res = res.reverse()
            return res

        df = _execute_query(selected_files)

        # Completeness safeguard: if limit was specified but the fast-path files didn't have enough rows,
        # expand to all candidate files in the range to guarantee no missing bars
        if limit is not None and len(df) < limit:
            all_files = sorted(
                glob.glob(os.path.join(self.parquet_root, "*", symbol, base_tf, "*.parquet"))
            )
            if len(selected_files) < len(all_files):
                df = _execute_query(all_files)

        if df.is_empty():
            return self.load_mt5_bars(symbol, timeframe, start_date, end_date, limit)

        return df

    def load_mt5_bars(
        self,
        symbol: str,
        timeframe: str = "1h",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: Optional[int] = 1000,
    ) -> pl.DataFrame:
        """
        Loads OHLCV bars directly from MT5 worker pool / local terminal history.
        Ensures zero-divergence candles for any MT5 traded symbol.
        """
        try:
            import MetaTrader5 as mt5
            from .mt5_pool_service import mt5_pool
            terminal_exe = mt5_pool.workers[0].terminal_path
            if not terminal_exe.is_file():
                return pl.DataFrame()

            tf_map = {
                "1m": mt5.TIMEFRAME_M1,
                "5m": mt5.TIMEFRAME_M5,
                "15m": mt5.TIMEFRAME_M15,
                "30m": mt5.TIMEFRAME_M30,
                "1h": mt5.TIMEFRAME_H1,
                "4h": mt5.TIMEFRAME_H4,
                "1d": mt5.TIMEFRAME_D1,
                "d": mt5.TIMEFRAME_D1,
                "1w": mt5.TIMEFRAME_W1,
            }
            mt5_tf = tf_map.get(timeframe.lower(), mt5.TIMEFRAME_H1)

            if not mt5.initialize(str(terminal_exe), portable=True):
                return pl.DataFrame()

            try:
                mt5.symbol_select(symbol, True)
                rates = None
                if start_date and end_date:
                    rates = mt5.copy_rates_range(symbol, mt5_tf, start_date, end_date)
                elif start_date:
                    cnt = limit or 1000
                    rates = mt5.copy_rates_from_date(symbol, mt5_tf, start_date, cnt)
                else:
                    cnt = limit or 1000
                    rates = mt5.copy_rates_from_pos(symbol, mt5_tf, 0, cnt)

                if rates is None or len(rates) == 0:
                    return pl.DataFrame()

                import pandas as pd
                df_pd = pd.DataFrame(rates)
                df_pd["timestamp"] = pd.to_datetime(df_pd["time"], unit="s", utc=True).dt.tz_localize(None)
                df_pd["volume"] = df_pd["tick_volume"].astype(float)
                cols_to_keep = ["timestamp", "open", "high", "low", "close", "volume"]
                return pl.from_pandas(df_pd[cols_to_keep])
            finally:
                mt5.shutdown()
        except Exception:
            return pl.DataFrame()

    def to_domain_bars(self, df: pl.DataFrame) -> List[Bar]:
        """Converts Polars DataFrame rows into immutable Bar dataclasses for the engine using fast columnar extraction."""
        if df.is_empty():
            return []
        
        timestamps = df["timestamp"].to_list()
        opens = df["open"].to_list()
        highs = df["high"].to_list()
        lows = df["low"].to_list()
        closes = df["close"].to_list()
        volumes = df["volume"].to_list()
        spreads = df["spread"].to_list() if "spread" in df.columns else [0.0] * len(df)
        symbols = df["symbol"].to_list() if "symbol" in df.columns else ["DEFAULT"] * len(df)

        return [
            Bar(
                timestamp=t,
                open=float(o),
                high=float(h),
                low=float(l),
                close=float(c),
                volume=float(v),
                spread=float(s),
                symbol=str(sym)
            )
            for t, o, h, l, c, v, s, sym in zip(
                timestamps, opens, highs, lows, closes, volumes, spreads, symbols
            )
        ]
