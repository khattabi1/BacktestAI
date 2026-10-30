'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  BookOpen,
  Search,
  CheckCircle2,
  XCircle,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Activity,
  ChevronRight,
  Sparkles,
  BarChart3,
  DollarSign,
  Percent,
  Scale,
  Target,
  FileText,
  Save,
  Check,
  RotateCcw,
  ExternalLink,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Briefcase,
} from 'lucide-react';
import { useSessionStore } from '@/stores/sessionStore';
import type { BacktestSession, Trade } from '@backtest-ai/domain';
import { SymbolLogo } from '@/components/common/SymbolLogo';

interface EquityPoint {
  index: number;
  time: string;
  balance: number;
  equity: number;
  pnl: number;
  drawdownPct: number;
  trade?: Trade;
}

/**
 * High-performance Interactive SVG Equity Curve & Underwater Drawdown Chart
 */
function SessionEquityChart({
  points,
  initialCapital,
  currentBalance,
}: {
  points: EquityPoint[];
  initialCapital: number;
  currentBalance: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(750);
  const [viewMode, setChartViewMode] = useState<'equity' | 'underwater'>('equity');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // ResizeObserver for responsive SVG dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(Math.max(260, containerRef.current.clientWidth));
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const width = containerWidth;
  const isSmallScreen = width < 480;
  const height = isSmallScreen ? 220 : 260;
  const padLeft = isSmallScreen ? 48 : 65;
  const padRight = isSmallScreen ? 14 : 25;
  const padTop = 20;
  const padBottom = 30;

  const chartW = Math.max(10, width - padLeft - padRight);
  const chartH = Math.max(10, height - padTop - padBottom);

  const { minVal, maxVal, highWaterMark } = useMemo(() => {
    if (viewMode === 'underwater') {
      let maxDD = 0.5;
      for (const p of points) {
        if (p.drawdownPct > maxDD) maxDD = p.drawdownPct;
      }
      return { minVal: -maxDD * 1.05, maxVal: 0, highWaterMark: 0 };
    }

    let min = initialCapital;
    let max = initialCapital;
    for (const p of points) {
      if (p.balance < min) min = p.balance;
      if (p.balance > max) max = p.balance;
    }
    const span = Math.max(max - min, initialCapital * 0.02);
    return {
      minVal: min - span * 0.05,
      maxVal: max + span * 0.05,
      highWaterMark: max,
    };
  }, [points, viewMode, initialCapital]);

  const getY = useCallback(
    (val: number) => {
      if (maxVal === minVal) return padTop + chartH / 2;
      return padTop + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;
    },
    [maxVal, minVal, chartH, padTop]
  );

  const getX = useCallback(
    (idx: number) => {
      if (points.length <= 1) return padLeft;
      return padLeft + (idx / (points.length - 1)) * chartW;
    },
    [points.length, chartW, padLeft]
  );

  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '' };

    let lPath = '';
    points.forEach((p, idx) => {
      const val = viewMode === 'underwater' ? -p.drawdownPct : p.balance;
      const x = getX(idx);
      const y = getY(val);
      if (idx === 0) {
        lPath += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        lPath += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });

    const baselineY = getY(viewMode === 'underwater' ? 0 : minVal);
    const firstX = getX(0);
    const lastX = getX(points.length - 1);
    const aPath = `${lPath} L ${lastX.toFixed(1)} ${baselineY.toFixed(1)} L ${firstX.toFixed(1)} ${baselineY.toFixed(1)} Z`;

    return { linePath: lPath, areaPath: aPath };
  }, [points, viewMode, getX, getY, minVal]);

  const initBaselineY = getY(viewMode === 'underwater' ? 0 : initialCapital);
  const activePt = hoverIndex !== null && hoverIndex < points.length ? points[hoverIndex] : null;
  const activeX = hoverIndex !== null ? getX(hoverIndex) : 0;
  const activeY =
    activePt && hoverIndex !== null
      ? getY(viewMode === 'underwater' ? -activePt.drawdownPct : activePt.balance)
      : 0;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRel = e.clientX - rect.left;
    const svgX = (xRel / rect.width) * width;
    if (svgX < padLeft || svgX > width - padRight) {
      setHoverIndex(null);
      return;
    }
    const ratio = (svgX - padLeft) / chartW;
    const idx = Math.round(ratio * (points.length - 1));
    setHoverIndex(Math.max(0, Math.min(points.length - 1, idx)));
  };

  const isProfitable = currentBalance >= initialCapital;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#0B101B] border border-[#1A2538] shadow-sm space-y-3 font-mono">
      {/* Chart Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#162133]">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-100 block">
              {viewMode === 'equity' ? 'Cumulative Balance & Equity Trajectory' : 'Underwater Drawdown Spectrum'}
            </span>
            <span className="text-[10px] text-slate-400">
              {points.length <= 1
                ? 'Baseline starting balance recorded'
                : `${points.length - 1} executed closed trade checkpoints mapped`}
            </span>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-[#0E1522] p-1 rounded-xl border border-[#1A2538] text-[10px]">
          <button
            type="button"
            onClick={() => setChartViewMode('equity')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              viewMode === 'equity'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Equity Curve
          </button>
          <button
            type="button"
            onClick={() => setChartViewMode('underwater')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              viewMode === 'underwater'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Drawdown (DD)
          </button>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div ref={containerRef} className="w-full relative select-none">
        <svg
          width={width}
          height={height}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
          className="w-full overflow-visible cursor-crosshair"
        >
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={isProfitable ? '#22D3EE' : '#F43F5E'}
                stopOpacity={viewMode === 'equity' ? 0.35 : 0.05}
              />
              <stop
                offset="100%"
                stopColor={isProfitable ? '#22D3EE' : '#F43F5E'}
                stopOpacity={0.0}
              />
            </linearGradient>
            <linearGradient id="underwaterGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#F43F5E" stopOpacity={0.4} />
            </linearGradient>
          </defs>

          {/* Grid lines and Y-axis scale */}
          {[0, 0.25, 0.5, 0.75, 1].map((r) => {
            const val = minVal + r * (maxVal - minVal);
            const y = getY(val);
            const label =
              viewMode === 'underwater'
                ? `${val.toFixed(1)}%`
                : `$${Math.round(val).toLocaleString()}`;
            return (
              <g key={r}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#162133"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="#64748B"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Initial Capital Baseline */}
          {viewMode === 'equity' && (
            <g>
              <line
                x1={padLeft}
                y1={initBaselineY}
                x2={width - padRight}
                y2={initBaselineY}
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={width - padRight}
                y={initBaselineY - 4}
                textAnchor="end"
                fill="#94A3B8"
                fontSize="9"
                fontWeight="bold"
              >
                Capital: ${initialCapital.toLocaleString()}
              </text>
            </g>
          )}

          {/* Area Fill */}
          {areaPath && (
            <path
              d={areaPath}
              fill={viewMode === 'equity' ? 'url(#equityGrad)' : 'url(#underwaterGrad)'}
            />
          )}

          {/* Stroke Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={
                viewMode === 'underwater'
                  ? '#F43F5E'
                  : isProfitable
                  ? '#22D3EE'
                  : '#FB7185'
              }
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Points Circles */}
          {points.length <= 30 &&
            points.map((p, idx) => {
              const val = viewMode === 'underwater' ? -p.drawdownPct : p.balance;
              const cx = getX(idx);
              const cy = getY(val);
              return (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r="3"
                  fill="#0B101B"
                  stroke={p.pnl >= 0 ? '#22D3EE' : '#F43F5E'}
                  strokeWidth="1.5"
                />
              );
            })}

          {/* Hover Crosshair & Dot */}
          {activePt && (
            <g>
              <line
                x1={activeX}
                y1={padTop}
                x2={activeX}
                y2={height - padBottom}
                stroke="#38BDF8"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={activeX}
                cy={activeY}
                r="5"
                fill="#38BDF8"
                stroke="#0B101B"
                strokeWidth="2"
              />
            </g>
          )}

          {/* X Axis Ticks */}
          {points.map((p, idx) => {
            if (
              idx === 0 ||
              idx === points.length - 1 ||
              (points.length > 5 && idx === Math.floor(points.length / 2))
            ) {
              const x = getX(idx);
              const label = idx === 0 ? 'Start' : `T#${idx}`;
              return (
                <text
                  key={idx}
                  x={x}
                  y={height - padBottom + 16}
                  textAnchor={idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'}
                  fill="#64748B"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {label}
                </text>
              );
            }
            return null;
          })}
        </svg>

        {/* Floating Tooltip Card on Hover */}
        {activePt && (
          <div
            className="absolute top-2 pointer-events-none p-2.5 rounded-xl bg-[#090D15]/95 border border-cyan-500/40 shadow-xl text-slate-200 text-xs font-mono space-y-1 z-30 backdrop-blur-md"
            style={{
              left: Math.min(Math.max(padLeft, activeX - 70), width - 180),
            }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-[#1A2538] pb-1">
              <span className="font-bold text-cyan-300">
                {activePt.index === 0 ? 'Initial Capital' : `Trade #${activePt.index}`}
              </span>
              <span className="text-[10px] text-slate-400">
                {activePt.time ? activePt.time.slice(0, 16).replace('T', ' ') : 'Checkpoint'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="text-slate-400">Account Balance:</span>
              <span className="font-extrabold text-slate-100">
                ${activePt.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {activePt.index > 0 && (
              <div className="flex items-center justify-between gap-4 text-[11px]">
                <span className="text-slate-400">Trade PnL:</span>
                <span
                  className={`font-bold ${
                    activePt.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {activePt.pnl >= 0 ? `+$${activePt.pnl.toFixed(2)}` : `-$${Math.abs(activePt.pnl).toFixed(2)}`}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="text-slate-400">Drawdown:</span>
              <span className="font-bold text-rose-300">
                -{activePt.drawdownPct.toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Main Journal Content Component driven entirely by real session telemetry
 */
function JournalContent() {
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get('session');

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { sessions, activeSessionId, switchSession } = useSessionStore();

  // Selected session ID
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (!mounted) return;
    if (sessionParam && sessions.some((s) => s.id === sessionParam)) {
      setSelectedId(sessionParam);
    } else if (activeSessionId && sessions.some((s) => s.id === activeSessionId)) {
      setSelectedId(activeSessionId);
    } else if (sessions.length > 0) {
      setSelectedId(sessions[0].id);
    }
  }, [mounted, sessionParam, activeSessionId, sessions]);

  const selectedSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedId) || sessions[0] || null;
  }, [sessions, selectedId]);

  // Trades filter state
  const [tradesSearch, setTradesSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState<'ALL' | 'WINS' | 'LOSSES' | 'LONG' | 'SHORT'>('ALL');

  // Journal notes state for the selected session
  const [hypothesis, setHypothesis] = useState('');
  const [setupNotes, setSetupNotes] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load existing persistent notes from SQLite backend
  useEffect(() => {
    if (!selectedSession) return;
    let isCancelled = false;
    const jrnId = selectedSession.journalId || `JRN-${selectedSession.id.replace('SES-', '')}`;

    fetch(`/api/v1/journal/${jrnId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isCancelled && data) {
          if (data.hypothesis) setHypothesis(data.hypothesis);
          if (data.setup_notes) setSetupNotes(data.setup_notes);
          if (data.conclusion) setConclusion(data.conclusion);
        } else if (!isCancelled) {
          // Defaults if not written yet
          setHypothesis(
            `Evaluating price action edge on ${selectedSession.symbol} (${selectedSession.timeframe}). Initial balance: $${(selectedSession.initialBalance || 100000).toLocaleString()}.`
          );
          setSetupNotes(`Strategy: ${selectedSession.strategyName || 'Discretionary Replay'} · Symbol: ${selectedSession.symbol}`);
          setConclusion(
            selectedSession.status === 'COMPLETED'
              ? `Session completed with ${selectedSession.trades?.length || 0} trades executed.`
              : 'Simulation is currently active.'
          );
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [selectedSession]);

  const handleSaveNotes = async () => {
    if (!selectedSession) return;
    setIsSavingNotes(true);
    setSaveSuccess(false);

    const initialCap = selectedSession.initialBalance || 100000;
    const currentCap = selectedSession.currentBalance ?? initialCap;
    const netPnl = currentCap - initialCap;
    const trades = selectedSession.trades || [];
    const wins = trades.filter((t) => t.pnl > 0).length;
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
    const jrnId = selectedSession.journalId || `JRN-${selectedSession.id.replace('SES-', '')}`;

    try {
      await fetch('/api/v1/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: jrnId,
          session_id: selectedSession.id,
          title: `Replay Journal: ${selectedSession.name}`,
          symbol: selectedSession.symbol,
          timeframe: selectedSession.timeframe,
          strategy_name: selectedSession.strategyName || 'Discretionary Replay',
          hypothesis,
          setup_notes: setupNotes,
          conclusion,
          status: selectedSession.status === 'COMPLETED' ? (netPnl >= 0 ? 'CONFIRMED' : 'INVALIDATED') : 'TESTING',
          sharpe_recorded: winRate,
          win_rate_recorded: winRate,
          tags: [selectedSession.symbol, selectedSession.timeframe, selectedSession.status, 'ForensicAutopsy'],
        }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.warn('Could not save journal notes:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Metrics computation from real session trades
  const analytics = useMemo(() => {
    if (!selectedSession) return null;

    const initialCapital = selectedSession.initialBalance || 100000;
    const currentBalance = selectedSession.currentBalance ?? initialCapital;
    const netPnl = currentBalance - initialCapital;
    const netPnlPct = initialCapital > 0 ? (netPnl / initialCapital) * 100 : 0;

    const trades = selectedSession.trades || [];
    const totalTrades = trades.length;
    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl < 0);
    const breakEvens = trades.filter((t) => t.pnl === 0);

    const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
    const grossProfit = wins.reduce((acc, t) => acc + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((acc, t) => acc + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;

    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
    const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
    const expectancy = totalTrades > 0 ? netPnl / totalTrades : 0;

    const bestTrade = totalTrades > 0 ? Math.max(...trades.map((t) => t.pnl)) : 0;
    const worstTrade = totalTrades > 0 ? Math.min(...trades.map((t) => t.pnl)) : 0;

    const longTrades = trades.filter((t) => t.side === 'LONG');
    const shortTrades = trades.filter((t) => t.side === 'SHORT');
    const longWins = longTrades.filter((t) => t.pnl > 0).length;
    const shortWins = shortTrades.filter((t) => t.pnl > 0).length;
    const longWinRate = longTrades.length > 0 ? (longWins / longTrades.length) * 100 : 0;
    const shortWinRate = shortTrades.length > 0 ? (shortWins / shortTrades.length) * 100 : 0;

    // Equity curve points
    const equityPoints: EquityPoint[] = [
      {
        index: 0,
        time: selectedSession.startDate || 'Start',
        balance: initialCapital,
        equity: initialCapital,
        pnl: 0,
        drawdownPct: 0,
      },
    ];

    let runningBal = initialCapital;
    let peak = initialCapital;

    trades.forEach((tr, i) => {
      runningBal += tr.pnl;
      if (runningBal > peak) peak = runningBal;
      const dd = peak > 0 ? ((peak - runningBal) / peak) * 100 : 0;
      equityPoints.push({
        index: i + 1,
        time: tr.exitTime || tr.entryTime,
        balance: runningBal,
        equity: runningBal,
        pnl: tr.pnl,
        drawdownPct: dd,
        trade: tr,
      });
    });

    const maxDrawdownPct = Math.max(...equityPoints.map((p) => p.drawdownPct));

    return {
      initialCapital,
      currentBalance,
      netPnl,
      netPnlPct,
      totalTrades,
      winsCount: wins.length,
      lossesCount: losses.length,
      breakEvenCount: breakEvens.length,
      winRate,
      grossProfit,
      grossLoss,
      profitFactor,
      avgWin,
      avgLoss,
      payoffRatio,
      expectancy,
      bestTrade,
      worstTrade,
      longTradesCount: longTrades.length,
      shortTradesCount: shortTrades.length,
      longWinRate,
      shortWinRate,
      equityPoints,
      maxDrawdownPct,
    };
  }, [selectedSession]);

  // Filtered trades list
  const filteredTrades = useMemo(() => {
    if (!selectedSession || !selectedSession.trades) return [];
    return selectedSession.trades.filter((t) => {
      if (tradeFilter === 'WINS' && t.pnl <= 0) return false;
      if (tradeFilter === 'LOSSES' && t.pnl >= 0) return false;
      if (tradeFilter === 'LONG' && t.side !== 'LONG') return false;
      if (tradeFilter === 'SHORT' && t.side !== 'SHORT') return false;

      if (tradesSearch.trim()) {
        const q = tradesSearch.toLowerCase();
        const matchesId = t.tradeId?.toLowerCase().includes(q);
        const matchesReason = t.exitReason?.toLowerCase().includes(q);
        const matchesPrice =
          t.entryPrice.toString().includes(q) || t.exitPrice.toString().includes(q);
        return matchesId || matchesReason || matchesPrice;
      }
      return true;
    });
  }, [selectedSession, tradeFilter, tradesSearch]);

  if (!mounted) {
    return (
      <div className="w-full h-96 flex items-center justify-center font-mono text-cyan-400 text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <span className="tracking-widest uppercase">Initializing Journal Telemetry...</span>
        </div>
      </div>
    );
  }

  // If no sessions exist in store
  if (sessions.length === 0) {
    return (
      <div className="p-8 sm:p-12 text-center rounded-2xl bg-[#0B101B] border border-[#1A2538] max-w-xl mx-auto my-12 font-mono select-none space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mx-auto flex items-center justify-center">
          <BookOpen className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-100">No Backtest Sessions Found</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Trading Journal reflects live and completed backtest sessions. Start your first session in Backtest Studio to record executions, test hypotheses, and generate full forensic autopsies.
          </p>
        </div>
        <Link
          href="/app/backtest"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-sm"
        >
          <span>Launch Backtest Studio</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (!selectedSession || !analytics) return null;

  const isProfitable = analytics.netPnl >= 0;

  return (
    <div className="space-y-6 pb-16 font-mono select-none text-slate-200">
      {/* 1. Header & Real Sessions Selector Strip */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0B101B] border border-[#1A2538] shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                TRADING JOURNAL & FORENSIC AUTOPSY
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight">
              Session Performance & Execution Autopsy
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl">
              Real-time forensic telemetry generated from your backtest sessions. Inspect every executed trade, equity drawdown dynamics, and statistical edges.
            </p>
          </div>

          {/* Quick Action: Open in Chart Replay */}
          <Link
            href={`/app/backtest/workspace?session=${encodeURIComponent(selectedSession.id)}`}
            className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Chart Replay</span>
          </Link>
        </div>

        {/* Sessions Pills Carousel / Picker */}
        <div className="pt-3 border-t border-[#162133] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[10px]">
              Select Backtest Session ({sessions.length})
            </span>
            <Link
              href="/app/backtest"
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
            >
              <span>Manage Sessions in Studio</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 custom-scrollbar">
            {sessions.map((sess) => {
              const isSelected = sess.id === selectedSession.id;
              const sessPnl = (sess.currentBalance ?? sess.initialBalance) - sess.initialBalance;
              const sessProfitable = sessPnl >= 0;

              return (
                <button
                  key={sess.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(sess.id);
                    switchSession(sess.id);
                  }}
                  className={`p-2.5 rounded-xl border text-left shrink-0 transition-all cursor-pointer flex items-center gap-3 min-w-[220px] ${
                    isSelected
                      ? 'bg-[#121A28] border-cyan-500/80 shadow-[0_0_12px_rgba(34,211,238,0.15)] ring-1 ring-cyan-500/40'
                      : 'bg-[#0E1522] border-[#162133] hover:border-[#1E2E44] opacity-80 hover:opacity-100'
                  }`}
                >
                  <SymbolLogo symbol={sess.symbol} size="sm" className="w-6 h-6 min-w-6" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-100 truncate block" title={sess.name}>
                        {sess.name}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                          sess.status === 'COMPLETED'
                            ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/30'
                            : 'bg-cyan-950/70 text-cyan-400 border-cyan-500/30'
                        }`}
                      >
                        {sess.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5 text-[10px]">
                      <span className="text-slate-400 font-bold">
                        {sess.symbol} · {sess.timeframe}
                      </span>
                      <span className={`font-bold ${sessProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {sessProfitable ? `+$${sessPnl.toFixed(2)}` : `-$${Math.abs(sessPnl).toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Key Performance Indicators (6 Real Stats Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Net P&L */}
        <div className="p-3.5 rounded-xl bg-[#0B101B] border border-[#1A2538] space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Net P&L ($)
          </span>
          <span
            className={`text-base font-extrabold flex items-center gap-1 ${
              isProfitable ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isProfitable ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {isProfitable ? `+$${analytics.netPnl.toFixed(2)}` : `-$${Math.abs(analytics.netPnl).toFixed(2)}`}
          </span>
          <span className={`text-[10px] font-bold block ${isProfitable ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
            {isProfitable ? '+' : ''}{analytics.netPnlPct.toFixed(2)}% Return
          </span>
        </div>

        {/* Card 2: Final Balance */}
        <div className="p-3.5 rounded-xl bg-[#0B101B] border border-[#1A2538] space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Final Balance
          </span>
          <span className="text-base font-extrabold text-slate-100 block">
            ${analytics.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-400 block truncate">
            Start: ${analytics.initialCapital.toLocaleString()}
          </span>
        </div>

        {/* Card 3: Win Rate */}
        <div className="p-3.5 rounded-xl bg-[#0B101B] border border-[#1A2538] space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Win Rate
          </span>
          <span className="text-base font-extrabold text-cyan-300 block">
            {analytics.winRate.toFixed(1)}%
          </span>
          <span className="text-[10px] text-slate-400 block">
            {analytics.winsCount} Wins / {analytics.lossesCount} Losses
          </span>
        </div>

        {/* Card 4: Profit Factor */}
        <div className="p-3.5 rounded-xl bg-[#0B101B] border border-[#1A2538] space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Profit Factor
          </span>
          <span className="text-base font-extrabold text-amber-300 block">
            {analytics.profitFactor.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 block">
            Payoff: {analytics.payoffRatio.toFixed(1)}:1
          </span>
        </div>

        {/* Card 5: Max Drawdown */}
        <div className="p-3.5 rounded-xl bg-[#0B101B] border border-[#1A2538] space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Max Drawdown
          </span>
          <span className="text-base font-extrabold text-rose-400 block">
            -{analytics.maxDrawdownPct.toFixed(2)}%
          </span>
          <span className="text-[10px] text-slate-400 block truncate">
            Worst: -${Math.abs(analytics.worstTrade).toFixed(2)}
          </span>
        </div>

        {/* Card 6: Total Trades & Expectancy */}
        <div className="p-3.5 rounded-xl bg-[#0B101B] border border-[#1A2538] space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Trades
          </span>
          <span className="text-base font-extrabold text-slate-100 block">
            {analytics.totalTrades} Executed
          </span>
          <span className="text-[10px] text-cyan-400 block truncate">
            {analytics.expectancy >= 0 ? '+' : ''}${analytics.expectancy.toFixed(2)} / trade
          </span>
        </div>
      </div>

      {/* 3. Performance Visuals: SVG Equity Curve Chart & Bias Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left ~66%: Interactive SVG Equity Curve */}
        <div className="lg:col-span-2">
          <SessionEquityChart
            points={analytics.equityPoints}
            initialCapital={analytics.initialCapital}
            currentBalance={analytics.currentBalance}
          />
        </div>

        {/* Right ~33%: Execution Breakdown & Side Bias */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0B101B] border border-[#1A2538] shadow-sm flex flex-col justify-between space-y-4 font-mono">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#162133]">
              <Target className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-100">Trade Distribution & Bias</span>
            </div>

            {/* Win vs Loss Volume Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-emerald-400">{analytics.winsCount} Profitable Trades</span>
                <span className="text-rose-400">{analytics.lossesCount} Losses</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#162133] overflow-hidden flex">
                <div
                  className="bg-emerald-400 transition-all duration-300"
                  style={{ width: `${analytics.winRate}%` }}
                />
                <div
                  className="bg-rose-500 transition-all duration-300"
                  style={{ width: `${100 - analytics.winRate}%` }}
                />
              </div>
            </div>

            {/* Long vs Short Breakdown */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-[#0E1522] border border-[#162133]">
                <span className="text-[10px] font-bold text-emerald-400 block uppercase">
                  Long Orders
                </span>
                <span className="text-xs font-extrabold text-slate-100 block mt-0.5">
                  {analytics.longTradesCount} Trades
                </span>
                <span className="text-[10px] text-slate-400">
                  {analytics.longWinRate.toFixed(1)}% Win Rate
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#0E1522] border border-[#162133]">
                <span className="text-[10px] font-bold text-rose-400 block uppercase">
                  Short Orders
                </span>
                <span className="text-xs font-extrabold text-slate-100 block mt-0.5">
                  {analytics.shortTradesCount} Trades
                </span>
                <span className="text-[10px] text-slate-400">
                  {analytics.shortWinRate.toFixed(1)}% Win Rate
                </span>
              </div>
            </div>

            {/* Best & Worst Trades */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-[#0E1522] border border-[#162133]">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Best Gain
                </span>
                <span className="text-xs font-extrabold text-emerald-400 block mt-0.5">
                  +${analytics.bestTrade.toFixed(2)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#0E1522] border border-[#162133]">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Worst Loss
                </span>
                <span className="text-xs font-extrabold text-rose-400 block mt-0.5">
                  -${Math.abs(analytics.worstTrade).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0E1522] border border-[#162133] text-[10px] text-slate-400 flex items-center justify-between">
            <span>Avg Win: +${analytics.avgWin.toFixed(2)}</span>
            <span>Avg Loss: -${analytics.avgLoss.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 4. Complete Trades Ledger (Forensic Table) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0B101B] border border-[#1A2538] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#162133]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-100 block">
                Session Trade Ledger & Execution Blotter
              </span>
              <span className="text-[10px] text-slate-400">
                Detailed audit trail of all fills, execution timestamps, and profit exits
              </span>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search trades..."
                value={tradesSearch}
                onChange={(e) => setTradesSearch(e.target.value)}
                className="pl-8 pr-3 py-1 rounded-lg bg-[#0E1522] border border-[#1A2538] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-44"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#0E1522] p-1 rounded-xl border border-[#1A2538] text-[10px]">
              {(['ALL', 'WINS', 'LOSSES', 'LONG', 'SHORT'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTradeFilter(mode)}
                  className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                    tradeFilter === mode
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Trades Table */}
        {filteredTrades.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-[#0E1522] border border-[#162133] text-slate-400 space-y-2">
            <Briefcase className="w-6 h-6 mx-auto text-slate-500 opacity-60" />
            <p className="text-xs font-bold text-slate-300">
              {selectedSession.trades?.length === 0
                ? 'No trades executed in this session yet.'
                : 'No trades match the current filter.'}
            </p>
            <p className="text-[11px] text-slate-400">
              Open the interactive chart replay to place discretionary or automated orders.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[700px] text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#162133] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0E1522]/50">
                  <th className="py-2.5 px-3">Trade #</th>
                  <th className="py-2.5 px-3">Side</th>
                  <th className="py-2.5 px-3">Lots</th>
                  <th className="py-2.5 px-3">Entry Price</th>
                  <th className="py-2.5 px-3">Exit Price</th>
                  <th className="py-2.5 px-3">Exit Reason</th>
                  <th className="py-2.5 px-3">Timestamps</th>
                  <th className="py-2.5 px-3 text-right">Realized P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#162133]">
                {filteredTrades.map((t, idx) => {
                  const isWin = t.pnl >= 0;
                  const isLong = t.side === 'LONG';

                  return (
                    <tr key={t.tradeId || idx} className="hover:bg-[#0E1522]/60 transition-colors">
                      <td className="py-2 px-3 font-bold text-slate-400">
                        {t.tradeId ? `#${t.tradeId.slice(-6)}` : `#${idx + 1}`}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isLong
                              ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-950/70 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {isLong ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {t.side}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-300">
                        {t.quantity} Lots
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-200">
                        {t.entryPrice.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-200">
                        {t.exitPrice.toFixed(2)}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            t.exitReason === 'TP'
                              ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/30'
                              : t.exitReason === 'SL'
                              ? 'bg-rose-950/70 text-rose-400 border-rose-500/30'
                              : 'bg-[#121A28] text-slate-300 border-[#1E2E44]'
                          }`}
                        >
                          {t.exitReason || 'MANUAL'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[10px] text-slate-400">
                        <div>Entry: {t.entryTime ? t.entryTime.slice(0, 16).replace('T', ' ') : '—'}</div>
                        <div>Exit: {t.exitTime ? t.exitTime.slice(0, 16).replace('T', ' ') : '—'}</div>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={`font-extrabold block ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isWin ? `+$${t.pnl.toFixed(2)}` : `-$${Math.abs(t.pnl).toFixed(2)}`}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {t.pnlPercent ? `${t.pnlPercent.toFixed(2)}%` : ''}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Persistent Research Thesis & Autopsy Notes Editor */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0B101B] border border-[#1A2538] shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#162133]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-100 block">
                Session Hypothesis & Autopsy Retrospective
              </span>
              <span className="text-[10px] text-slate-400">
                Document scientific thesis, market regime context, and empirical lessons learned
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={isSavingNotes}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              saveSuccess
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-sm'
            }`}
          >
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved to Database</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingNotes ? 'Saving...' : 'Save Autopsy'}</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Hypothesis */}
          <div className="p-3.5 rounded-xl bg-[#0E1522] border border-[#162133] space-y-2 flex flex-col">
            <div className="flex items-center gap-1.5 text-cyan-400 text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>1. Trading Hypothesis / Thesis</span>
            </div>
            <textarea
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="State the scientific market hypothesis behind this backtest session..."
              rows={4}
              className="w-full flex-1 p-2.5 rounded-lg bg-[#080D15] border border-[#162133] text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none font-mono"
            />
          </div>

          {/* 2. Setup Conditions */}
          <div className="p-3.5 rounded-xl bg-[#0E1522] border border-[#162133] space-y-2 flex flex-col">
            <div className="flex items-center gap-1.5 text-slate-300 text-[10px] font-bold uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>2. Setup Rules & Parameters</span>
            </div>
            <textarea
              value={setupNotes}
              onChange={(e) => setSetupNotes(e.target.value)}
              placeholder="List entry triggers, indicators, SL/TP rules, and session timing parameters..."
              rows={4}
              className="w-full flex-1 p-2.5 rounded-lg bg-[#080D15] border border-[#162133] text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none font-mono"
            />
          </div>

          {/* 3. Conclusion & Post-Mortem */}
          <div className="p-3.5 rounded-xl bg-[#0E1522] border border-[#162133] space-y-2 flex flex-col">
            <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>3. Empirical Conclusion & Autopsy</span>
            </div>
            <textarea
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              placeholder="Document the post-mortem: Was the edge validated? What psychological or execution errors occurred?"
              rows={4}
              className="w-full flex-1 p-2.5 rounded-lg bg-[#080D15] border border-[#162133] text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResearchJournalPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-96 flex items-center justify-center font-mono text-cyan-400 text-xs">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span className="tracking-widest uppercase">Loading Trading Journal...</span>
          </div>
        </div>
      }
    >
      <JournalContent />
    </Suspense>
  );
}
