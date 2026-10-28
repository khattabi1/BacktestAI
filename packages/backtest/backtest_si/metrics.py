import math
from typing import List
from .types import Trade, EquityPoint, PerformanceMetrics, SimulationConfig

def calculate_metrics(
    trades: List[Trade],
    equity_history: List[EquityPoint],
    config: SimulationConfig,
    total_bars: int = 0
) -> PerformanceMetrics:
    initial_cap = config.initial_capital
    ending_eq = equity_history[-1].equity if equity_history else initial_cap
    net_profit = ending_eq - initial_cap
    net_profit_pct = (net_profit / initial_cap) * 100.0 if initial_cap > 0 else 0.0

    total_trades = len(trades)
    winning_trades = sum(1 for t in trades if t.pnl > 0)
    losing_trades = sum(1 for t in trades if t.pnl < 0)
    win_rate = (winning_trades / total_trades) * 100.0 if total_trades > 0 else 0.0

    gross_profit = sum(t.pnl for t in trades if t.pnl > 0)
    gross_loss = abs(sum(t.pnl for t in trades if t.pnl < 0))

    if gross_loss > 0:
        profit_factor = gross_profit / gross_loss
    elif gross_profit > 0:
        profit_factor = 999.0
    else:
        profit_factor = 0.0

    average_trade = net_profit / total_trades if total_trades > 0 else 0.0
    average_win = (gross_profit / winning_trades) if winning_trades > 0 else 0.0
    average_loss = (gross_loss / losing_trades) if losing_trades > 0 else 0.0
    payoff_ratio = (average_win / average_loss) if average_loss > 0 else (average_win if average_win > 0 else 0.0)

    # Expectancy ($ per trade) = (Win Rate * Avg Win) - (Loss Rate * Avg Loss)
    p_win = winning_trades / total_trades if total_trades > 0 else 0.0
    p_loss = losing_trades / total_trades if total_trades > 0 else 0.0
    expectancy = (p_win * average_win) - (p_loss * average_loss)

    # Max Drawdown
    max_dd = max((ep.drawdown for ep in equity_history), default=0.0)
    max_dd_pct = max((ep.drawdown_pct for ep in equity_history), default=0.0)

    # Consecutive streaks
    max_cons_wins = 0
    max_cons_losses = 0
    cur_wins = 0
    cur_losses = 0
    for t in trades:
        if t.pnl > 0:
            cur_wins += 1
            cur_losses = 0
            if cur_wins > max_cons_wins:
                max_cons_wins = cur_wins
        elif t.pnl < 0:
            cur_losses += 1
            cur_wins = 0
            if cur_losses > max_cons_losses:
                max_cons_losses = cur_losses
        else:
            cur_wins = 0
            cur_losses = 0

    # Sharpe & Sortino calculation from periodic equity returns
    returns: List[float] = []
    downside_returns: List[float] = []
    for i in range(1, len(equity_history)):
        prev_eq = equity_history[i-1].equity
        cur_eq = equity_history[i].equity
        if prev_eq > 0:
            ret = (cur_eq - prev_eq) / prev_eq
            returns.append(ret)
            if ret < 0:
                downside_returns.append(ret)

    sharpe_ratio = 0.0
    sortino_ratio = 0.0
    if len(returns) > 1:
        mean_ret = sum(returns) / len(returns)
        variance = sum((r - mean_ret) ** 2 for r in returns) / (len(returns) - 1)
        std_dev = math.sqrt(variance) if variance > 0 else 0.0

        if std_dev > 0:
            ann_factor = math.sqrt(config.annualization_factor)
            rf_periodic = config.risk_free_rate / config.annualization_factor
            sharpe_ratio = ((mean_ret - rf_periodic) / std_dev) * ann_factor

        if len(downside_returns) > 1:
            downside_var = sum(r ** 2 for r in downside_returns) / len(downside_returns)
            downside_dev = math.sqrt(downside_var) if downside_var > 0 else 0.0
            if downside_dev > 0:
                sortino_ratio = ((mean_ret - rf_periodic) / downside_dev) * math.sqrt(config.annualization_factor)

    # Calmar Ratio = Annualized Return / Max Drawdown Pct
    calmar_ratio = 0.0
    if max_dd_pct > 0 and len(equity_history) > 1:
        years = len(equity_history) / max(config.annualization_factor, 1)
        if years > 0 and ending_eq > 0:
            cagr = ((ending_eq / initial_cap) ** (1.0 / max(years, 0.01)) - 1.0) * 100.0
            calmar_ratio = cagr / max_dd_pct

    total_bars_in_market = sum(t.holding_period_bars for t in trades)
    exposure_pct = (total_bars_in_market / max(total_bars, 1)) * 100.0 if total_bars > 0 else 0.0

    return PerformanceMetrics(
        initial_capital=round(initial_cap, 2),
        ending_equity=round(ending_eq, 2),
        net_profit=round(net_profit, 2),
        net_profit_pct=round(net_profit_pct, 2),
        total_trades=total_trades,
        winning_trades=winning_trades,
        losing_trades=losing_trades,
        win_rate=round(win_rate, 2),
        profit_factor=round(profit_factor, 2),
        expectancy=round(expectancy, 2),
        average_trade=round(average_trade, 2),
        average_win=round(average_win, 2),
        average_loss=round(average_loss, 2),
        payoff_ratio=round(payoff_ratio, 2),
        max_drawdown=round(max_dd, 2),
        max_drawdown_pct=round(max_dd_pct, 2),
        sharpe_ratio=round(sharpe_ratio, 2),
        sortino_ratio=round(sortino_ratio, 2),
        calmar_ratio=round(calmar_ratio, 2),
        max_consecutive_wins=max_cons_wins,
        max_consecutive_losses=max_cons_losses,
        exposure_pct=round(exposure_pct, 2)
    )
