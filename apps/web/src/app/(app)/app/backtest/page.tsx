'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Layers,
  Search,
  Plus,
  Play,
  X,
  BookOpen,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { useSessionStore } from '@/stores/sessionStore';
import type { BacktestSession, Trade } from '@backtest-ai/domain';
import { NewSessionModal } from '@/components/session/NewSessionModal';

/**
 * Calculates deterministic replay progress percentage across multiple fallback metrics
 */
function calculateProgressPct(session?: BacktestSession | null): number {
  if (!session) return 0;
  if (typeof session.progressPct === 'number' && !isNaN(session.progressPct)) {
    return Math.min(100, Math.max(0, Math.round(session.progressPct)));
  }
  if (session.lastBarIndex && session.totalBars && session.totalBars > 0) {
    return Math.min(100, Math.max(0, Math.round((session.lastBarIndex / session.totalBars) * 100)));
  }
  if (session.lastReplayTime && session.startDate && session.endDate) {
    const sTime = new Date(session.startDate).getTime();
    const eTime = new Date(session.endDate).getTime();
    const currTime = session.lastReplayTime < 10000000000 ? session.lastReplayTime * 1000 : session.lastReplayTime;
    if (currTime && eTime > sTime && currTime >= sTime) {
      return Math.max(0, Math.min(100, Math.round(((currTime - sTime) / (eTime - sTime)) * 100)));
    }
  }
  if (session.trades && session.trades.length > 0) {
    return Math.min(95, Math.max(5, session.trades.length * 6));
  }
  return 0;
}

/**
 * High-performance Mini SVG Sparkline with smooth curve and terminal glowing dot
 */
function HeroSparkline({
  trades = [],
  isProfit,
  initialBalance = 100000,
}: {
  trades: Trade[];
  isProfit: boolean;
  initialBalance: number;
}) {
  const width = 160;
  const height = 46;
  const pad = 6;

  const points = useMemo(() => {
    if (trades.length === 0) {
      // Natural elegant upward arc when starting a clean session
      return [
        { x: pad, y: height - pad - 6 },
        { x: width * 0.35, y: height - pad - 8 },
        { x: width * 0.7, y: height * 0.42 },
        { x: width - pad, y: pad + 4 },
      ];
    }

    let runningBal = initialBalance;
    const balances = [runningBal];
    trades.forEach((t) => {
      runningBal += t.pnl || 0;
      balances.push(runningBal);
    });

    const min = Math.min(...balances);
    const max = Math.max(...balances);
    const range = Math.max(1, max - min);

    return balances.map((b, idx) => {
      const x = pad + (idx / Math.max(1, balances.length - 1)) * (width - pad * 2);
      const y = height - pad - ((b - min) / range) * (height - pad * 2);
      return { x, y };
    });
  }, [trades, initialBalance, height, width, pad]);

  const path = useMemo(() => {
    if (points.length < 2) return '';
    return points.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
      const prev = points[i - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    }, '');
  }, [points]);

  const lastPt = points[points.length - 1] || { x: width - pad, y: pad + 4 };
  const strokeColor = isProfit ? '#10B981' : '#F43F5E';

  return (
    <svg width={width} height={height} className="overflow-visible select-none">
      <defs>
        <filter id="heroSparkGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Trajectory Curve */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Terminal Glowing Dot */}
      <circle
        cx={lastPt.x}
        cy={lastPt.y}
        r="3.5"
        fill="#22D3EE"
        filter="url(#heroSparkGlow)"
      />
      <circle
        cx={lastPt.x}
        cy={lastPt.y}
        r="6.5"
        fill="#22D3EE"
        opacity="0.35"
        className="animate-pulse"
      />
    </svg>
  );
}

export default function BacktestStudioHubPage() {
  const router = useRouter();
  const {
    sessions,
    activeSessionId,
    switchSession,
    resetSession,
    deleteSession,
    isNewSessionModalOpen,
    setNewSessionModalOpen,
  } = useSessionStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHeroId, setSelectedHeroId] = useState<string>('');
  const [sessionToReset, setSessionToReset] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  // Filtered sessions based on search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.symbol.toLowerCase().includes(q) ||
        s.timeframe?.toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  // Featured Hero Session: selectedHeroId -> activeSessionId -> first session
  const heroSession = useMemo(() => {
    if (selectedHeroId) {
      const found = sessions.find((s) => s.id === selectedHeroId);
      if (found) return found;
    }
    if (activeSessionId) {
      const found = sessions.find((s) => s.id === activeSessionId);
      if (found) return found;
    }
    return filteredSessions[0] || sessions[0] || null;
  }, [selectedHeroId, activeSessionId, filteredSessions, sessions]);

  // Other sessions for the right-hand scroll list (exclude the current hero)
  const otherSessions = useMemo(() => {
    if (!heroSession) return [];
    return filteredSessions.filter((s) => s.id !== heroSession.id);
  }, [filteredSessions, heroSession]);

  const handleLaunch = (sessionId: string) => {
    switchSession(sessionId);
    router.push(`/app/backtest/workspace?session=${encodeURIComponent(sessionId)}`);
  };

  const handleConfirmReset = (sessionId: string) => {
    resetSession(sessionId);
    setSessionToReset(null);
  };

  const handleConfirmDelete = (sessionId: string) => {
    deleteSession(sessionId);
    setSessionToDelete(null);
    if (selectedHeroId === sessionId) {
      setSelectedHeroId('');
    }
  };

  if (!mounted) {
    return (
      <div className="space-y-6 pb-16 animate-fadeIn">
        <div className="p-12 rounded-2xl bg-[#0C121D] border border-[#1A2538] flex items-center justify-center py-24">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  // Hero calculations
  const heroInitialBalance = heroSession?.initialBalance || 100000;
  const heroCurrentBalance = heroSession?.currentBalance ?? heroInitialBalance;
  const heroNetPnl = heroCurrentBalance - heroInitialBalance;
  const heroNetPnlPct = heroInitialBalance > 0 ? (heroNetPnl / heroInitialBalance) * 100 : 0;
  const heroIsProfit = heroNetPnl >= 0;

  const heroTrades = heroSession?.trades || [];
  const heroTradesCount = heroTrades.length;
  const heroWinsCount = heroTrades.filter((t) => (t.pnl || 0) > 0).length;
  const heroLossesCount = heroTrades.filter((t) => (t.pnl || 0) <= 0).length;
  const heroWinRate = heroTradesCount > 0 ? (heroWinsCount / heroTradesCount) * 100 : 0;
  const heroProgressPct = calculateProgressPct(heroSession);

  let heroPlayheadText = 'Live Replay';
  if (heroSession?.lastReplayTime && heroSession.lastReplayTime > 0) {
    const t = heroSession.lastReplayTime < 10000000000 ? heroSession.lastReplayTime * 1000 : heroSession.lastReplayTime;
    const d = new Date(t);
    heroPlayheadText = `T[NOW] ${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
  } else if (heroTrades.length > 0) {
    const lastT = heroTrades[heroTrades.length - 1];
    const tStr = lastT.exitTime || lastT.entryTime;
    if (tStr) heroPlayheadText = `T[NOW] ${tStr.slice(0, 16).replace('T', ' ')}`;
  } else if (heroSession?.startDate) {
    heroPlayheadText = `T[NOW] ${heroSession.startDate.slice(0, 10)} 00:00`;
  }

  const heroStartDate = heroSession?.startDate ? heroSession.startDate.slice(0, 10) : '2025-01-01';
  const heroEndDate = heroSession?.endDate ? heroSession.endDate.slice(0, 10) : '2026-10-02';

  return (
    <div className="space-y-6 pb-16 animate-fadeIn font-mono select-none">
      {/* 1. Header Strip (Minimal, Institutional, Actions Right-Aligned) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0B101B] border border-[#162133] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                sessions.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'
              }`}
            />
            <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider font-bold">
              BACKTEST STUDIO · {sessions.length} REPLAY SESSIONS ARCHIVED
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight font-sans">
            Backtest & Replay Studio
          </h1>
        </div>

        {/* Action Buttons Right-Aligned */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            onClick={() => setNewSessionModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2 min-h-[40px] rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create New Session</span>
          </button>

          <Link
            href="/app/journal"
            className="w-full sm:w-auto px-4 py-2 min-h-[40px] rounded-xl bg-[#121A28] hover:bg-[#1A2538] border border-[#1E2E44] text-slate-300 hover:text-white font-mono text-xs font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Trading Journal</span>
          </Link>
        </div>
      </div>

      {/* 2. Full-Width Title & Search Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Left: Section Marker & Count Badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-4 bg-cyan-400 rounded-full" />
          <h2 className="text-xs sm:text-sm font-bold font-mono tracking-wider text-slate-200 uppercase">
            Archived Sessions
          </h2>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#0F172A] border border-[#1E293B] text-cyan-400 font-semibold">
            {filteredSessions.length} {filteredSessions.length === 1 ? 'SESSION' : 'SESSIONS'}
          </span>
        </div>

        {/* Right: Inset Search Pill */}
        <div className="relative flex items-center bg-[#070C14] hover:bg-[#0A101C] focus-within:bg-[#0A101C] border border-[#162234] focus-within:border-cyan-400/60 rounded-xl px-3 py-1.5 shadow-inner transition-all duration-200 w-full sm:w-80 group/search">
          <Search className="w-3.5 h-3.5 text-slate-500 group-focus-within/search:text-cyan-400 transition-colors shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by symbol, name..."
            className="w-full bg-transparent border-none text-xs text-slate-200 placeholder-slate-500 focus:outline-none pl-2.5 pr-2 font-mono tracking-tight"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0D1524] border border-[#1A263C] text-slate-500">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* 3. Main Replay Hub Section */}
      {sessions.length === 0 ? (
        /* Empty State */
        <div className="p-12 rounded-2xl bg-[#0C121D] border border-[#1A2538] text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
            <Play className="w-6 h-6 ml-0.5 fill-current" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-100 font-mono">
              No Active Replay Sessions
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Create a replay session for Gold (XAUUSD), Bitcoin, or Forex to start deterministic forward stepping with TradeLocker order execution.
            </p>
          </div>

          <button
            onClick={() => setNewSessionModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-mono font-bold text-xs inline-flex items-center gap-2 shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Launch First Replay Session</span>
          </button>
        </div>
      ) : (
        /* 2-Column Minimal Space Layout: Large Hero Card (Left) + Compact Scroll List (Right) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT: HERO LAST ACTIVE SESSION CARD (EXACT MATCHING HEIGHT WITH RIGHT LIST) */}
          {heroSession && (
            <div className="lg:col-span-7 xl:col-span-8 rounded-2xl bg-[#090E18] border border-[#162234] hover:border-cyan-500/30 shadow-2xl p-4 sm:p-5 flex flex-col justify-between font-mono relative transition-all lg:h-[295px]">
              {/* Top Row: Title, Window Dates & Real-time PnL */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold tracking-wider uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span>LAST ACTIVE SESSION</span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-black text-slate-100 font-sans tracking-tight truncate" title={`${heroSession.symbol} — ${heroSession.name}`}>
                    {heroSession.symbol} — {heroSession.name}
                  </h2>

                  <p className="text-xs text-slate-400 font-mono">
                    Window: {heroStartDate} → {heroEndDate} • <span className="text-cyan-300 font-bold">{heroProgressPct}% Completed</span>
                  </p>
                </div>

                {/* Right PnL & Return Telemetry */}
                <div className="text-left sm:text-right shrink-0">
                  <div className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${heroIsProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {heroIsProfit
                      ? `+$${heroNetPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `-$${Math.abs(heroNetPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-0.5">
                    <span className={`font-bold ${heroIsProfit ? 'text-emerald-400/90' : 'text-rose-400/90'}`}>
                      {heroIsProfit ? '+' : ''}{heroNetPnlPct.toFixed(2)}% Return
                    </span>
                    <span className="mx-1.5 text-slate-600">•</span>
                    <span className="text-slate-300 font-bold">
                      ${heroCurrentBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Bal
                    </span>
                  </div>
                </div>
              </div>

              {/* Inset Telemetry Box with Mini Equity Curve Sparkline */}
              <div className="p-2.5 sm:p-3 rounded-xl bg-[#060A12] border border-[#131C2D] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                    <span>Win Rate: {heroWinRate.toFixed(1)}%</span>
                    <span className="text-slate-400 font-normal">
                      ({heroWinsCount}W / {heroLossesCount}L)
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                    <span className="text-slate-400">Playhead:</span>
                    <span className="text-slate-200 font-semibold">{heroPlayheadText}</span>
                  </div>
                </div>

                {/* Mini Equity Sparkline */}
                <div className="w-full sm:w-44 h-10 shrink-0 flex items-center justify-start sm:justify-end">
                  <HeroSparkline
                    trades={heroTrades}
                    isProfit={heroIsProfit}
                    initialBalance={heroInitialBalance}
                  />
                </div>
              </div>

              {/* Bottom Row: Shortcut Hint + Quick Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#141E2E]">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span>Press</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#101726] border border-[#1E2E44] text-slate-200 text-[10px] font-bold">
                    Space
                  </kbd>
                  <span>to step next candle</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Journal Deep Link */}
                  <Link
                    href={`/app/journal?session=${encodeURIComponent(heroSession.id)}`}
                    className="p-1.5 sm:p-2 rounded-xl bg-[#121A28] hover:bg-[#1A2538] border border-[#1E2E44] text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                    title="View in Trading Journal"
                  >
                    <BookOpen className="w-4 h-4" />
                  </Link>

                  {/* Reset to Day 1 Trigger */}
                  <button
                    type="button"
                    onClick={() => setSessionToReset(heroSession.id)}
                    className="p-1.5 sm:p-2 rounded-xl bg-[#121A28] hover:bg-[#1A2538] border border-[#1E2E44] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Reset session to Day 1"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  {/* Delete Trigger */}
                  <button
                    type="button"
                    onClick={() => setSessionToDelete(heroSession.id)}
                    className="p-1.5 sm:p-2 rounded-xl bg-[#121A28] hover:bg-[#1A2538] border border-[#1E2E44] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Delete session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Primary Continue Button */}
                  <button
                    type="button"
                    onClick={() => handleLaunch(heroSession.id)}
                    className="px-3.5 sm:px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-400/25 active:scale-95 transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Continue {heroSession.symbol} Replay</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RIGHT: SCROLLABLE LIST OF OTHER SESSIONS (SAME EXACT HEIGHT lg:h-[295px]) */}
          <div className="lg:col-span-5 xl:col-span-4 lg:h-[295px] flex flex-col min-h-0">
            {/* Scrollable List Container */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
              {otherSessions.length === 0 ? (
                <div className="h-full p-6 rounded-2xl bg-[#090E18] border border-[#152030] flex flex-col items-center justify-center text-center space-y-1 text-slate-400">
                  <p className="text-xs font-bold text-slate-300">
                    {searchQuery ? 'No matching archived sessions.' : 'No other archived sessions.'}
                  </p>
                  <p className="text-[10px]">
                    {searchQuery
                      ? 'Try clearing the search query.'
                      : 'Click "+ Create New Session" above to launch another replay.'}
                  </p>
                </div>
              ) : (
                otherSessions.map((sess) => {
                  const initBal = sess.initialBalance || 100000;
                  const curBal = sess.currentBalance ?? initBal;
                  const pnl = curBal - initBal;
                  const tradesCnt = sess.trades?.length || 0;
                  const winRate =
                    tradesCnt > 0
                      ? Number(((sess.trades.filter((t) => (t.pnl || 0) > 0).length / tradesCnt) * 100).toFixed(0))
                      : 0;
                  const prog = calculateProgressPct(sess);
                  const isSelected = heroSession?.id === sess.id;

                  return (
                    <div
                      key={sess.id}
                      onClick={() => setSelectedHeroId(sess.id)}
                      className={`p-2.5 sm:p-3 rounded-xl border transition-all flex items-center justify-between gap-3 group cursor-pointer ${
                        isSelected
                          ? 'bg-[#101827] border-cyan-500/50 shadow-sm ring-1 ring-cyan-500/30'
                          : 'bg-[#090E18] hover:bg-[#0D1524] border-[#152030] hover:border-[#1E2E46]'
                      }`}
                    >
                      {/* Left: Symbol, Name, Progress & Telemetry */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-extrabold text-xs text-slate-100 font-mono tracking-wide shrink-0">
                            {sess.symbol}
                          </span>
                          <span className="text-xs text-slate-400 font-sans truncate">
                            {sess.name}
                          </span>
                          <span className="text-[9px] font-bold font-mono px-1.5 py-0.2 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 shrink-0">
                            {prog}%
                          </span>
                        </div>

                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          Bal: ${curBal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          <span className="mx-1 text-slate-600">•</span>
                          {tradesCnt} Trades ({winRate}%)
                        </div>
                      </div>

                      {/* Right: Net PnL + Quick Play Button */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span
                          className={`text-xs sm:text-sm font-black font-mono ${
                            pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          {pnl > 0
                            ? `+$${pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : pnl < 0
                            ? `-$${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : '$0.00'}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLaunch(sess.id);
                          }}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#111A29] hover:bg-cyan-400 hover:text-slate-950 text-cyan-400 border border-[#1C2C44] hover:border-cyan-400 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
                          title="Open Replay"
                        >
                          <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current ml-0.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {sessionToReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setSessionToReset(null)}
          />
          <div className="relative w-full max-w-sm p-5 rounded-2xl bg-[#0F1420] border border-rose-500/40 shadow-2xl z-10 font-mono space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Reset Session to Day 1?</span>
            </div>
            <p className="text-xs text-slate-300">
              Notice: Resetting will permanently wipe all trades, active positions, and journal autopsy records for this session.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1C2638]">
              <button
                type="button"
                onClick={() => setSessionToReset(null)}
                className="py-2 rounded-lg bg-[#162132] text-slate-300 text-xs font-semibold hover:bg-[#1E2E44] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmReset(sessionToReset)}
                className="py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setSessionToDelete(null)}
          />
          <div className="relative w-full max-w-sm p-5 rounded-2xl bg-[#0F1420] border border-rose-500/40 shadow-2xl z-10 font-mono space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase">
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Delete Session?</span>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete this replay session? This action cannot be undone.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1C2638]">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="py-2 rounded-lg bg-[#162132] text-slate-300 text-xs font-semibold hover:bg-[#1E2E44] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(sessionToDelete)}
                className="py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Session Creator Modal */}
      <NewSessionModal
        isOpen={isNewSessionModalOpen}
        onClose={() => setNewSessionModalOpen(false)}
      />
    </div>
  );
}
