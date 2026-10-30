'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Clock,
  Sliders,
  CheckCircle2,
  BookOpen,
  Sparkles,
  Maximize2,
  Play,
  RotateCcw,
} from 'lucide-react';

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const CHART_FEATURES = [
  {
    title: '90% Viewport Domination',
    description: 'TradingView-grade chart canvas built for institutional focus. Minimal chrome, maximum price clarity, and distraction-free analysis.',
    icon: Maximize2,
  },
  {
    title: 'Intrabar Replay Scrubber',
    description: 'Step forward or backward bar-by-bar or tick-by-tick. Scrub seamlessly between 1m, 5m, 15m, 1h, 4h, and 1D without desynchronization.',
    icon: Clock,
  },
  {
    title: 'On-Chart Order Execution HUD',
    description: 'Place simulated Market, Limit, and Stop orders directly during active replay. Set Stop Loss, Take Profit, and lot sizing in real-time.',
    icon: Sliders,
  },
  {
    title: 'Integrated Session Journal',
    description: 'Log your emotional state, trade thesis, and setup notes. Every simulated trade is permanently linked to its historical replay timestamp.',
    icon: BookOpen,
  },
];

export default function ChartsFeaturePage() {
  return (
    <div className="py-16 md:py-24 space-y-24">
      {/* 1. Hero */}
      <section className="max-w-5xl mx-auto px-6 space-y-6 text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          className="space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111722] border border-[#202A38] text-[11px] font-mono text-slate-400">
            <Activity className="w-3.5 h-3.5 text-cyan-accent" />
            <span>DISCRETIONARY REPLAY CANVAS</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-100">
            TradingView Clarity. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-accent to-slate-200">
              Microsecond Bar Control.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Practice manual discretionary trading on historical data without look-ahead cues. Step candles one-by-one, execute simulated orders, and build genuine market intuition.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/app/backtest"
              className="px-6 py-3 rounded-xl bg-cyan-accent text-obsidian-base font-bold font-mono text-xs hover:bg-cyan-accent/90 transition-all shadow-hud"
            >
              Launch Replay Studio Free
            </Link>
          </div>
        </motion.div>
      </section>

      {/* 2. Visual Terminal Showcase */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-3 sm:p-5 shadow-2xl relative overflow-hidden">
          <div className="relative h-[380px] sm:h-[480px] w-full rounded-2xl overflow-hidden">
            <Image
              src="/assets/replay_canvas.jpg"
              alt="Replay Studio Interactive Canvas"
              fill
              sizes="(max-width: 1200px) 100vw, 1200px"
              className="object-cover object-center filter brightness-[0.98] contrast-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E15]/70 via-transparent to-black/20 pointer-events-none" />

            <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-[#0D1118]/90 border border-[#202A38] backdrop-blur-md flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-slate-200 font-bold">REPLAY ENGINE :: 120 FPS STREAM</span>
              </div>
              <div className="text-slate-400 text-[11px] hidden sm:block">
                TIMEFRAME: 1M · SPREAD: 0.15 PIPS · ZERO LOOKAHEAD
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Four Core Capabilities */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CHART_FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="p-7 rounded-3xl border border-[#202A38] bg-[#0A0E15] space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-[#111722] border border-[#202A38] flex items-center justify-center text-cyan-accent">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-slate-100">{feat.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  {feat.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Discretionary Execution Specs */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-8 md:p-10 shadow-2xl space-y-6">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl font-bold text-slate-100">
              Why Discretionary Traders Rely on Replay Studio
            </h2>
            <p className="text-xs text-slate-400">
              Unlike static charts or video replays, Replay Studio lets you interact with historical price as if it were happening live right now.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-4 rounded-xl bg-[#0D1118] border border-[#202A38]">
              <span className="text-slate-500 text-[10px] block">TIMEFRAMES</span>
              <span className="text-slate-200 font-bold">1m, 5m, 15m, 1h, 4h, 1D</span>
            </div>
            <div className="p-4 rounded-xl bg-[#0D1118] border border-[#202A38]">
              <span className="text-slate-500 text-[10px] block">SPEED CONTROL</span>
              <span className="text-slate-200 font-bold">0.1x to 10x Playback</span>
            </div>
            <div className="p-4 rounded-xl bg-[#0D1118] border border-[#202A38]">
              <span className="text-slate-500 text-[10px] block">ORDER TYPES</span>
              <span className="text-slate-200 font-bold">Market, SL, TP, Lots</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
