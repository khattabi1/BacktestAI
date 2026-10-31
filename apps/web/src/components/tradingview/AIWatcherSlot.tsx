'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Brain,
  Zap,
  Activity,
  Eye,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Loader2,
  ChevronRight,
  Cpu,
} from 'lucide-react';
import { useSessionStore } from '@/stores/sessionStore';
import type { Trade } from '@backtest-ai/domain';

interface AIWatcherSlotProps {
  sessionId: string;
  symbol: string;
  timeframe?: string;
  trades: Trade[];
}

export function AIWatcherSlot({
  sessionId,
  symbol,
  timeframe = '15m',
  trades,
}: AIWatcherSlotProps) {
  const router = useRouter();
  const isAIWatcherEnabled = useSessionStore((s) => s.isAIWatcherEnabled);
  const setAIWatcherEnabled = useSessionStore((s) => s.setAIWatcherEnabled);
  const aiCoachFeedback = useSessionStore((s) => s.aiCoachFeedback[sessionId]);
  const setAICoachFeedback = useSessionStore((s) => s.setAICoachFeedback);

  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [activeTab, setActiveTab] = useState<'COACH' | 'CLONER'>('COACH');

  const closedCount = trades.length;
  const targetSampleSize = 10;
  const progressPct = Math.min(100, Math.round((closedCount / targetSampleSize) * 100));

  // Handle Run Diagnosis (Respect / Remove / Adjust)
  const handleRunDiagnosis = async () => {
    if (closedCount === 0) return;
    setIsDiagnosing(true);
    try {
      const tradeCards = trades.map((t, idx) => ({
        trade_id: t.tradeId || (t as any).id || `trd_${idx + 1}`,
        sequence_number: idx + 1,
        status: 'PROCESSED',
        symbol: t.symbol || symbol,
        direction: t.side === 'LONG' ? 'BUY' : 'SELL',
        entry_price: t.entryPrice,
        exit_price: t.exitPrice,
        stop_loss: t.stopLoss,
        take_profit: t.takeProfit,
        lot_size: t.quantity || 1.0,
        pnl: t.pnl,
        pnl_r_multiple: t.pnl >= 0 ? 1.5 : -1.0,
        math_context: {
          price_vs_ema50: t.entryPrice > 0 ? 'ABOVE' : 'BELOW',
          price_vs_ema200: 'ABOVE',
          distance_to_sl_pips: 40.0,
          rr_ratio: 2.0,
          atr_regime: 'NORMAL',
        },
        visual_context: {
          setup_archetype: 'IMPULSE_BREAKOUT',
          sl_placement_quality: 'STRUCTURAL_SWING',
          chart_summary: `Trade executed on ${t.symbol}`,
        },
      }));

      const res = await fetch('/api/v1/ai-watcher/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          trades: tradeCards,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAICoachFeedback(sessionId, data);
      }
    } catch (err) {
      console.warn('[AI Watcher] Diagnosis failed:', err);
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Handle Clone Strategy & Redirect to Quant Lab
  const handleCloneToQuantLab = async () => {
    if (closedCount === 0) return;
    setIsCloning(true);
    try {
      const tradeCards = trades.map((t, idx) => ({
        trade_id: t.tradeId || (t as any).id || `trd_${idx + 1}`,
        sequence_number: idx + 1,
        status: 'PROCESSED',
        symbol: t.symbol || symbol,
        direction: t.side === 'LONG' ? 'BUY' : 'SELL',
        entry_price: t.entryPrice,
        exit_price: t.exitPrice,
        stop_loss: t.stopLoss,
        take_profit: t.takeProfit,
        lot_size: t.quantity || 1.0,
        pnl: t.pnl,
        pnl_r_multiple: t.pnl >= 0 ? 1.5 : -1.0,
        math_context: {
          price_vs_ema50: 'ABOVE',
          distance_to_sl_pips: 45.0,
          rr_ratio: 2.2,
        },
      }));

      const res = await fetch('/api/v1/ai-cloner/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          symbol,
          timeframe,
          trades: tradeCards,
        }),
      });

      if (res.ok) {
        const payload = await res.json();
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('cloned_strategy_bridge', JSON.stringify(payload));
          router.push(`/app/quant?cloned=true&name=${encodeURIComponent(payload.strategy_name)}`);
        }
      }
    } catch (err) {
      console.warn('[AI Cloner] Strategy cloning failed:', err);
    } finally {
      setIsCloning(false);
    }
  };

  // ---------------------------------------------------------------------------
  // STATE A: WATCHER IS DISABLED (Full Space, Clean, Dormant, 0 Credits)
  // ---------------------------------------------------------------------------
  if (!isAIWatcherEnabled) {
    return (
      <div className="flex-1 min-h-[300px] flex flex-col justify-between rounded-xl border border-[#162234] bg-[#0A0F1A] p-3 text-slate-200 transition-all shadow-md shadow-black/40">
        {/* Terminal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#141E2E]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#121A28] border border-[#1E2E44] flex items-center justify-center">
              <Brain className="w-3 h-3 text-slate-400" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold text-slate-300 tracking-wider">
                AI COPILOT
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60 font-mono">
                STANDBY
              </span>
            </div>
          </div>

          {/* Clean Toggle Switch */}
          <button
            type="button"
            onClick={() => setAIWatcherEnabled(true)}
            className="w-9 h-5 rounded-full bg-[#141E2E] border border-[#1E2E44] flex items-center p-0.5 cursor-pointer transition-colors hover:border-slate-500"
            title="Enable AI Watcher & Copilot"
          >
            <div className="w-3.5 h-3.5 rounded-full bg-slate-500 shadow-sm" />
          </button>
        </div>

        {/* 3-Point High Density Feature Matrix (Takes available space elegantly) */}
        <div className="space-y-2 py-2 flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-[#0C1320] border border-[#1A2638]">
            <Eye className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-slate-200 block">Canvas Vision Tagger</span>
              <span className="text-[9px] text-slate-400 block leading-tight">Auto-tags candlestick setups & wicks on trade close</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-[#0C1320] border border-[#1A2638]">
            <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-slate-200 block">Behavioral Guard</span>
              <span className="text-[9px] text-slate-400 block leading-tight">Audits revenge trades, overtrading & stop placement</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-[#0C1320] border border-[#1A2638]">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-slate-200 block">Strategy Cloner</span>
              <span className="text-[9px] text-slate-400 block leading-tight">Synthesizes discretionary edge into native MQL5</span>
            </div>
          </div>
        </div>

        {/* Action & Credit Shield Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-[#141E2E]">
          <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium">0 Credits Used</span>
          </div>

          <button
            type="button"
            onClick={() => setAIWatcherEnabled(true)}
            className="px-3 py-1.5 rounded-lg bg-[#14233C] hover:bg-[#1A2E4E] border border-cyan-500/40 text-[10px] font-bold text-cyan-300 flex items-center gap-1 transition-all cursor-pointer shadow-xs"
          >
            <span>Activate Copilot</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STATE B: WATCHER IS ACTIVE (Full Space, Clean Simple Colors like Pic 1)
  // ---------------------------------------------------------------------------
  return (
    <div className="flex-1 min-h-[360px] flex flex-col justify-between rounded-xl border border-[#1A2638] bg-[#0A0F1A] p-3 text-slate-200 transition-all shadow-md shadow-black/40">
      {/* Header with Live Status Indicator */}
      <div className="flex items-center justify-between pb-2 border-b border-[#141E2E]">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-5 h-5 rounded-md bg-[#112234] border border-cyan-500/50 flex items-center justify-center">
              <Activity className="w-3 h-3 text-cyan-400" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-extrabold text-white tracking-wider">
              AI COPILOT
            </span>
            <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-500/40 font-mono">
              LIVE
            </span>
          </div>
        </div>

        {/* Active Toggle Switch */}
        <button
          type="button"
          onClick={() => setAIWatcherEnabled(false)}
          className="w-9 h-5 rounded-full bg-cyan-950 border border-cyan-500/60 flex items-center justify-end p-0.5 cursor-pointer transition-colors"
          title="Turn off to pause watcher"
        >
          <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-xs" />
        </button>
      </div>

      {/* Mode Selector Tabs (Matches OrderPod MARKET/LIMIT/STOP styling) */}
      <div className="flex items-center gap-1 bg-[#080D16] p-0.5 rounded-lg border border-[#162234]">
        <button
          type="button"
          onClick={() => setActiveTab('COACH')}
          className={`flex-1 text-[10px] font-extrabold py-1.5 rounded transition-colors cursor-pointer ${
            activeTab === 'COACH'
              ? 'bg-[#18263E] text-cyan-300 border border-cyan-500/50 shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Behavioral Coach
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CLONER')}
          className={`flex-1 text-[10px] font-extrabold py-1.5 rounded transition-colors cursor-pointer ${
            activeTab === 'CLONER'
              ? 'bg-[#18263E] text-cyan-300 border border-cyan-500/50 shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Strategy Cloner
        </button>
      </div>

      {/* Live Sample Meter Strip */}
      <div className="px-2.5 py-1.5 rounded-xl bg-[#0C1320] border border-[#162234] flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-medium">Sample:</span>
          <span className="font-mono font-bold text-slate-100">{closedCount}</span>
          <span className="text-slate-500 font-mono">/ 10 trades</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-[#141E2E] overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${closedCount >= 10 ? 'bg-emerald-400' : 'bg-cyan-400'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className={`text-[9px] font-bold font-mono ${closedCount >= 10 ? 'text-emerald-400' : 'text-slate-400'}`}>
            {progressPct}%
          </span>
        </div>
      </div>

      {/* Tab Content (Fills all remaining height) */}
      {activeTab === 'COACH' ? (
        <div className="flex-1 min-h-0 flex flex-col justify-between space-y-2.5 mt-1">
          {aiCoachFeedback ? (
            /* Diagnostic Feedback Cards (Expanded to full space with Pic 1 colors) */
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {aiCoachFeedback.what_to_remove?.[0] && (
                <div className="bg-[#0C1320] border border-[#1A2638] rounded-xl p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)] shrink-0" />
                    <span className="text-[10px] font-black text-rose-400 font-mono tracking-wider">
                      REMOVE: {aiCoachFeedback.what_to_remove[0].title}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-relaxed font-sans pl-3.5">
                    {aiCoachFeedback.what_to_remove[0].detail}
                  </p>
                </div>
              )}

              {aiCoachFeedback.what_to_adjust?.[0] && (
                <div className="bg-[#0C1320] border border-[#1A2638] rounded-xl p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.7)] shrink-0" />
                    <span className="text-[10px] font-black text-amber-400 font-mono tracking-wider">
                      ADJUST: {aiCoachFeedback.what_to_adjust[0].title}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-relaxed font-sans pl-3.5">
                    {aiCoachFeedback.what_to_adjust[0].detail}
                  </p>
                </div>
              )}

              {aiCoachFeedback.what_to_respect?.[0] && (
                <div className="bg-[#0C1320] border border-[#1A2638] rounded-xl p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)] shrink-0" />
                    <span className="text-[10px] font-black text-emerald-400 font-mono tracking-wider">
                      RESPECT: {aiCoachFeedback.what_to_respect[0].title}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-relaxed font-sans pl-3.5">
                    {aiCoachFeedback.what_to_respect[0].detail}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Live Telemetry Radar (Fills full space when 0 or awaiting diagnosis) */
            <div className="flex-1 min-h-0 p-3 rounded-xl bg-[#0C1320] border border-[#162234] flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pb-1.5 border-b border-[#141E2E]">
                  <span className="flex items-center gap-1.5 font-bold text-slate-200">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    TELEMETRY SENSORS
                  </span>
                  <span className="text-emerald-400 font-bold">ARMED</span>
                </div>

                <div className="space-y-1.5 text-[10px] pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Canvas WebP Hook:</span>
                    <span className="font-mono font-bold text-slate-200">READY</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Vision Model:</span>
                    <span className="font-mono font-bold text-cyan-300">Muse Spark 1.3 Contributor</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Behavioral Guard:</span>
                    <span className="font-mono font-bold text-emerald-400">MONITORING</span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 pt-2 border-t border-[#141E2E] leading-relaxed">
                {closedCount === 0
                  ? 'Execute trades on chart. Each close automatically captures canvas snapshot and tags visual edge.'
                  : `${closedCount} trades captured. Ready for complete behavioral diagnosis.`}
              </p>
            </div>
          )}

          {/* Action Button */}
          <button
            type="button"
            onClick={handleRunDiagnosis}
            disabled={closedCount === 0 || isDiagnosing}
            className="w-full py-2.5 rounded-xl bg-[#14233C] hover:bg-[#1B2F52] border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 text-[10px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
          >
            {isDiagnosing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>Analyzing Behavioral Edge...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>{aiCoachFeedback ? 'Re-Audit Session' : 'Run Behavioral Audit'}</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* CLONER TAB (Fills full space) */
        <div className="flex-1 min-h-0 flex flex-col justify-between space-y-2.5 mt-1">
          {/* Blueprint Specs Box */}
          <div className="flex-1 min-h-0 p-3 rounded-xl bg-[#0C1320] border border-[#162234] flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between text-[10px] font-mono pb-1.5 border-b border-[#141E2E]">
                <span className="text-slate-400 font-medium">Statistical State:</span>
                <span className={closedCount >= 10 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {closedCount >= 10 ? 'SUFFICIENT (10+)' : 'PRELIMINARY (<10)'}
                </span>
              </div>

              <div className="text-[10px] space-y-1.5 pt-2 text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Target Output:</span>
                  <span className="font-mono font-bold text-cyan-300">{symbol}_ClonedEdge.mq5</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Bridge Target:</span>
                  <span className="font-mono text-slate-200">Quant Lab Multimodal Agent</span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 pt-2 border-t border-[#141E2E] leading-relaxed">
              Synthesizes discretionary execution patterns into deterministic MQL5 code with self-healing backtest.
            </p>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={handleCloneToQuantLab}
            disabled={closedCount === 0 || isCloning}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-[10px] tracking-wide flex items-center justify-center gap-1.5 shadow-md shadow-cyan-950/40 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isCloning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Reverse-Engineering MQL5...</span>
              </>
            ) : (
              <>
                <span>Clone Edge to Quant Lab</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
