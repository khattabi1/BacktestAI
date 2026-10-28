"""
Quantitative Execution & Backtesting Tools Plugin for BacktestAI Agent Harness (DSH).
Provides simulation execution, results inspection, comparative analysis, and parameter sweeps.
"""

from __future__ import annotations
import ast
import asyncio
from datetime import datetime, timezone
import importlib.util
import inspect
import itertools
import json
import logging
import os
from pathlib import Path
import re
import sys
import traceback
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger("backtest_ai.agent.tools.execution")

_backtest_service = None
_backtest_store = None


def _get_services():
    global _backtest_service, _backtest_store
    if _backtest_service is None or _backtest_store is None:
        try:
            from apps.api.src.services.backtest_service import backtest_service
            from apps.api.src.services.backtest_store import backtest_store
            _backtest_service = backtest_service
            _backtest_store = backtest_store
        except Exception as err:
            logger.warning(f"Could not import backtest services: {err}")
    return _backtest_service, _backtest_store


STRATEGY_ALIASES: Dict[str, str] = {
    "trend_following": "gold_sr_scalper",
    "rsi_mean_reversion": "gold_sr_scalper",
    "gold_scalper": "gold_sr_scalper",
}


def _normalize_strategy_params(strategy_id: str, params: Dict[str, Any]) -> tuple[str, Dict[str, Any]]:
    norm_id = STRATEGY_ALIASES.get(strategy_id.lower().strip(), strategy_id)
    norm_params = dict(params)
    return norm_id, norm_params


def _parse_date_bound(val: Optional[Union[str, int, datetime]], is_end: bool = False) -> Optional[datetime]:
    """Parses user or agent date string into a timezone-aware UTC datetime."""
    if not val:
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo is not None else val.replace(tzinfo=timezone.utc)
    s = str(val).strip()
    if not s:
        return None
    # 4-digit year like "2025"
    if re.match(r"^\d{4}$", s):
        year = int(s)
        if is_end:
            return datetime(year, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
        return datetime(year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    # Year-month like "2025-06"
    if re.match(r"^\d{4}-\d{2}$", s):
        year, month = map(int, s.split("-"))
        if is_end:
            import calendar
            _, last_day = calendar.monthrange(year, month)
            return datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)
        return datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
    # Full date / ISO string
    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        if is_end and dt.hour == 0 and dt.minute == 0 and dt.second == 0:
            dt = dt.replace(hour=23, minute=59, second=59)
        return dt
    except Exception:
        pass
    return None


async def run_backtest(
    strategy_id: str = "gold_sr_scalper",
    symbol: str = "XAUUSD",
    timeframe: str = "15m",
    start_date: Optional[Union[str, datetime]] = None,
    end_date: Optional[Union[str, datetime]] = None,
    initial_capital: float = 100000.0,
    slippage_points: float = 0.5,
    commission_pct: float = 0.0002,
    parameters: Optional[Dict[str, Any]] = None,
    direct: bool = False,
) -> Dict[str, Any]:
    """
    Executes a quantitative backtest on historical market data and returns
    a concise statistical performance summary.
    Dispatches to ARQ distributed background worker via Redis, preventing API thread blocking.
    """
    svc, store = _get_services()
    if not svc:
        return {"success": False, "error": "Backtesting engine is not available."}

    from domain.models import BacktestRunRequest, SimulationConfigModel

    try:
        resolved_id, resolved_params = _normalize_strategy_params(strategy_id, parameters or {})

        # Guard: Check if caller is trying to run a native MQL5 Expert Advisor on the Python parquet engine
        clean_sid = strategy_id.lower().strip()
        is_mql5 = clean_sid.endswith((".mq5", ".ex5"))
        if not is_mql5:
            is_registered_py = False
            try:
                from apps.api.src.services.strategy_registry import strategy_registry
                is_registered_py = clean_sid in strategy_registry._strategies
            except Exception:
                pass

            if not is_registered_py:
                try:
                    try:
                        from .workspace import PROJECT_ROOT
                    except ImportError:
                        from packages.agent.src.tools.workspace import PROJECT_ROOT
                    py_matches = list((PROJECT_ROOT / "data" / "users").rglob(f"{Path(clean_sid).stem}.py"))
                    if not py_matches:
                        mq5_matches = list((PROJECT_ROOT / "data" / "users").rglob(f"{Path(clean_sid).stem}.mq5"))
                        if mq5_matches:
                            is_mql5 = True
                except Exception:
                    pass

        if is_mql5:
            return {
                "success": False,
                "error": (
                    f"'{strategy_id}' is a native MetaTrader 5 Expert Advisor (.mq5). "
                    "Native MQL5 strategies must be tested using 'run_strategy_tester(ea_name=\"<name>.ex5\", ...)' on MT5 real tick data, "
                    "not 'run_backtest' (which is strictly for Python catalog strategies)."
                ),
                "strategy_id": strategy_id,
                "symbol": symbol,
            }

        # Date bounding logic: local parquet data is partitioned by year (2010.parquet .. 2026.parquet).
        # We always enforce explicit date bounds to avoid unbounded 16-year DuckDB scans.
        parsed_start = _parse_date_bound(start_date, is_end=False)
        parsed_end = _parse_date_bound(end_date, is_end=True)

        # If user passed e.g. start_date="2025" and no end_date, bound both to 2025
        if start_date and not end_date and isinstance(start_date, (str, int)) and re.match(r"^\d{4}$", str(start_date).strip()) and parsed_start is not None:
            start_dt = parsed_start
            end_dt = datetime(parsed_start.year, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
        elif end_date and not start_date and isinstance(end_date, (str, int)) and re.match(r"^\d{4}$", str(end_date).strip()) and parsed_end is not None:
            end_dt = parsed_end
            start_dt = datetime(parsed_end.year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        else:
            start_dt = parsed_start
            end_dt = parsed_end

        # Default to the most recent 2-3 years if unbounded
        if start_dt is None and end_dt is None:
            end_dt = datetime(2026, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
            start_dt = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        elif start_dt is None:
            assert end_dt is not None
            start_dt = datetime(max(2010, end_dt.year - 2), 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        elif end_dt is None:
            end_dt = datetime(2026, 12, 31, 23, 59, 59, tzinfo=timezone.utc)

        config = SimulationConfigModel(
            initial_capital=initial_capital,
            slippage_points=slippage_points,
            commission_pct=commission_pct,
        )
        req = BacktestRunRequest(
            strategy_id=resolved_id,
            symbol=symbol,
            timeframe=timeframe,
            config=config,
            parameters=resolved_params,
            start_date=start_dt,
            end_date=end_dt,
        )

        resp_raw = None
        dispatched_to_worker = False
        skip_queue = direct or os.environ.get("INSIDE_ARQ_WORKER") == "1" or "PYTEST_CURRENT_TEST" in os.environ
        if not skip_queue:
            try:
                from apps.api.src.job_queue import job_queue
                job_payload = req.model_dump(mode="json")
                job_id = await job_queue.enqueue("run_backtest_job", job_payload)
                dispatched_to_worker = True
                logger.info(f"[run_backtest] Dispatched to ARQ worker (job_id={job_id}) for {resolved_id} ({start_dt.date()} -> {end_dt.date()})")

                # Poll for worker completion (up to 45s)
                for _ in range(90):
                    await asyncio.sleep(0.5)
                    status_resp = await job_queue.get_status(job_id)
                    if status_resp.status == "complete":
                        if status_resp.error:
                            logger.warning(f"[run_backtest] Worker job '{job_id}' completed with error: {status_resp.error}")
                            return {
                                "success": False,
                                "error": f"Backtest execution failed: {status_resp.error}",
                                "strategy_id": resolved_id,
                                "symbol": symbol,
                            }
                        resp_raw = status_resp.result
                        break
                    elif status_resp.status in ("failed", "error") or status_resp.error:
                        logger.warning(f"[run_backtest] Worker job '{job_id}' failed: {status_resp.error}")
                        return {
                            "success": False,
                            "error": f"Backtest execution failed: {status_resp.error or 'Worker job failed'}",
                            "strategy_id": resolved_id,
                            "symbol": symbol,
                        }
                else:
                    logger.warning(f"[run_backtest] Worker job '{job_id}' timed out after 45s.")
                    return {
                        "success": False,
                        "error": f"Backtest execution timed out after 45s in background worker (job_id={job_id}).",
                        "strategy_id": resolved_id,
                        "symbol": symbol,
                    }
            except Exception as queue_err:
                logger.warning(f"[run_backtest] ARQ worker dispatch unavailable, falling back to guarded local thread: {queue_err}")

        # 2. Guarded fallback to thread pool ONLY if worker was not reachable
        if resp_raw is None:
            if dispatched_to_worker:
                return {
                    "success": False,
                    "error": "Backtest execution did not return a valid result from worker.",
                    "strategy_id": resolved_id,
                    "symbol": symbol,
                }
            logger.info(f"[run_backtest] Running backtest in local thread pool via asyncio.to_thread with timeout...")
            try:
                resp_raw = await asyncio.wait_for(
                    asyncio.to_thread(svc.run_backtest, req),
                    timeout=30.0
                )
            except asyncio.TimeoutError:
                return {
                    "success": False,
                    "error": "Backtest execution timed out after 30 seconds in local thread pool.",
                    "strategy_id": resolved_id,
                    "symbol": symbol,
                }
            except Exception as local_err:
                logger.exception(f"Error executing backtest locally: {local_err}")
                return {
                    "success": False,
                    "error": f"Backtest execution failed: {str(local_err)}",
                    "strategy_id": resolved_id,
                    "symbol": symbol,
                }

        if isinstance(resp_raw, dict):
            from domain.models import BacktestRunResponse
            resp = BacktestRunResponse(**resp_raw)
        else:
            resp = resp_raw

        # Save to local in-memory store so caller / API can query it immediately
        if store:
            store.save_run(resp)

        m = resp.metrics

        # Collect deep autopsy telemetry across executed trades
        trades_list = resp.trades or []
        exit_reasons: Dict[str, int] = {}
        largest_win = 0.0
        largest_loss = 0.0
        max_consecutive_losses = 0
        curr_streak = 0

        for t in trades_list:
            reason = getattr(t, "exit_reason", None) or "UNKNOWN"
            exit_reasons[reason] = exit_reasons.get(reason, 0) + 1
            pnl = getattr(t, "pnl", 0.0) or 0.0
            if pnl > largest_win:
                largest_win = pnl
            if pnl < largest_loss:
                largest_loss = pnl
            if pnl < 0:
                curr_streak += 1
                if curr_streak > max_consecutive_losses:
                    max_consecutive_losses = curr_streak
            else:
                curr_streak = 0

        sample_trades = [
            {
                "side": str(getattr(t, "side", "")),
                "entry_price": getattr(t, "entry_price", 0.0),
                "exit_price": getattr(t, "exit_price", 0.0),
                "pnl": round(getattr(t, "pnl", 0.0), 2),
                "exit_reason": getattr(t, "exit_reason", ""),
            }
            for t in trades_list[:8]
        ]

        # Return a rich quant autopsy dataset for the agent context
        return {
            "success": True,
            "run_id": resp.id,
            "strategy_id": resp.strategy_id,
            "strategy_name": resp.strategy_name,
            "symbol": resp.symbol,
            "timeframe": resp.timeframe,
            "date_range": f"{start_dt.strftime('%Y-%m-%d')} to {end_dt.strftime('%Y-%m-%d')}",
            "net_profit": round(m.net_profit, 2),
            "net_profit_pct": round(m.net_profit_pct, 2),
            "total_trades": m.total_trades,
            "winning_trades": m.winning_trades,
            "losing_trades": m.losing_trades,
            "win_rate": round(m.win_rate, 4),
            "profit_factor": round(m.profit_factor, 2),
            "sharpe_ratio": round(m.sharpe_ratio, 2),
            "sortino_ratio": round(m.sortino_ratio, 2),
            "max_drawdown": round(m.max_drawdown, 2),
            "max_drawdown_pct": round(m.max_drawdown_pct, 2),
            "expectancy": round(m.expectancy, 2),
            "average_win": round(getattr(m, "average_win", 0.0), 2),
            "average_loss": round(getattr(m, "average_loss", 0.0), 2),
            "payoff_ratio": round(getattr(m, "payoff_ratio", 0.0), 2),
            "max_consecutive_wins": getattr(m, "max_consecutive_wins", 0),
            "exposure_pct": round(getattr(m, "exposure_pct", 0.0), 2),
            "calmar_ratio": round(getattr(m, "calmar_ratio", 0.0), 2),
            "initial_capital": round(getattr(m, "initial_capital", 100000.0), 2),
            "ending_equity": round(getattr(m, "ending_equity", 100000.0), 2),
            "largest_win": round(largest_win, 2),
            "largest_loss": round(largest_loss, 2),
            "max_consecutive_losses": max_consecutive_losses,
            "exit_reasons_breakdown": exit_reasons,
            "sample_trades": sample_trades,
            "bars_processed": resp.bars_processed,
            "duration_seconds": round(resp.duration_seconds, 3),
        }
    except Exception as err:
        logger.exception(f"Error executing backtest: {err}")
        return {"success": False, "error": str(err)}


async def launch_sandbox_runner(
    strategy_id: str = "gold_sr_scalper",
    symbol: str = "XAUUSD",
    timeframe: str = "15m",
    start_date: Optional[Union[str, datetime]] = None,
    end_date: Optional[Union[str, datetime]] = None,
    parameters: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Opens the interactive Sandbox Simulation Cockpit in the central UI viewport
    with preconfigured symbol, timeframe, date range, and parameter vector.
    Triggers local Parquet partition verification and awaits user execution or simulation complete.
    """
    resolved_id, resolved_params = _normalize_strategy_params(strategy_id, parameters or {})

    # Normalize dates
    s_date = str(start_date).strip() if start_date else "2025-01-01"
    e_date = str(end_date).strip() if end_date else "2025-12-31"

    if re.match(r"^\d{4}$", s_date) and (not end_date or s_date == str(end_date).strip()):
        s_date = f"{s_date}-01-01"
        e_date = f"{s_date[:4]}-12-31"

    return {
        "success": True,
        "action": "launch_sandbox_runner",
        "strategy_id": resolved_id,
        "symbol": symbol,
        "timeframe": timeframe,
        "start_date": s_date,
        "end_date": e_date,
        "parameters": resolved_params,
        "message": f"Central Sandbox Simulation Cockpit opened for {resolved_id} on {symbol} ({timeframe}) covering {s_date} to {e_date}. Local Parquet data verification started. Waiting for execution telemetry.",
    }



async def get_backtest_result(run_id: str) -> Dict[str, Any]:
    """
    Retrieves full metrics and trade summary for an existing backtest run.
    """
    _, store = _get_services()
    if not store:
        return {"found": False, "error": "Backtest store is not available."}

    run = store.get_run(run_id)
    if not run:
        return {"found": False, "error": f"Backtest run '{run_id}' not found."}

    m = run.metrics
    return {
        "found": True,
        "run_id": run.id,
        "strategy_name": run.strategy_name,
        "symbol": run.symbol,
        "timeframe": run.timeframe,
        "initial_capital": run.config.initial_capital,
        "ending_equity": round(m.ending_equity, 2),
        "net_profit": round(m.net_profit, 2),
        "net_profit_pct": round(m.net_profit_pct, 2),
        "total_trades": m.total_trades,
        "win_rate": round(m.win_rate, 4),
        "profit_factor": round(m.profit_factor, 2),
        "sharpe_ratio": round(m.sharpe_ratio, 2),
        "sortino_ratio": round(m.sortino_ratio, 2),
        "calmar_ratio": round(m.calmar_ratio, 2),
        "max_drawdown_pct": round(m.max_drawdown_pct, 2),
        "average_win": round(m.average_win, 2),
        "average_loss": round(m.average_loss, 2),
        "payoff_ratio": round(m.payoff_ratio, 2),
    }


async def compare_backtests(run_id_a: str, run_id_b: str) -> Dict[str, Any]:
    """
    Compares two backtest simulation runs and generates an algorithmic delta verdict.
    """
    res_a = await get_backtest_result(run_id_a)
    res_b = await get_backtest_result(run_id_b)

    if not res_a.get("found"):
        return {"success": False, "error": f"Run A ('{run_id_a}') not found."}
    if not res_b.get("found"):
        return {"success": False, "error": f"Run B ('{run_id_b}') not found."}

    delta_profit_pct = round(res_b["net_profit_pct"] - res_a["net_profit_pct"], 2)
    delta_sharpe = round(res_b["sharpe_ratio"] - res_a["sharpe_ratio"], 2)
    delta_max_dd_pct = round(res_b["max_drawdown_pct"] - res_a["max_drawdown_pct"], 2)
    delta_profit_factor = round(res_b["profit_factor"] - res_a["profit_factor"], 2)
    delta_win_rate = round(res_b["win_rate"] - res_a["win_rate"], 4)

    # Determine superior run based on Sharpe and Drawdown
    if res_b["sharpe_ratio"] > res_a["sharpe_ratio"] and res_b["max_drawdown_pct"] <= res_a["max_drawdown_pct"]:
        verdict = f"Run B ({run_id_b}) strictly outperforms Run A on both Sharpe ratio (+{delta_sharpe}) and drawdown risk."
    elif res_b["sharpe_ratio"] > res_a["sharpe_ratio"]:
        verdict = f"Run B ({run_id_b}) achieves higher risk-adjusted return (Sharpe +{delta_sharpe}), but has different drawdown profile ({delta_max_dd_pct}% delta)."
    elif res_a["sharpe_ratio"] > res_b["sharpe_ratio"]:
        verdict = f"Run A ({run_id_a}) maintains higher stability and superior Sharpe ratio compared to Run B."
    else:
        verdict = "Both runs show comparable risk-adjusted metrics."

    return {
        "success": True,
        "run_a": {
            "id": run_id_a,
            "strategy": res_a["strategy_name"],
            "net_profit_pct": res_a["net_profit_pct"],
            "sharpe_ratio": res_a["sharpe_ratio"],
            "max_drawdown_pct": res_a["max_drawdown_pct"],
            "profit_factor": res_a["profit_factor"],
        },
        "run_b": {
            "id": run_id_b,
            "strategy": res_b["strategy_name"],
            "net_profit_pct": res_b["net_profit_pct"],
            "sharpe_ratio": res_b["sharpe_ratio"],
            "max_drawdown_pct": res_b["max_drawdown_pct"],
            "profit_factor": res_b["profit_factor"],
        },
        "deltas": {
            "net_profit_pct_diff": delta_profit_pct,
            "sharpe_ratio_diff": delta_sharpe,
            "max_drawdown_pct_diff": delta_max_dd_pct,
            "profit_factor_diff": delta_profit_factor,
            "win_rate_diff": delta_win_rate,
        },
        "verdict": verdict,
    }


async def run_parameter_matrix_sweep(
    strategy_id: str = "gold_sr_scalper",
    symbol: str = "XAUUSD",
    timeframe: str = "15m",
    start_date: Optional[Union[str, datetime]] = None,
    end_date: Optional[Union[str, datetime]] = None,
    parameter_grid: Optional[Dict[str, List[Any]]] = None,
    max_combinations: int = 6,
) -> Dict[str, Any]:
    """
    Executes a parameter matrix sweep across multiple hyperparameter combinations
    and ranks results by Sharpe ratio to identify optimal, robust configurations.
    """
    grid = parameter_grid or {
        "ema_period": [30, 50],
        "atr_multiplier_sl": [1.5, 2.0],
    }

    # Generate cartesian product
    keys = list(grid.keys())
    value_lists = [grid[k] for k in keys]
    combinations = list(itertools.product(*value_lists))[:max_combinations]

    results: List[Dict[str, Any]] = []
    for combo in combinations:
        params = dict(zip(keys, combo))
        run_res = await run_backtest(
            strategy_id=strategy_id,
            symbol=symbol,
            timeframe=timeframe,
            start_date=start_date,
            end_date=end_date,
            parameters=params,
            direct=True,
        )
        if run_res.get("success"):
            results.append({
                "parameters": params,
                "run_id": run_res["run_id"],
                "sharpe_ratio": run_res["sharpe_ratio"],
                "net_profit_pct": run_res["net_profit_pct"],
                "max_drawdown_pct": run_res["max_drawdown_pct"],
                "profit_factor": run_res["profit_factor"],
                "total_trades": run_res["total_trades"],
            })

    if not results:
        return {"success": False, "error": "No parameter combinations succeeded in the sweep."}

    # Sort by Sharpe Ratio descending
    ranked = sorted(results, key=lambda x: x["sharpe_ratio"], reverse=True)
    best_config = ranked[0]

    return {
        "success": True,
        "strategy_id": strategy_id,
        "symbol": symbol,
        "timeframe": timeframe,
        "combinations_tested": len(ranked),
        "best_configuration": best_config,
        "top_configurations": ranked[:3],
    }


def compute_simulation_autopsy(
    metrics: Dict[str, Any],
    trades: List[Dict[str, Any]],
    strategy_name: str = "strategy",
    symbol: str = "BTCUSDT",
    timeframe: str = "1h",
) -> Dict[str, Any]:
    """
    Computes an exhaustive dynamic institutional forensic autopsy of backtest simulation results.
    Analyzes win/loss profiles, exact stop loss & take profit excursions (min/max/avg),
    directional asymmetry, holding duration skew, break-even and trailing stop dynamics,
    and outlier 'crime scene' losses with full execution parameters.
    """
    total_trades = len(trades)
    winning_trades = [t for t in trades if float(t.get("pnl", 0.0)) > 0]
    losing_trades = [t for t in trades if float(t.get("pnl", 0.0)) < 0]
    
    # Dynamic Break-Even (BE) detection
    breakeven_trades = [
        t for t in trades
        if abs(float(t.get("pnl", 0.0))) <= 0.0001
        or "be" in str(t.get("exit_reason", "") or t.get("comment", "")).lower().split()
        or "breakeven" in str(t.get("exit_reason", "") or t.get("comment", "")).lower()
        or "break even" in str(t.get("exit_reason", "") or t.get("comment", "")).lower()
    ]
    
    # Dynamic Trailing Stop detection
    trailing_trades = [
        t for t in trades
        if "trail" in str(t.get("exit_reason", "") or t.get("comment", "")).lower()
        or "tsl" in str(t.get("exit_reason", "") or t.get("comment", "")).lower()
    ]

    win_rate = (len(winning_trades) / total_trades) if total_trades > 0 else 0.0

    # Payoff Ratio & Expectancy
    gross_profit = sum(float(t.get("pnl", 0.0)) for t in winning_trades)
    gross_loss = abs(sum(float(t.get("pnl", 0.0)) for t in losing_trades))
    avg_win = (gross_profit / len(winning_trades)) if winning_trades else 0.0
    avg_loss = (gross_loss / len(losing_trades)) if losing_trades else 0.0
    payoff_ratio = round((avg_win / avg_loss) if avg_loss > 0 else (99.0 if avg_win > 0 else 0.0), 2)
    expectancy = round((win_rate * avg_win) - ((1.0 - win_rate) * avg_loss), 2)

    # Key Outliers (Biggest Winner & Biggest Loser)
    biggest_winner = None
    if winning_trades:
        bw = max(winning_trades, key=lambda t: float(t.get("pnl", 0.0)))
        biggest_winner = {
            "trade_id": str(bw.get("trade_id", "") or bw.get("deal", "")),
            "side": str(bw.get("side", "")),
            "pnl": round(float(bw.get("pnl", 0.0)), 2),
            "pnl_percent": round(float(bw.get("pnl_percent", 0.0)), 2),
            "holding_period_bars": int(bw.get("holding_period_bars", 0)),
            "exit_reason": str(bw.get("exit_reason", "") or bw.get("comment", "")),
            "entry_price": float(bw.get("entry_price", 0.0)),
            "exit_price": float(bw.get("exit_price", 0.0)),
        }

    biggest_loser = None
    if losing_trades:
        bl = min(losing_trades, key=lambda t: float(t.get("pnl", 0.0)))
        biggest_loser = {
            "trade_id": str(bl.get("trade_id", "") or bl.get("deal", "")),
            "side": str(bl.get("side", "")),
            "pnl": round(float(bl.get("pnl", 0.0)), 2),
            "pnl_percent": round(float(bl.get("pnl_percent", 0.0)), 2),
            "holding_period_bars": int(bl.get("holding_period_bars", 0)),
            "exit_reason": str(bl.get("exit_reason", "") or bl.get("comment", "")),
            "entry_price": float(bl.get("entry_price", 0.0)),
            "exit_price": float(bl.get("exit_price", 0.0)),
        }

    # Directional Side Asymmetry Analysis
    long_trades = [t for t in trades if str(t.get("side", "")).lower() in ("long", "buy")]
    short_trades = [t for t in trades if str(t.get("side", "")).lower() in ("short", "sell")]

    def _calc_side(group: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not group:
            return {"count": 0, "win_rate": 0.0, "net_pnl": 0.0, "profit_factor": 0.0, "avg_trade": 0.0}
        wins = [t for t in group if float(t.get("pnl", 0.0)) > 0]
        gw = sum(float(t.get("pnl", 0.0)) for t in wins)
        gl = abs(sum(float(t.get("pnl", 0.0)) for t in group if float(t.get("pnl", 0.0)) < 0))
        pf = (gw / gl) if gl > 0 else (99.0 if gw > 0 else 0.0)
        net = sum(float(t.get("pnl", 0.0)) for t in group)
        return {
            "count": len(group),
            "win_rate": round(len(wins) / len(group), 4),
            "net_pnl": round(net, 2),
            "profit_factor": round(pf, 2),
            "avg_trade": round(net / len(group), 2),
        }

    long_stats = _calc_side(long_trades)
    short_stats = _calc_side(short_trades)

    # Exit Reasons Aggregation
    exit_reasons: Dict[str, Dict[str, Any]] = {}
    for t in trades:
        reason = str(t.get("exit_reason") or t.get("comment") or "unspecified").strip()
        pnl_val = float(t.get("pnl", 0.0))
        if reason not in exit_reasons:
            exit_reasons[reason] = {"count": 0, "wins": 0, "losses": 0, "net_pnl": 0.0}
        exit_reasons[reason]["count"] += 1
        if pnl_val > 0:
            exit_reasons[reason]["wins"] += 1
        elif pnl_val < 0:
            exit_reasons[reason]["losses"] += 1
        exit_reasons[reason]["net_pnl"] = round(exit_reasons[reason]["net_pnl"] + pnl_val, 2)

    # Consecutive Streaks
    max_consec_wins = 0
    max_consec_losses = 0
    cur_wins = 0
    cur_losses = 0
    for t in trades:
        pnl_val = float(t.get("pnl", 0.0))
        if pnl_val > 0:
            cur_wins += 1
            cur_losses = 0
            max_consec_wins = max(max_consec_wins, cur_wins)
        elif pnl_val < 0:
            cur_losses += 1
            cur_wins = 0
            max_consec_losses = max(max_consec_losses, cur_losses)
        else:
            cur_wins = 0
            cur_losses = 0

    # Holding Durations & Skew
    avg_win_bars = (
        round(sum(int(t.get("holding_period_bars", 0)) for t in winning_trades) / len(winning_trades), 1)
        if winning_trades else 0.0
    )
    avg_loss_bars = (
        round(sum(int(t.get("holding_period_bars", 0)) for t in losing_trades) / len(losing_trades), 1)
        if losing_trades else 0.0
    )
    duration_skew = round((avg_loss_bars / avg_win_bars), 2) if avg_win_bars > 0 else 0.0

    # Dynamic Stops Analysis: Stop Loss (SL) & Take Profit (TP) Execution Distributions
    sl_trade_records = []
    tp_trade_records = []
    for t in trades:
        r_str = str(t.get("exit_reason", "") or t.get("comment", "")).lower()
        p_val = float(t.get("pnl", 0.0))
        e_p = float(t.get("entry_price", 0.0))
        x_p = float(t.get("exit_price", 0.0))

        # Determine price distance
        if e_p > 0 and x_p > 0:
            dist = round(abs(x_p - e_p), 5)
        elif "pnl_percent" in t and abs(float(t.get("pnl_percent", 0.0))) > 0:
            dist = round(abs(float(t.get("pnl_percent", 0.0))), 4)
        else:
            dist = round(abs(p_val), 2)

        is_sl = ("sl" in r_str) or ("stop_loss" in r_str) or (r_str == "stop") or (p_val < 0 and "tp" not in r_str and "take" not in r_str and abs(p_val) > 0.0001)
        is_tp = ("tp" in r_str) or ("take_profit" in r_str) or ("takeprofit" in r_str) or (p_val > 0 and "sl" not in r_str and "stop" not in r_str)

        if is_sl:
            sl_trade_records.append({
                "trade_id": str(t.get("trade_id", "") or t.get("deal", "")),
                "dist": dist,
                "loss": abs(p_val),
                "side": str(t.get("side", "")),
                "reason": r_str,
                "entry_price": e_p,
                "exit_price": x_p,
            })
        elif is_tp:
            tp_trade_records.append({
                "trade_id": str(t.get("trade_id", "") or t.get("deal", "")),
                "dist": dist,
                "win": abs(p_val),
                "side": str(t.get("side", "")),
                "reason": r_str,
                "entry_price": e_p,
                "exit_price": x_p,
            })

    stops_analysis: Dict[str, Any] = {}
    if sl_trade_records:
        min_sl = min(sl_trade_records, key=lambda x: x["dist"])
        max_sl = max(sl_trade_records, key=lambda x: x["dist"])
        avg_sl_dist = round(sum(x["dist"] for x in sl_trade_records) / len(sl_trade_records), 4)
        avg_sl_loss = round(sum(x["loss"] for x in sl_trade_records) / len(sl_trade_records), 2)
        stops_analysis["stop_loss"] = {
            "count": len(sl_trade_records),
            "pct_of_total": round(len(sl_trade_records) / total_trades * 100, 1) if total_trades else 0.0,
            "min_distance": min_sl["dist"],
            "min_loss": min_sl["loss"],
            "max_distance": max_sl["dist"],
            "max_loss": max_sl["loss"],
            "avg_distance": avg_sl_dist,
            "avg_loss": avg_sl_loss,
        }

    if tp_trade_records:
        min_tp = min(tp_trade_records, key=lambda x: x["dist"])
        max_tp = max(tp_trade_records, key=lambda x: x["dist"])
        avg_tp_dist = round(sum(x["dist"] for x in tp_trade_records) / len(tp_trade_records), 4)
        avg_tp_win = round(sum(x["win"] for x in tp_trade_records) / len(tp_trade_records), 2)
        stops_analysis["take_profit"] = {
            "count": len(tp_trade_records),
            "pct_of_total": round(len(tp_trade_records) / total_trades * 100, 1) if total_trades else 0.0,
            "min_distance": min_tp["dist"],
            "min_win": min_tp["win"],
            "max_distance": max_tp["dist"],
            "max_win": max_tp["win"],
            "avg_distance": avg_tp_dist,
            "avg_win": avg_tp_win,
        }

    # Dynamic Break-Even & Trailing Stops Data
    breakeven_analysis = None
    if breakeven_trades:
        breakeven_analysis = {
            "count": len(breakeven_trades),
            "pct_of_trades": round(len(breakeven_trades) / total_trades * 100, 2) if total_trades else 0.0,
        }

    trailing_analysis = None
    if trailing_trades:
        trailing_analysis = {
            "count": len(trailing_trades),
            "pct_of_trades": round(len(trailing_trades) / total_trades * 100, 2) if total_trades else 0.0,
            "net_pnl": round(sum(float(t.get("pnl", 0.0)) for t in trailing_trades), 2),
        }

    # Dynamic Broker Friction (Commission & Swaps)
    comm_sum = sum(float(t.get("commission", 0.0)) for t in trades)
    swap_sum = sum(float(t.get("swap", 0.0)) for t in trades)
    friction_analysis = None
    if abs(comm_sum) > 0.001 or abs(swap_sum) > 0.001:
        friction_analysis = {
            "total_commission": round(comm_sum, 2),
            "total_swap": round(swap_sum, 2),
        }

    # Crime Scene Outlier Breakdown: Top 3 Worst Outlier Losses & Top 3 Best Winners
    sorted_losses = sorted(losing_trades, key=lambda t: float(t.get("pnl", 0.0)))
    worst_losses_crime_scene = []
    for t in sorted_losses[:3]:
        worst_losses_crime_scene.append({
            "trade_id": str(t.get("trade_id", "") or t.get("deal", "")),
            "side": str(t.get("side", "")),
            "pnl": round(float(t.get("pnl", 0.0)), 2),
            "pnl_percent": round(float(t.get("pnl_percent", 0.0)), 2),
            "entry_price": float(t.get("entry_price", 0.0)),
            "exit_price": float(t.get("exit_price", 0.0)),
            "exit_reason": str(t.get("exit_reason", "") or t.get("comment", "")),
            "entry_time": str(t.get("entry_time", "")),
            "exit_time": str(t.get("exit_time", "")),
            "holding_period_bars": int(t.get("holding_period_bars", 0)),
        })

    sorted_wins = sorted(winning_trades, key=lambda t: float(t.get("pnl", 0.0)), reverse=True)
    best_wins = []
    for t in sorted_wins[:3]:
        best_wins.append({
            "trade_id": str(t.get("trade_id", "") or t.get("deal", "")),
            "side": str(t.get("side", "")),
            "pnl": round(float(t.get("pnl", 0.0)), 2),
            "pnl_percent": round(float(t.get("pnl_percent", 0.0)), 2),
            "entry_price": float(t.get("entry_price", 0.0)),
            "exit_price": float(t.get("exit_price", 0.0)),
            "exit_reason": str(t.get("exit_reason", "") or t.get("comment", "")),
            "entry_time": str(t.get("entry_time", "")),
            "exit_time": str(t.get("exit_time", "")),
            "holding_period_bars": int(t.get("holding_period_bars", 0)),
        })

    # Metrics Extraction
    net_profit = float(metrics.get("net_profit", 0.0))
    net_profit_pct = float(metrics.get("net_profit_pct", 0.0))
    profit_factor = float(metrics.get("profit_factor", 0.0))
    sharpe = float(metrics.get("sharpe_ratio", 0.0))
    max_dd_pct = float(metrics.get("max_drawdown_pct", 0.0))

    # Objective Mathematical Diagnostics & Algorithmic Focus Vectors for _v2
    diagnostics: List[str] = []
    recommendations: List[str] = []

    # Profitability & Sharpe profile
    if profit_factor >= 1.75 and sharpe >= 1.2:
        diagnostics.append(f"Institutional statistical edge: Profit factor is {profit_factor:.2f} with Sharpe {sharpe:.2f} across {total_trades} trades.")
    elif profit_factor >= 1.05:
        diagnostics.append(f"Marginal profitability regime: Profit factor is {profit_factor:.2f} with net return of {net_profit_pct:.2f}%.")
    else:
        diagnostics.append(f"Sub-optimal expectancy: Profit factor is {profit_factor:.2f} with net loss of -${abs(net_profit):,.2f} ({net_profit_pct:.2f}%).")

    # Directional asymmetry
    if long_stats["count"] > 0 and short_stats["count"] > 0:
        if short_stats["net_pnl"] < 0 and long_stats["net_pnl"] > 0:
            diagnostics.append(f"Severe Directional Asymmetry: SHORT trades produced net loss of -${abs(float(short_stats['net_pnl'])):,.2f} (PF {short_stats['profit_factor']:.2f}) vs LONG net gain of +${long_stats['net_pnl']:,.2f} (PF {long_stats['profit_factor']:.2f}).")
            recommendations.append(f"Directional Regimes for _v2: Filter or constrain SHORT entries, or condition shorts on higher-timeframe trend alignment.")
        elif long_stats["net_pnl"] < 0 and short_stats["net_pnl"] > 0:
            diagnostics.append(f"Severe Directional Asymmetry: LONG trades produced net loss of -${abs(float(long_stats['net_pnl'])):,.2f} (PF {long_stats['profit_factor']:.2f}) vs SHORT net gain of +${short_stats['net_pnl']:,.2f} (PF {short_stats['profit_factor']:.2f}).")
            recommendations.append(f"Directional Regimes for _v2: Filter or constrain LONG entries, or condition longs on higher-timeframe trend alignment.")

    # Stop Loss & Take Profit dynamics
    if "stop_loss" in stops_analysis:
        sl_info = stops_analysis["stop_loss"]
        diagnostics.append(f"Stop Loss Dispersion: SL triggered on {sl_info['count']} trades ({sl_info['pct_of_total']}%), with excursions from {sl_info['min_distance']} to {sl_info['max_distance']} pts (avg {sl_info['avg_distance']} pts, avg loss -${sl_info['avg_loss']:,.2f}).")
        recommendations.append(f"Stop Loss Calibration for _v2: Calibrate hard SL around the empirical average excursion ({sl_info['avg_distance']} pts) to eliminate catastrophic outlier loss tails up to -${sl_info['max_loss']:,.2f}.")

    if "take_profit" in stops_analysis:
        tp_info = stops_analysis["take_profit"]
        diagnostics.append(f"Take Profit Execution: TP hit on {tp_info['count']} trades ({tp_info['pct_of_total']}%), with targets from {tp_info['min_distance']} to {tp_info['max_distance']} pts (avg {tp_info['avg_distance']} pts, avg win +${tp_info['avg_win']:,.2f}).")

    # Duration Skew
    if duration_skew > 1.3:
        diagnostics.append(f"Holding Duration Skew: Losing trades remained open {duration_skew:.1f}x longer ({avg_loss_bars} bars) than winning trades ({avg_win_bars} bars).")
        recommendations.append(f"Time-Based Decay Exit for _v2: Enforce a maximum holding bar limit (e.g. {int(avg_win_bars * 1.5)} bars) to avoid lingering in adverse drift.")

    # Consecutive Streaks
    if max_consec_losses >= 3:
        diagnostics.append(f"Drawdown Clustering: Strategy encountered a streak of {max_consec_losses} consecutive losing trades.")

    # Fallback recommendations if none populated
    if not recommendations:
        recommendations.append(f"Calibrate parameter sensitivity and stop-target ratios using the observed empirical payoff ratio ({payoff_ratio:.2f}) and expectancy (${expectancy:,.2f}/trade).")

    # Generate Crisp Markdown Report
    be_label = f" / {len(breakeven_trades)} BE" if breakeven_trades else ""
    md_lines = [
        f"## 🔬 Simulation Autopsy: `{strategy_name}`",
        f"**Symbol**: `{symbol}` | **Timeframe**: `{timeframe}` | **Total Trades**: `{total_trades}`",
        "",
        "### 📊 Key Performance & Expectancy Metrics",
        f"- **Net Profit**: `${net_profit:,.2f}` (`{net_profit_pct:.2f}%`)",
        f"- **Win Rate**: `{win_rate * 100:.1f}%` ({len(winning_trades)} W / {len(losing_trades)} L{be_label})",
        f"- **Profit Factor**: `{profit_factor:.2f}` | **Sharpe Ratio**: `{sharpe:.2f}`",
        f"- **Max Drawdown**: `{max_dd_pct:.2f}%`",
        f"- **Payoff Ratio**: `{payoff_ratio:.2f}` (Avg Win: `${avg_win:,.2f}` vs Avg Loss: `${avg_loss:,.2f}`)",
        f"- **Expectancy**: `${expectancy:,.2f}` per trade",
        f"- **Consecutive Streaks**: Max Wins: `{max_consec_wins}` | Max Losses: `{max_consec_losses}`",
        f"- **Average Bars Held**: Wins: `{avg_win_bars}` bars | Losses: `{avg_loss_bars}` bars (Skew: `{duration_skew}x`)",
        "",
        "### ⚖️ Directional Edge & Asymmetry",
        f"- **Long Trades**: {long_stats['count']} trades | Win Rate: {long_stats['win_rate']*100:.1f}% | Net: `${long_stats['net_pnl']:,.2f}` | PF: {long_stats['profit_factor']:.2f}",
        f"- **Short Trades**: {short_stats['count']} trades | Win Rate: {short_stats['win_rate']*100:.1f}% | Net: `${short_stats['net_pnl']:,.2f}` | PF: {short_stats['profit_factor']:.2f}",
    ]

    # Dynamic Stops Markdown Section
    if stops_analysis:
        md_lines.append("")
        md_lines.append("### 🎯 Dynamic Stop Loss & Take Profit Bounds")
        if "stop_loss" in stops_analysis:
            sl = stops_analysis["stop_loss"]
            md_lines.append(f"- **Stop Loss Triggers**: {sl['count']} trades ({sl['pct_of_total']}%)")
            md_lines.append(f"  - **Smallest SL Distance**: `{sl['min_distance']}` pts (Loss: `-${sl['min_loss']:,.2f}`)")
            md_lines.append(f"  - **Largest SL Distance**: `{sl['max_distance']}` pts (Loss: `-${sl['max_loss']:,.2f}`)")
            md_lines.append(f"  - **Average SL Excursion**: `{sl['avg_distance']}` pts (Avg Loss: `-${sl['avg_loss']:,.2f}`)")
        if "take_profit" in stops_analysis:
            tp = stops_analysis["take_profit"]
            md_lines.append(f"- **Take Profit Triggers**: {tp['count']} trades ({tp['pct_of_total']}%)")
            md_lines.append(f"  - **Smallest TP Distance**: `{tp['min_distance']}` pts (Gain: `+${tp['min_win']:,.2f}`)")
            md_lines.append(f"  - **Largest TP Distance**: `{tp['max_distance']}` pts (Gain: `+${tp['max_win']:,.2f}`)")
            md_lines.append(f"  - **Average TP Distance**: `{tp['avg_distance']}` pts (Avg Gain: `+${tp['avg_win']:,.2f}`)")

    # Dynamic Advanced Mechanics Section (Omitted if not present)
    if breakeven_analysis or trailing_analysis:
        md_lines.append("")
        md_lines.append("### 🛡️ Advanced Exit Mechanics")
        if breakeven_analysis:
            md_lines.append(f"- **Break-Even (BE) Exits**: {breakeven_analysis['count']} trades ({breakeven_analysis['pct_of_trades']}%)")
        if trailing_analysis:
            md_lines.append(f"- **Trailing Stop Exits**: {trailing_analysis['count']} trades ({trailing_analysis['pct_of_trades']}%) | Net: `${trailing_analysis['net_pnl']:,.2f}`")

    # Dynamic Friction Section
    if friction_analysis:
        md_lines.append("")
        md_lines.append("### 💸 Friction & Execution Drag")
        if friction_analysis.get("total_commission"):
            md_lines.append(f"- **Total Commission**: `${friction_analysis['total_commission']:,.2f}`")
        if friction_analysis.get("total_swap"):
            md_lines.append(f"- **Total Swap**: `${friction_analysis['total_swap']:,.2f}`")

    # Outliers / Crime Scene
    md_lines.append("")
    md_lines.append("### 🚨 Crime Scene: Outlier Trade Autopsy")
    if biggest_winner:
        md_lines.append(f"- **Biggest Winner**: Trade `{biggest_winner['trade_id']}` ({biggest_winner['side']}) `+${biggest_winner['pnl']}` ({biggest_winner['holding_period_bars']} bars, exit: `{biggest_winner['exit_reason']}`)")
    if biggest_loser:
        md_lines.append(f"- **Biggest Loser**: Trade `{biggest_loser['trade_id']}` ({biggest_loser['side']}) `-${abs(float(biggest_loser['pnl'])):,.2f}` ({biggest_loser['holding_period_bars']} bars, exit: `{biggest_loser['exit_reason']}`)")

    if len(worst_losses_crime_scene) > 1:
        md_lines.append("- **Top Worst Drawdown Losses**:")
        for idx, wl in enumerate(worst_losses_crime_scene, 1):
            price_detail = f"[{wl['entry_price']} -> {wl['exit_price']}]" if wl['entry_price'] > 0 else ""
            md_lines.append(f"  {idx}. Trade `{wl['trade_id']}` ({wl['side']}) `-${abs(float(wl['pnl'])):,.2f}` {price_detail} ({wl['holding_period_bars']} bars, reason: `{wl['exit_reason']}`)")

    md_lines.append("")
    md_lines.append("### 💡 Algorithmic Empirical Observations for `_v2`")
    for d in diagnostics:
        md_lines.append(f"- **Empirical Diagnosis**: {d}")
    for idx, r in enumerate(recommendations, 1):
        md_lines.append(f"- **Actionable Vector {idx}**: {r}")

    markdown_report = "\n".join(md_lines)

    result_payload: Dict[str, Any] = {
        "strategy_name": strategy_name,
        "symbol": symbol,
        "timeframe": timeframe,
        "total_trades": total_trades,
        "win_rate": round(win_rate, 4),
        "profit_factor": round(profit_factor, 2),
        "sharpe_ratio": round(sharpe, 2),
        "max_drawdown_pct": round(max_dd_pct, 2),
        "net_profit": round(net_profit, 2),
        "net_profit_pct": round(net_profit_pct, 2),
        "payoff_ratio": payoff_ratio,
        "expectancy": expectancy,
        "biggest_winner": biggest_winner,
        "biggest_loser": biggest_loser,
        "long_stats": long_stats,
        "short_stats": short_stats,
        "exit_reasons": exit_reasons,
        "max_consec_wins": max_consec_wins,
        "max_consec_losses": max_consec_losses,
        "avg_win_bars": avg_win_bars,
        "avg_loss_bars": avg_loss_bars,
        "duration_skew": duration_skew,
        "diagnostics": diagnostics,
        "recommendations": recommendations,
        "markdown_report": markdown_report,
    }

    # Dynamically inject sections only if present
    if stops_analysis:
        result_payload["stops_analysis"] = stops_analysis
    if breakeven_analysis:
        result_payload["breakeven_analysis"] = breakeven_analysis
    if trailing_analysis:
        result_payload["trailing_stop_analysis"] = trailing_analysis
    if friction_analysis:
        result_payload["friction"] = friction_analysis
    if worst_losses_crime_scene:
        result_payload["worst_losses_crime_scene"] = worst_losses_crime_scene
    if best_wins:
        result_payload["best_wins"] = best_wins

    return result_payload


def generate_dynamic_forensic_autopsy(
    metrics: Dict[str, Any],
    trades: List[Dict[str, Any]],
    strategy_name: str = "strategy",
    symbol: str = "XAUUSD",
    timeframe: str = "1h",
) -> Dict[str, Any]:
    """
    Computes a focused dynamic institutional forensic autopsy of backtest simulation results.
    Produces:
    - Directional Long vs Short win rates & PnL asymmetry
    - Hourly loss clustering (detecting toxic trading sessions)
    - Exit reason attribution (TP, SL, BE, Manual)
    - Compact markdown report (< 1,200 chars) tailored for LLM reasoning.
    """
    if not trades:
        return {
            "strategy_name": strategy_name,
            "symbol": symbol,
            "timeframe": timeframe,
            "total_trades": 0,
            "win_rate": 0.0,
            "net_profit": 0.0,
            "profit_factor": 0.0,
            "directional_breakdown": {
                "long": {"count": 0, "win_rate": 0.0, "net_pnl": 0.0, "profit_factor": 0.0, "avg_trade": 0.0},
                "short": {"count": 0, "win_rate": 0.0, "net_pnl": 0.0, "profit_factor": 0.0, "avg_trade": 0.0},
                "directional_asymmetry_detected": False,
                "recommendation": "No trades executed to analyze.",
            },
            "hourly_breakdown": {
                "worst_losing_hours": [],
                "best_hours": [],
                "peak_loss_hour": None,
                "hourly_pnl": {},
            },
            "exit_reasons": {},
            "markdown_report": f"### 🔬 Simulation Autopsy: `{strategy_name}`\nNo trades executed (0 trades). Check entry filters and spread settings.",
        }

    total_trades = len(trades)
    winning_trades = [t for t in trades if float(t.get("pnl", 0.0)) > 0]
    losing_trades = [t for t in trades if float(t.get("pnl", 0.0)) < 0]

    win_rate = (len(winning_trades) / total_trades) if total_trades > 0 else 0.0
    net_profit = float(metrics.get("net_profit", sum(float(t.get("pnl", 0.0)) for t in trades)))
    gross_wins = sum(float(t.get("pnl", 0.0)) for t in winning_trades)
    gross_losses = abs(sum(float(t.get("pnl", 0.0)) for t in losing_trades))
    profit_factor = float(
        metrics.get("profit_factor", round((gross_wins / gross_losses) if gross_losses > 0 else (99.0 if gross_wins > 0 else 0.0), 2))
    )

    # Directional Breakdown: Long vs Short
    long_trades = [t for t in trades if str(t.get("side", "")).lower() in ("buy", "long") or str(t.get("type", "")).lower() in ("buy", "deal_type_buy", "0")]
    short_trades = [t for t in trades if str(t.get("side", "")).lower() in ("sell", "short") or str(t.get("type", "")).lower() in ("sell", "deal_type_sell", "1")]

    def _side_stats(group: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not group:
            return {"count": 0, "wins": 0, "losses": 0, "win_rate": 0.0, "net_pnl": 0.0, "profit_factor": 0.0, "avg_trade": 0.0}
        wins = [t for t in group if float(t.get("pnl", 0.0)) > 0]
        losses = [t for t in group if float(t.get("pnl", 0.0)) < 0]
        gw = sum(float(t.get("pnl", 0.0)) for t in wins)
        gl = abs(sum(float(t.get("pnl", 0.0)) for t in losses))
        pf = round((gw / gl) if gl > 0 else (99.0 if gw > 0 else 0.0), 2)
        net = round(sum(float(t.get("pnl", 0.0)) for t in group), 2)
        return {
            "count": len(group),
            "wins": len(wins),
            "losses": len(losses),
            "win_rate": round(len(wins) / len(group), 4),
            "net_pnl": net,
            "profit_factor": pf,
            "avg_trade": round(net / len(group), 2),
        }

    long_stats = _side_stats(long_trades)
    short_stats = _side_stats(short_trades)

    asymmetry_detected = False
    asymmetry_rec = ""
    if long_stats["count"] > 0 and short_stats["count"] > 0:
        if short_stats["net_pnl"] < 0 and long_stats["net_pnl"] > 0:
            asymmetry_detected = True
            asymmetry_rec = f"Severe Asymmetry: Shorts net -${abs(short_stats['net_pnl']):,.2f} vs Longs net +${long_stats['net_pnl']:,.2f}. Filter shorts or trade Long-Only."
        elif long_stats["net_pnl"] < 0 and short_stats["net_pnl"] > 0:
            asymmetry_detected = True
            asymmetry_rec = f"Severe Asymmetry: Longs net -${abs(long_stats['net_pnl']):,.2f} vs Shorts net +${short_stats['net_pnl']:,.2f}. Filter longs or trade Short-Only."
        elif abs(long_stats["win_rate"] - short_stats["win_rate"]) >= 0.3:
            asymmetry_detected = True
            asymmetry_rec = f"Win Rate Divergence: Longs WR {long_stats['win_rate']*100:.1f}% vs Shorts WR {short_stats['win_rate']*100:.1f}%."

    # Hourly Analysis & Loss Clustering
    hourly_pnl: Dict[int, float] = {}
    hourly_counts: Dict[int, int] = {}
    for t in trades:
        pnl = float(t.get("pnl", 0.0))
        t_str = str(t.get("entry_time") or t.get("open_time") or t.get("time") or t.get("exit_time") or "")
        match = re.search(r"(\d{1,2}):\d{2}", t_str)
        if match:
            h = int(match.group(1))
            hourly_pnl[h] = hourly_pnl.get(h, 0.0) + pnl
            hourly_counts[h] = hourly_counts.get(h, 0) + 1

    worst_losing_hours = sorted([h for h, p in hourly_pnl.items() if p < 0], key=lambda h: hourly_pnl[h])
    best_hours = sorted([h for h, p in hourly_pnl.items() if p > 0], key=lambda h: hourly_pnl[h], reverse=True)
    peak_loss_hour = worst_losing_hours[0] if worst_losing_hours else None

    # Exit Reasons
    exit_reasons: Dict[str, Dict[str, Any]] = {}
    for t in trades:
        reason = str(t.get("exit_reason") or t.get("comment") or "unspecified").strip().upper()
        pnl_val = float(t.get("pnl", 0.0))
        if reason not in exit_reasons:
            exit_reasons[reason] = {"count": 0, "wins": 0, "losses": 0, "net_pnl": 0.0}
        exit_reasons[reason]["count"] += 1
        if pnl_val > 0:
            exit_reasons[reason]["wins"] += 1
        elif pnl_val < 0:
            exit_reasons[reason]["losses"] += 1
        exit_reasons[reason]["net_pnl"] = round(exit_reasons[reason]["net_pnl"] + pnl_val, 2)

    # Compact Markdown Report (< 1,200 chars to respect session token budget)
    worst_hours_str = ", ".join(f"UTC {h:02d}:00 (-${abs(hourly_pnl[h]):,.0f})" for h in worst_losing_hours[:3]) or "None"
    best_hours_str = ", ".join(f"UTC {h:02d}:00 (+${hourly_pnl[h]:,.0f})" for h in best_hours[:3]) or "None"
    exits_summary = ", ".join(f"{k}: {v['count']}" for k, v in list(exit_reasons.items())[:4]) or "N/A"

    md_lines = [
        f"## 🔬 Simulation Autopsy: `{strategy_name}`",
        f"**Symbol**: `{symbol}` | **Timeframe**: `{timeframe}` | **Total Trades**: `{total_trades}`",
        "",
        "### 📊 Key Performance & Expectancy Metrics",
        f"- **Net Profit**: `${net_profit:,.2f}` | **Win Rate**: `{win_rate * 100:.1f}%` ({len(winning_trades)} W / {len(losing_trades)} L) | **PF**: `{profit_factor:.2f}`",
        "",
        "### ⚖️ Directional Edge & Asymmetry",
        f"- **Long Trades**: {long_stats['count']} trades | Win Rate: {long_stats['win_rate']*100:.1f}% | Net: `${long_stats['net_pnl']:,.2f}` | PF: {long_stats['profit_factor']:.2f}",
        f"- **Short Trades**: {short_stats['count']} trades | Win Rate: {short_stats['win_rate']*100:.1f}% | Net: `${short_stats['net_pnl']:,.2f}` | PF: {short_stats['profit_factor']:.2f}",
        "",
        "### ⏰ Hourly Distribution & Risk Clusters",
        f"- **Worst Losing Hours**: {worst_hours_str}",
        f"- **Best Hours**: {best_hours_str}",
        f"- **Exit Reasons**: {exits_summary}",
        "",
        "### 💡 Algorithmic Empirical Observations for `_v2`",
        f"- **Actionable Vector 1**: {asymmetry_rec or 'Expectancy is distributed evenly across directions. Calibrate SL/TP parameters.'}",
    ]
    markdown_report = "\n".join(md_lines)
    if len(markdown_report) > 1200:
        markdown_report = markdown_report[:1195] + "\n..."

    return {
        "strategy_name": strategy_name,
        "symbol": symbol,
        "timeframe": timeframe,
        "total_trades": total_trades,
        "win_rate": round(win_rate, 4),
        "profit_factor": round(profit_factor, 2),
        "net_profit": round(net_profit, 2),
        "directional_breakdown": {
            "long": long_stats,
            "short": short_stats,
            "directional_asymmetry_detected": asymmetry_detected,
            "recommendation": asymmetry_rec,
        },
        "hourly_breakdown": {
            "worst_losing_hours": worst_losing_hours,
            "best_hours": best_hours,
            "peak_loss_hour": peak_loss_hour,
            "hourly_pnl": hourly_pnl,
        },
        "exit_reasons": exit_reasons,
        "markdown_report": markdown_report,
    }


async def ingest_test_results(
    run_id: Optional[str] = None,
    telemetry_data: Optional[Dict[str, Any]] = None,
    strategy_name: Optional[str] = None,
    username: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Ingests simulation backtest telemetry and trades to generate a deep autopsy,
    loss analysis, and algorithmic recommendations for strategy _v2.
    """
    metrics = {}
    trades = []
    symbol = "BTCUSDT"
    timeframe = "1h"
    resolved_strategy = strategy_name or "strategy"

    if run_id:
        _, store = _get_services()
        if store:
            run = store.get_run(run_id)
            if run:
                metrics = run.metrics.model_dump()
                trades = [t.model_dump() for t in run.trades]
                symbol = run.symbol
                timeframe = run.timeframe
                resolved_strategy = strategy_name or run.strategy_name or run.strategy_id

    if not metrics and telemetry_data:
        metrics = telemetry_data.get("metrics") or {}
        trades = telemetry_data.get("trades") or []
        symbol = telemetry_data.get("symbol") or symbol
        timeframe = telemetry_data.get("timeframe") or timeframe
        resolved_strategy = strategy_name or telemetry_data.get("strategy_name") or resolved_strategy

    if not metrics:
        return {
            "success": False,
            "error": f"No telemetry found for run_id '{run_id}' or telemetry_data payload.",
        }

    autopsy = compute_simulation_autopsy(
        metrics=metrics,
        trades=trades,
        strategy_name=resolved_strategy,
        symbol=symbol,
        timeframe=timeframe,
    )

    # Optionally persist autopsy report to disk under data/users/<username>/<strategy_name>/
    file_saved = None
    try:
        from pathlib import Path
        project_root = Path(__file__).resolve().parents[4]
        safe_user = (username or "default").strip().lower()
        strategy_folder = project_root / "data" / "users" / safe_user / resolved_strategy
        strategy_folder.mkdir(parents=True, exist_ok=True)
        autopsy_path = strategy_folder / f"{resolved_strategy}_autopsy.json"
        with open(autopsy_path, "w", encoding="utf-8") as f:
            json.dump(autopsy, f, indent=2, default=str)
        file_saved = str(autopsy_path)
    except Exception as err:
        logger.warning(f"Could not persist autopsy to disk: {err}")

    return {
        "success": True,
        "run_id": run_id,
        "strategy_name": resolved_strategy,
        "symbol": symbol,
        "timeframe": timeframe,
        "autopsy": autopsy,
        "markdown_report": autopsy["markdown_report"],
        "persisted_path": file_saved,
    }


def register_execution_tools(harness: Any) -> None:
    """
    Registers the quantitative execution, autopsy, and backtesting tools into an AgentHarness.
    """
    async def _bound_run_backtest(
        strategy_id: str = "gold_sr_scalper",
        symbol: str = "XAUUSD",
        timeframe: str = "15m",
        start_date: Optional[Union[str, datetime]] = None,
        end_date: Optional[Union[str, datetime]] = None,
        initial_capital: float = 100000.0,
        slippage_points: float = 0.5,
        commission_pct: float = 0.0002,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        res = await run_backtest(
            strategy_id=strategy_id,
            symbol=symbol,
            timeframe=timeframe,
            start_date=start_date,
            end_date=end_date,
            initial_capital=initial_capital,
            slippage_points=slippage_points,
            commission_pct=commission_pct,
            parameters=parameters,
        )
        if res.get("success") and hasattr(harness, "set_inception_state"):
            try:
                from ..core.types import StrategyInceptionState
            except ImportError:
                from packages.agent.src.core.types import StrategyInceptionState
            harness.set_inception_state(
                StrategyInceptionState.TESTED,
                strategy_name=res.get("strategy_name") or strategy_id,
            )
        return res


    harness.register_tool(
        name="launch_sandbox_runner",
        description="Opens the Central Sandbox Simulation Cockpit in the UI with target parameters (symbol, timeframe, date range) so local parquet data is verified and the backtest can be observed interactively.",
        parameters={
            "type": "object",
            "properties": {
                "strategy_id": {
                    "type": "string",
                    "default": "gold_sr_scalper",
                    "description": "Strategy identifier or script filename to test.",
                },
                "symbol": {"type": "string", "default": "XAUUSD", "description": "Market ticker symbol (e.g. XAUUSD, BTCUSDT)."},
                "timeframe": {"type": "string", "default": "15m", "description": "Candle timeframe resolution (e.g. 5m, 15m, 1h)."},
                "start_date": {"type": "string", "description": "Start date for simulation (e.g. '2025-01-01' or '2025')."},
                "end_date": {"type": "string", "description": "End date for simulation (e.g. '2025-12-31' or '2025')."},
                "parameters": {"type": "object", "description": "Optional strategy parameter overrides."},
            },
            "required": ["strategy_id"],
        },
        handler=launch_sandbox_runner,
    )

    harness.register_tool(
        name="run_backtest",
        description="Executes a deterministic quantitative backtest on local partitioned parquet market data via background worker. You MUST specify start_date and end_date when known.",
        parameters={
            "type": "object",
            "properties": {
                "strategy_id": {
                    "type": "string",
                    "default": "gold_sr_scalper",
                    "description": "Identifier of the strategy (e.g. 'gold_sr_scalper').",
                },
                "symbol": {"type": "string", "default": "XAUUSD", "description": "Market ticker symbol (e.g. 'XAUUSD', 'BTCUSDT')."},
                "timeframe": {"type": "string", "default": "15m", "description": "Bar resolution (1m, 5m, 15m, 1h, 4h, 1d)."},
                "start_date": {
                    "type": "string",
                    "description": "Start date (e.g. '2025-01-01' or '2025'). Data is stored in local partitioned parquet files (2010-2026). If the user requested a specific year or range, pass it here.",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date (e.g. '2025-12-31' or '2025'). If unspecified and start_date is a 4-digit year, it automatically covers that full year. Defaults to recent 2-3 years if omitted.",
                },
                "initial_capital": {"type": "number", "default": 100000.0, "description": "Starting balance in account currency."},
                "slippage_points": {"type": "number", "default": 0.5, "description": "Simulated order execution slippage in points."},
                "commission_pct": {"type": "number", "default": 0.0002, "description": "Per-trade broker commission percentage."},
                "parameters": {"type": "object", "description": "Optional strategy parameter overrides."},
            },
            "required": ["strategy_id"],
        },
        handler=_bound_run_backtest,
    )

    harness.register_tool(
        name="get_backtest_result",
        description="Retrieves granular performance statistics, win rate, expectancy, and drawdown metrics of a completed backtest.",
        parameters={
            "type": "object",
            "properties": {
                "run_id": {"type": "string", "description": "Backtest run identifier (e.g. 'BT_ABC123')."},
            },
            "required": ["run_id"],
        },
        handler=get_backtest_result,
    )

    harness.register_tool(
        name="compare_backtests",
        description="Statistically compares two backtest runs to evaluate strategy modifications or timeframe regime differences.",
        parameters={
            "type": "object",
            "properties": {
                "run_id_a": {"type": "string", "description": "Baseline backtest run ID."},
                "run_id_b": {"type": "string", "description": "Alternative backtest run ID."},
            },
            "required": ["run_id_a", "run_id_b"],
        },
        handler=compare_backtests,
    )

    harness.register_tool(
        name="run_parameter_matrix_sweep",
        description="Executes a parameter sweep across multiple hyperparameter values to find optimal, robust configurations and prevent overfitting.",
        parameters={
            "type": "object",
            "properties": {
                "strategy_id": {"type": "string", "default": "gold_sr_scalper"},
                "symbol": {"type": "string", "default": "XAUUSD"},
                "timeframe": {"type": "string", "default": "15m"},
                "start_date": {
                    "type": "string",
                    "description": "Start date for backtesting (e.g. '2025-01-01' or '2025').",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date for backtesting (e.g. '2025-12-31' or '2025').",
                },
                "parameter_grid": {
                    "type": "object",
                    "description": "Dictionary mapping parameter names to lists of candidate values.",
                },
                "max_combinations": {"type": "integer", "default": 6},
            },
            "required": ["strategy_id"],
        },
        handler=run_parameter_matrix_sweep,
    )

    harness.register_tool(
        name="ingest_test_results",
        description="Ingests simulation backtest telemetry and trades to generate a deep autopsy, loss analysis, and algorithmic recommendations for strategy _v2.",
        parameters={
            "type": "object",
            "properties": {
                "run_id": {"type": "string", "description": "Backtest run identifier (e.g. 'BT_ABC123')."},
                "telemetry_data": {"type": "object", "description": "Optional raw telemetry metrics and trades dictionary."},
                "strategy_name": {"type": "string", "description": "Short 2-3 word strategy name (e.g. 'ict_gold_scalper')."},
                "username": {"type": "string", "description": "Optional user account identifier."},
            },
        },
        handler=ingest_test_results,
    )


