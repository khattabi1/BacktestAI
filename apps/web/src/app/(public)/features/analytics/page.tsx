'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  LineChart,
  BarChart2,
  CheckCircle2,
  Flame,
  AlertTriangle,
} from 'lucide-react';

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const FORENSIC_CHECKS = [
  {
    title: '1,000-Path Monte Carlo Resampling',
    description: 'Reshuffle historical trades across 1,000 randomized sequences. Discover if your equity curve was luck or true mathematical edge, and calculate exact ruin probability.',
    metric: '95% Certainty Band',
    icon: ShieldCheck,
  },
  {
    title: 'Sliding Walk-Forward Windows',
    description: 'Optimize on historical slices and validate on untouched forward windows. Measure alpha retention and eliminate parameter curve-fitting.',
    metric: '12 Rolling Slices',
    icon: LineChart,
  },
  {
    title: 'Regime Shift Stress Testing',
    description: 'Stress-test strategies across sudden volatility spikes, liquidity crunches, and macroeconomic shocks (e.g. FOMC, CPI, flash crashes).',
    metric: 'Multi-Regime Check',
    icon: AlertTriangle,
  },
  {
    title: 'Overfitting Risk Score',
    description: 'Quantitative metric rating degrees of freedom, parameter sensitivity, and performance decay from in-sample to out-of-sample.',
    metric: '0 to 100 Score',
    icon: BarChart2,
  },
];

export default function AnalyticsFeaturePage() {
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
            <ShieldAlert className="w-3.5 h-3.5 text-cyan-accent" />
            <span>FORENSIC STRATEGY AUTOPSY</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-100">
            Don’t Trust the Backtest. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-accent to-emerald-400">
              Survive the Autopsy.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Most automated trading systems fail on live accounts because their backtests were overfitted to historical noise. BacktestAI subjects every trading model to institutional stress testing.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/app/strategies"
              className="px-6 py-3 rounded-xl bg-cyan-accent text-obsidian-base font-bold font-mono text-xs hover:bg-cyan-accent/90 transition-all shadow-hud"
            >
              Inspect Strategy Library
            </Link>
          </div>
        </motion.div>
      </section>

      {/* 2. Visual Autopsy Preview */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-3 sm:p-5 shadow-2xl relative overflow-hidden">
          <div className="relative h-[380px] sm:h-[480px] w-full rounded-2xl overflow-hidden">
            <Image
              src="/assets/autopsy_workspace.jpg"
              alt="Forensic Strategy Autopsy Workspace"
              fill
              sizes="(max-width: 1200px) 100vw, 1200px"
              className="object-cover object-center filter brightness-[0.98] contrast-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E15]/70 via-transparent to-black/20 pointer-events-none" />

            <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-[#0D1118]/90 border border-[#202A38] backdrop-blur-md flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-cyan-accent animate-ping" />
                <span className="text-slate-200 font-bold">AUTOPSY ENGINE :: 1,000 RESAMPLE ITERATIONS</span>
              </div>
              <div className="text-emerald-400 text-[11px] font-bold">
                RUIN PROBABILITY: 0.0% · PASS
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Four Core Checks */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FORENSIC_CHECKS.map((check) => {
            const Icon = check.icon;
            return (
              <div
                key={check.title}
                className="p-7 rounded-3xl border border-[#202A38] bg-[#0A0E15] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#111722] border border-[#202A38] flex items-center justify-center text-cyan-accent">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#111722] border border-[#202A38] text-slate-300">
                    {check.metric}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-100">{check.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  {check.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Action Card */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-8 md:p-10 shadow-2xl text-center space-y-4">
          <h2 className="text-2xl font-bold text-slate-100">
            Stop Guessing. Know Your Real Edge.
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Experience the difference between naive historical fitting and genuine statistical robustness.
          </p>
          <div className="pt-2">
            <Link
              href="/app/strategies"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-accent text-obsidian-base font-bold font-mono text-xs hover:bg-cyan-accent/90 transition-all shadow-hud"
            >
              <span>Explore Strategy Autopsy</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
