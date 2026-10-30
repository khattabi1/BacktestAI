'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Share2,
  Copy,
  Check,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Code2,
  Layers,
  BarChart3,
  Calendar,
  Lock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Download,
} from 'lucide-react';

interface StrategyPublicData {
  slug: string;
  name: string;
  author: {
    name: string;
    username: string;
    avatar: string;
    verified: boolean;
  };
  symbol: string;
  timeframe: string;
  dateRange: string;
  verifiedHash: string;
  description: string;
  engine: 'Python Polars' | 'MQL5 EA' | 'C++ SIMD';
  metrics: {
    sharpeRatio: number;
    netProfit: string;
    netProfitPct: string;
    maxDrawdownPct: string;
    winRatePct: string;
    profitFactor: number;
    totalTrades: number;
    avgTradeSec: string;
  };
  parameters: {
    name: string;
    value: string | number;
    description: string;
  }[];
  equityCurve: { x: number; y: number }[];
  recentTrades: {
    id: string;
    time: string;
    type: 'LONG' | 'SHORT';
    entry: string;
    exit: string;
    pnl: string;
    pnlPct: string;
    isWin: boolean;
  }[];
}

const PUBLIC_STRATEGIES: Record<string, StrategyPublicData> = {
  'sma-trend-momentum': {
    slug: 'sma-trend-momentum',
    name: 'Dual Moving Average Trend Momentum',
    author: {
      name: 'Dr. Tariq Khattak',
      username: 'khattak_quant',
      avatar: 'TK',
      verified: true,
    },
    symbol: 'EURUSD',
    timeframe: '1-Hour (H1)',
    dateRange: 'Jan 2022 — Present (4.5 Years)',
    verifiedHash: '0x8f2a...c94e (SHA-256 Invariant Match)',
    description:
      'A vectorized trend-following model utilizing 9-period and 21-period exponential moving averages with ATR-based volatility band sizing and strict dynamic trailing stops.',
    engine: 'Python Polars',
    metrics: {
      sharpeRatio: 2.14,
      netProfit: '+$42,850.00',
      netProfitPct: '+42.85%',
      maxDrawdownPct: '7.42%',
      winRatePct: '61.4%',
      profitFactor: 2.38,
      totalTrades: 384,
      avgTradeSec: '18h 42m',
    },
    parameters: [
      { name: 'Fast EMA', value: 9, description: 'Short-term momentum period' },
      { name: 'Slow EMA', value: 21, description: 'Long-term baseline trend filter' },
      { name: 'ATR Multiplier', value: 2.0, description: 'Dynamic trailing stop distance' },
      { name: 'Risk per Trade', value: '1.0%', description: 'Fractional Kelly sizing' },
    ],
    equityCurve: [
      { x: 0, y: 100000 },
      { x: 10, y: 103200 },
      { x: 20, y: 101800 },
      { x: 30, y: 108400 },
      { x: 40, y: 112100 },
      { x: 50, y: 110900 },
      { x: 60, y: 119400 },
      { x: 70, y: 124800 },
      { x: 80, y: 128200 },
      { x: 90, y: 135400 },
      { x: 100, y: 142850 },
    ],
    recentTrades: [
      {
        id: 'TR-384',
        time: '2026-10-04 14:00',
        type: 'LONG',
        entry: '1.08420',
        exit: '1.08940',
        pnl: '+$520.00',
        pnlPct: '+0.48%',
        isWin: true,
      },
      {
        id: 'TR-383',
        time: '2026-10-02 09:00',
        type: 'SHORT',
        entry: '1.09110',
        exit: '1.08650',
        pnl: '+$460.00',
        pnlPct: '+0.42%',
        isWin: true,
      },
      {
        id: 'TR-382',
        time: '2026-09-29 16:00',
        type: 'LONG',
        entry: '1.08300',
        exit: '1.08150',
        pnl: '-$150.00',
        pnlPct: '-0.14%',
        isWin: false,
      },
      {
        id: 'TR-381',
        time: '2026-09-26 11:00',
        type: 'LONG',
        entry: '1.07920',
        exit: '1.08550',
        pnl: '+$630.00',
        pnlPct: '+0.58%',
        isWin: true,
      },
    ],
  },
  'order-flow-imbalance-sweep': {
    slug: 'order-flow-imbalance-sweep',
    name: 'Order Flow Imbalance Sweep',
    author: {
      name: 'Alpha Quant Desk',
      username: 'alpha_desk',
      avatar: 'AQ',
      verified: true,
    },
    symbol: 'NQ_FUTURES',
    timeframe: '1-Minute (M1)',
    dateRange: 'Jan 2023 — Present',
    verifiedHash: '0x3d7b...e19a (SHA-256 Invariant Match)',
    description:
      'High-frequency microstructure model capturing liquidity sweeps outside value areas with CME Market By Order (MBO) order-book depth analytics.',
    engine: 'C++ SIMD',
    metrics: {
      sharpeRatio: 2.82,
      netProfit: '+$89,400.00',
      netProfitPct: '+89.40%',
      maxDrawdownPct: '4.85%',
      winRatePct: '68.2%',
      profitFactor: 3.12,
      totalTrades: 940,
      avgTradeSec: '4m 12s',
    },
    parameters: [
      { name: 'Imbalance Threshold', value: '3.5x', description: 'Volume ratio bid/ask exhaustion' },
      { name: 'Lookback Window', value: 30, description: 'Minute order flow aggregation' },
      { name: 'Tick Offset', value: 8, description: 'Limit fill bracket depth' },
      { name: 'Fixed Risk', value: '$750', description: 'Hard stop per contract' },
    ],
    equityCurve: [
      { x: 0, y: 100000 },
      { x: 20, y: 114000 },
      { x: 40, y: 128500 },
      { x: 60, y: 149000 },
      { x: 80, y: 168200 },
      { x: 100, y: 189400 },
    ],
    recentTrades: [
      {
        id: 'TR-940',
        time: '2026-10-05 10:24',
        type: 'LONG',
        entry: '20,410.25',
        exit: '20,432.50',
        pnl: '+$445.00',
        pnlPct: '+0.11%',
        isWin: true,
      },
      {
        id: 'TR-939',
        time: '2026-10-05 09:48',
        type: 'SHORT',
        entry: '20,450.00',
        exit: '20,422.00',
        pnl: '+$560.00',
        pnlPct: '+0.14%',
        isWin: true,
      },
    ],
  },
};

export default function PublicStrategySharePage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || 'sma-trend-momentum';

  const strategy = PUBLIC_STRATEGIES[slug] || PUBLIC_STRATEGIES['sma-trend-momentum'];
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDuplicate = () => {
    // Navigate to app strategies with strategy imported
    router.push(`/app/strategies?import=${strategy.slug}`);
  };

  // Min and max for equity curve SVG normalization
  const minEquity = Math.min(...strategy.equityCurve.map((p) => p.y)) * 0.98;
  const maxEquity = Math.max(...strategy.equityCurve.map((p) => p.y)) * 1.02;

  const points = strategy.equityCurve
    .map((p) => {
      const x = p.x * 7;
      const y = 200 - ((p.y - minEquity) / (maxEquity - minEquity)) * 180;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="min-h-screen bg-[#080B10] text-slate-100 flex flex-col font-sans selection:bg-cyan-accent/25 selection:text-cyan-accent">
      {/* Top Navigation */}
      <header className="h-14 border-b border-[#202A38] bg-[#0A0E15]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        <Link href="/" className="flex items-center gap-2 text-xs font-semibold tracking-tight text-slate-100">
          <span className="w-2.5 h-2.5 rounded bg-cyan-accent" />
          <span>BACKTEST<span className="text-cyan-accent">-SI</span></span>
          <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-[#111722] border border-[#202A38] text-slate-400">
            PUBLIC STRATEGY CARD
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111722] hover:bg-[#182030] text-xs font-medium text-slate-300 border border-[#202A38] transition-colors min-h-[38px]"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden xs:inline">{copied ? 'Link Copied' : 'Share Card'}</span>
          </button>

          <Link
            href="/login"
            className="px-3.5 py-1.5 rounded-lg bg-cyan-accent text-[#080B10] text-xs font-bold font-mono hover:bg-cyan-accent/90 transition-colors min-h-[38px] flex items-center justify-center"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Verification Banner */}
        <div className="p-3.5 rounded-xl bg-cyan-accent/[0.04] border border-cyan-accent/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-cyan-accent/10 border border-cyan-accent/30 flex items-center justify-center text-cyan-accent shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-semibold text-slate-200">Zero Look-Ahead Bias Verified (&Delta;&tau; = 0)</span>
              <span className="text-slate-400 block text-[11px] font-mono mt-0.5">
                Deterministic hash: {strategy.verifiedHash} • Computed on Polars SIMD Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              PBO &lt; 5.0% PASS
            </span>
          </div>
        </div>

        {/* Strategy Header Card */}
        <div className="p-6 rounded-2xl bg-[#0A0E15] border border-[#202A38] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#111722] text-cyan-accent border border-cyan-accent/30">
                  {strategy.symbol}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-[#111722] border border-[#202A38]">
                  {strategy.timeframe}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-[#111722] border border-[#202A38]">
                  {strategy.engine}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">{strategy.name}</h1>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">{strategy.description}</p>
            </div>

            <div className="flex flex-col sm:items-end gap-2 shrink-0 w-full sm:w-auto">
              <button
                onClick={handleDuplicate}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-cyan-accent text-[#080B10] font-bold font-mono text-xs hover:bg-cyan-accent/90 transition-all shadow-hud"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Duplicate to Workspace</span>
              </button>
              <span className="text-[10px] font-mono text-slate-500 text-center sm:text-right">Free 1-click clone into your research IDE</span>
            </div>
          </div>

          {/* Author Strip */}
          <div className="pt-4 border-t border-[#1C2636] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#111722] border border-cyan-accent/30 flex items-center justify-center font-mono font-bold text-xs text-cyan-accent">
                {strategy.author.avatar}
              </div>
              <div>
                <span className="font-semibold text-slate-200">{strategy.author.name}</span>
                <span className="text-[11px] text-slate-500 font-mono ml-2">@{strategy.author.username}</span>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{strategy.dateRange}</span>
            </div>
          </div>
        </div>

        {/* Executive KPI Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div className="p-4 rounded-xl bg-[#0A0E15] border border-[#202A38]">
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Sharpe Ratio</span>
            <div className="mt-1 text-2xl font-bold text-emerald-400">{strategy.metrics.sharpeRatio.toFixed(2)}</div>
            <span className="text-[10px] text-slate-400">Risk-Adjusted Alpha</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0A0E15] border border-[#202A38]">
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Net Return</span>
            <div className="mt-1 text-2xl font-bold text-slate-100">{strategy.metrics.netProfitPct}</div>
            <span className="text-[10px] text-emerald-400">{strategy.metrics.netProfit}</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0A0E15] border border-[#202A38]">
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Max Drawdown</span>
            <div className="mt-1 text-2xl font-bold text-rose-400">{strategy.metrics.maxDrawdownPct}</div>
            <span className="text-[10px] text-slate-400">Peak-to-Trough DD</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0A0E15] border border-[#202A38]">
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Win Rate</span>
            <div className="mt-1 text-2xl font-bold text-cyan-accent">{strategy.metrics.winRatePct}</div>
            <span className="text-[10px] text-slate-400">PF: {strategy.metrics.profitFactor} ({strategy.metrics.totalTrades} trades)</span>
          </div>
        </div>

        {/* Equity Curve Preview Card */}
        <div className="p-6 rounded-2xl bg-[#0A0E15] border border-[#202A38] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-accent" />
              <h2 className="text-sm font-semibold text-slate-200">Verified Equity Growth Curve</h2>
            </div>
            <span className="text-xs font-mono text-emerald-400">{strategy.metrics.netProfitPct} Gain</span>
          </div>

          {/* SVG Equity Line */}
          <div className="w-full h-52 relative flex items-center justify-center bg-[#0D1118]/60 rounded-xl border border-[#1A2332] p-4 overflow-hidden">
            <svg viewBox="0 0 700 200" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <polyline
                fill="none"
                stroke="#22D3EE"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />
            </svg>
            <div className="absolute bottom-2 left-4 text-[10px] font-mono text-slate-500">
              Start: $100,000.00
            </div>
            <div className="absolute top-2 right-4 text-[10px] font-mono text-emerald-400">
              Final: $142,850.00
            </div>
          </div>
        </div>

        {/* Two-Column Grid: Parameters & Recent Executions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Parameter Schema */}
          <div className="p-5 rounded-2xl bg-[#0A0E15] border border-[#202A38] space-y-4">
            <div className="flex items-center gap-2 border-b border-[#202A38] pb-3">
              <Layers className="w-4 h-4 text-cyan-accent" />
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                Strategy Parameter Matrix
              </h3>
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              {strategy.parameters.map((param, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-[#111722]/60 border border-[#1C2636] flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-slate-200 block">{param.name}</span>
                    <span className="text-[10px] text-slate-500">{param.description}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-[#0A0E15] border border-[#202A38] text-cyan-accent font-bold">
                    {param.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Sample Trade Blotter */}
          <div className="p-5 rounded-2xl bg-[#0A0E15] border border-[#202A38] space-y-4">
            <div className="flex items-center justify-between border-b border-[#202A38] pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                  Sample Executions
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Last 4 executions</span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              {strategy.recentTrades.map((t) => (
                <div
                  key={t.id}
                  className="p-2.5 rounded-lg bg-[#111722]/60 border border-[#1C2636] flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        t.type === 'LONG'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {t.type}
                    </span>
                    <div>
                      <span className="text-slate-300 font-medium block">
                        {t.entry} &rarr; {t.exit}
                      </span>
                      <span className="text-[10px] text-slate-500">{t.time}</span>
                    </div>
                  </div>

                  <span className={`font-bold ${t.isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {t.pnl}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom CTA Banner */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-[#0D131F] via-[#0A0E15] to-[#0D131F] border border-cyan-accent/30 text-center space-y-4 shadow-hud">
          <h3 className="text-lg sm:text-xl font-bold text-slate-100">
            Want to backtest or optimize this strategy on tick data?
          </h3>
          <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
            Duplicate this algorithmic model into your BacktestAI workspace. Run 1,000-path Monte Carlo simulations, synthesize variants with Claude Opus 5.5, or export native MQL5 Expert Advisors.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <button
              onClick={handleDuplicate}
              className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl bg-cyan-accent text-[#080B10] font-bold font-mono text-xs hover:bg-cyan-accent/90 transition-all shadow-hud flex items-center justify-center cursor-pointer"
            >
              Duplicate Strategy Now
            </button>
            <Link
              href="/signup"
              className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl bg-[#111722] hover:bg-[#182030] text-slate-200 font-medium text-xs border border-[#202A38] transition-all flex items-center justify-center text-center cursor-pointer"
            >
              Create Free Account
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#202A38] py-6 px-6 text-center text-xs text-slate-500 font-mono">
        BacktestAI Deterministic Simulation Network • All results verified against local zero-lookahead tick datasets.
      </footer>
    </div>
  );
}
