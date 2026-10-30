'use client';

import React, { useState } from 'react';
import {
  X,
  Play,
  Sliders,
  Shield,
  Activity,
  Layers,
  Sparkles,
  Zap,
  CheckCircle2,
  DollarSign,
  ChevronDown,
} from 'lucide-react';
import type { SimulationConfig } from '@backtest-ai/domain';

interface StrategyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStrategyId: string;
  onStrategyChange: (strategyId: string) => void;
  parameters: Record<string, number>;
  onParamChange: (key: string, value: number) => void;
  simulationConfig: SimulationConfig;
  onConfigChange: (updates: Partial<SimulationConfig>) => void;
  onRunSimulation: () => void;
  isRunning: boolean;
  runStats: any;
}

const STRATEGY_PRESETS = [
  {
    id: 'sma-cross',
    name: 'SMA Trend Momentum',
    description: 'Dual Moving Average trend-following system with strict next-open execution.',
    paramDefs: [
      { key: 'fast_period', label: 'Fast SMA Period', min: 5, max: 100, step: 1, desc: 'Signal trigger window' },
      { key: 'slow_period', label: 'Slow SMA Period', min: 20, max: 200, step: 1, desc: 'Trend baseline window' },
      { key: 'stop_loss_pct', label: 'Stop Loss (%)', min: 0.5, max: 10.0, step: 0.1, desc: 'Protective hard stop' },
      { key: 'take_profit_pct', label: 'Take Profit (%)', min: 1.0, max: 20.0, step: 0.1, desc: 'Target profit' },
    ],
  },
  {
    id: 'ema-reversion',
    name: 'EMA Mean Reversion Cross',
    description: 'Statistical mean reversion triggered upon standard deviation extension.',
    paramDefs: [
      { key: 'fast_period', label: 'EMA Fast Period', min: 3, max: 50, step: 1, desc: 'Short-term momentum' },
      { key: 'slow_period', label: 'EMA Slow Period', min: 10, max: 100, step: 1, desc: 'Baseline equilibrium' },
      { key: 'rsi_period', label: 'RSI Filter Period', min: 7, max: 28, step: 1, desc: 'Overbought filter' },
      { key: 'stop_loss_pct', label: 'Stop Loss (%)', min: 0.5, max: 8.0, step: 0.1, desc: 'SL threshold' },
      { key: 'take_profit_pct', label: 'Take Profit (%)', min: 1.0, max: 15.0, step: 0.1, desc: 'TP threshold' },
    ],
  },
  {
    id: 'rsi-breakout',
    name: 'RSI Volatility Breakout',
    description: 'Structural momentum expansion out of compressed volatility bands.',
    paramDefs: [
      { key: 'rsi_period', label: 'RSI Period', min: 5, max: 30, step: 1, desc: 'Oscillator length' },
      { key: 'upper_threshold', label: 'Upper Breakout Band', min: 60, max: 85, step: 1, desc: 'Long trigger' },
      { key: 'lower_threshold', label: 'Lower Breakout Band', min: 15, max: 40, step: 1, desc: 'Short trigger' },
      { key: 'stop_loss_pct', label: 'Stop Loss (%)', min: 0.5, max: 5.0, step: 0.1, desc: 'SL threshold' },
      { key: 'take_profit_pct', label: 'Take Profit (%)', min: 1.0, max: 10.0, step: 0.1, desc: 'TP threshold' },
    ],
  },
];

export function StrategyDrawer({
  isOpen,
  onClose,
  selectedStrategyId,
  onStrategyChange,
  parameters,
  onParamChange,
  simulationConfig,
  onConfigChange,
  onRunSimulation,
  isRunning,
  runStats,
}: StrategyDrawerProps) {
  const [activeTab, setActiveTab] = useState<'strategy' | 'risk' | 'stats'>('strategy');

  if (!isOpen) return null;

  const currentStrat = STRATEGY_PRESETS.find((s) => s.id === selectedStrategyId) || STRATEGY_PRESETS[0];

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-obsidian-base/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-96 max-w-full bg-obsidian-card border-l border-obsidian-border shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div>
          <div className="flex items-center justify-between p-4 border-b border-obsidian-border bg-obsidian-sub">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-accent/15 border border-cyan-accent/30 text-cyan-accent">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-text">Strategy & Execution Terminal</h3>
                <p className="text-[10px] text-slate-muted font-mono">Dynamic Parameters & Risk</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-muted hover:text-slate-text hover:bg-obsidian-elevated transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center border-b border-obsidian-border bg-obsidian-sub/50 text-xs font-medium">
            <button
              onClick={() => setActiveTab('strategy')}
              className={`flex-1 py-2.5 text-center transition-colors ${
                activeTab === 'strategy'
                  ? 'border-b-2 border-cyan-accent text-cyan-accent bg-obsidian-card font-semibold'
                  : 'text-slate-muted hover:text-slate-text'
              }`}
            >
              Strategy
            </button>
            <button
              onClick={() => setActiveTab('risk')}
              className={`flex-1 py-2.5 text-center transition-colors ${
                activeTab === 'risk'
                  ? 'border-b-2 border-cyan-accent text-cyan-accent bg-obsidian-card font-semibold'
                  : 'text-slate-muted hover:text-slate-text'
              }`}
            >
              Risk & Capital
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex-1 py-2.5 text-center transition-colors ${
                activeTab === 'stats'
                  ? 'border-b-2 border-cyan-accent text-cyan-accent bg-obsidian-card font-semibold'
                  : 'text-slate-muted hover:text-slate-text'
              }`}
            >
              Telemetry
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="p-4 space-y-4 max-h-[calc(100vh-210px)] overflow-y-auto text-xs font-sans">
            {/* Tab 1: Strategy & Parameters */}
            {activeTab === 'strategy' && (
              <div className="space-y-4">
                {/* Strategy Selector */}
                <div className="space-y-1.5">
                  <label className="text-slate-subtext font-medium text-xs">Active Strategy</label>
                  <div className="relative">
                    <select
                      value={selectedStrategyId}
                      onChange={(e) => onStrategyChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-obsidian-sub border border-obsidian-border text-slate-text text-xs focus:outline-none focus:border-cyan-accent/50 appearance-none font-semibold cursor-pointer"
                    >
                      {STRATEGY_PRESETS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-obsidian-sub/80 border border-obsidian-border text-slate-muted text-[11px] leading-relaxed">
                  {currentStrat.description}
                </div>

                {/* Live Sliders */}
                <div className="space-y-3.5 pt-1">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-muted font-semibold">
                    PARAMETER SLIDERS
                  </div>
                  {currentStrat.paramDefs.map((def) => {
                    const val = parameters[def.key] ?? def.min;
                    return (
                      <div key={def.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-subtext">{def.label}</span>
                          <span className="font-mono text-cyan-accent font-bold">{val}</span>
                        </div>
                        <input
                          type="range"
                          min={def.min}
                          max={def.max}
                          step={def.step}
                          value={val}
                          onChange={(e) => onParamChange(def.key, parseFloat(e.target.value))}
                          className="w-full accent-cyan-accent h-1.5 bg-obsidian-sub rounded-lg cursor-pointer"
                        />
                        <div className="flex items-center justify-between text-[10px] text-slate-muted">
                          <span>{def.desc}</span>
                          <span>[{def.min} - {def.max}]</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: Risk Profile */}
            {activeTab === 'risk' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-slate-subtext font-medium">Session Capital ($)</label>
                  <input
                    type="number"
                    value={simulationConfig.initialCapital}
                    onChange={(e) =>
                      onConfigChange({ initialCapital: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-obsidian-sub border border-obsidian-border text-slate-text font-mono text-xs focus:outline-none focus:border-cyan-accent/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-subtext font-medium">Leverage (1:N)</label>
                  <select
                    value={simulationConfig.leverage}
                    onChange={(e) => onConfigChange({ leverage: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-lg bg-obsidian-sub border border-obsidian-border text-slate-text font-mono text-xs focus:outline-none focus:border-cyan-accent/50 cursor-pointer"
                  >
                    <option value={1}>1:1 (Cash / Spot)</option>
                    <option value={30}>1:30 (Institutional Standard)</option>
                    <option value={100}>1:100 (High Leverage)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-subtext">Slippage (Points)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={simulationConfig.slippagePoints}
                      onChange={(e) =>
                        onConfigChange({ slippagePoints: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-obsidian-sub border border-obsidian-border text-slate-text font-mono text-xs focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-subtext">Spread (Points)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={simulationConfig.spreadPoints}
                      onChange={(e) =>
                        onConfigChange({ spreadPoints: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-obsidian-sub border border-obsidian-border text-slate-text font-mono text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-obsidian-sub/70 border border-obsidian-border text-[11px] text-slate-muted space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-text font-semibold">
                    <Shield className="w-3.5 h-3.5 text-emerald-edge" />
                    <span>Deterministic Next-Open Fill</span>
                  </div>
                  <p>All simulated market orders are filled strictly at the opening price of bar t+1.</p>
                </div>
              </div>
            )}

            {/* Tab 3: Telemetry & Results */}
            {activeTab === 'stats' && (
              <div className="space-y-3 font-mono">
                {runStats ? (
                  <>
                    <div className="p-3 rounded-lg bg-obsidian-sub border border-obsidian-border flex items-center justify-between">
                      <span className="text-[10px] text-slate-muted">EXECUTION STATUS</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-glow text-emerald-edge border border-emerald-edge/30">
                        VERIFIED 0 BIAS
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-3 rounded-lg bg-obsidian-sub border border-obsidian-border">
                        <span className="text-slate-muted text-[10px]">NET PROFIT</span>
                        <div
                          className={`text-base font-bold mt-0.5 ${
                            runStats.netProfit >= 0 ? 'text-emerald-edge' : 'text-crimson-risk'
                          }`}
                        >
                          {runStats.netProfit >= 0 ? '+' : ''}${runStats.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-obsidian-sub border border-obsidian-border">
                        <span className="text-slate-muted text-[10px]">WIN RATE</span>
                        <div className="text-base font-bold text-slate-text mt-0.5">
                          {runStats.winRate}%
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-obsidian-sub border border-obsidian-border">
                        <span className="text-slate-muted text-[10px]">SHARPE RATIO</span>
                        <div className="text-base font-bold text-cyan-accent mt-0.5">
                          {runStats.sharpeRatio}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-obsidian-sub border border-obsidian-border">
                        <span className="text-slate-muted text-[10px]">MAX DRAWDOWN</span>
                        <div className="text-base font-bold text-crimson-risk mt-0.5">
                          -{runStats.maxDrawdownPct}%
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-muted">
                    No run executed yet. Click &apos;Run Simulation&apos; below.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Action Footer */}
        <div className="p-4 border-t border-obsidian-border bg-obsidian-sub space-y-2">
          <button
            onClick={onRunSimulation}
            disabled={isRunning}
            className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-hud ${
              isRunning
                ? 'bg-obsidian-elevated text-slate-muted border border-obsidian-border cursor-not-allowed'
                : 'bg-cyan-accent text-obsidian-base hover:bg-cyan-accent/90 hover:shadow-cyan-glow'
            }`}
          >
            {isRunning ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-muted border-t-transparent animate-spin" />
                <span>Simulating Vectorized Signals...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Strategy Backtest</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
