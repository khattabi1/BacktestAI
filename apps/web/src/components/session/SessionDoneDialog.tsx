'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  X,
  RotateCcw,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  LayoutGrid,
} from 'lucide-react';
import type { BacktestSession } from '@backtest-ai/domain';

interface SessionDoneDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExitToStudio: () => void;
  session: BacktestSession;
  currentBalance?: number;
  tradesCount?: number;
  winRate?: number;
  netPnl?: number;
  onKeepInDone?: () => void;
  onCreateNewSession: () => void;
  onResetSession: () => void;
}

export function SessionDoneDialog({
  isOpen,
  onClose,
  onExitToStudio,
  session,
  currentBalance = 100000,
  tradesCount = 0,
  winRate = 0,
  netPnl = 0,
  onCreateNewSession,
  onResetSession,
}: SessionDoneDialogProps) {
  const [showResetWarning, setShowResetWarning] = useState(false);

  if (!isOpen) return null;

  const initialCap = session.initialBalance || 100000;
  const pnlPercent = initialCap > 0 ? ((netPnl / initialCap) * 100).toFixed(2) : '0.00';
  const isProfitable = netPnl >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Native Backdrop: Clicking outside exits cleanly to Backtest Studio */}
      <div
        className="fixed inset-0 bg-[#060A12]/80 backdrop-blur-sm transition-opacity"
        onClick={onExitToStudio}
      />

      {/* Pro Modal Card */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#0B101B] border border-[#1A2538] rounded-2xl shadow-2xl p-4 sm:p-5 z-10 font-mono select-none space-y-4 animate-in fade-in zoom-in-95 duration-150 custom-scrollbar">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#162133]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-500/30 inline-block">
                SESSION DONE · COMPLETED
              </span>
              <h2 className="text-sm font-bold text-slate-100 mt-1 max-w-[260px] sm:max-w-[340px] truncate" title={session.name}>
                {session.name}
              </h2>
            </div>
          </div>

          {/* Close [X] Exit Button: Navigates cleanly to Backtest Studio */}
          <button
            type="button"
            onClick={onExitToStudio}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#162133] transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            title="Exit to Backtest Studio"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Numbers / Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
          {/* Final Balance */}
          <div className="p-3 rounded-xl bg-[#0E1522] border border-[#162133]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Final Balance
            </span>
            <span className="text-sm font-extrabold text-slate-100 block mt-1">
              ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span
              className={`text-[10px] font-bold mt-0.5 flex items-center gap-0.5 ${
                isProfitable ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isProfitable ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isProfitable ? `+$${netPnl.toFixed(2)}` : `-$${Math.abs(netPnl).toFixed(2)}`} ({pnlPercent}%)
            </span>
          </div>

          {/* Closed Trades */}
          <div className="p-3 rounded-xl bg-[#0E1522] border border-[#162133]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Closed Trades
            </span>
            <span className="text-sm font-extrabold text-slate-100 block mt-1">
              {tradesCount} Trades
            </span>
          </div>

          {/* Win Rate */}
          <div className="p-3 rounded-xl bg-[#0E1522] border border-[#162133]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Win Rate
            </span>
            <span className="text-sm font-extrabold text-cyan-300 block mt-1">
              {winRate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* 2. Journal Callout Bar */}
        <div className="p-3 rounded-xl bg-[#0E1522] border border-[#162133] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-100 block">
                Autopsy Saved to Trading Journal
              </span>
              <span className="text-[10px] text-slate-400">
                Review execution ledger, charts, and performance notes.
              </span>
            </div>
          </div>

          <Link
            href={`/app/journal?session=${encodeURIComponent(session.id)}`}
            className="px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[36px] sm:min-h-0 shrink-0"
          >
            <span>View Journal</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* 3. Bottom Actions: Studio Exit, Create Session & Reset */}
        {!showResetWarning ? (
          <div className="pt-2 border-t border-[#162133] space-y-2.5 w-full">
            {/* Primary Actions Grid: Same Size taking Full Width */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 w-full">
              <button
                type="button"
                onClick={onExitToStudio}
                className="w-full py-2.5 min-h-[44px] rounded-xl bg-[#121A28] hover:bg-[#1A2538] border border-[#1E2E44] hover:border-cyan-500/50 text-slate-200 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                title="Return to Backtest Studio"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
                <span>Backtest Studio</span>
              </button>

              <button
                type="button"
                onClick={onCreateNewSession}
                className="w-full py-2.5 min-h-[44px] rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center transition-all shadow-sm cursor-pointer"
                title="Create a new backtest session"
              >
                Create New Session
              </button>
            </div>

            {/* Reset Session Action: Subtly placed below, requiring explicit user intent */}
            <button
              type="button"
              onClick={() => setShowResetWarning(true)}
              className="w-full py-2.5 min-h-[42px] rounded-xl bg-[#150B10] hover:bg-[#200E17] border border-rose-500/30 hover:border-rose-500/60 text-rose-300 hover:text-rose-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              title="Reset session (Notice: permanently wipes trades and journal data)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>Reset Session</span>
            </button>
          </div>
        ) : (
          /* Reset Confirmation Notice with 50/50 Full-Width Buttons */
          <div className="pt-2 border-t border-[#162133] space-y-2.5 p-3 rounded-xl bg-[#180C11] border border-rose-500/60 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="text-[11px] font-semibold">
                Notice: Resetting will permanently wipe all trades and journal data!
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 w-full pt-1 border-t border-rose-900/30">
              <button
                type="button"
                onClick={() => setShowResetWarning(false)}
                className="w-full py-2 rounded-lg bg-[#121A28] hover:bg-[#1A2538] text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetWarning(false);
                  onResetSession();
                }}
                className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Yes, Reset Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
