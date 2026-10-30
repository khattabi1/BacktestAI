'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Play,
  RotateCcw,
  Trash2,
  Edit2,
  Check,
  X,
  BookOpen,
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
} from 'lucide-react';
import type { BacktestSession } from '@backtest-ai/domain';
import { useSessionStore } from '@/stores/sessionStore';
import { SymbolLogo } from '@/components/common/SymbolLogo';

interface SessionCardProps {
  session: BacktestSession;
}

export function SessionCard({ session }: SessionCardProps) {
  const router = useRouter();
  const { renameSession, deleteSession, resetSession, switchSession } = useSessionStore();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(session.name);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const initialBalance = session.initialBalance || 10000;
  const currentBalance = session.currentBalance ?? initialBalance;
  const netPnl = currentBalance - initialBalance;
  const netPnlPct = (netPnl / initialBalance) * 100;
  const isProfit = netPnl >= 0;

  const tradesCount = session.trades?.length || 0;
  const winRate = session.metrics?.winRate ?? (
    tradesCount > 0
      ? Number(((session.trades.filter((t) => t.pnl > 0).length / tradesCount) * 100).toFixed(1))
      : 0
  );

  const activePositionsCount = session.activePositions?.length || 0;
  const pendingOrdersCount = session.pendingOrders?.length || 0;

  // Calculate replay progress percentage
  let progressPct = 0;
  if (typeof session.progressPct === 'number' && !isNaN(session.progressPct)) {
    progressPct = Math.min(100, Math.max(0, Math.round(session.progressPct)));
  } else if (session.lastBarIndex && session.totalBars && session.totalBars > 0) {
    progressPct = Math.min(100, Math.max(0, Math.round((session.lastBarIndex / session.totalBars) * 100)));
  } else if (session.lastReplayTime && session.startDate && session.endDate) {
    const sTime = new Date(session.startDate).getTime();
    const eTime = new Date(session.endDate).getTime();
    const currTime = session.lastReplayTime < 10000000000 ? session.lastReplayTime * 1000 : session.lastReplayTime;

    if (currTime && eTime > sTime && currTime >= sTime) {
      progressPct = Math.max(0, Math.min(100, Math.round(((currTime - sTime) / (eTime - sTime)) * 100)));
    }
  }

  // Fallbacks: If user took trades or stepped bars in this session, ensure progress is visibly reflected!
  if (progressPct === 0) {
    if (session.trades && session.trades.length > 0) {
      const lastTrade = session.trades[session.trades.length - 1];
      const tradeTimeStr = lastTrade.exitTime || lastTrade.entryTime;
      if (tradeTimeStr && session.startDate && session.endDate) {
        const sTime = new Date(session.startDate).getTime();
        const eTime = new Date(session.endDate).getTime();
        const tradeTime = new Date(tradeTimeStr).getTime();
        if (eTime > sTime && tradeTime >= sTime && tradeTime <= eTime) {
          progressPct = Math.max(1, Math.min(100, Math.round(((tradeTime - sTime) / (eTime - sTime)) * 100)));
        } else {
          progressPct = Math.min(95, Math.max(5, session.trades.length * 5));
        }
      } else {
        progressPct = Math.min(95, Math.max(5, session.trades.length * 5));
      }
    } else if ((session.lastBarIndex || session.replayIndex || 0) > 4) {
      const bIndex = session.lastBarIndex || session.replayIndex || 0;
      progressPct = Math.min(100, Math.max(1, Math.round((bIndex / 500) * 100)));
    }
  }

  const handleSaveName = () => {
    if (editedName.trim()) {
      renameSession(session.id, editedName.trim());
    }
    setIsEditingName(false);
  };

  const handleContinueReplay = () => {
    switchSession(session.id);
    router.push(`/app/backtest/workspace?session=${encodeURIComponent(session.id)}`);
  };

  const handleConfirmReset = () => {
    resetSession(session.id);
    setShowResetConfirm(false);
  };

  const handleConfirmDelete = () => {
    deleteSession(session.id);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="rounded-2xl bg-[#0C121D] border border-[#1A2538] hover:border-cyan-500/40 transition-all duration-300 shadow-hud flex flex-col justify-between overflow-hidden group">
      {/* 1. Header & Symbol Info */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* Inline Symbol + Smaller Icon */}
            <div className="flex items-center gap-2">
              <SymbolLogo symbol={session.symbol} size="sm" className="w-5 h-5 min-w-5 min-h-5" />
              <span className="font-mono font-extrabold text-slate-100 text-sm tracking-wide">
                {session.symbol}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                  session.status === 'COMPLETED'
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                    : 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
                }`}
              >
                {session.status}
              </span>
            </div>

            {/* Editable Name */}
            {isEditingName ? (
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="px-2 py-0.5 text-xs rounded bg-[#151F30] border border-cyan-500 text-slate-100 font-mono focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="p-1 rounded bg-cyan-500 text-slate-900 hover:bg-cyan-400"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  className="p-1 rounded bg-[#1A2538] text-slate-300 hover:bg-[#223048]"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-1 group/name">
                <h3 className="text-xs font-semibold text-slate-300 line-clamp-1">{session.name}</h3>
                <button
                  onClick={() => {
                    setEditedName(session.name);
                    setIsEditingName(true);
                  }}
                  className="opacity-0 group-hover/name:opacity-100 p-0.5 text-slate-500 hover:text-slate-300 transition-opacity"
                  title="Rename session"
                >
                  <Edit2 className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>

          {/* Net PnL Badge */}
          <div className="text-right shrink-0">
            <span
              className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded border ${
                isProfit
                  ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-950/50 text-rose-400 border-rose-500/30'
              }`}
            >
              {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>
                {isProfit ? '+' : '-'}${Math.abs(netPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
              {isProfit ? '+' : ''}{netPnlPct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* 2. Capital & Metrics Telemetry */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#162030] text-center">
          <div className="p-2 rounded-lg bg-[#080D15]/80 border border-[#141F30]">
            <span className="text-[10px] text-slate-500 font-mono block">Balance</span>
            <span className="text-xs font-bold font-mono text-slate-200 mt-0.5 block">
              ${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-[#080D15]/80 border border-[#141F30]">
            <span className="text-[10px] text-slate-500 font-mono block">Trades / WR</span>
            <span className="text-xs font-bold font-mono text-cyan-300 mt-0.5 block">
              {tradesCount} ({winRate}%)
            </span>
          </div>

          <div className="p-2 rounded-lg bg-[#080D15]/80 border border-[#141F30]">
            <span className="text-[10px] text-slate-500 font-mono block">Positions</span>
            <span className="text-xs font-bold font-mono text-slate-200 mt-0.5 block">
              {activePositionsCount > 0 ? (
                <span className="text-emerald-400 font-semibold">{activePositionsCount} Open</span>
              ) : (
                <span className="text-slate-500">None</span>
              )}
            </span>
          </div>
        </div>

        {/* 3. Replay Progress Timeline */}
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Progress</span>
            <span className="text-cyan-300 font-bold">{progressPct}%</span>
          </div>

          {/* Progress Track */}
          <div className="w-full h-1.5 rounded-full bg-[#121A28] border border-[#1E2E44] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.max(4, progressPct)}%` }}
            />
          </div>

          {/* Date Labels */}
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
            <span>{session.startDate ? session.startDate.slice(0, 10) : 'Day 1'}</span>
            <span>{session.endDate ? session.endDate.slice(0, 10) : 'Ongoing'}</span>
          </div>
        </div>
      </div>

      {/* 4. Action Strip */}
      <div className="p-3 bg-[#080D15] border-t border-[#162030] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {/* Journal Deep Link */}
          <Link
            href={`/app/journal?session=${encodeURIComponent(session.id)}`}
            className="p-2 rounded-lg bg-[#121A28] hover:bg-[#1A2538] border border-[#1E2E44] text-slate-400 hover:text-cyan-300 transition-colors"
            title="Inspect Trading Journal entity for this session"
          >
            <BookOpen className="w-3.5 h-3.5" />
          </Link>

          {/* Reset to Day 1 Button with clear warning */}
          {showResetConfirm ? (
            <div className="flex items-center gap-1.5 bg-[#1C0D12] border border-rose-500/60 px-2.5 py-1 rounded-lg">
              <span className="text-[10px] font-mono text-rose-300 font-semibold" title="Notice: Resetting permanently deletes all closed trades and journal autopsy records for this session">
                ⚠️ Erase trades &amp; journal?
              </span>
              <button
                onClick={handleConfirmReset}
                className="text-[10px] font-bold text-rose-300 hover:text-white px-1.5 py-0.5 rounded bg-rose-600/50 hover:bg-rose-600 font-mono transition-colors cursor-pointer"
                title="Confirm Reset (Data will be lost)"
              >
                Yes
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="text-[10px] text-slate-300 hover:text-white px-1 font-mono transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="p-2 rounded-lg bg-[#121A28] hover:bg-[#1A2538] border border-[#1E2E44] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              title="Reset session to Day 1 (Notice: will lose all trades and journal autopsy data)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete Button */}
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1 bg-[#1F1218] border border-rose-500/50 px-2 py-1 rounded-lg">
              <span className="text-[10px] font-mono text-rose-300">Delete?</span>
              <button
                onClick={handleConfirmDelete}
                className="text-[10px] font-bold text-rose-400 hover:underline font-mono"
              >
                Yes
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-[10px] text-slate-400 hover:text-slate-200 font-mono"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-lg bg-[#121A28] hover:bg-[#1A2538] border border-[#1E2E44] text-slate-400 hover:text-rose-400 transition-colors"
              title="Delete session"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Big Continue Replay Launcher */}
        <button
          onClick={handleContinueReplay}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Continue Replay</span>
        </button>
      </div>
    </div>
  );
}
