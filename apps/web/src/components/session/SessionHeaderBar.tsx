'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  Plus,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  Layers,
  Trash2,
} from 'lucide-react';
import { useSessionStore } from '@/stores/sessionStore';
import { NewSessionModal } from './NewSessionModal';

interface SessionHeaderBarProps {
  onRunSession: () => void;
  isRunning: boolean;
}

export function SessionHeaderBar({ onRunSession, isRunning }: SessionHeaderBarProps) {
  const { sessions, activeSessionId, switchSession, deleteSession, getActiveSession } = useSessionStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const activeSession = getActiveSession();

  if (!activeSession) return null;

  const netPnl = activeSession.currentBalance - activeSession.initialBalance;
  const netPnlPct = (netPnl / activeSession.initialBalance) * 100;
  const isPositive = netPnl >= 0;

  return (
    <>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-obsidian-card border border-obsidian-border shadow-hud">
        {/* Left: Session Selector & Details */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Active Session Dropdown Selector */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              type="button"
              className="flex items-center gap-3 px-3.5 py-2 rounded-lg bg-obsidian-sub hover:bg-obsidian-elevated border border-obsidian-border hover:border-cyan-accent/40 text-xs transition-all text-left group shadow-sm"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-edge animate-pulse shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-text group-hover:text-cyan-accent transition-colors">
                    {activeSession.name}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-glow text-cyan-accent border border-cyan-accent/30">
                    {activeSession.symbol}
                  </span>
                </div>
                <div className="text-[10px] text-slate-muted font-mono mt-0.5">
                  {activeSession.strategyName} · Active Replay
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-muted ml-1" />
            </button>

            {/* Sessions Dropdown Menu */}
            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute left-0 top-full mt-2 w-80 bg-obsidian-card border border-obsidian-border rounded-xl shadow-2xl p-2 z-40 space-y-1 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-muted flex items-center justify-between">
                    <span>SWITCH SESSION ({sessions.length})</span>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsModalOpen(true);
                      }}
                      className="text-cyan-accent hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New</span>
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {sessions.map((s) => {
                      const sPnl = s.currentBalance - s.initialBalance;
                      const sPnlPct = (sPnl / s.initialBalance) * 100;
                      const sPos = sPnl >= 0;
                      const isSelected = s.id === activeSessionId;

                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            switchSession(s.id);
                            setIsDropdownOpen(false);
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors text-xs ${
                            isSelected
                              ? 'bg-cyan-accent/10 border border-cyan-accent/30 text-slate-text'
                              : 'hover:bg-obsidian-sub text-slate-subtext border border-transparent'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-text truncate">
                              {s.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-muted flex items-center gap-1.5 mt-0.5">
                              <span className="text-cyan-accent">{s.symbol}</span>
                              <span>·</span>
                              <span>${s.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0 ml-2 font-mono">
                            <div
                              className={`text-[11px] font-bold ${
                                sPos ? 'text-emerald-edge' : 'text-crimson-risk'
                              }`}
                            >
                              {sPos ? '+' : ''}${sPnl.toFixed(0)}
                            </div>
                            <div className="text-[10px] text-slate-muted">
                              {sPos ? '+' : ''}{sPnlPct.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-1.5 border-t border-obsidian-border">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsModalOpen(true);
                      }}
                      className="w-full py-2 rounded-lg bg-obsidian-sub hover:bg-obsidian-elevated text-cyan-accent text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create New Session</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* New Session Fast Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-2 rounded-lg bg-obsidian-sub hover:bg-obsidian-elevated border border-obsidian-border hover:border-slate-muted text-xs text-slate-subtext hover:text-slate-text transition-colors flex items-center gap-1.5 font-medium shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-accent" />
            <span>New Session</span>
          </button>
        </div>

        {/* Center / Right: Balance & PnL HUD + Run Trigger */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Capital & PnL HUD */}
          <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-lg bg-obsidian-sub border border-obsidian-border text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-muted block">SESSION BALANCE</span>
              <span className="font-bold text-slate-text">
                ${activeSession.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="h-6 w-px bg-obsidian-border" />

            <div>
              <span className="text-[10px] text-slate-muted block">NET PROFIT</span>
              <span
                className={`font-bold flex items-center gap-0.5 ${
                  isPositive ? 'text-emerald-edge' : 'text-crimson-risk'
                }`}
              >
                {isPositive ? '+' : ''}${netPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                <span className="text-[10px] font-normal">
                  ({isPositive ? '+' : ''}{netPnlPct.toFixed(2)}%)
                </span>
              </span>
            </div>
          </div>

          {/* Continue / Run Backtest Trigger */}
          <button
            onClick={onRunSession}
            disabled={isRunning}
            className={`px-5 py-2.5 rounded-lg font-semibold text-xs flex items-center gap-2 transition-all ${
              isRunning
                ? 'bg-obsidian-elevated text-slate-muted border border-obsidian-border cursor-not-allowed'
                : 'bg-cyan-accent text-obsidian-base hover:bg-cyan-accent/90 shadow-hud hover:shadow-cyan-glow'
            }`}
          >
            {isRunning ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-muted border-t-transparent animate-spin" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Continue Session</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* New Session Modal */}
      <NewSessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
