import asyncio
import re
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Request
from domain.models import BacktestRunRequest, BacktestRunResponse, BacktestRecordModel
from ..services.backtest_service import backtest_service
from ..services.backtest_store import backtest_store

router = APIRouter(prefix="/backtests", tags=["Backtests"])

@router.post("/run", response_model=BacktestRunResponse)
async def run_backtest(req: BacktestRunRequest, request: Request):
    """
    Execute a backtest run deterministically.
    - Loads historical parquet bars via DuckDB
    - Executes event-driven backtesting engine
    - Computes advanced risk-adjusted metrics and returns complete performance report
    Executed in a background thread to prevent blocking the async event loop.
    """
    try:
        response = await asyncio.wait_for(
            asyncio.to_thread(backtest_service.run_backtest, req, user_id=getattr(request.state, "user_id", None)),
            timeout=60.0
        )
        return response
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Backtest execution timed out after 60 seconds.")
    except FileNotFoundError as fnfe:
        raise HTTPException(status_code=404, detail=str(fnfe))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Engine execution error: {str(e)}")

from datetime import datetime, timezone

def _parse_dt(val) -> datetime:
    if isinstance(val, datetime):
        return val if val.tzinfo is not None else val.replace(tzinfo=timezone.utc)
    if isinstance(val, (int, float)):
        ts = float(val)
        if ts > 1e11:  # epoch milliseconds
            ts /= 1000.0
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    if isinstance(val, str) and val.strip():
        s = val.strip()
        # Convert MT5 dot notation: 'YYYY.MM.DD' -> 'YYYY-MM-DD'
        if len(s) >= 10 and s[4] == "." and s[7] == ".":
            s = s[:4] + "-" + s[5:7] + "-" + s[8:]
        s_iso = s.replace(" ", "T")
        try:
            dt = datetime.fromisoformat(s_iso)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            pass
        for fmt in (
            "%Y-%m-%d %H:%M:%S",
            "%Y.%m.%d %H:%M:%S",
            "%Y-%m-%d",
            "%Y.%m.%d",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S.%f",
        ):
            try:
                dt = datetime.strptime(val.strip(), fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except Exception:
                pass
    # If unparseable, return a safe historical anchor, NEVER execution timestamp (datetime.now)
    return datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

@router.get("/{backtest_id}", response_model=BacktestRunResponse)
def get_backtest(backtest_id: str):
    """Retrieve full backtest result, trades, and equity curve by backtest ID."""
    run = backtest_store.get_run(backtest_id)
    if run:
        return run

    # Fallback to persistent SQLite storage
    try:
        from ..db.repository import DatabaseRepository
        repo = DatabaseRepository()
        db_run = repo.get_backtest_run(backtest_id)
        if db_run:
            from domain.models import (
                BacktestStatus,
                PerformanceMetricsModel,
                TradeModel,
                PositionSide,
                EquityPointModel,
            )
            trades = []
            for idx, t in enumerate(db_run.get("trades", [])):
                sl_val = float(t.get("stop_loss") or t.get("initial_sl") or t.get("sl") or 0.0)
                tp_val = float(t.get("take_profit") or t.get("initial_tp") or t.get("tp") or 0.0)
                cmt = str(t.get("exit_reason") or t.get("comment") or "")
                if sl_val <= 0 and "sl " in cmt.lower():
                    m_sl = re.search(r"sl\s*([\d.]+)", cmt, re.I)
                    if m_sl:
                        try:
                            sl_val = float(m_sl.group(1))
                        except Exception:
                            pass
                if tp_val <= 0 and "tp " in cmt.lower():
                    m_tp = re.search(r"tp\s*([\d.]+)", cmt, re.I)
                    if m_tp:
                        try:
                            tp_val = float(m_tp.group(1))
                        except Exception:
                            pass

                trades.append(
                    TradeModel(
                        trade_id=str(t.get("trade_id") or t.get("id") or f"TRD_{idx+1}"),
                        symbol=t.get("symbol") or db_run.get("symbol") or "EURUSD",
                        side=PositionSide.SHORT if str(t.get("side", "")).upper() in ("SELL", "SHORT") else PositionSide.LONG,
                        entry_time=_parse_dt(t.get("entry_time")),
                        exit_time=_parse_dt(t.get("exit_time")),
                        entry_price=float(t.get("entry_price") or 0.0),
                        exit_price=float(t.get("exit_price") or 0.0),
                        quantity=float(t.get("quantity") or 1.0),
                        pnl=float(t.get("pnl") or 0.0),
                        pnl_percent=float(t.get("pnl_pct") or t.get("pnl_percent") or 0.0),
                        commission=float(t.get("fee") or t.get("commission") or 0.0),
                        swap=float(t.get("swap") or 0.0),
                        slippage=0.0,
                        exit_reason=t.get("exit_reason") or "TARGET_HIT",
                        holding_period_bars=int(t.get("holding_period_bars") or 0),
                        tag=t.get("tag"),
                        stop_loss=sl_val if sl_val > 0 else None,
                        take_profit=tp_val if tp_val > 0 else None,
                        initial_sl=sl_val if sl_val > 0 else None,
                        initial_tp=tp_val if tp_val > 0 else None,
                    )
                )

            # Reconstruct equity curve with authentic simulation dates
            equity_curve = []
            if db_run.get("equity_curve"):
                for pt in db_run["equity_curve"]:
                    equity_curve.append(
                        EquityPointModel(
                            timestamp=_parse_dt(pt.get("timestamp")),
                            balance=float(pt.get("balance", 0.0)),
                            equity=float(pt.get("equity", 0.0)),
                            drawdown=float(pt.get("drawdown", 0.0)),
                            drawdown_pct=float(pt.get("drawdown_pct", 0.0))
                        )
                    )
            elif trades:
                init_cap = float((db_run.get("config") or {}).get("initial_capital", 10000.0))
                running_bal = init_cap
                peak = running_bal
                equity_curve.append(
                    EquityPointModel(
                        timestamp=trades[0].entry_time,
                        balance=running_bal,
                        equity=running_bal,
                        drawdown=0.0,
                        drawdown_pct=0.0
                    )
                )
                for tr in trades:
                    running_bal += tr.pnl
                    if running_bal > peak:
                        peak = running_bal
                    dd = peak - running_bal
                    dd_pct = (dd / peak) * 100.0 if peak > 0 else 0.0
                    equity_curve.append(
                        EquityPointModel(
                            timestamp=tr.exit_time,
                            balance=round(running_bal, 2),
                            equity=round(running_bal, 2),
                            drawdown=round(dd, 2),
                            drawdown_pct=round(dd_pct, 2)
                        )
                    )

            metrics_data = db_run.get("metrics") or {}
            created_dt = _parse_dt(db_run.get("created_at"))
            cfg = db_run.get("config") or {}
            start_raw = db_run.get("start_date") or cfg.get("start_date") or cfg.get("from_date") or cfg.get("startDate")
            end_raw = db_run.get("end_date") or cfg.get("end_date") or cfg.get("to_date") or cfg.get("endDate")
            if (not start_raw or not end_raw) and trades:
                if not start_raw and trades[0].entry_time:
                    start_raw = trades[0].entry_time
                if not end_raw and trades[-1].exit_time:
                    end_raw = trades[-1].exit_time

            start_dt = _parse_dt(start_raw) if start_raw else created_dt
            end_dt = _parse_dt(end_raw) if end_raw else created_dt

            return BacktestRunResponse(
                id=db_run["id"],
                strategy_id=db_run.get("strategy_id") or "custom",
                strategy_name=db_run.get("strategy_name") or "Backtest Run",
                symbol=db_run["symbol"],
                timeframe=db_run["timeframe"],
                status=BacktestStatus.COMPLETED,
                config=cfg,
                metrics=PerformanceMetricsModel(**metrics_data),
                trades=trades,
                equity_curve=equity_curve,
                bars_processed=int(db_run.get("total_trades", len(trades))),
                duration_seconds=float(db_run.get("execution_time_ms", 0.0)) / 1000.0,
                version_num=int(db_run.get("version_num") or (db_run.get("config") or {}).get("version_num") or 1),
                start_date=start_dt,
                end_date=end_dt,
                created_at=created_dt
            )
    except Exception as err:
        print(f"[get_backtest] Error loading run {backtest_id}: {err}")

    raise HTTPException(status_code=404, detail=f"Backtest '{backtest_id}' not found.")

@router.get("", response_model=List[BacktestRecordModel])
def list_backtests(
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    version_num: Optional[int] = Query(None),
    min_trades: Optional[int] = Query(None)
):
    """Retrieve history of completed backtest records, combining in-memory and SQLite repository."""
    limit_val = int(getattr(limit, "default", limit) or 50)
    effective_min_trades = min_trades or 0
    user_id = getattr(request.state, "user_id", None)
    records = backtest_store.list_records(limit=limit_val, min_trades=effective_min_trades)
    if user_id:
        records = [r for r in records if getattr(r, "user_id", None) in (user_id, None)]
    else:
        records = []
    seen_ids = {r.id for r in records}
    try:
        from ..db.repository import DatabaseRepository
        from domain.models import BacktestStatus, PerformanceMetricsModel, SimulationConfigModel
        repo = DatabaseRepository()
        db_runs = repo.list_backtest_runs(user_id=user_id, limit=limit_val, min_trades=effective_min_trades)
        for r in db_runs:
            if r["id"] not in seen_ids:
                metrics_data = r.get("metrics") or {}
                metrics_model = PerformanceMetricsModel(**metrics_data)
                cfg = r.get("config") or {}
                cfg_model = SimulationConfigModel(**cfg)
                created_dt = _parse_dt(r.get("created_at"))
                start_raw = r.get("start_date") or cfg.get("start_date") or cfg.get("from_date") or cfg.get("startDate")
                end_raw = r.get("end_date") or cfg.get("end_date") or cfg.get("to_date") or cfg.get("endDate")
                start_dt = _parse_dt(start_raw) if start_raw else created_dt
                end_dt = _parse_dt(end_raw) if end_raw else created_dt
                run_v = int(r.get("version_num") or (r.get("config") or {}).get("version_num") or 1)
                records.append(
                    BacktestRecordModel(
                        id=r["id"],
                        strategy_id=r.get("strategy_id") or "custom",
                        strategy_name=r.get("strategy_name") or "Backtest Run",
                        version_num=run_v,
                        symbol=r["symbol"],
                        timeframe=r["timeframe"],
                        start_date=start_dt,
                        end_date=end_dt,
                        status=BacktestStatus.COMPLETED,
                        config=cfg_model,
                        metrics=metrics_model,
                        engine_version="1.0.0",
                        data_checksum="parquet_duckdb_v1",
                        created_at=created_dt
                    )
                )
                seen_ids.add(r["id"])
    except Exception as err:
        print(f"[list_backtests] Error reading from SQLite: {err}")

    if version_num is not None:
        records = [r for r in records if r.version_num == version_num]

    if min_trades is not None and min_trades > 0:
        records = [r for r in records if getattr(r.metrics, "total_trades", 0) >= min_trades]

    records.sort(key=lambda x: str(x.created_at), reverse=True)
    return records[:limit_val]


@router.delete("")
def clear_all_backtests(request: Request):
    """Clear all backtest records for the authenticated user from in-memory cache and SQLite database."""
    backtest_store.clear()
    from ..db.repository import DatabaseRepository
    repo = DatabaseRepository()
    user_id = getattr(request.state, "user_id", None)
    runs_deleted = repo.delete_all_backtest_runs(user_id=user_id)
    return {"success": True, "runs_deleted": runs_deleted}


@router.delete("/{run_id}")
def delete_single_backtest(run_id: str, request: Request):
    """Delete a single backtest record by ID strictly if owned by caller."""
    backtest_store.delete_run(run_id)
    from ..db.repository import DatabaseRepository
    repo = DatabaseRepository()
    user_id = getattr(request.state, "user_id", None)
    deleted = repo.delete_backtest_run(run_id, user_id=user_id)
    return {"success": True, "run_id": run_id, "deleted": deleted}


@router.get("/pool/status")
def get_mt5_pool_status():
    """Retrieve telemetry status of the MT5 5-worker pool."""
    from ..services.mt5_pool_service import mt5_pool
    return mt5_pool.get_status()
