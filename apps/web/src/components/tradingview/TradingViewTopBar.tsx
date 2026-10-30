'use client';

import React, { useState } from 'react';
import {
  Search,
  Sliders,
  Play,
  RotateCcw,
  Sparkles,
  Maximize2,
  ChevronDown,
  Layers,
  Activity,
  Plus,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { SymbolSearchModal, type MarketSymbolDef } from './SymbolSearchModal';
import { useSessionStore } from '@/stores/sessionStore';
import { NewSessionModal } from '@/components/session/NewSessionModal';

interface TradingViewTopBarProps {
  currentSymbol: string | null;
  onSelectSymbol: (symbol: string) => void;
  currentTimeframe: string;
  onSelectTimeframe: (tf: string) => void;
  onOpenStrategyDrawer: () => void;
  activeStrategyName: string;
  onRunSimulation: () => void;
  isRunning: boolean;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  isOrderPanelOpen?: boolean;
  onToggleOrderPanel?: () => void;
  onOpenSessionLauncher?: () => void;
}

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1D'] as const;

export function TradingViewTopBar({
  currentSymbol,
  onSelectSymbol,
  currentTimeframe,
  onSelectTimeframe,
  onOpenStrategyDrawer,
  activeStrategyName,
  onRunSimulation,
  isRunning,
  onToggleFullscreen,
  isFullscreen,
  isOrderPanelOpen,
  onToggleOrderPanel,
  onOpenSessionLauncher,
}: TradingViewTopBarProps) {
  const [isSymbolModalOpen, setIsSymbolModalOpen] = useState(false);
  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false);
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);

  const { sessions, activeSessionId, switchSession, getActiveSession } = useSessionStore();
  const activeSession = getActiveSession();

  const netPnl = activeSession ? activeSession.currentBalance - activeSession.initialBalance : 0;
  const isPnlPositive = netPnl >= 0;

  return (
    <>
      <div className="h-14 border-b border-obsidian-border bg-obsidian-card px-4 flex items-center justify-between shrink-0 select-none z-20">
        {/* Left Section: Symbol Picker & Timeframe Toolbar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {/* 1. Symbol Search Button */}
          <button
            onClick={() => setIsSymbolModalOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-mono group shadow-sm ${
              currentSymbol
                ? 'bg-obsidian-sub hover:bg-obsidian-elevated border-obsidian-border hover:border-cyan-accent/50 text-slate-text'
                : 'bg-cyan-accent/15 border-cyan-accent/50 text-cyan-accent animate-pulse shadow-hud'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-cyan-accent group-hover:scale-110 transition-transform" />
            <span className="font-bold tracking-tight text-sm">
              {currentSymbol ? currentSymbol : 'Select Pair'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-muted" />
          </button>

          <div className="h-5 w-px bg-obsidian-border mx-1 shrink-0" />

          {/* 2. TradingView-Style Timeframe Pills */}
          <div className="flex items-center gap-1 shrink-0">
            {TIMEFRAMES.map((tf) => {
              const isActive = currentTimeframe === tf;
              return (
                <button
                  key={tf}
                  onClick={() => onSelectTimeframe(tf)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                    isActive
                      ? 'bg-cyan-accent text-obsidian-base font-bold shadow-hud scale-105'
                      : 'text-slate-muted hover:text-slate-text hover:bg-obsidian-elevated'
                  }`}
                >
                  {tf}
                </button>
              );
            })}
          </div>

          <div className="h-5 w-px bg-obsidian-border mx-1 shrink-0" />

          {/* 3. Indicators & Strategy Button */}
          <button
            onClick={onOpenStrategyDrawer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-obsidian-sub hover:bg-obsidian-elevated border border-obsidian-border hover:border-slate-muted text-xs text-slate-subtext hover:text-cyan-accent transition-all group shrink-0"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-accent group-hover:rotate-45 transition-transform" />
            <span className="font-sans font-medium">{activeStrategyName}</span>
          </button>
        </div>

        {/* Right Section: Session Switcher & Fast Run Trigger */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Active Session Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                if (onOpenSessionLauncher) {
                  onOpenSessionLauncher();
                } else {
                  setIsSessionDropdownOpen((prev) => !prev);
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-obsidian-sub hover:bg-obsidian-elevated border border-obsidian-border hover:border-cyan-accent/50 text-xs font-mono text-slate-subtext transition-all group shadow-sm"
              title="Manage Replay Sessions"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-edge animate-pulse shrink-0" />
              <div className="hidden sm:block text-left">
                <span className="font-bold text-slate-text block leading-none truncate max-w-[130px]">
                  {activeSession?.name || 'Default Session'}
                </span>
                <span className="text-[10px] text-slate-muted">
                  ${activeSession?.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 0 }) || '100,000'}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-muted ml-0.5" />
            </button>

            {/* Dropdown Menu */}
            {isSessionDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsSessionDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-72 bg-obsidian-card border border-obsidian-border rounded-xl shadow-2xl p-2 z-40 space-y-1 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-muted flex items-center justify-between">
                    <span>Active Sessions ({sessions.length})</span>
                    <button
                      onClick={() => {
                        setIsSessionDropdownOpen(false);
                        setIsNewSessionModalOpen(true);
                      }}
                      className="text-cyan-accent hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New</span>
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          switchSession(s.id);
                          setIsSessionDropdownOpen(false);
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                          s.id === activeSessionId
                            ? 'bg-cyan-accent/15 text-slate-text border border-cyan-accent/30'
                            : 'hover:bg-obsidian-sub text-slate-subtext border border-transparent'
                        }`}
                      >
                        <div className="truncate">
                          <div className="font-semibold truncate">{s.name}</div>
                          <div className="text-[10px] font-mono text-slate-muted">
                            ${s.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 0 })} · {s.symbol}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Order Palette Toggle Button */}
          {onToggleOrderPanel && (
            <button
              onClick={onToggleOrderPanel}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-1.5 shadow-sm ${
                isOrderPanelOpen
                  ? 'bg-cyan-accent/20 border-cyan-accent/50 text-cyan-accent shadow-hud'
                  : 'bg-obsidian-sub border-obsidian-border text-slate-muted hover:text-slate-text hover:bg-obsidian-elevated'
              }`}
              title="Toggle Order Execution Palette"
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-semibold">Orders</span>
            </button>
          )}

          {/* Simulation Trigger Button */}
          <button
            onClick={onRunSimulation}
            disabled={isRunning}
            className={`px-4 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-hud ${
              isRunning
                ? 'bg-obsidian-elevated text-slate-muted border border-obsidian-border cursor-not-allowed'
                : 'bg-cyan-accent text-obsidian-base hover:bg-cyan-accent/90 hover:shadow-cyan-glow'
            }`}
          >
            {isRunning ? (
              <>
                <div className="w-3 h-3 rounded-full border-2 border-slate-muted border-t-transparent animate-spin" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Simulate</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Symbol Search Modal */}
      <SymbolSearchModal
        isOpen={isSymbolModalOpen}
        onClose={() => setIsSymbolModalOpen(false)}
        onSelectSymbol={(symDef: MarketSymbolDef) => onSelectSymbol(symDef.symbol)}
      />

      {/* New Session Modal */}
      <NewSessionModal
        isOpen={isNewSessionModalOpen}
        onClose={() => setIsNewSessionModalOpen(false)}
      />
    </>
  );
}
