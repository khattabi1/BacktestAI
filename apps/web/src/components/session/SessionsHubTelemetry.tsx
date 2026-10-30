'use client';

import React from 'react';
import { Layers, DollarSign, TrendingUp, TrendingDown, Target } from 'lucide-react';
import type { BacktestSession } from '@backtest-ai/domain';

interface SessionsHubTelemetryProps {
  sessions: BacktestSession[];
}

export function SessionsHubTelemetry({ sessions }: SessionsHubTelemetryProps) {
  const totalSessions = sessions.length;

  const totalCapital = sessions.reduce((acc, s) => acc + (s.currentBalance || s.initialBalance || 0), 0);
  const totalInitial = sessions.reduce((acc, s) => acc + (s.initialBalance || 0), 0);
  const aggregatePnl = totalCapital - totalInitial;
  const aggregatePnlPct = totalInitial > 0 ? (aggregatePnl / totalInitial) * 100 : 0;
  const isPnlPositive = aggregatePnl >= 0;

  const allTrades = sessions.flatMap((s) => s.trades || []);
  const totalTradesCount = allTrades.length;
  const winningTradesCount = allTrades.filter((t) => t.pnl > 0).length;
  const aggregateWinRate = totalTradesCount > 0 ? ((winningTradesCount / totalTradesCount) * 100).toFixed(1) : '—';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
      {/* 1. Total Sessions */}
      <div className="p-4 rounded-xl bg-[#0C121D] border border-[#1A2538] flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
            Replay Sessions
          </span>
          <span className="text-xl font-bold font-mono text-slate-100 mt-1 block">
            {totalSessions}
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
            {sessions.filter((s) => s.status === 'ACTIVE').length} active · {sessions.filter((s) => s.status === 'COMPLETED').length} done
          </span>
        </div>
        <div className="w-9 h-9 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
          <Layers className="w-4 h-4" />
        </div>
      </div>

      {/* 2. Active Capital Pool */}
      <div className="p-4 rounded-xl bg-[#0C121D] border border-[#1A2538] flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
            Replay Capital
          </span>
          <span className="text-xl font-bold font-mono text-slate-100 mt-1 block">
            ${totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
            Initial: ${totalInitial.toLocaleString()}
          </span>
        </div>
        <div className="w-9 h-9 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
          <DollarSign className="w-4 h-4" />
        </div>
      </div>

      {/* 3. Aggregate PnL */}
      <div className="p-4 rounded-xl bg-[#0C121D] border border-[#1A2538] flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
            Net Performance
          </span>
          <span
            className={`text-xl font-bold font-mono mt-1 block ${
              isPnlPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isPnlPositive ? '+' : '-'}${Math.abs(aggregatePnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
            {isPnlPositive ? '+' : ''}{aggregatePnlPct.toFixed(2)}% ROI
          </span>
        </div>
        <div
          className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
            isPnlPositive
              ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-950/60 border-rose-500/30 text-rose-400'
          }`}
        >
          {isPnlPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        </div>
      </div>

      {/* 4. Total Trades & Win Rate */}
      <div className="p-4 rounded-xl bg-[#0C121D] border border-[#1A2538] flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
            Win Rate / Volume
          </span>
          <span className="text-xl font-bold font-mono text-cyan-300 mt-1 block">
            {aggregateWinRate}%
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
            {totalTradesCount} executed trades
          </span>
        </div>
        <div className="w-9 h-9 rounded-lg bg-sky-950/60 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
          <Target className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
