from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from domain.models import BacktestRunResponse, BacktestRecordModel

def _resolve_dt(val: Any) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo is not None else val.replace(tzinfo=timezone.utc)
    s = str(val).strip().replace(".", "-")
    try:
        if "T" in s:
            return datetime.fromisoformat(s)
        parts = s.split(" ")[0].split("-")
        if len(parts) == 3:
            return datetime(int(parts[0]), int(parts[1]), int(parts[2]), tzinfo=timezone.utc)
    except Exception:
        pass
    return None

class BacktestStore:
    """Thread-safe in-memory store for backtest runs and records."""
    def __init__(self):
        self._runs: Dict[str, BacktestRunResponse] = {}

    def save_run(self, run: BacktestRunResponse) -> None:
        self._runs[run.id] = run

    def get_run(self, run_id: str) -> Optional[BacktestRunResponse]:
        return self._runs.get(run_id)

    def list_records(self, limit: int = 50, min_trades: int = 0) -> List[BacktestRecordModel]:
        records = []
        for r in reversed(list(self._runs.values())):
            # Disregard runs below min_trades if filtering requested
            if min_trades > 0 and getattr(r.metrics, "total_trades", 0) < min_trades:
                continue
            # Robust simulation dates resolution
            start_dt = _resolve_dt(r.start_date)
            end_dt = _resolve_dt(r.end_date)

            cfg = r.config
            if not start_dt:
                cfg_start = getattr(cfg, "start_date", None) or getattr(cfg, "from_date", None) if hasattr(cfg, "__dict__") else None
                if not cfg_start and isinstance(cfg, dict):
                    cfg_start = cfg.get("start_date") or cfg.get("from_date")
                start_dt = _resolve_dt(cfg_start)

            if not end_dt:
                cfg_end = getattr(cfg, "end_date", None) or getattr(cfg, "to_date", None) if hasattr(cfg, "__dict__") else None
                if not cfg_end and isinstance(cfg, dict):
                    cfg_end = cfg.get("end_date") or cfg.get("to_date")
                end_dt = _resolve_dt(cfg_end)

            if r.trades:
                if not start_dt and r.trades[0].entry_time:
                    start_dt = _resolve_dt(r.trades[0].entry_time)
                if not end_dt and r.trades[-1].exit_time:
                    end_dt = _resolve_dt(r.trades[-1].exit_time)

            records.append(
                BacktestRecordModel(
                    id=r.id,
                    strategy_id=r.strategy_id,
                    strategy_name=r.strategy_name,
                    version_num=getattr(r, "version_num", 1) or 1,
                    symbol=r.symbol,
                    timeframe=r.timeframe,
                    start_date=start_dt or r.created_at,
                    end_date=end_dt or r.created_at,
                    status=r.status,
                    config=r.config,
                    metrics=r.metrics,
                    engine_version="1.0.0",
                    data_checksum="parquet_duckdb_v1",
                    created_at=r.created_at
                )
            )
            if len(records) >= limit:
                break
        return records

    def delete_run(self, run_id: str) -> bool:
        if run_id in self._runs:
            del self._runs[run_id]
            return True
        return False

    def clear(self) -> None:
        self._runs.clear()

# Singleton backtest store instance
backtest_store = BacktestStore()
