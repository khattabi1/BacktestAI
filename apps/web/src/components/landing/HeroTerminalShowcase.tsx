'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Activity,
  Cpu,
  Layers,
  ArrowRight,
  Terminal,
} from 'lucide-react';

type TerminalView = 'replay' | 'quant' | 'autopsy';

interface ViewConfig {
  id: TerminalView;
  stepNumber: string;
  title: string;
  badge: string;
  imageSrc: string;
  headline: string;
  description: string;
  route: string;
  ctaText: string;
  statusLabel: string;
}

const VIEWS: Record<TerminalView, ViewConfig> = {
  replay: {
    id: 'replay',
    stepNumber: '01',
    title: 'Replay Studio',
    badge: 'Discretionary Canvas',
    imageSrc: '/assets/replay_canvas.jpg',
    headline: 'TradingView-Grade Interactive Replay Canvas',
    description:
      'Deterministic bar-by-bar market playback with microsecond intrabar resolution. Scrub multi-timeframe candles, place simulated discretionary orders, and build muscle memory with zero look-ahead bias.',
    route: '/app/backtest',
    ctaText: 'Launch Replay Studio',
    statusLabel: '01 · DISCRETIONARY REPLAY ENGINE',
  },
  quant: {
    id: 'quant',
    stepNumber: '02',
    title: 'Quant Trading Lab',
    badge: 'Algorithmic & AI',
    imageSrc: '/assets/quant_ide.jpg',
    headline: 'Dual-Language Python & MQL5 AI Research IDE',
    description:
      'Natural language prompt-to-strategy engine with real-time parameter schema parsing, bidirectional Python Polars ↔ MetaTrader 5 MQL5 EA cross-compilation, and zero-latency strategy deployment.',
    route: '/app/quant',
    ctaText: 'Open Quant Trading Lab',
    statusLabel: '02 · POLARS & MQL5 AI COPILOT',
  },
  autopsy: {
    id: 'autopsy',
    stepNumber: '03',
    title: 'Strategy Autopsy',
    badge: 'Forensic Lab',
    imageSrc: '/assets/autopsy_workspace.jpg',
    headline: 'Don’t Trust the Backtest. Forensic Autopsy.',
    description:
      'Stress-test strategy edges against walk-forward degradation envelopes, 1,000-path Monte Carlo ruin simulations, and regime shift sensitivity matrices before risking a single dollar of live capital.',
    route: '/app/strategies',
    ctaText: 'Inspect Strategy Library',
    statusLabel: '03 · FORENSIC RUIN ENGINE',
  },
};

// Strict sequential order: 01 (Replay) -> 02 (Quant) -> 03 (Autopsy)
const ORDERED_VIEWS: TerminalView[] = ['replay', 'quant', 'autopsy'];

export function HeroTerminalShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Strict 5-second interval timer: strictly advances 0 -> 1 -> 2 -> 0 (1 -> 2 -> 3 -> 1)
  useEffect(() => {
    if (isPaused) return;

    setProgress(0);
    const DURATION = 5000;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= DURATION) {
        clearInterval(interval);
        // Strictly advance: 0 -> 1 -> 2 -> 0
        setActiveIndex((prev) => (prev + 1) % ORDERED_VIEWS.length);
      } else {
        setProgress(Math.min((elapsed / DURATION) * 100, 100));
      }
    }, 40);

    return () => clearInterval(interval);
  }, [activeIndex, isPaused]);

  const activeViewKey = ORDERED_VIEWS[activeIndex];
  const current = VIEWS[activeViewKey];

  return (
    <div
      className="w-full relative select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 1. Sequential Tabs: 01 -> 02 -> 03 */}
      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mb-6">
        {ORDERED_VIEWS.map((viewKey, idx) => {
          const view = VIEWS[viewKey];
          const isActive = idx === activeIndex;

          return (
            <button
              key={view.id}
              type="button"
              onClick={() => {
                setActiveIndex(idx);
                setProgress(0);
              }}
              className={`relative overflow-hidden flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-mono text-xs transition-all duration-300 cursor-pointer ${
                isActive
                  ? 'bg-[#151C27] text-white border border-cyan-accent/50 shadow-hud'
                  : 'bg-[#0D1118]/80 text-slate-400 hover:text-slate-200 hover:bg-[#151C27] border border-[#202A38]'
              }`}
            >
              {/* Step number badge (01, 02, 03) */}
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors ${
                  isActive
                    ? 'bg-cyan-accent/20 text-cyan-accent'
                    : 'bg-[#151C27] text-slate-500'
                }`}
              >
                0{idx + 1}
              </span>

              {view.id === 'replay' && <Activity className="w-3.5 h-3.5 text-cyan-accent" />}
              {view.id === 'quant' && <Cpu className="w-3.5 h-3.5 text-violet-400" />}
              {view.id === 'autopsy' && <Layers className="w-3.5 h-3.5 text-emerald-400" />}

              <span className="font-semibold text-slate-200">{view.title}</span>

              <span className="text-[10px] text-slate-500 hidden sm:inline">
                {view.badge}
              </span>

              {/* Simple, fluid progress bar on active tab */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#202A38]">
                  <div
                    className="h-full bg-cyan-accent transition-all duration-75 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 2. Main Terminal Showcase */}
      <div className="relative max-w-6xl mx-auto">
        {/* Soft Ambient Glow */}
        <div className="absolute -inset-4 bg-gradient-to-r from-cyan-accent/10 via-violet-500/10 to-transparent rounded-3xl blur-3xl opacity-50 pointer-events-none" />

        {/* Outer Frame */}
        <div className="relative rounded-2xl border border-[#202A38] bg-[#0A0E15] shadow-2xl overflow-hidden backdrop-blur-xl">
          {/* Terminal Window Header */}
          <div className="px-5 py-3 border-b border-[#202A38] bg-[#0D1118] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-crimson-risk/80 inline-block shadow-sm" />
                <span className="w-3 h-3 rounded-full bg-amber-400/80 inline-block shadow-sm" />
                <span className="w-3 h-3 rounded-full bg-emerald-edge/80 inline-block shadow-sm" />
              </div>
              <div className="h-4 w-px bg-[#202A38] mx-1" />
              <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
                <Terminal className="w-3.5 h-3.5 text-cyan-accent" />
                <span className="font-bold text-slate-200">
                  BACKTESTAI ::{' '}
                  <span className="text-cyan-accent">{current.statusLabel}</span>
                </span>
                <span className="text-slate-600 hidden sm:inline">·</span>
                <span className="hidden sm:inline-block text-[11px] text-emerald-400 font-semibold">
                  120 FPS STREAM
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={current.route}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-accent text-obsidian-base font-bold font-mono text-xs hover:bg-cyan-accent/90 transition-all shadow-hud active:scale-95"
              >
                <span>{current.ctaText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* 3. Visual Canvas: Simple & Fluid Cross-Fade Transition */}
          <div className="relative h-[480px] w-full overflow-hidden bg-[#080B10]">
            {ORDERED_VIEWS.map((viewKey, idx) => {
              const isCurrent = idx === activeIndex;
              const viewData = VIEWS[viewKey];

              return (
                <div
                  key={viewKey}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                    isCurrent
                      ? 'opacity-100 z-10 pointer-events-auto'
                      : 'opacity-0 z-0 pointer-events-none'
                  }`}
                >
                  <Image
                    src={viewData.imageSrc}
                    alt={viewData.title}
                    fill
                    priority={idx === 0}
                    sizes="(max-width: 1200px) 100vw, 1200px"
                    className="object-cover object-center"
                  />
                  {/* Subtle edge vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E15]/60 via-transparent to-black/20 pointer-events-none" />
                </div>
              );
            })}
          </div>

          {/* 4. Bottom Feature Explainer Bar */}
          <div className="px-6 py-4 bg-[#0D1118] border-t border-[#202A38] flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl text-xs text-slate-400 leading-relaxed font-sans transition-opacity duration-300">
              <span className="text-slate-100 font-bold">{current.headline}:</span>{' '}
              {current.description}
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <Link
                href="/app/backtest"
                className={`transition-colors flex items-center gap-1 ${
                  activeIndex === 0
                    ? 'text-cyan-accent font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-cyan-accent" />
                <span>Replay Studio</span>
              </Link>
              <span className="text-slate-600">·</span>
              <Link
                href="/app/quant"
                className={`transition-colors flex items-center gap-1 ${
                  activeIndex === 1
                    ? 'text-cyan-accent font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-violet-400" />
                <span>Quant Lab (MQL5)</span>
              </Link>
              <span className="text-slate-600">·</span>
              <Link
                href="/app/strategies"
                className={`transition-colors flex items-center gap-1 ${
                  activeIndex === 2
                    ? 'text-cyan-accent font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Strategy Autopsy</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
