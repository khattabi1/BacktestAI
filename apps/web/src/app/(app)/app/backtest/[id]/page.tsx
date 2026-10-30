'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  Download,
  BookOpen,
  RotateCcw,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronRight,
  Zap,
  Info,
  Maximize2,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import type { Trade, PerformanceMetrics, EquityPoint } from '@backtest-ai/domain';

interface RunDetailPageProps {
  params: { id: string };
}

// Deterministic mock run generator for any backtest run ID
function generateMockRunData(runId: string) {
  const isBtc = runId.includes('BTC') || runId.charCodeAt(runId.length - 1) % 2 === 0;
  const symbol = isBtc ? 'BTCUSDT' : 'EURUSD';
  const strategyName = isBtc ? 'EMA Mean Reversion Cross' : 'SMA Trend Momentum';
  const initialCapital = 100000;

  // Generate 40 trades
  const trades: Trade[] = [];
  let currentBalance = initialCapital;
  const equityCurve: EquityPoint[] = [{
    timestamp: '2026-01-01T00:00:00Z',
    balance: initialCapital,
    equity: initialCapital,
    drawdown: 0,
    drawdownPct: 0,
  }];

  let peakEquity = initialCapital;
  let maxDd = 0;
  let maxDdPct = 0;
  let winCount = 0;

  for (let i = 1; i <= 36; i++) {
    const isLong = (i * 7) % 3 !== 0;
    const isWin = (i * 13) % 5 !== 0;
    const entryPrice = isBtc ? 62000 + (i * 120) : 1.0820 + (i * 0.001);
    const pnl = isWin ? 650 + (i * 45) : -(320 + (i * 25));
    const pnlPct = (pnl / currentBalance) * 100;
    const exitPrice = isLong
      ? entryPrice * (1 + (pnl / 100000))
      : entryPrice * (1 - (pnl / 100000));

    currentBalance += pnl;
    if (currentBalance > peakEquity) peakEquity = currentBalance;
    const dd = peakEquity - currentBalance;
    const ddPct = (dd / peakEquity) * 100;
    if (dd > maxDd) maxDd = dd;
    if (ddPct > maxDdPct) maxDdPct = ddPct;
    if (isWin) winCount++;

    const dateStr = `2026-01-${String(Math.min(28, Math.floor(i * 0.7) + 1)).padStart(2, '0')}T${String((i * 3) % 24).padStart(2, '0')}:00:00Z`;
    const exitDateStr = `2026-01-${String(Math.min(28, Math.floor(i * 0.7) + 1)).padStart(2, '0')}T${String((i * 3 + 2) % 24).padStart(2, '0')}:00:00Z`;

    trades.push({
      tradeId: `TRD-${runId.slice(-4)}-${String(i).padStart(3, '0')}`,
      symbol,
      side: isLong ? 'LONG' : 'SHORT',
      entryTime: dateStr,
      exitTime: exitDateStr,
      entryPrice: Number(entryPrice.toFixed(isBtc ? 2 : 5)),
      exitPrice: Number(exitPrice.toFixed(isBtc ? 2 : 5)),
      quantity: isBtc ? 0.5 : 100000,
      pnl: Number(pnl.toFixed(2)),
      pnlPercent: Number(pnlPct.toFixed(2)),
      commission: 2.0,
      slippage: 1.0,
      exitReason: isWin ? 'TP' : 'SL',
      holdingPeriodBars: 4 + (i % 6),
    });

    equityCurve.push({
      timestamp: exitDateStr,
      balance: Number(currentBalance.toFixed(2)),
      equity: Number(currentBalance.toFixed(2)),
      drawdown: Number(dd.toFixed(2)),
      drawdownPct: Number(ddPct.toFixed(2)),
    });
  }

  const netProfit = currentBalance - initialCapital;
  const netProfitPct = (netProfit / initialCapital) * 100;
  const winRate = (winCount / trades.length) * 100;

  const metrics: PerformanceMetrics = {
    initialCapital,
    endingEquity: Number(currentBalance.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    netProfitPct: Number(netProfitPct.toFixed(2)),
    totalTrades: trades.length,
    winningTrades: winCount,
    losingTrades: trades.length - winCount,
    winRate: Number(winRate.toFixed(1)),
    profitFactor: 2.24,
    expectancy: Number((netProfit / trades.length).toFixed(2)),
    averageTrade: Number((netProfit / trades.length).toFixed(2)),
    averageWin: 1140.5,
    averageLoss: -512.2,
    payoffRatio: 2.22,
    maxDrawdown: Number(maxDd.toFixed(2)),
    maxDrawdownPct: Number(maxDdPct.toFixed(2)),
    sharpeRatio: 2.18,
    sortinoRatio: 3.42,
    calmarRatio: 4.15,
    maxConsecutiveWins: 7,
    maxConsecutiveLosses: 3,
    exposurePct: 16.4,
  };

  return {
    runId,
    symbol,
    strategyName,
    timeframe: '1h',
    createdAt: '2026-02-14 09:30 UTC',
    engineVersion: '1.14.0',
    dataChecksum: 'SHA256:7f9a2b0e...881',
    metrics,
    trades,
    equityCurve,
  };
}

export default function BacktestResultsPage({ params }: RunDetailPageProps) {
  const data = useMemo(() => generateMockRunData(params.id || 'RUN-94821'), [params.id]);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<'equity' | 'underwater'>('equity');
  const [filterReason, setFilterReason] = useState<string>('ALL');

  const filteredTrades = useMemo(() => {
    if (filterReason === 'ALL') return data.trades;
    return data.trades.filter((t) => t.exitReason === filterReason);
  }, [data.trades, filterReason]);

  // Equity SVG Path Generator
  const equityPointsSvg = useMemo(() => {
    if (data.equityCurve.length === 0) return '';
    const minVal = Math.min(...data.equityCurve.map((p) => p.equity));
    const maxVal = Math.max(...data.equityCurve.map((p) => p.equity));
    const range = Math.max(1, maxVal - minVal);
    const width = 800;
    const height = 220;
    const padding = 20;

    return data.equityCurve
      .map((p, idx) => {
        const x = padding + (idx / (data.equityCurve.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((p.equity - minVal) / range) * (height - 2 * padding);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [data.equityCurve]);

  // Underwater Drawdown SVG Path Generator
  const underwaterPointsSvg = useMemo(() => {
    if (data.equityCurve.length === 0) return '';
    const maxDdPct = Math.max(0.1, ...data.equityCurve.map((p) => p.drawdownPct));
    const width = 800;
    const height = 220;
    const padding = 20;

    return data.equityCurve
      .map((p, idx) => {
        const x = padding + (idx / (data.equityCurve.length - 1)) * (width - 2 * padding);
        const y = padding + (p.drawdownPct / maxDdPct) * (height - 2 * padding);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [data.equityCurve]);

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-obsidian-card border border-obsidian-border shadow-hud">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-muted">
            <Link href="/app" className="hover:text-cyan-accent transition-colors">
              Workspace
            </Link>
            <span>/</span>
            <Link href="/app/backtest" className="hover:text-cyan-accent transition-colors">
              Backtests
            </Link>
            <span>/</span>
            <span className="text-cyan-accent font-semibold">{data.runId}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-slate-text tracking-tight">
              {data.strategyName}
            </h1>
            <span className="px-2 py-0.5 rounded bg-cyan-glow text-cyan-accent border border-cyan-accent/30 text-xs font-mono">
              {data.symbol} · {data.timeframe}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-glow text-emerald-edge border border-emerald-edge/30 text-xs font-mono">
              <CheckCircle2 className="w-3 h-3" />
              VERIFIED DETERMINISTIC
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/app/backtest?runId=${data.runId}&symbol=${data.symbol}`}
            className="px-3 py-1.5 rounded-lg bg-obsidian-sub hover:bg-obsidian-elevated border border-obsidian-border text-slate-text text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-accent" />
            <span>Re-run Session</span>
          </Link>

          <Link
            href={`/app/journal?runId=${data.runId}&strategy=${encodeURIComponent(data.strategyName)}`}
            className="px-3 py-1.5 rounded-lg bg-obsidian-sub hover:bg-obsidian-elevated border border-obsidian-border text-slate-text text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <BookOpen className="w-3.5 h-3.5 text-violet-ai" />
            <span>Journal Entry</span>
          </Link>

          <button
            onClick={() => {
              const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(jsonBlob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${data.runId}_forensic_audit.json`;
              a.click();
            }}
            className="px-3 py-1.5 rounded-lg bg-cyan-accent/10 hover:bg-cyan-accent/20 border border-cyan-accent/40 text-cyan-accent text-xs font-medium transition-all shadow-hud flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit JSON</span>
          </button>
        </div>
      </div>

      {/* 2. Institutional Performance Scorecard (8 KPI HUD Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="p-3.5 rounded-xl bg-obsidian-card border border-obsidian-border space-y-1">
          <span className="text-[10px] font-mono text-slate-muted block">NET PROFIT</span>
          <div
            className={`text-base font-bold font-mono ${
              data.metrics.netProfit >= 0 ? 'text-emerald-edge' : 'text-crimson-risk'
            }`}
          >
            {data.metrics.netProfit >= 0 ? '+' : ''}${data.metrics.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] font-mono text-slate-muted block">
            +{data.metrics.netProfitPct}%
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-obsidian-card border border-obsidian-border space-y-1">
          <span className="text-[10px] font-mono text-slate-muted block">SHARPE RATIO</span>
          <div className="text-base font-bold font-mono text-cyan-accent">
            {data.metrics.sharpeRatio}
          </div>
          <span className="text-[10px] font-mono text-slate-muted block">
            Sortino: {data.metrics.sortinoRatio}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-obsidian-card border border-obsidian-border space-y-1">
          <span className="text-[10px] font-mono text-slate-muted block">WIN RATE</span>
          <div className="text-base font-bold font-mono text-slate-text">
            {data.metrics.winRate}%
          </div>
          <span className="text-[10px] font-mono text-slate-muted block">
            {data.metrics.winningTrades}W / {data.metrics.losingTrades}L
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-obsidian-card border border-obsidian-border space-y-1">
          <span className="text-[10px] font-mono text-slate-muted block">PROFIT FACTOR</span>
          <div className="text-base font-bold font-mono text-emerald-edge">
            {data.metrics.profitFactor}
          </div>
          <span className="text-[10px] font-mono text-slate-muted block">
            Payoff: {data.metrics.payoffRatio}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-obsidian-card border border-obsidian-border space-y-1">
          <span className="text-[10px] font-mono text-slate-muted block">MAX DRAWDOWN</span>
          <div className="text-base font-bold font-mono text-crimson-risk">
            -{data.metrics.maxDrawdownPct}%
          </div>
          <span className="text-[10px] font-mono text-slate-muted block">
            -${data.metrics.maxDrawdown.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-obsidian-card border border-obsidian-border space-y-1">
          <span className="text-[10px] font-mono text-slate-muted block">TOTAL TRADES</span>
          <div className="text-base font-bold font-mono text-slate-text">
            {data.metrics.totalTrades}
          </div>
          <span className="text-[10px] font-mono text-slate-muted block">
            Exposure: {data.metrics.exposurePct}%
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-obsidian-card border border-obsidian-border space-y-1">
          <span className="text-[10px] font-mono text-slate-muted block">EXPECTANCY</span>
          <div className="text-base font-bold font-mono text-emerald-edge">
            +${data.metrics.expectancy}
          </div>
          <span className="text-[10px] font-mono text-slate-muted block">Per execution</span>
        </div>

        <div className="p-3.5 rounded-xl bg-obsidian-card border border-obsidian-border space-y-1">
          <span className="text-[10px] font-mono text-slate-muted block">CALMAR RATIO</span>
          <div className="text-base font-bold font-mono text-cyan-accent">
            {data.metrics.calmarRatio}
          </div>
          <span className="text-[10px] font-mono text-slate-muted block">Annualized</span>
        </div>
      </div>

      {/* 3. Interactive Charts (Equity Curve & Underwater Drawdown) */}
      <div className="rounded-2xl bg-obsidian-card border border-obsidian-border p-5 shadow-hud space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-obsidian-border pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveChartTab('equity')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
                activeChartTab === 'equity'
                  ? 'bg-cyan-accent text-obsidian-base font-bold shadow-hud'
                  : 'text-slate-subtext hover:text-slate-text bg-obsidian-sub'
              }`}
            >
              Cumulative Equity Curve ($)
            </button>
            <button
              onClick={() => setActiveChartTab('underwater')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
                activeChartTab === 'underwater'
                  ? 'bg-crimson-risk text-obsidian-base font-bold shadow-hud'
                  : 'text-slate-subtext hover:text-slate-text bg-obsidian-sub'
              }`}
            >
              Underwater Drawdown (%)
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-muted">
            <div>
              Starting:{' '}
              <span className="text-slate-text">${data.metrics.initialCapital.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
            </div>
            <div>
              Ending:{' '}
              <span className="text-emerald-edge">${data.metrics.endingEquity.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
            </div>
          </div>
        </div>

        {/* Dynamic SVG Chart Viewport */}
        <div className="relative w-full h-64 bg-obsidian-sub/70 rounded-xl border border-obsidian-border/80 p-3 overflow-hidden flex items-center justify-center">
          <svg
            viewBox="0 0 800 220"
            className="w-full h-full preserve-3d"
            preserveAspectRatio="none"
          >
            {/* Grid Lines */}
            <line x1="0" y1="55" x2="800" y2="55" stroke="#202A38" strokeDasharray="4 4" />
            <line x1="0" y1="110" x2="800" y2="110" stroke="#202A38" strokeDasharray="4 4" />
            <line x1="0" y1="165" x2="800" y2="165" stroke="#202A38" strokeDasharray="4 4" />

            {activeChartTab === 'equity' ? (
              <>
                {/* Gradient area */}
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d={`${equityPointsSvg} L 780 200 L 20 200 Z`}
                  fill="url(#equityGrad)"
                />
                <path
                  d={equityPointsSvg}
                  fill="none"
                  stroke="#22D3EE"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            ) : (
              <>
                {/* Underwater gradient */}
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity="0.0" />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity="0.3" />
                  </linearGradient>
                </defs>
                <path
                  d={`M 20 20 ${underwaterPointsSvg.replace('M', 'L')} L 780 20 Z`}
                  fill="url(#ddGrad)"
                />
                <path
                  d={underwaterPointsSvg}
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}
          </svg>
        </div>
      </div>

      {/* 4. Trade Execution Ledger & Forensic Autopsy */}
      <div className="rounded-2xl bg-obsidian-card border border-obsidian-border overflow-hidden shadow-sm">
        {/* Table Controls */}
        <div className="p-4 sm:p-5 border-b border-obsidian-border bg-obsidian-sub/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-text flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-cyan-accent" />
              <span>Trade Execution Ledger ({filteredTrades.length} Trades)</span>
            </h2>
            <p className="text-xs text-slate-muted mt-0.5">
              Click any execution row to open forensic slippage, excursion, and risk autopsy.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-muted">Filter Trigger:</span>
            {(['ALL', 'TP', 'SL'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setFilterReason(r)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  filterReason === r
                    ? 'bg-cyan-accent text-obsidian-base font-bold'
                    : 'bg-obsidian-base border border-obsidian-border text-slate-muted hover:text-slate-text'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-obsidian-sub text-[10px] uppercase text-slate-muted border-b border-obsidian-border">
              <tr>
                <th className="py-2.5 px-4">Trade ID</th>
                <th className="py-2.5 px-4">Side</th>
                <th className="py-2.5 px-4">Entry Time & Price</th>
                <th className="py-2.5 px-4">Exit Time & Price</th>
                <th className="py-2.5 px-4 text-center">Holding Bars</th>
                <th className="py-2.5 px-4 text-center">Exit Trigger</th>
                <th className="py-2.5 px-4 text-right">Net PnL ($)</th>
                <th className="py-2.5 px-4 text-right">Return (%)</th>
                <th className="py-2.5 px-4 text-center">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-border/50 text-[11px]">
              {filteredTrades.map((t) => {
                const isWin = t.pnl > 0;
                return (
                  <tr
                    key={t.tradeId}
                    onClick={() => setSelectedTrade(t)}
                    className="hover:bg-obsidian-elevated/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-text group-hover:text-cyan-accent">
                      {t.tradeId}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          t.side === 'LONG'
                            ? 'bg-emerald-glow text-emerald-edge'
                            : 'bg-crimson-glow text-crimson-risk'
                        }`}
                      >
                        {t.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-subtext">
                      <div>${t.entryPrice.toLocaleString('en-US')}</div>
                      <div className="text-[10px] text-slate-muted">{t.entryTime.slice(0, 16).replace('T', ' ')}</div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-subtext">
                      <div>${t.exitPrice.toLocaleString('en-US')}</div>
                      <div className="text-[10px] text-slate-muted">{t.exitTime.slice(0, 16).replace('T', ' ')}</div>
                    </td>
                    <td className="py-2.5 px-4 text-center text-slate-text">
                      {t.holdingPeriodBars} bars
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-obsidian-sub border border-obsidian-border text-slate-subtext">
                        {t.exitReason}
                      </span>
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-semibold ${
                        isWin ? 'text-emerald-edge' : 'text-crimson-risk'
                      }`}
                    >
                      {isWin ? '+' : ''}${t.pnl.toFixed(2)}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right ${
                        isWin ? 'text-emerald-edge' : 'text-crimson-risk'
                      }`}
                    >
                      {isWin ? '+' : ''}{t.pnlPercent.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="text-[10px] text-cyan-accent group-hover:underline flex items-center justify-center gap-0.5 font-sans">
                        <span>Inspect</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Forensic Trade Inspector Modal / Drawer */}
      {selectedTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-obsidian-base/80 backdrop-blur-sm"
            onClick={() => setSelectedTrade(null)}
          />
          <div className="relative w-full max-w-xl bg-obsidian-card border border-obsidian-border rounded-2xl shadow-2xl p-6 z-10 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-obsidian-border pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-text font-mono">
                  {selectedTrade.tradeId}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                    selectedTrade.side === 'LONG'
                      ? 'bg-emerald-glow text-emerald-edge'
                      : 'bg-crimson-glow text-crimson-risk'
                  }`}
                >
                  {selectedTrade.side}
                </span>
                <span className="text-xs font-mono text-slate-muted">
                  {data.symbol}
                </span>
              </div>
              <button
                onClick={() => setSelectedTrade(null)}
                className="p-1 rounded-lg text-slate-muted hover:text-slate-text hover:bg-obsidian-elevated"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Trade Forensic Metrics */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-obsidian-sub border border-obsidian-border">
                <span className="text-slate-muted text-[10px] block">REALIZED PNL</span>
                <span
                  className={`text-lg font-bold ${
                    selectedTrade.pnl > 0 ? 'text-emerald-edge' : 'text-crimson-risk'
                  }`}
                >
                  {selectedTrade.pnl > 0 ? '+' : ''}${selectedTrade.pnl.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-muted block mt-0.5">
                  ({selectedTrade.pnlPercent > 0 ? '+' : ''}{selectedTrade.pnlPercent}%)
                </span>
              </div>

              <div className="p-3 rounded-lg bg-obsidian-sub border border-obsidian-border">
                <span className="text-slate-muted text-[10px] block">EXIT TRIGGER</span>
                <span className="text-lg font-bold text-slate-text block">
                  {selectedTrade.exitReason === 'TP' ? 'Take Profit' : 'Stop Loss'}
                </span>
                <span className="text-[10px] text-slate-muted block mt-0.5">
                  {selectedTrade.holdingPeriodBars} Bars In Market
                </span>
              </div>
            </div>

            {/* Execution Anatomy */}
            <div className="p-4 rounded-xl bg-obsidian-sub/80 border border-obsidian-border space-y-2 text-xs font-mono">
              <div className="text-[10px] uppercase tracking-wider text-slate-muted font-semibold">
                EXECUTION AUDIT TRAIL
              </div>
              <div className="flex items-center justify-between text-slate-subtext">
                <span>Entry Fill:</span>
                <span className="text-slate-text">${selectedTrade.entryPrice} @ {selectedTrade.entryTime}</span>
              </div>
              <div className="flex items-center justify-between text-slate-subtext">
                <span>Exit Fill:</span>
                <span className="text-slate-text">${selectedTrade.exitPrice} @ {selectedTrade.exitTime}</span>
              </div>
              <div className="flex items-center justify-between text-slate-subtext">
                <span>Slippage & Commission:</span>
                <span className="text-slate-text">${selectedTrade.commission + selectedTrade.slippage}</span>
              </div>
              <div className="flex items-center justify-between text-slate-subtext border-t border-obsidian-border pt-1">
                <span>Look-Ahead Verification:</span>
                <span className="text-emerald-edge">PASSED (Strict Next-Open)</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedTrade(null)}
                className="px-4 py-2 rounded-lg bg-obsidian-sub hover:bg-obsidian-elevated border border-obsidian-border text-slate-text text-xs font-medium"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
