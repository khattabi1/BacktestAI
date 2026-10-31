"""
Native MT5 Automation Engine for BacktestAI.
Provides self-contained, broker-grade MQL5 compilation, Strategy Tester execution,
and report ingestion directly inside BacktestAI without external dependencies.
"""

from __future__ import annotations
import asyncio
from datetime import datetime
import logging
import os
from pathlib import Path
import re
import subprocess
import time
from typing import Any, Dict, List, Optional
from bs4 import BeautifulSoup
import MetaTrader5 as mt5

from .mt5_pool_service import MT5WorkerInstance, mt5_pool

logger = logging.getLogger("backtest_ai.api.mt5_engine")


class MT5EngineService:
    """
    Self-contained MT5 Execution Service.
    Orchestrates headless MQL5 compilation, Strategy Tester automation on IC Markets,
    and report parsing.
    """

    def __init__(self) -> None:
        pass

    async def compile_mql5(
        self,
        filepath: str,
        worker: Optional[MT5WorkerInstance] = None,
    ) -> Dict[str, Any]:
        """
        Compiles an MQL5 file (.mq5) into a binary (.ex5) using MetaEditor CLI.
        Returns compilation status, errors, warnings, and ex5 path.
        """
        resolved_worker = worker or mt5_pool.workers[0]
        metaeditor_exe = resolved_worker.metaeditor_path

        if not metaeditor_exe.is_file():
            return {
                "success": False,
                "error": f"MetaEditor executable not found at: {metaeditor_exe}",
            }

        source_path = Path(filepath).resolve()
        if not source_path.is_file():
            # Check inside shared_experts
            shared_source = resolved_worker.base_dir.parent / "shared_experts" / filepath
            if shared_source.is_file():
                source_path = shared_source
            else:
                return {
                    "success": False,
                    "error": f"MQL5 source file not found at: {filepath}",
                }

        log_path = source_path.with_suffix(".log")
        ex5_path = source_path.with_suffix(".ex5")

        # If log exists, remove old log
        if log_path.is_file():
            try:
                log_path.unlink()
            except Exception:
                pass

        # MetaEditor CLI command: metaeditor64.exe /compile:"<file>" /log:"<log>"
        cmd = [
            str(metaeditor_exe),
            f"/compile:{str(source_path)}",
            f"/log:{str(log_path)}",
        ]

        logger.info(f"[MT5Engine] Compiling {source_path.name} via MetaEditor CLI...")
        proc = await asyncio.to_thread(
            subprocess.run,
            cmd,
            capture_output=True,
            text=True,
            timeout=30.0,
        )

        # MetaEditor writes UTF-16-LE or ANSI log file
        log_content = ""
        if log_path.is_file():
            for encoding in ("utf-16-le", "utf-8", "cp1252", "latin-1"):
                try:
                    log_content = log_path.read_text(encoding=encoding)
                    break
                except UnicodeDecodeError:
                    continue

        is_success = ex5_path.is_file() and ("0 errors" in log_content or proc.returncode == 0)

        # Parse errors and warnings from log lines
        errors: List[str] = []
        warnings: List[str] = []
        for line in log_content.splitlines():
            line_clean = line.strip()
            if "error" in line_clean.lower() and not line_clean.endswith("0 errors"):
                errors.append(line_clean)
            elif "warning" in line_clean.lower() and not line_clean.endswith("0 warnings"):
                warnings.append(line_clean)

        return {
            "success": is_success,
            "returncode": proc.returncode,
            "source_file": str(source_path),
            "ex5_file": str(ex5_path) if is_success else None,
            "log": log_content.strip(),
            "errors": errors,
            "warnings": warnings,
            "message": "Compilation clean (0 errors)" if is_success else f"Compilation failed with {len(errors)} error(s)",
        }

    async def run_strategy_tester(
        self,
        ea_name: str,
        symbol: str = "XAUUSD",
        period: str = "H1",
        deposit: float = 10000.0,
        currency: str = "USD",
        leverage: int = 100,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        model: int = 0,  # 0=every tick (real broker ticks)
        timeout: float = 600.0,
        worker: Optional[MT5WorkerInstance] = None,
    ) -> Dict[str, Any]:
        """
        Executes a Strategy Tester backtest on the specified worker.
        Uses IC Markets real tick data (model=0) and generates an HTML report.
        """
        resolved_worker = worker or mt5_pool.workers[0]
        terminal_exe = resolved_worker.terminal_path

        if not terminal_exe.is_file():
            return {
                "success": False,
                "error": f"Terminal executable not found at: {terminal_exe}",
            }

        # 1. Prepare Paths
        config_dir = resolved_worker.config_dir
        config_dir.mkdir(parents=True, exist_ok=True)
        tester_ini_path = config_dir / f"tester_{int(time.time())}.ini"
        report_rel = f"MQL5\\Files\\report_{int(time.time())}.htm"
        report_path = resolved_worker.base_dir / report_rel
        report_path.parent.mkdir(parents=True, exist_ok=True)

        # 2. Inject Date Ranges into terminal.ini [Tester] as Unix timestamps
        if from_date or to_date:
            self._inject_date_range_to_terminal_ini(
                resolved_worker.terminal_ini,
                from_date=from_date,
                to_date=to_date,
            )

        # 3. Clean EA name (remove Experts\ prefix if present)
        clean_ea = ea_name.replace("Experts\\", "").replace("Experts/", "")
        if not clean_ea.endswith(".ex5"):
            clean_ea = f"{clean_ea}.ex5"

        # 4. Generate tester.ini
        tester_config_lines = [
            "[Tester]",
            f"Expert={clean_ea}",
            f"Symbol={symbol}",
            f"Period={period}",
            f"Deposit={deposit}",
            f"Currency={currency}",
            f"Leverage={leverage}",
            f"Model={model}",  # 0 = Every tick based on real ticks
            "ExecutionMode=0",
            "Optimization=0",
            f"Report={report_rel}",
            "ReplaceReport=1",
            "ShutdownTerminal=1",
        ]
        tester_ini_path.write_text("\n".join(tester_config_lines), encoding="utf-8")

        # 5. Launch terminal64.exe /portable /config:<tester_ini>
        cmd = [
            str(terminal_exe),
            "/portable",
            f"/config:{str(tester_ini_path)}",
        ]

        logger.info(f"[MT5Engine] Launching MT5 Strategy Tester on Worker #{resolved_worker.worker_id} ({symbol} {period})...")
        start_time = time.time()

        proc = await asyncio.to_thread(
            subprocess.run,
            cmd,
            cwd=str(resolved_worker.base_dir),
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        duration = round(time.time() - start_time, 2)

        # 6. Wait a few seconds for MT5 to flush report to disk
        for _ in range(6):
            if report_path.is_file() and report_path.stat().st_size > 1000:
                break
            await asyncio.sleep(1.0)

        # 7. Parse report if generated
        report_data = {}
        if report_path.is_file():
            report_data = self.parse_html_report(report_path)

        # Cleanup temporary tester config
        try:
            tester_ini_path.unlink()
        except Exception:
            pass

        return {
            "success": report_path.is_file(),
            "worker_id": resolved_worker.worker_id,
            "duration_seconds": duration,
            "report_path": str(report_path) if report_path.is_file() else None,
            "metrics": report_data.get("metrics", {}),
            "trades": report_data.get("trades", []),
            "trades_count": len(report_data.get("trades", [])),
        }

    def _inject_date_range_to_terminal_ini(
        self,
        terminal_ini_path: Path,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> None:
        """
        Injects DateFrom and DateTo Unix timestamps into terminal.ini's [Tester] section.
        MT5 Strategy Tester requires timestamps in terminal.ini to respect date filters.
        """
        if not terminal_ini_path.is_file():
            return

        # Parse dates to unix timestamps
        ts_from = None
        ts_to = None
        if from_date:
            try:
                dt_from = datetime.fromisoformat(from_date.replace(".", "-"))
                ts_from = int(dt_from.timestamp())
            except Exception:
                pass

        if to_date:
            try:
                dt_to = datetime.fromisoformat(to_date.replace(".", "-"))
                ts_to = int(dt_to.timestamp())
            except Exception:
                pass

        # Read terminal.ini
        lines: List[str] = []
        for encoding in ("utf-16-le", "utf-8", "cp1252"):
            try:
                content = terminal_ini_path.read_text(encoding=encoding)
                lines = content.splitlines()
                break
            except Exception:
                continue

        if not lines:
            return

        # Find or add [Tester] section
        new_lines: List[str] = []
        in_tester_section = False
        tester_section_found = False

        for line in lines:
            if line.strip().lower() == "[tester]":
                in_tester_section = True
                tester_section_found = True
                new_lines.append(line)
                if ts_from:
                    new_lines.append(f"DateFrom={ts_from}")
                if ts_to:
                    new_lines.append(f"DateTo={ts_to}")
                continue

            if in_tester_section and line.startswith("["):
                in_tester_section = False

            if in_tester_section and (line.startswith("DateFrom=") or line.startswith("DateTo=")):
                continue  # Replace existing dates

            new_lines.append(line)

        if not tester_section_found:
            new_lines.append("\n[Tester]")
            if ts_from:
                new_lines.append(f"DateFrom={ts_from}")
            if ts_to:
                new_lines.append(f"DateTo={ts_to}")

        try:
            terminal_ini_path.write_text("\n".join(new_lines), encoding="utf-16-le")
        except Exception as e:
            logger.warning(f"Could not update terminal.ini: {e}")

    def parse_html_report(self, report_path: Path) -> Dict[str, Any]:
        """
        Parses an MT5 Strategy Tester HTML report.
        Extracts performance summary metrics and the full closed deals ledger.
        """
        content = ""
        for encoding in ("utf-16", "utf-16-le", "utf-8", "cp1252"):
            try:
                content = report_path.read_text(encoding=encoding)
                break
            except Exception:
                continue

        if not content:
            return {"metrics": {}, "trades": []}

        soup = BeautifulSoup(content, "html.parser")
        metrics: Dict[str, Any] = {}
        trades: List[Dict[str, Any]] = []

        # Parse key metrics from table cells
        cells = [td.get_text(strip=True) for td in soup.find_all("td")]
        for i, text in enumerate(cells):
            t = text.lower()
            if "total net profit" in t and i + 1 < len(cells):
                try:
                    metrics["net_profit"] = float(re.sub(r"[^\d.-]", "", cells[i + 1]))
                except ValueError:
                    pass
            elif "profit factor" in t and i + 1 < len(cells):
                try:
                    metrics["profit_factor"] = float(re.sub(r"[^\d.-]", "", cells[i + 1]))
                except ValueError:
                    pass
            elif "total trades" in t and i + 1 < len(cells):
                try:
                    metrics["total_trades"] = int(re.sub(r"[^\d]", "", cells[i + 1]))
                except ValueError:
                    pass
            elif "maximal drawdown" in t and i + 1 < len(cells):
                try:
                    metrics["max_drawdown"] = float(re.sub(r"[^\d.-]", "", cells[i + 1]))
                except ValueError:
                    pass
            elif "sharpe ratio" in t and i + 1 < len(cells):
                try:
                    metrics["sharpe_ratio"] = float(re.sub(r"[^\d.-]", "", cells[i + 1]))
                except ValueError:
                    pass

        # Parse Orders Table to extract exact Stop Loss and Take Profit levels
        orders_map = {}
        in_orders_section = False
        all_tr = soup.find_all("tr")

        for tr in all_tr:
            text = tr.get_text(strip=True)
            if "orders" in text.lower() and len(tr.find_all(["td", "th"])) <= 2:
                in_orders_section = True
                continue
            if in_orders_section:
                if "deals" in text.lower() and len(tr.find_all(["td", "th"])) <= 2:
                    break
                cols = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
                if len(cols) >= 8 and cols[0] != "Open Time":
                    order_id = cols[1]
                    sl_raw = cols[6] if len(cols) > 6 else ""
                    tp_raw = cols[7] if len(cols) > 7 else ""
                    try:
                        sl_val = float(sl_raw.replace(" ", "")) if sl_raw else None
                    except ValueError:
                        sl_val = None
                    try:
                        tp_val = float(tp_raw.replace(" ", "")) if tp_raw else None
                    except ValueError:
                        tp_val = None
                    orders_map[order_id] = {"sl": sl_val, "tp": tp_val}

        # Parse Deals Table (pairing 'in' entries with 'out' exits)
        deals_rows = []
        in_deals_section = False

        for tr in all_tr:
            text = tr.get_text(strip=True)
            if "deals" in text.lower() and len(tr.find_all(["td", "th"])) <= 2:
                in_deals_section = True
                continue
            if in_deals_section:
                cols = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
                if len(cols) >= 11 and cols[0] != "Time" and cols[3].lower() != "balance":
                    deals_rows.append(cols)

        # Pair in and out deals
        last_in = None
        for r in deals_rows:
            time_str = r[0]
            deal_id = r[1]
            sym = r[2]
            dtype = r[3].lower()
            direction = r[4].lower() if len(r) > 4 else ""
            try:
                vol = float(r[5].replace(" ", "")) if len(r) > 5 and r[5] else 0.1
            except ValueError:
                vol = 0.1
            try:
                price = float(r[6].replace(" ", "")) if len(r) > 6 and r[6] else 0.0
            except ValueError:
                price = 0.0
            order_id = r[7] if len(r) > 7 else ""
            try:
                profit = float(r[10].replace(" ", "")) if len(r) > 10 and r[10] else 0.0
            except ValueError:
                profit = 0.0
            try:
                balance = float(r[11].replace(" ", "")) if len(r) > 11 and r[11] else 0.0
            except ValueError:
                balance = 0.0
            comment = r[12] if len(r) > 12 else ""

            if direction == "in":
                side = "BUY" if dtype == "buy" else "SELL"
                ord_info = orders_map.get(order_id, {})
                last_in = {
                    "time": time_str,
                    "deal_id": deal_id,
                    "order_id": order_id,
                    "sym": sym,
                    "side": side,
                    "volume": vol,
                    "price": price,
                    "comment": comment,
                    "sl": ord_info.get("sl"),
                    "tp": ord_info.get("tp")
                }
            elif direction == "out":
                e_time = last_in["time"] if last_in else time_str
                e_price = last_in["price"] if last_in else price
                side = last_in["side"] if last_in else ("SELL" if dtype == "buy" else "BUY")
                trade_vol = last_in["volume"] if last_in else vol
                sl_val = last_in["sl"] if last_in else None
                tp_val = last_in["tp"] if last_in else None

                # Fallback to comment string parsing if orders table had no explicit level
                if sl_val is None and "sl " in comment.lower():
                    m = re.search(r"sl\s*([\d.]+)", comment, re.I)
                    if m:
                        try:
                            sl_val = float(m.group(1))
                        except ValueError:
                            pass
                if tp_val is None and "tp " in comment.lower():
                    m = re.search(r"tp\s*([\d.]+)", comment, re.I)
                    if m:
                        try:
                            tp_val = float(m.group(1))
                        except ValueError:
                            pass

                trades.append({
                    "trade_id": deal_id,
                    "symbol": sym or (last_in["sym"] if last_in else "XAUUSD"),
                    "side": side,
                    "entry_time": e_time,
                    "exit_time": time_str,
                    "entry_price": e_price,
                    "exit_price": price,
                    "volume": trade_vol,
                    "pnl": profit,
                    "balance": balance,
                    "exit_reason": comment or "STOP_TARGET",
                    "stop_loss": sl_val,
                    "take_profit": tp_val
                })
                last_in = None

        # Capture unclosed trade if Strategy Tester ended with an open position
        if last_in:
            trades.append({
                "trade_id": last_in["deal_id"],
                "symbol": last_in["sym"] or "XAUUSD",
                "side": last_in["side"],
                "entry_time": last_in["time"],
                "exit_time": None,
                "entry_price": last_in["price"],
                "exit_price": None,
                "volume": last_in["volume"],
                "pnl": 0.0,
                "balance": balance,
                "exit_reason": "OPEN POSITION",
                "stop_loss": last_in.get("sl"),
                "take_profit": last_in.get("tp")
            })

        # Fallback if no paired deals found (e.g. non-standard report layout)
        if not trades:
            for row in all_tr:
                cols = [td.get_text(strip=True) for td in row.find_all("td")]
                if len(cols) >= 10 and any(d in (cols[3].lower(), cols[4].lower()) for d in ("buy", "sell")):
                    try:
                        deal_time = cols[0]
                        side = "BUY"
                        for col in cols[:6]:
                            clow = col.lower()
                            if clow == "buy":
                                side = "BUY"
                                break
                            elif clow == "sell":
                                side = "SELL"
                                break

                        volume = float(cols[5].replace(" ", "")) if len(cols) > 5 and cols[5] else 0.1
                        price = float(cols[6].replace(" ", "")) if len(cols) > 6 and cols[6] else 0.0
                        pnl = float(cols[10].replace(" ", "")) if len(cols) > 10 and cols[10] else 0.0

                        trades.append({
                            "trade_id": cols[1] if len(cols) > 1 else str(len(trades) + 1),
                            "symbol": cols[2] if len(cols) > 2 and cols[2] else "XAUUSD",
                            "entry_time": deal_time,
                            "exit_time": deal_time,
                            "side": side,
                            "volume": volume,
                            "entry_price": price,
                            "exit_price": price,
                            "pnl": pnl,
                            "exit_reason": cols[12] if len(cols) > 12 else "MT5_DEAL",
                        })
                    except Exception:
                        continue

        return {"metrics": metrics, "trades": trades}


# Singleton service instance
mt5_engine = MT5EngineService()
