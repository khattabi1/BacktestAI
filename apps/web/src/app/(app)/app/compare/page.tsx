'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GitCompare,
  TrendingUp,
  TrendingDown,
  Shield,
  Activity,
  Layers,
  ArrowRight,
  Sparkles,
  Check,
  BarChart3,
  RefreshCw,
  Terminal,
  Play,
} from 'lucide-react';

interface RawStrategy {
  id: string;
  name: string;
  created_at?: string;
  code?: string;
}

interface BacktestRunSummary {
  id: string;
  strategy_id: string;
  strategy_name: string;
  version_num?: number;
  symbol: string;
  timeframe: string;
  status: string;
  config: {
    initial_capital?: number;
    leverage?: number;
    commission_per_order?: number;
    slippage_points?: number;
  };
  metrics?: {
    initial_capital?: number;
    ending_equity?: number;
    net_profit?: number;
    net_profit_pct?: number;
    total_trades?: number;
    winning_trades?: number;
    losing_trades?: number;
    win_rate?: number;
    profit_factor?: number;
    expectancy?: number;
    average_trade?: number;
    average_win?: number;
    average_loss?: number;
    payoff_ratio?: number;
    max_drawdown?: number;
    max_drawdown_pct?: number;
    sharpe_ratio?: number;
    sortino_ratio?: number;
    calmar_ratio?: number;
    exposure_pct?: number;
  } | null;
  created_at: string;
  start_date?: string;
  end_date?: string;
  equity_curve?: { timestamp: string; balance: number; equity: number; drawdown: number; drawdown_pct: number }[];
  trades?: any[];
}

export interface ComparedStrategy {
  id: string;
  strategyName: string;
  cleanName: string;
  letter: string;
  color: string;
  colorHex: string;
  bestRun: {
    id: string;
    versionNum: number;
    symbol: string;
    timeframe: string;
    startDate?: string;
    endDate?: string;
    createdAt: string;
    allRunsCount: number;
  };
  netProfit: number;
  netProfitPct: number;
  cagr: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  winRate: number;
  profitFactor: number;
  payoffRatio: number;
  maxDrawdownPct: number;
  maxDrawdown: number;
  totalTrades: number;
  expectancy: number;
  exposurePct: number;
  curve: number[];
  avgWin: number;
  avgLoss: number;
  durationDays: number;
}

const COLOR_PALETTE = [
  { color: 'text-cyan-accent', colorHex: '#22D3EE' },
  { color: 'text-emerald-edge', colorHex: '#22C55E' },
  { color: 'text-violet-ai', colorHex: '#A855F7' },
  { color: 'text-amber-400', colorHex: '#FBBF24' },
  { color: 'text-rose-400', colorHex: '#FB7185' },
  { color: 'text-sky-400', colorHex: '#38BDF8' },
];

export default function StrategyComparisonPage() {
  const router = useRouter();
  const [strategies, setStrategies] = useState<RawStrategy[]>([]);
  const [backtestRuns, setBacktestRuns] = useState<BacktestRunSummary[]>([]);
  const [detailedRuns, setDetailedRuns] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStrategyIds, setSelectedStrategyIds] = useState<string[]>([]);

  // Interactive 3D Perspective Tilt on Benchmark Vector Art
  const [artTilt, setArtTilt] = useState<{ x: number; y: number; isHovered: boolean }>({ x: 0, y: 0, isHovered: false });

  const handleArtMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    setArtTilt({ x: relX * 18, y: -relY * 18, isHovered: true });
  }, []);

  const handleArtMouseLeave = useCallback(() => {
    setArtTilt({ x: 0, y: 0, isHovered: false });
  }, []);

  // Fetch all strategies and raw backtest runs from API
  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Strategies
      let rawStrats: RawStrategy[] = [];
      try {
        const resStrats = await fetch('/api/v1/strategies', { headers: { Accept: 'application/json' } });
        if (resStrats.ok) rawStrats = await resStrats.json();
      } catch {
        const resStrats2 = await fetch('/api/v1/strategies', { headers: { Accept: 'application/json' } });
        if (resStrats2.ok) rawStrats = await resStrats2.json();
      }
      setStrategies(Array.isArray(rawStrats) ? rawStrats : []);

      // 2. Fetch Backtests
      let rawRuns: BacktestRunSummary[] = [];
      try {
        const resRuns = await fetch('/api/v1/backtests?limit=100', { headers: { Accept: 'application/json' } });
        if (resRuns.ok) rawRuns = await resRuns.json();
      } catch {
        const resRuns2 = await fetch('/api/v1/backtests?limit=100', { headers: { Accept: 'application/json' } });
        if (resRuns2.ok) rawRuns = await resRuns2.json();
      }
      setBacktestRuns(Array.isArray(rawRuns) ? rawRuns : []);

      // 3. Identify best runs per strategy and fetch their detailed telemetry
      if (Array.isArray(rawRuns) && rawRuns.length > 0) {
        // Group runs by strategy
        const runsByStrategy: Record<string, BacktestRunSummary[]> = {};
        for (const r of rawRuns) {
          const m = r.metrics;
          // Filter out runs with no metrics or 0 trades
          if (!m || (m.total_trades || 0) === 0) continue;
          const sKey = (r.strategy_name || r.strategy_id || 'unknown').replace(/\.[^/.]+$/, '').trim().toLowerCase();
          if (!runsByStrategy[sKey]) runsByStrategy[sKey] = [];
          runsByStrategy[sKey].push(r);
        }

        // For each strategy, find the run with the peak return
        const bestRunIds: string[] = [];
        for (const sKey of Object.keys(runsByStrategy)) {
          const sRuns = runsByStrategy[sKey];
          sRuns.sort((a, b) => {
            const aNet = a.metrics?.net_profit_pct ?? a.metrics?.net_profit ?? -9999;
            const bNet = b.metrics?.net_profit_pct ?? b.metrics?.net_profit ?? -9999;
            if (bNet !== aNet) return bNet - aNet;
            const aPf = a.metrics?.profit_factor ?? 0;
            const bPf = b.metrics?.profit_factor ?? 0;
            if (bPf !== aPf) return bPf - aPf;
            return (b.metrics?.sharpe_ratio ?? 0) - (a.metrics?.sharpe_ratio ?? 0);
          });
          if (sRuns[0]) {
            bestRunIds.push(sRuns[0].id);
          }
        }

        // Fetch details for best runs
        const detailsMap: Record<string, any> = {};
        await Promise.all(
          bestRunIds.map(async (runId) => {
            try {
              let dRes = await fetch(`/api/v1/backtests/${encodeURIComponent(runId)}`);
              if (!dRes.ok) dRes = await fetch(`/api/v1/backtests/${encodeURIComponent(runId)}`);
              if (dRes.ok) {
                const detail = await dRes.json();
                detailsMap[runId] = detail;
              }
            } catch {}
          })
        );
        setDetailedRuns((prev) => ({ ...prev, ...detailsMap }));
      }
    } catch (err) {
      console.warn('[Compare] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Transform raw data: Group by STRATEGY, take the BEST return test of any version, exclude 0-trade strategies
  const comparedStrategies: ComparedStrategy[] = useMemo(() => {
    if (backtestRuns.length === 0) return [];

    // Map strategies by clean name
    const stratNameMap: Record<string, RawStrategy> = {};
    for (const s of strategies) {
      const clean = s.name.replace(/\.[^/.]+$/, '').trim().toLowerCase();
      stratNameMap[clean] = s;
    }

    // Group runs by strategy
    const runsByStrategy: Record<string, { stratName: string; stratId: string; runs: BacktestRunSummary[] }> = {};

    for (const r of backtestRuns) {
      const rawName = r.strategy_name || r.strategy_id || 'unknown';
      const clean = rawName.replace(/\.[^/.]+$/, '').trim();
      const cleanKey = clean.toLowerCase();

      // Check if run has real trades (exclude runs with 0 trades or null metrics)
      const m = r.metrics;
      const tradeCount = m?.total_trades ?? 0;
      if (!m || tradeCount <= 0) {
        continue; // Discard 0-trade tests
      }

      if (!runsByStrategy[cleanKey]) {
        const matchingStrat = stratNameMap[cleanKey];
        runsByStrategy[cleanKey] = {
          stratName: clean,
          stratId: matchingStrat ? matchingStrat.id : cleanKey,
          runs: [],
        };
      }
      runsByStrategy[cleanKey].runs.push(r);
    }

    // For each valid strategy with > 0 trade tests, pick the single BEST-performing run across any version
    const validStratKeys = Object.keys(runsByStrategy);
    const result: ComparedStrategy[] = [];

    validStratKeys.forEach((sKey, idx) => {
      const group = runsByStrategy[sKey];
      const sRuns = group.runs;
      if (sRuns.length === 0) return;

      // Sort by best return
      sRuns.sort((a, b) => {
        const aNet = a.metrics?.net_profit_pct ?? a.metrics?.net_profit ?? -9999;
        const bNet = b.metrics?.net_profit_pct ?? b.metrics?.net_profit ?? -9999;
        if (bNet !== aNet) return bNet - aNet;
        const aPf = a.metrics?.profit_factor ?? 0;
        const bPf = b.metrics?.profit_factor ?? 0;
        if (bPf !== aPf) return bPf - aPf;
        return (b.metrics?.sharpe_ratio ?? 0) - (a.metrics?.sharpe_ratio ?? 0);
      });

      const bestRun = sRuns[0];
      const detail = detailedRuns[bestRun.id] || bestRun;
      const m = detail.metrics || bestRun.metrics || {};
      const trades: any[] = detail.trades || [];

      const initialCapital = m.initial_capital || bestRun.config?.initial_capital || 10000;
      const endingEquity = m.ending_equity || (initialCapital + (m.net_profit ?? 0));
      const netProfit = m.net_profit ?? (endingEquity - initialCapital);
      const netProfitPct = m.net_profit_pct ?? (initialCapital > 0 ? (netProfit / initialCapital) * 100 : 0);

      // Real trades analysis
      const winningTrades = trades.filter((t) => (t.pnl ?? 0) > 0);
      const losingTrades = trades.filter((t) => (t.pnl ?? 0) < 0);
      const totalTrades = trades.length > 0 ? trades.length : (m.total_trades ?? 0);
      const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : (m.win_rate ?? 0);

      const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (m.profit_factor ?? (grossProfit > 0 ? 99 : 0));

      const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : (m.average_win ?? 0);
      const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : (m.average_loss ?? 0);
      const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : (m.payoff_ratio ?? 0);

      const expectancy = totalTrades > 0 ? trades.reduce((sum, t) => sum + (t.pnl || 0), 0) / totalTrades : (m.expectancy ?? 0);

      const maxDrawdownPct = m.max_drawdown_pct ?? 0;
      const maxDrawdown = (m.max_drawdown && m.max_drawdown > 0)
        ? m.max_drawdown
        : (initialCapital * maxDrawdownPct) / 100;

      // Authentic duration & CAGR
      let durationDays = 365;
      const sDate = detail.start_date || (trades.length > 0 && trades[0]?.entry_time);
      const eDate = detail.end_date || (trades.length > 0 && trades[trades.length - 1]?.exit_time);
      let spanMs = 1;
      if (sDate && eDate) {
        const tStart = new Date(sDate).getTime();
        const tEnd = new Date(eDate).getTime();
        if (!isNaN(tStart) && !isNaN(tEnd) && tEnd > tStart) {
          spanMs = tEnd - tStart;
          durationDays = Math.max(spanMs / (1000 * 60 * 60 * 24), 1);
        }
      }
      const durationYears = Math.max(durationDays / 365.25, 0.05);
      const cagr = Number((((1 + netProfitPct / 100) ** (1 / durationYears) - 1) * 100).toFixed(2));

      // Authentic Market Exposure
      let totalMarketMs = 0;
      for (const tr of trades) {
        if (tr.entry_time && tr.exit_time) {
          const t1 = new Date(tr.entry_time).getTime();
          const t2 = new Date(tr.exit_time).getTime();
          if (t2 > t1) totalMarketMs += (t2 - t1);
        }
      }
      const exposurePct = (m.exposure_pct && m.exposure_pct > 0)
        ? m.exposure_pct
        : spanMs > 1 && totalMarketMs > 0
        ? Math.min(Math.max((totalMarketMs / spanMs) * 100, 0), 100)
        : 0;

      // Authentic Sortino
      const downsideDevReturns = trades
        .filter((t) => (t.pnl ?? 0) < 0)
        .map((t) => ((t.pnl ?? 0) / initialCapital) ** 2);
      const downsideDev = downsideDevReturns.length > 0
        ? Math.sqrt(downsideDevReturns.reduce((sum, v) => sum + v, 0) / Math.max(trades.length, 1))
        : 0;
      const sortino = (m.sortino_ratio && m.sortino_ratio !== 0)
        ? m.sortino_ratio
        : downsideDev > 0
        ? Number(((netProfitPct / 100) / downsideDev).toFixed(2))
        : 0;

      // Authentic Calmar
      const calmar = (m.calmar_ratio && m.calmar_ratio !== 0)
        ? m.calmar_ratio
        : maxDrawdownPct > 0
        ? Number((cagr / maxDrawdownPct).toFixed(2))
        : 0;

      // Normalized Equity Curve
      let curve: number[] = [];
      if (Array.isArray(detail.equity_curve) && detail.equity_curve.length > 0) {
        const baseCap = detail.config?.initial_capital || initialCapital;
        const rawPoints = detail.equity_curve.map((pt: any) =>
          Number((((pt.equity - baseCap) / baseCap) * 100).toFixed(2))
        );
        if (rawPoints.length <= 40) {
          curve = rawPoints;
        } else {
          curve = Array.from({ length: 40 }, (_, i) => {
            const index = Math.min(Math.floor((i / 39) * (rawPoints.length - 1)), rawPoints.length - 1);
            return rawPoints[index];
          });
        }
      } else if (totalTrades > 0) {
        let running = 0;
        curve = [0];
        for (const tr of trades) {
          running += tr.pnl || 0;
          curve.push(Number(((running / initialCapital) * 100).toFixed(2)));
        }
      } else {
        curve = [0, 0];
      }

      const p = COLOR_PALETTE[idx % COLOR_PALETTE.length];
      const letter = String.fromCharCode(65 + (idx % 26));

      result.push({
        id: group.stratId,
        strategyName: group.stratName,
        cleanName: group.stratName,
        letter,
        color: p.color,
        colorHex: p.colorHex,
        bestRun: {
          id: bestRun.id,
          versionNum: bestRun.version_num || 1,
          symbol: bestRun.symbol || 'EURUSD',
          timeframe: bestRun.timeframe || '1h',
          startDate: bestRun.start_date,
          endDate: bestRun.end_date,
          createdAt: bestRun.created_at,
          allRunsCount: sRuns.length,
        },
        netProfit,
        netProfitPct,
        cagr,
        sharpe: m.sharpe_ratio ?? 0,
        sortino,
        calmar,
        winRate,
        profitFactor,
        payoffRatio,
        maxDrawdownPct,
        maxDrawdown,
        totalTrades,
        expectancy,
        exposurePct,
        curve,
        avgWin,
        avgLoss,
        durationDays: Math.round(durationDays),
      });
    });

    return result;
  }, [strategies, backtestRuns, detailedRuns]);

  // Synchronize selection: by default select all valid compared strategies
  useEffect(() => {
    if (comparedStrategies.length > 0) {
      setSelectedStrategyIds((prev) => {
        const validIds = comparedStrategies.map((s) => s.id);
        const retained = prev.filter((id) => validIds.includes(id));
        return retained.length > 0 ? retained : validIds;
      });
    }
  }, [comparedStrategies]);

  const toggleStrategySelection = (id: string) => {
    setSelectedStrategyIds((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((s) => s !== id)
          : prev
        : [...prev, id]
    );
  };

  const selectedStrategies = useMemo(() => {
    return comparedStrategies.filter((s) => selectedStrategyIds.includes(s.id));
  }, [comparedStrategies, selectedStrategyIds]);



  // Dynamic scale calculation from points
  const chartScale = useMemo(() => {
    if (selectedStrategies.length === 0) return { minVal: 0, maxVal: 5, range: 5, zeroY: 195 };
    const allVals = selectedStrategies.flatMap((s) => s.curve);
    const maxVal = Math.max(...allVals, 5);
    const minVal = Math.min(...allVals, 0);
    const range = maxVal - minVal || 1;
    const height = 220;
    const padding = 25;
    const zeroY = height - padding - ((0 - minVal) / range) * (height - 2 * padding);
    return { minVal, maxVal, range, zeroY };
  }, [selectedStrategies]);

  const generateSvgPath = (points: number[]) => {
    if (!points || points.length === 0) return '';
    const width = 800;
    const height = 220;
    const padding = 25;
    const { minVal, range } = chartScale;

    return points
      .map((val, idx) => {
        const x = padding + (idx / Math.max(points.length - 1, 1)) * (width - 2 * padding);
        const y = height - padding - ((val - minVal) / range) * (height - 2 * padding);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const handleOpenInQuantLab = (strat: ComparedStrategy) => {
    try {
      localStorage.setItem('quantlab_active_file', strat.cleanName);
    } catch {}
    router.push(`/app/quant?file=${encodeURIComponent(strat.cleanName)}`);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header Banner with Institutional Benchmark Matrix Isometric Vector Art */}
      <div className="p-4 sm:p-6 md:p-8 rounded-2xl bg-gradient-to-r from-[#0C121D] via-[#0E1524] to-[#0C121D] border border-[#1A2538] shadow-hud flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                comparedStrategies.length > 0 ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
            <span className="text-[11px] sm:text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
              QUANTITATIVE STRATEGY BENCHMARK · {comparedStrategies.length} TESTED STRATEGIES
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-100 tracking-tight">
            Multi-Strategy Comparison Matrix
          </h1>
          <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
            Side-by-side risk-adjusted benchmarking. Compares each strategy by its best verified backtest
            return across all iterations, contrasting risk exposure, drawdown recovery profiles, and equity growth.
          </p>
        </div>

        {/* Meaningful Multi-Strategy Benchmark Vector Art (Interactive 3D Perspective Tilt) */}
        <div
          onMouseMove={handleArtMouseMove}
          onMouseLeave={handleArtMouseLeave}
          className="shrink-0 flex items-center justify-center md:justify-end relative group cursor-pointer select-none"
          style={{ perspective: 1000 }}
          title="Interactive Quantitative Benchmark Matrix"
        >
          <div
            className="transition-transform duration-500 ease-out"
            style={{
              transform: `rotateX(${artTilt.y * 0.6}deg) rotateY(${artTilt.x * 0.6}deg) scale(${artTilt.isHovered ? 1.03 : 1})`,
              transformStyle: 'preserve-3d',
            }}
          >
            <svg
              viewBox="0 0 340 170"
              className="w-56 sm:w-80 md:w-96 lg:w-[400px] h-auto select-none overflow-visible"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Quantitative Multi-Strategy Benchmark & Pareto Frontier"
            >
              <defs>
                <style>{`
                  @keyframes pillarFloatAlpha {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-3.5px); }
                  }
                  @keyframes pillarFloatBeta {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(2.5px); }
                  }
                  @keyframes frontierBreathe {
                    0%, 100% { opacity: 0.55; }
                    50% { opacity: 0.95; }
                  }
                  .anim-pillar-alpha {
                    animation: pillarFloatAlpha 11s ease-in-out infinite;
                  }
                  .anim-pillar-beta {
                    animation: pillarFloatBeta 13s ease-in-out infinite 0.5s;
                  }
                  .anim-frontier {
                    animation: frontierBreathe 8s ease-in-out infinite;
                  }
                `}</style>

                {/* Deep horizon atmospheric haze */}
                <radialGradient id="cmpHaze" cx="50%" cy="75%" r="65%">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.16" />
                  <stop offset="50%" stopColor="#0f172a" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#000" stopOpacity="0" />
                </radialGradient>

                {/* Sweeping Pareto Frontier Continuous Gradient */}
                <linearGradient id="frontierGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
                  <stop offset="30%" stopColor="#818cf8" stopOpacity="0.65" />
                  <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="1" />
                </linearGradient>

                {/* Alpha Pillar (Cyan) Facet Gradients */}
                <linearGradient id="alphaTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#0891b2" stopOpacity="0.75" />
                </linearGradient>
                <linearGradient id="alphaLeftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0c2b45" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#061726" stopOpacity="0.65" />
                </linearGradient>
                <linearGradient id="alphaRightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0e3a5f" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#09253d" stopOpacity="0.75" />
                </linearGradient>

                {/* Beta Pillar (Emerald) Facet Gradients */}
                <linearGradient id="betaTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.75" />
                </linearGradient>
                <linearGradient id="betaLeftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#062e24" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#031812" stopOpacity="0.65" />
                </linearGradient>
                <linearGradient id="betaRightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0a4233" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#05281e" stopOpacity="0.75" />
                </linearGradient>

                {/* Specular Glow Filter */}
                <filter id="softSpecularGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* 1. Deep Atmospheric Horizon Glow */}
              <ellipse cx="170" cy="130" rx="145" ry="38" fill="url(#cmpHaze)" />

              {/* 2. Isometric Risk-Return Coordinate Floor Grid */}
              <g opacity="0.75">
                <polygon
                  points="170,92 290,132 170,166 50,132"
                  fill="#060c16"
                  fillOpacity="0.45"
                  stroke="#1B2B40"
                  strokeWidth="0.9"
                />

                <line x1="80" y1="141" x2="200" y2="102" stroke="#1A293D" strokeWidth="0.6" strokeDasharray="3 3" />
                <line x1="110" y1="149" x2="230" y2="112" stroke="#1A293D" strokeWidth="0.6" strokeDasharray="3 3" />
                <line x1="140" y1="158" x2="260" y2="122" stroke="#1A293D" strokeWidth="0.6" strokeDasharray="3 3" />

                <line x1="130" y1="105" x2="70" y2="125" stroke="#1A293D" strokeWidth="0.6" strokeDasharray="3 3" />
                <line x1="190" y1="115" x2="130" y2="155" stroke="#1A293D" strokeWidth="0.6" strokeDasharray="3 3" />
                <line x1="250" y1="125" x2="190" y2="162" stroke="#1A293D" strokeWidth="0.6" strokeDasharray="3 3" />

                <line x1="170" y1="92" x2="170" y2="166" stroke="#22D3EE" strokeWidth="0.7" strokeOpacity="0.3" strokeDasharray="2 3" />

                {/* Floor Axis Calibrations with Technical Extension Ticks */}
                <line x1="50" y1="132" x2="38" y2="132" stroke="#334155" strokeWidth="0.8" />
                <text x="34" y="135" textAnchor="end" fill="#64748b" fontSize="6.5" fontFamily="monospace" fontWeight="600" letterSpacing="0.8">
                  σ (RISK)
                </text>

                <line x1="290" y1="132" x2="302" y2="132" stroke="#334155" strokeWidth="0.8" />
                <text x="306" y="135" textAnchor="start" fill="#64748b" fontSize="6.5" fontFamily="monospace" fontWeight="600" letterSpacing="0.8">
                  μ (RETURN)
                </text>
              </g>

              {/* 3. The Pareto / Efficient Frontier Hyperbolic Arc (Clean Background Curve) */}
              <g className="anim-frontier">
                <path
                  d="M 52 142 C 86 100, 142 36, 292 20"
                  stroke="url(#frontierGrad)"
                  strokeWidth="1.6"
                  fill="none"
                />

                <line x1="248" y1="23" x2="248" y2="29" stroke="#818CF8" strokeWidth="0.8" strokeOpacity="0.8" />
                <circle cx="248" cy="29" r="1.8" fill="#38BDF8" />

                {/* Distinct Pareto Frontier HUD Badge */}
                <g transform="translate(206, 8)">
                  <rect
                    x="0"
                    y="0"
                    width="84"
                    height="16"
                    rx="3.5"
                    fill="#08101E"
                    fillOpacity="0.95"
                    stroke="#818CF8"
                    strokeWidth="0.8"
                  />
                  <circle cx="8" cy="8" r="2" fill="#818CF8" />
                  <text
                    x="15"
                    y="11"
                    fill="#A5B4FC"
                    fontSize="6.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                    letterSpacing="0.8"
                  >
                    PARETO FRONTIER
                  </text>
                </g>
              </g>

              {/* 4. Model Alpha Pillar (Strategy A) */}
              <g className="anim-pillar-alpha">
                <ellipse cx="118" cy="130" rx="14" ry="5.5" fill="none" stroke="#22D3EE" strokeWidth="0.8" strokeOpacity="0.4" />
                <line x1="118" y1="52" x2="118" y2="130" stroke="#22D3EE" strokeWidth="0.7" strokeDasharray="2 3" strokeOpacity="0.5" />

                <path
                  d="M 104 46 L 118 54 L 118 128 L 104 120 Z"
                  fill="url(#alphaLeftGrad)"
                  stroke="#0284c7"
                  strokeWidth="0.6"
                />
                <path
                  d="M 118 54 L 132 46 L 132 120 L 118 128 Z"
                  fill="url(#alphaRightGrad)"
                  stroke="#38bdf8"
                  strokeWidth="0.8"
                />
                <polygon
                  points="118,38 132,46 118,54 104,46"
                  fill="url(#alphaTopGrad)"
                  stroke="#22D3EE"
                  strokeWidth="1"
                  filter="url(#softSpecularGlow)"
                />
                <circle cx="118" cy="46" r="1.5" fill="#FFFFFF" fillOpacity="0.9" />

                {/* Clean Symmetrical Strategy A Badge */}
                <line x1="98" y1="66.5" x2="104" y2="66.5" stroke="#0EA5E9" strokeWidth="0.8" strokeOpacity="0.7" />
                <g transform="translate(26, 58)">
                  <rect x="0" y="0" width="72" height="17" rx="3.5" fill="#081422" fillOpacity="0.95" stroke="#0ea5e9" strokeWidth="0.75" />
                  <text x="8" y="11.5" fill="#38bdf8" fontSize="7" fontFamily="monospace" fontWeight="bold" letterSpacing="0.8">
                    STRATEGY A
                  </text>
                </g>
              </g>

              {/* 5. Model Beta Pillar (Strategy B) */}
              <g className="anim-pillar-beta">
                <ellipse cx="224" cy="138" rx="15" ry="6" fill="none" stroke="#34D399" strokeWidth="0.8" strokeOpacity="0.4" />
                <line x1="224" y1="76" x2="224" y2="138" stroke="#34D399" strokeWidth="0.7" strokeDasharray="2 3" strokeOpacity="0.5" />

                <path
                  d="M 210 70 L 224 78 L 224 136 L 210 128 Z"
                  fill="url(#betaLeftGrad)"
                  stroke="#059669"
                  strokeWidth="0.6"
                />
                <path
                  d="M 224 78 L 238 70 L 238 128 L 224 136 Z"
                  fill="url(#betaRightGrad)"
                  stroke="#34D399"
                  strokeWidth="0.8"
                />
                <polygon
                  points="224,62 238,70 224,78 210,70"
                  fill="url(#betaTopGrad)"
                  stroke="#34D399"
                  strokeWidth="1"
                  filter="url(#softSpecularGlow)"
                />
                <circle cx="224" cy="70" r="1.5" fill="#FFFFFF" fillOpacity="0.9" />

                {/* Clean Symmetrical Strategy B Badge */}
                <line x1="238" y1="88.5" x2="244" y2="88.5" stroke="#10B981" strokeWidth="0.8" strokeOpacity="0.7" />
                <g transform="translate(244, 80)">
                  <rect x="0" y="0" width="72" height="17" rx="3.5" fill="#061a14" fillOpacity="0.95" stroke="#10b981" strokeWidth="0.75" />
                  <text x="8" y="11.5" fill="#34d399" fontSize="7" fontFamily="monospace" fontWeight="bold" letterSpacing="0.8">
                    STRATEGY B
                  </text>
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* 2. Strategy Comparison Selection Toolbar (Buttons Removed as Requested) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-obsidian-card border border-obsidian-border">
        {/* Strategy Selection Pills: 1 Pill Per Valid Strategy (Using Peak Return Test) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-muted mr-1 shrink-0">
            COMPARE ({selectedStrategies.length}/{comparedStrategies.length}):
          </span>
          {comparedStrategies.map((strat) => {
            const isSelected = selectedStrategyIds.includes(strat.id);
            return (
              <button
                key={strat.id}
                type="button"
                onClick={() => toggleStrategySelection(strat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all border shrink-0 whitespace-nowrap min-h-[36px] ${
                  isSelected
                    ? 'bg-obsidian-sub text-slate-text border-slate-muted/60 shadow-sm'
                    : 'bg-obsidian-base text-slate-muted border-obsidian-border opacity-60 hover:opacity-100'
                }`}
              >
                <span
                  className="w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center text-obsidian-base shrink-0"
                  style={{ backgroundColor: strat.colorHex }}
                >
                  {strat.letter}
                </span>
                <span className="font-semibold">{strat.cleanName}</span>
                <span className="text-[10px] text-slate-400">
                  ({strat.bestRun.symbol} · {strat.bestRun.timeframe.toUpperCase()})
                </span>
                <span className={`text-[10px] font-bold ml-0.5 ${strat.netProfitPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {strat.netProfitPct >= 0 ? '+' : ''}{strat.netProfitPct.toFixed(1)}%
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-cyan-accent ml-1" />}
              </button>
            );
          })}
        </div>

        {comparedStrategies.length > 0 && (
          <div className="text-[10px] sm:text-[11px] font-mono text-slate-400 shrink-0">
            Peak Verified Telemetry ({comparedStrategies.reduce((acc, s) => acc + s.bestRun.allRunsCount, 0)} Total Runs Analyzed)
          </div>
        )}
      </div>

      {/* 3. Loading State */}
      {isLoading && (
        <div className="p-12 text-center rounded-2xl bg-obsidian-card border border-obsidian-border space-y-4">
          <RefreshCw className="w-8 h-8 text-cyan-accent animate-spin mx-auto" />
          <div className="text-sm font-semibold text-slate-text">Loading Strategy Telemetry...</div>
          <p className="text-xs text-slate-muted max-w-md mx-auto">
            Evaluating historical backtest executions and identifying peak-return runs per strategy.
          </p>
        </div>
      )}

      {/* 4. Authentic Empty State (When 0 valid tested strategies exist) */}
      {!isLoading && comparedStrategies.length === 0 && (
        <div className="rounded-2xl bg-obsidian-card border border-obsidian-border p-8 md:p-12 shadow-hud text-center space-y-8">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-cyan-accent/10 border border-cyan-accent/20 flex items-center justify-center text-cyan-accent mx-auto shadow-hud">
              <GitCompare className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-text">No Tested Strategies with Trades Found</h2>
            <p className="text-xs md:text-sm text-slate-subtext leading-relaxed">
              Multi-strategy benchmarking evaluates verified strategies with at least one executed simulation.
              Strategies with 0 completed trades are automatically excluded from comparison.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
            <Link
              href="/app/quant"
              className="p-5 rounded-xl bg-obsidian-sub hover:bg-obsidian-elevated border border-obsidian-border hover:border-cyan-accent/40 transition-all group space-y-2"
            >
              <div className="flex items-center justify-between">
                <Terminal className="w-5 h-5 text-cyan-accent" />
                <ArrowRight className="w-4 h-4 text-slate-muted group-hover:text-cyan-accent group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-sm font-bold text-slate-text group-hover:text-cyan-accent transition-colors">
                Launch Quant Lab
              </h3>
              <p className="text-xs text-slate-subtext">
                Generate and simulate quantitative strategies with natural language AI Copilot and Polars engine.
              </p>
            </Link>

            <Link
              href="/app/strategies"
              className="p-5 rounded-xl bg-obsidian-sub hover:bg-obsidian-elevated border border-obsidian-border hover:border-emerald-edge/40 transition-all group space-y-2"
            >
              <div className="flex items-center justify-between">
                <Layers className="w-5 h-5 text-emerald-edge" />
                <ArrowRight className="w-4 h-4 text-slate-muted group-hover:text-emerald-edge group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-sm font-bold text-slate-text group-hover:text-emerald-edge transition-colors">
                Strategy Library
              </h3>
              <p className="text-xs text-slate-subtext">
                Explore validated algorithmic strategies, inspect code logic, and launch instant simulations.
              </p>
            </Link>
          </div>
        </div>
      )}

      {/* 5. Real Data Mode (When 1 or more valid strategies exist) */}
      {!isLoading && comparedStrategies.length > 0 && (
        <>
          {/* Multi-Curve Equity Progression Overlay: 1 Curve Per Selected Strategy */}
          <div className="rounded-2xl bg-obsidian-card border border-obsidian-border p-5 shadow-hud space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-obsidian-border pb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-text flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-accent" />
                  <span>Comparative Normalized Equity Growth Overlay (%)</span>
                </h2>
                <p className="text-xs text-slate-muted mt-0.5">
                  Overlaying the peak-performance backtest run for each selected strategy from 0.0% capital baseline.
                </p>
              </div>

              {/* Clean Legend: 1 Entry per Unique Strategy */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                {selectedStrategies.map((strat) => (
                  <div key={strat.id} className="flex items-center gap-1.5">
                    <span
                      className="w-3.5 h-3.5 rounded text-[9px] font-bold flex items-center justify-center text-obsidian-base shrink-0"
                      style={{ backgroundColor: strat.colorHex }}
                    >
                      {strat.letter}
                    </span>
                    <span className="text-slate-text font-medium">{strat.cleanName}:</span>
                    <span
                      className="font-bold"
                      style={{ color: strat.netProfitPct >= 0 ? strat.colorHex : '#EF4444' }}
                    >
                      {strat.netProfitPct >= 0 ? '+' : ''}
                      {strat.netProfitPct.toFixed(2)}%
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({strat.bestRun.symbol} · {strat.bestRun.timeframe.toUpperCase()})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic Multi-Line SVG Chart with Verified Math */}
            <div className="relative w-full h-72 bg-obsidian-sub/70 rounded-xl border border-obsidian-border/80 p-3 overflow-hidden flex items-center justify-center">
              <svg viewBox="0 0 800 220" className="w-full h-full preserve-3d" preserveAspectRatio="none">
                {/* Horizontal Grid Lines */}
                <line x1="0" y1="40" x2="800" y2="40" stroke="#202A38" strokeDasharray="4 4" />
                <line x1="0" y1="95" x2="800" y2="95" stroke="#202A38" strokeDasharray="4 4" />
                <line x1="0" y1="150" x2="800" y2="150" stroke="#202A38" strokeDasharray="4 4" />

                {/* Mathematical Dynamic Zero Baseline */}
                <line
                  x1="0"
                  y1={chartScale.zeroY}
                  x2="800"
                  y2={chartScale.zeroY}
                  stroke="#38BDF8"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.8"
                />

                {/* Render selected strategy curves */}
                {selectedStrategies.map((strat) => (
                  <g key={strat.id}>
                    <path
                      d={generateSvgPath(strat.curve)}
                      fill="none"
                      stroke={strat.colorHex}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                ))}
              </svg>

              {/* Y-Axis Value Labels Overlay */}
              <div className="absolute right-4 top-4 text-[10px] font-mono text-slate-400">
                +{chartScale.maxVal.toFixed(1)}%
              </div>
              <div
                className="absolute right-4 text-[10px] font-mono font-bold text-cyan-400"
                style={{ top: `${(chartScale.zeroY / 220) * 100}%`, transform: 'translateY(-50%)' }}
              >
                0.0% Baseline
              </div>
              <div className="absolute right-4 bottom-4 text-[10px] font-mono text-slate-400">
                {chartScale.minVal.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Side-by-Side Institutional KPI Matrix (1 Column Per Strategy) */}
          <div className="rounded-2xl bg-obsidian-card border border-obsidian-border overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 border-b border-obsidian-border bg-obsidian-sub/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h2 className="text-sm font-semibold text-slate-text flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-cyan-accent" />
                  <span>Side-by-Side Strategy Performance Breakdown</span>
                </h2>
                <p className="text-xs text-slate-muted mt-0.5">
                  Direct statistical comparison calculated from the peak verified test of each strategy across all iterations.
                </p>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 self-start sm:self-auto shrink-0">
                {selectedStrategies.length} Strategies Benchmarked
              </span>
            </div>

            {/* Mobile Comparative Cards Stack (< md screens) */}
            <div className="md:hidden divide-y divide-obsidian-border/60">
              {selectedStrategies.map((s) => (
                <div key={s.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-obsidian-base shrink-0"
                        style={{ backgroundColor: s.colorHex }}
                      >
                        {s.letter}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-100 font-mono truncate">{s.cleanName}</h3>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {s.bestRun.symbol} · {s.bestRun.timeframe.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right font-mono shrink-0">
                      <div className={`text-xs font-bold ${s.netProfitPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {s.netProfitPct >= 0 ? '+' : ''}{s.netProfitPct.toFixed(2)}%
                      </div>
                      <div className="text-[10px] text-cyan-accent font-semibold">
                        Sharpe: {s.sharpe ? s.sharpe.toFixed(2) : '0.00'}
                      </div>
                    </div>
                  </div>

                  {/* 3x2 stats grid */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-obsidian-sub/70 border border-obsidian-border/50 text-center font-mono">
                    <div>
                      <div className="text-[9px] text-slate-400">WIN RATE</div>
                      <div className="text-xs font-bold text-slate-200 mt-0.5">{s.winRate.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400">PROFIT FACTOR</div>
                      <div className="text-xs font-bold text-emerald-400 mt-0.5">{s.profitFactor.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400">MAX DD</div>
                      <div className="text-xs font-bold text-rose-400 mt-0.5">-{s.maxDrawdownPct.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400">TRADES</div>
                      <div className="text-xs font-bold text-slate-200 mt-0.5">{s.totalTrades}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400">EXPECTANCY</div>
                      <div className={`text-xs font-bold mt-0.5 ${s.expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${s.expectancy.toFixed(1)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400">EXPOSURE</div>
                      <div className="text-xs font-bold text-slate-200 mt-0.5">{s.exposurePct.toFixed(1)}%</div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenInQuantLab(s)}
                      className="flex-1 py-2 px-3 rounded-lg bg-obsidian-elevated hover:bg-cyan-accent/15 border border-obsidian-border hover:border-cyan-accent/40 text-cyan-300 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>QuantLab</span>
                    </button>
                    <Link
                      href="/app/strategies"
                      className="flex-1 py-2 px-3 rounded-lg bg-obsidian-elevated hover:bg-[#141F30] border border-obsidian-border text-slate-200 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
                    >
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>Explorer</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= md screens) with touch scroll wrapper */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-obsidian-sub text-[10px] uppercase text-slate-muted border-b border-obsidian-border">
                  <tr>
                    <th className="py-3 px-4 font-sans font-semibold text-slate-text w-56">METRIC CATEGORY</th>
                    {selectedStrategies.map((s) => (
                      <th key={s.id} className="py-3 px-4 min-w-[200px]">
                        <div className="flex items-center gap-1.5 font-bold" style={{ color: s.colorHex }}>
                          <span
                            className="w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center text-obsidian-base shrink-0"
                            style={{ backgroundColor: s.colorHex }}
                          >
                            {s.letter}
                          </span>
                          <span className="truncate">{s.cleanName}</span>
                        </div>
                        <div className="text-[10px] text-slate-muted font-normal mt-0.5">
                          {s.bestRun.symbol} · {s.bestRun.timeframe.toUpperCase()} · Peak Run #{s.bestRun.versionNum}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-obsidian-border/50 text-[11px]">
                  {/* Category 1: Returns & Profitability Alpha */}
                  <tr className="bg-obsidian-base/60">
                    <td
                      colSpan={selectedStrategies.length + 1}
                      className="py-1.5 px-4 font-bold text-[10px] text-cyan-accent tracking-wider uppercase"
                    >
                      1. Return & Profitability Alpha
                    </td>
                  </tr>
                  <tr className="hover:bg-obsidian-elevated/40">
                    <td className="py-2.5 px-4 text-slate-muted font-sans font-medium">Net Return (%)</td>
                    {selectedStrategies.map((s) => (
                      <td
                        key={s.id}
                        className={`py-2.5 px-4 font-bold ${
                          s.netProfitPct >= 0 ? 'text-emerald-edge' : 'text-crimson-risk'
                        }`}
                      >
                        {s.netProfitPct >= 0 ? '+' : ''}
                        {s.netProfitPct.toFixed(2)}%
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-obsidian-elevated/40">
                    <td className="py-2.5 px-4 text-slate-muted font-sans font-medium">Net Profit ($)</td>
                    {selectedStrategies.map((s) => (
                      <td key={s.id} className="py-2.5 px-4 text-slate-text font-bold">
                        {s.netProfit >= 0 ? '+' : ''}${s.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-obsidian-elevated/40">
                    <td className="py-2.5 px-4 text-slate-muted font-sans font-medium">CAGR (True Annualized Rate)</td>
                    {selectedStrategies.map((s) => (
                      <td key={s.id} className="py-2.5 px-4 font-semibold text-slate-200">
                        {s.cagr >= 0 ? '+' : ''}{s.cagr.toFixed(2)}% <span className="text-[10px] text-slate-500">({s.durationDays}d)</span>
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-obsidian-elevated/40">
                    <td className="py-2.5 px-4 text-slate-muted font-sans font-medium">Expectancy ($ / Trade)</td>
                    {selectedStrategies.map((s) => (
                      <td key={s.id} className={`py-2.5 px-4 font-semibold ${s.expectancy >= 0 ? 'text-emerald-edge' : 'text-rose-400'}`}>
                        {s.expectancy >= 0 ? '+' : ''}${s.expectancy.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  {/* Category 2: Risk-Adjusted Ratios */}
                  <tr className="bg-obsidian-base/60">
                    <td
                      colSpan={selectedStrategies.length + 1}
                      className="py-1.5 px-4 font-bold text-[10px] text-cyan-accent tracking-wider uppercase"
                    >
                      2. Risk-Adjusted Ratios
                    </td>
                  </tr>
                  <tr className="hover:bg-obsidian-elevated/40">
                    <td className="py-2.5 px-4 text-slate-muted font-sans font-medium">Sharpe Ratio</td>
                    {selectedStrategies.map((s) => (
                      <td key={s.id} className="py-2.5 px-4 font-bold text-cyan-accent text-sm">
                        {s.sharpe ? s.sharpe.toFixed(2) : '0.00'}
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-obsidian-elevated/40">
                    <td className="py-2.5 px-4 text-slate-muted font-sans font-medium">Sortino Ratio</td>
                    {selectedStrategies.map((s) => (
                      <td key={s.id} className="py-2.5 px-4 text-slate-text">
                        {s.sortino !== 0 ? ((s.sortino > 0 ? '+' : '') + s.sortino.toFixed(2)) : 'N/A'}
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-obsidian-elevated/40">
                    <td className="py-2.5 px-4 text-slate-muted font-sans font-medium">Calmar Ratio</td>
                    {selectedStrategies.map((s) => (
                      <td key={s.id} className="py-2.5 px-4 text-slate-text">
                        {s.calmar !== 0 ? ((s.calmar > 0 ? '+' : '') + s.calmar.toFixed(2)) : 'N/A'}
                      </td>
                    ))}
                  </tr>

                  {/* Category 3: Trade Execution & Hit Rate */}
                  <tr className="bg-obsidian-base/60">
                    <td
                      colSpan={selectedStrategies.length + 1}
                      className="py-1.5 px-4 font-bold text-[10px] text-cyan-accent tracking-wider uppercase"
                    >
                      3. Trade Execution & Hit Rate
                    </td>
                  </tr>
                  <tr className="hover:bg-obsidian-elevated/40">
                    <td className="py-2.5 px-4 text-slate-muted font-sans font-medium">Win Rate (%)</td>
                    {selectedStrategies.map((s) => (
                      <td key={s.id} className="py-2.5 px-4 font-bold text-slate-text">
                        {s.winRate.toFixed(1)}%
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-obsidian-elevated/40">
                    <td className="py-2.5 px-4 text-slate-muted font-sans font-medium">Profit Factor</td>
                    {selectedStrategies.map((s) => (
                      <td key={s.id} className="py-2.5 px-4 text-emerald-edge font-semibold">
                        {s.profitFactor > 50 ? '> 50.0' : s.profitFactor.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-obsidian-elevated/40">
                    <td className="py-2.5 px-4 text-slate-muted font-sans font-medium">Payoff Ratio (Win:Loss)</td>
                    {selectedStrategies.map((s) => (
                      <td key={s.id} className="py-2.5 px-4 text-slate-text">
                        {s.payoffRatio > 0 ? `${s.payoffRatio.toFixed(2)} : 1` : 'N/A'}
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-obsidian-elevated/40">
                    <td className="py-2.5 px-4 text-slate-muted font-sans font-medium">Total Executed Trades</td>
                    {selectedStrategies.map((s) => (
                      <td key={s.id} className="py-2.5 px-4 text-slate-text">
                        {s.totalTrades}
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-obsidian-elevated/40">
                    <td className="py-2.5 px-4 text-slate-muted font-sans font-medium">Average Win / Loss</td>
                    {selectedStrategies.map((s) => (
                      <td key={s.id} className="py-2.5 px-4 text-slate-300">
                        <span className="text-emerald-400">+${s.avgWin.toFixed(2)}</span> /{' ' }
                        <span className="text-rose-400">-${s.avgLoss.toFixed(2)}</span>
                      </td>
                    ))}
                  </tr>

                  {/* Category 4: Risk & Drawdown Exposure */}
                  <tr className="bg-obsidian-base/60">
                    <td
                      colSpan={selectedStrategies.length + 1}
                      className="py-1.5 px-4 font-bold text-[10px] text-cyan-accent tracking-wider uppercase"
                    >
                      4. Risk & Drawdown Exposure
                    </td>
                  </tr>
                  <tr className="hover:bg-obsidian-elevated/40">
                    <td className="py-2.5 px-4 text-slate-muted font-sans font-medium">Max Drawdown (%)</td>
                    {selectedStrategies.map((s) => (
                      <td key={s.id} className="py-2.5 px-4 font-bold text-crimson-risk">
                        -{s.maxDrawdownPct.toFixed(2)}%
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-obsidian-elevated/40">
                    <td className="py-2.5 px-4 text-slate-muted font-sans font-medium">Max Drawdown ($)</td>
                    {selectedStrategies.map((s) => (
                      <td key={s.id} className="py-2.5 px-4 text-crimson-risk/80 font-bold">
                        -${s.maxDrawdown.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-obsidian-elevated/40">
                    <td className="py-2.5 px-4 text-slate-muted font-sans font-medium">Market Exposure (%)</td>
                    {selectedStrategies.map((s) => (
                      <td key={s.id} className="py-2.5 px-4 text-slate-text font-semibold">
                        {s.exposurePct.toFixed(1)}%
                      </td>
                    ))}
                  </tr>

                  {/* Category 5: Workspace Action Row */}
                  <tr className="bg-obsidian-sub/80 font-sans">
                    <td className="py-3 px-4 font-semibold text-slate-text">Actions</td>
                    {selectedStrategies.map((s) => (
                      <td key={s.id} className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenInQuantLab(s)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0A121E] hover:bg-cyan-500/10 border border-[#1A2538] hover:border-cyan-500/40 text-cyan-300 text-xs font-medium transition-colors"
                            title="Open strategy code directly in QuantLab"
                          >
                            <Terminal className="w-3 h-3 text-cyan-400" />
                            <span>QuantLab</span>
                          </button>

                          <Link
                            href="/app/strategies"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0A121E] hover:bg-[#141F30] border border-[#1A2538] text-slate-300 text-xs font-medium transition-colors"
                            title="View Strategy in Explorer Studio"
                          >
                            <Layers className="w-3 h-3 text-slate-400" />
                            <span>Explorer</span>
                          </Link>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
