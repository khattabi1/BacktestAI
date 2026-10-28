"""
Unit tests for Execution & Backtesting Tools Plugin in packages/agent.
Verifies simulation execution, metrics inspection, comparative analysis,
parameter sweeps, and AgentHarness dispatch.
"""

from __future__ import annotations
import pytest

from packages.agent.src.core.harness import AgentHarness, ModelChunk
from packages.agent.src.core.types import AgentState, EventType, ToolCall
from packages.agent.src.tools.execution import (
    compare_backtests,
    compute_simulation_autopsy,
    get_backtest_result,
    ingest_test_results,
    register_execution_tools,
    run_backtest,
    run_parameter_matrix_sweep,
)


from backtest_si.strategy import BaseStrategy
from apps.api.src.services.strategy_registry import strategy_registry, StrategyMetadata


class MockTestStrategy(BaseStrategy):
    def on_bar(self, *args, **kwargs):
        return []


@pytest.fixture(autouse=True)
def setup_test_strategy():
    from pathlib import Path
    user_dir = Path(__file__).resolve().parents[3] / "data" / "users" / "default"
    user_dir.mkdir(parents=True, exist_ok=True)
    strat_file = user_dir / "gold_sr_scalper.py"
    strat_file.write_text(
        "from backtest_si.strategy import BaseStrategy\n\n"
        "class MockTestStrategy(BaseStrategy):\n"
        "    def on_bar(self, *args, **kwargs):\n"
        "        return []\n",
        encoding="utf-8",
    )
    strategy_registry.register(
        "gold_sr_scalper",
        MockTestStrategy,
        StrategyMetadata(
            id="gold_sr_scalper",
            name="MockTestStrategy",
            description="Mock strategy for execution tool tests",
            category="test",
            parameters=[],
        ),
    )
    yield
    try:
        if strat_file.is_file():
            strat_file.unlink()
    except Exception:
        pass


@pytest.mark.asyncio
async def test_run_backtest_returns_quant_digest():
    res = await run_backtest(
        strategy_id="gold_sr_scalper",
        symbol="XAUUSD",
        timeframe="15m",
        initial_capital=50000.0,
        slippage_points=1.0,
        commission_pct=0.0004,
    )
    assert res["success"] is True
    assert "run_id" in res
    assert res["symbol"] == "XAUUSD"
    assert res["timeframe"] == "15m"
    assert "sharpe_ratio" in res
    assert "max_drawdown_pct" in res
    assert "win_rate" in res
    assert res["total_trades"] >= 0
    assert res["bars_processed"] > 0


@pytest.mark.asyncio
async def test_get_backtest_result_lifecycle():
    # 1. Run backtest first
    run_res = await run_backtest(
        strategy_id="gold_sr_scalper",
        symbol="XAUUSD",
        timeframe="15m",
    )
    assert run_res["success"] is True
    run_id = run_res["run_id"]

    # 2. Get result
    detail = await get_backtest_result(run_id)
    assert detail["found"] is True
    assert detail["run_id"] == run_id
    assert detail["strategy_name"] == run_res["strategy_name"]
    assert detail["net_profit"] == run_res["net_profit"]
    assert detail["total_trades"] == run_res["total_trades"]


@pytest.mark.asyncio
async def test_compare_backtests_with_deltas():
    # Run Baseline (Run A)
    res_a = await run_backtest(
        strategy_id="gold_sr_scalper",
        symbol="XAUUSD",
        timeframe="15m",
        parameters={"ema_period": 30},
    )
    # Run Variant (Run B)
    res_b = await run_backtest(
        strategy_id="gold_sr_scalper",
        symbol="XAUUSD",
        timeframe="15m",
        parameters={"ema_period": 50},
    )

    comparison = await compare_backtests(res_a["run_id"], res_b["run_id"])
    assert comparison["success"] is True
    assert "deltas" in comparison
    deltas = comparison["deltas"]
    assert "sharpe_ratio_diff" in deltas
    assert "max_drawdown_pct_diff" in deltas
    assert "net_profit_pct_diff" in deltas
    assert "verdict" in comparison
    assert len(comparison["verdict"]) > 10


@pytest.mark.asyncio
async def test_run_parameter_matrix_sweep():
    sweep = await run_parameter_matrix_sweep(
        strategy_id="gold_sr_scalper",
        symbol="XAUUSD",
        timeframe="15m",
        parameter_grid={
            "ema_period": [30, 40],
        },
        max_combinations=2,
    )
    assert sweep["success"] is True
    assert sweep["combinations_tested"] >= 1
    assert "best_configuration" in sweep
    assert "sharpe_ratio" in sweep["best_configuration"]
    assert len(sweep["top_configurations"]) >= 1


class MockLLMForExecutionTool:
    def __init__(self, tool_call: ToolCall, final_answer: str) -> None:
        self.tool_call = tool_call
        self.final_answer = final_answer
        self.turn = 0

    async def generate_turn(self, messages, tools):
        self.turn += 1
        if self.turn == 1:
            yield ModelChunk(
                thought_delta="Triggering backtest simulation...",
                tool_calls=[self.tool_call],
            )
        else:
            yield ModelChunk(
                thought_delta="Analyzing Sharpe ratio and Drawdown results...",
                content_delta=self.final_answer,
            )


@pytest.mark.asyncio
async def test_harness_dispatches_execution_tool():
    tool_call = ToolCall(
        id="tc_exec_1",
        name="run_backtest",
        arguments={"strategy_id": "gold_sr_scalper", "symbol": "XAUUSD", "timeframe": "15m"},
    )
    mock_llm = MockLLMForExecutionTool(tool_call, "Backtest completed with Sharpe ratio of 1.45.")

    harness = AgentHarness(
        session_id="sess_exec_tool_test",
        user_id="usr_quant_exec",
        llm_adapter=mock_llm,
    )
    register_execution_tools(harness)

    assert "run_backtest" in harness._tools
    assert "get_backtest_result" in harness._tools
    assert "compare_backtests" in harness._tools
    assert "run_parameter_matrix_sweep" in harness._tools
    assert "ingest_test_results" in harness._tools

    events = []
    async for event in harness.run("Backtest trend following on BTCUSDT"):
        events.append(event)

    assert harness.session.state == AgentState.DONE
    types = [e.event_type for e in events]
    assert EventType.TOOL_CALL_STARTED in types
    assert EventType.TOOL_CALL_FINISHED in types

    tool_msg = [m for m in harness.session.history if m.role.value == "tool"][0]
    assert "sharpe_ratio" in tool_msg.content


def test_compute_simulation_autopsy_full_diagnostics():
    mock_metrics = {
        "net_profit": 4250.0,
        "net_profit_pct": 8.5,
        "profit_factor": 1.45,
        "sharpe_ratio": 1.15,
        "max_drawdown_pct": 9.2,
    }
    mock_trades = [
        {"trade_id": "T1", "side": "BUY", "pnl": 500.0, "pnl_percent": 1.0, "holding_period_bars": 12, "exit_reason": "take_profit"},
        {"trade_id": "T2", "side": "BUY", "pnl": -200.0, "pnl_percent": -0.4, "holding_period_bars": 5, "exit_reason": "stop_loss"},
        {"trade_id": "T3", "side": "SELL", "pnl": -350.0, "pnl_percent": -0.7, "holding_period_bars": 8, "exit_reason": "stop_loss"},
        {"trade_id": "T4", "side": "BUY", "pnl": 1200.0, "pnl_percent": 2.4, "holding_period_bars": 24, "exit_reason": "take_profit"},
    ]

    autopsy = compute_simulation_autopsy(
        metrics=mock_metrics,
        trades=mock_trades,
        strategy_name="gold_fvg_scalper",
        symbol="XAUUSD",
        timeframe="5m",
    )

    assert autopsy["strategy_name"] == "gold_fvg_scalper"
    assert autopsy["symbol"] == "XAUUSD"
    assert autopsy["total_trades"] == 4
    assert autopsy["win_rate"] == 0.5
    assert autopsy["biggest_winner"]["trade_id"] == "T4"
    assert autopsy["biggest_winner"]["pnl"] == 1200.0
    assert autopsy["biggest_loser"]["trade_id"] == "T3"
    assert autopsy["biggest_loser"]["pnl"] == -350.0
    assert autopsy["long_stats"]["count"] == 3
    assert autopsy["short_stats"]["count"] == 1
    assert "take_profit" in autopsy["exit_reasons"]
    assert "stop_loss" in autopsy["exit_reasons"]
    assert len(autopsy["diagnostics"]) > 0
    assert len(autopsy["recommendations"]) > 0
    assert "## 🔬 Simulation Autopsy" in autopsy["markdown_report"]


@pytest.mark.asyncio
async def test_ingest_test_results_lifecycle():
    # 1. Run live backtest
    run_res = await run_backtest(
        strategy_id="gold_sr_scalper",
        symbol="XAUUSD",
        timeframe="15m",
    )
    assert run_res["success"] is True
    run_id = run_res["run_id"]

    # 2. Ingest test results and run autopsy
    autopsy_res = await ingest_test_results(
        run_id=run_id,
        strategy_name="gold_sr_scalper",
        username="trader1",
    )
    assert autopsy_res["success"] is True
    assert autopsy_res["strategy_name"] == "gold_sr_scalper"
    assert autopsy_res["symbol"] == "XAUUSD"
    assert "autopsy" in autopsy_res
    assert "markdown_report" in autopsy_res
    assert autopsy_res["autopsy"]["total_trades"] >= 0
    assert len(autopsy_res["autopsy"]["recommendations"]) > 0
    if autopsy_res["persisted_path"]:
        import os
        assert os.path.exists(autopsy_res["persisted_path"])
