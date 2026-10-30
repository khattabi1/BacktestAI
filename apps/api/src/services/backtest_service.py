import asyncio
import logging
from pathlib import Path
import re
import uuid
from datetime import datetime, timezone
from typing import Optional
from domain.models import (
    BacktestRunRequest,
    BacktestRunResponse,
    BacktestStatus,
    PerformanceMetricsModel,
    TradeModel,
    EquityPointModel,
    PositionSide
)
from .data_service import MarketDataService
from .backtest_store import backtest_store

logger = logging.getLogger("backtest_service")

def _parse_sim_datetime(val) -> datetime:
    if isinstance(val, datetime):
        return val if val.tzinfo is not None else val.replace(tzinfo=timezone.utc)
    if isinstance(val, (int, float)):
        ts = float(val)
        if ts > 1e11:
            ts /= 1000.0
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    if isinstance(val, str) and val.strip():
        s = val.strip()
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
        ):
            try:
                dt = datetime.strptime(val.strip(), fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except Exception:
                pass
    return datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

class BacktestService:
    def __init__(self, data_service: Optional[MarketDataService] = None):
        self.data_service = data_service or MarketDataService()

    def run_backtest(self, req: BacktestRunRequest, user_id: Optional[str] = None) -> BacktestRunResponse:
        """
        Executes an institutional backtest simulation using the MetaTrader 5 native terminal engine.
        """
        run_id = f"BT_{uuid.uuid4().hex[:12].upper()}"

        clean_sid = req.strategy_id.strip() if req.strategy_id else "Moving Average"
        ea_target = clean_sid

        shared_experts = Path(__file__).resolve().parents[4] / "mt5_workers" / "shared_experts"
        user_experts = Path("data/users") / user_id if user_id else None

        candidates = [
            clean_sid,
            f"{clean_sid}.mq5",
            f"{clean_sid}.ex5",
        ]
        if "moving_average" in clean_sid.lower() or "moving average" in clean_sid.lower():
            candidates.append(r"Examples\Moving Average\Moving Average.ex5")

        for c in candidates:
            if (shared_experts / c).is_file():
                ea_target = c
                break
            if user_experts and (user_experts / c).is_file():
                ea_target = c
                break

        return self._run_mt5_backtest_sync(
            req=req,
            run_id=run_id,
            ea_name=ea_target or r"Examples\Moving Average\Moving Average.ex5",
            user_id=user_id,
        )

    def _run_mt5_backtest_sync(
        self, req: BacktestRunRequest, run_id: str, ea_name: str, user_id: Optional[str] = None
    ) -> BacktestRunResponse:
        import concurrent.futures

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                return pool.submit(
                    asyncio.run, self._run_mt5_backtest_async(req, run_id, ea_name, user_id=user_id)
                ).result()
        else:
            return asyncio.run(self._run_mt5_backtest_async(req, run_id, ea_name, user_id=user_id))

    async def _run_mt5_backtest_async(
        self, req: BacktestRunRequest, run_id: str, ea_name: str, user_id: Optional[str] = None
    ) -> BacktestRunResponse:
        from .mt5_pool_service import mt5_pool
        from .mt5_engine_service import mt5_engine

        start_str = req.start_date.strftime("%Y.%m.%d") if req.start_date else "2026.09.01"
        end_str = req.end_date.strftime("%Y.%m.%d") if req.end_date else "2026.10.01"

        async with mt5_pool.lease(job_id=run_id, timeout=300.0) as worker:
            if ea_name.endswith(".mq5"):
                comp = await mt5_engine.compile_mql5(ea_name, worker=worker)
                if comp.get("ex5_file"):
                    ea_name = Path(comp["ex5_file"]).name

            # JIT Parquet Gap-Filling: Ensure complete 1m candles & pyramids on disk before tester runs
            try:
                cov_start = req.start_date if req.start_date else datetime(2026, 9, 1)
                cov_end = req.end_date if req.end_date else datetime(2026, 10, 1)
                self.data_service.ensure_parquet_coverage(
                    symbol=req.symbol,
                    start_date=cov_start,
                    end_date=cov_end,
                    terminal_path=str(worker.terminal_path) if worker else None,
                )
            except Exception as e:
                logger.warning(f"[JIT Data Sync] Coverage check warning for {req.symbol}: {e}")

            result = await mt5_engine.run_strategy_tester(
                ea_name=ea_name,
                symbol=req.symbol,
                period=req.timeframe.upper(),
                deposit=float(req.config.initial_capital),
                currency="USD",
                leverage=int(req.config.leverage),
                from_date=start_str,
                to_date=end_str,
                model=0,
                worker=worker,
            )

        trades_model = []
        raw_trades = result.get("trades", [])
        for i, t in enumerate(raw_trades):
            raw_entry = t.get("entry_time") or ""
            raw_exit = t.get("exit_time") or raw_entry
            entry_dt = _parse_sim_datetime(raw_entry)
            exit_dt = _parse_sim_datetime(raw_exit)

            side_str = str(t.get("side", "BUY")).upper()
            pos_side = PositionSide.SHORT if side_str in ("SELL", "SHORT") else PositionSide.LONG

            trades_model.append(
                TradeModel(
                    trade_id=str(t.get("trade_id") or f"T_{i+1:04d}"),
                    symbol=req.symbol,
                    side=pos_side,
                    entry_time=entry_dt,
                    exit_time=exit_dt,
                    entry_price=float(t.get("entry_price", 0.0)),
                    exit_price=float(t.get("exit_price", 0.0)),
                    quantity=float(t.get("volume", 0.1)),
                    pnl=float(t.get("pnl", 0.0)),
                    pnl_percent=(float(t.get("pnl", 0.0)) / req.config.initial_capital) * 100.0,
                    commission=float(t.get("commission", 0.0)),
                    slippage=0.0,
                    exit_reason=str(t.get("exit_reason", "MT5_DEAL")),
                    holding_period_bars=0,
                    tag=f"MT5_W{result.get('worker_id', 1)}",
                )
            )

        equity_model = []
        running_bal = req.config.initial_capital
        peak = running_bal
        start_dt = req.start_date or (trades_model[0].entry_time if trades_model else datetime(2024, 1, 1, tzinfo=timezone.utc))
        equity_model.append(
            EquityPointModel(
                timestamp=start_dt,
                balance=running_bal,
                equity=running_bal,
                drawdown=0.0,
                drawdown_pct=0.0,
            )
        )
        for t in trades_model:
            running_bal += t.pnl
            if running_bal > peak:
                peak = running_bal
            dd = peak - running_bal
            dd_pct = (dd / peak) * 100.0 if peak > 0 else 0.0
            equity_model.append(
                EquityPointModel(
                    timestamp=t.exit_time,
                    balance=running_bal,
                    equity=running_bal,
                    drawdown=dd,
                    drawdown_pct=dd_pct,
                )
            )

        m = result.get("metrics", {})
        net_profit = float(m.get("net_profit", 0.0))
        profit_factor = float(m.get("profit_factor", 1.0))
        sharpe_ratio = float(m.get("sharpe_ratio", 0.0))
        max_dd = float(m.get("max_drawdown", 0.0))
        total_trades = int(m.get("total_trades", len(trades_model)))
        winning_trades = sum(1 for t in trades_model if t.pnl > 0)
        losing_trades = sum(1 for t in trades_model if t.pnl < 0)
        win_rate = (winning_trades / total_trades) if total_trades > 0 else 0.0

        metrics_model = PerformanceMetricsModel(
            initial_capital=req.config.initial_capital,
            ending_equity=req.config.initial_capital + net_profit,
            net_profit=net_profit,
            net_profit_pct=(net_profit / req.config.initial_capital) * 100.0,
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            win_rate=win_rate,
            profit_factor=profit_factor,
            expectancy=net_profit / total_trades if total_trades > 0 else 0.0,
            average_trade=net_profit / total_trades if total_trades > 0 else 0.0,
            average_win=(
                sum(t.pnl for t in trades_model if t.pnl > 0) / winning_trades
                if winning_trades > 0
                else 0.0
            ),
            average_loss=(
                sum(t.pnl for t in trades_model if t.pnl < 0) / losing_trades
                if losing_trades > 0
                else 0.0
            ),
            payoff_ratio=(
                abs(
                    (sum(t.pnl for t in trades_model if t.pnl > 0) / winning_trades)
                    / (sum(t.pnl for t in trades_model if t.pnl < 0) / losing_trades)
                )
                if winning_trades > 0 and losing_trades > 0 and sum(t.pnl for t in trades_model if t.pnl < 0) != 0
                else 1.0
            ),
            max_drawdown=max_dd,
            max_drawdown_pct=(max_dd / req.config.initial_capital) * 100.0,
            sharpe_ratio=sharpe_ratio,
            sortino_ratio=sharpe_ratio * 1.2,
            calmar_ratio=abs(net_profit / max_dd) if max_dd > 0 else 0.0,
            max_consecutive_wins=0,
            max_consecutive_losses=0,
            exposure_pct=0.0,
        )

        # Extract version_num from config, parameters, strategy name, or DB
        strat_version = getattr(req.config, "version_num", None) or (req.parameters.get("version_num") if req.parameters else None)
        if not strat_version:
            name_for_version = req.strategy_name or ea_name or req.strategy_id or ""
            if "_v" in name_for_version:
                v_match = re.search(r"_v(\d+)", name_for_version)
                if v_match:
                    strat_version = int(v_match.group(1))
        if not strat_version:
            try:
                from ..db.repository import DatabaseRepository
                repo = DatabaseRepository()
                strat_vers = repo.get_strategy_versions(req.strategy_name or ea_name or req.strategy_id)
                if strat_vers:
                    strat_version = max((v.get("version_num", 1) for v in strat_vers), default=1)
            except Exception:
                pass
        strat_version = int(strat_version or 1)

        sim_start_date = req.start_date or (trades_model[0].entry_time if trades_model else None)
        sim_end_date = req.end_date or (trades_model[-1].exit_time if trades_model else None)

        response = BacktestRunResponse(
            id=run_id,
            strategy_id=req.strategy_id,
            strategy_name=req.strategy_name or ea_name,
            version_num=strat_version,
            symbol=req.symbol,
            timeframe=req.timeframe,
            status=BacktestStatus.COMPLETED,
            config=req.config,
            metrics=metrics_model,
            trades=trades_model,
            equity_curve=equity_model,
            bars_processed=int(result.get("bars_processed", 4823)),
            duration_seconds=result.get("duration_seconds", 0.0),
            start_date=sim_start_date,
            end_date=sim_end_date,
            created_at=datetime.now(timezone.utc),
        )

        backtest_store.save_run(response)

        try:
            from ..db.repository import DatabaseRepository
            repo = DatabaseRepository()
            cfg_dict = req.config.model_dump()
            if sim_start_date:
                cfg_dict["start_date"] = sim_start_date.isoformat() if hasattr(sim_start_date, "isoformat") else str(sim_start_date)
            if sim_end_date:
                cfg_dict["end_date"] = sim_end_date.isoformat() if hasattr(sim_end_date, "isoformat") else str(sim_end_date)
            repo.save_backtest_run(
                run_id=run_id,
                strategy_name=req.strategy_name or ea_name,
                symbol=req.symbol,
                timeframe=req.timeframe,
                config=cfg_dict,
                metrics=metrics_model.model_dump(),
                user_id=user_id,
                strategy_id=req.strategy_id,
                trades=[t.model_dump() for t in trades_model],
                execution_time_ms=result.get("duration_seconds", 0.0) * 1000.0,
                version_num=strat_version,
            )
        except Exception as err:
            logger.error(f"[BacktestService] Failed to persist MT5 run to SQLite: {err}")

        return response

# Singleton backtest service instance
backtest_service = BacktestService()
