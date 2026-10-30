'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  Cpu,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Zap,
  Terminal,
  FileCode,
  Scale,
  Database,
  Lock,
  LineChart,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* Animation Variants (Fluid & Subtle Easing)                                 */
/* -------------------------------------------------------------------------- */
const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const cardStagger: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] as const },
  }),
};


/* -------------------------------------------------------------------------- */
/* 1. "From Idea to Evidence" Quant Workflow Pipeline                         */
/* -------------------------------------------------------------------------- */
interface PipelineStep {
  step: string;
  title: string;
  badge: string;
  tagline: string;
  description: string;
  icon: React.ElementType;
  imageSrc: string;
  previewType: 'prompt' | 'replay' | 'autopsy' | 'export';
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    step: '01',
    title: 'Hypothesis Formulation',
    badge: 'Discretionary or AI',
    tagline: 'Natural language prompt or rule-based discretionary logic',
    description:
      'Describe your market edge in plain English or define structured entry rules. BacktestAI AI converts hypotheses directly into typed Python Polars and MQL5 parameter schemas.',
    icon: Sparkles,
    imageSrc: '/assets/ai_synthesis_flow.jpg',
    previewType: 'prompt',
  },
  {
    step: '02',
    title: 'Causal Bar Replay',
    badge: 'Zero Look-Ahead Bias',
    tagline: 'Deterministic microsecond playback across multi-timeframe candles',
    description:
      'Test your discretionary instincts or verify automated order triggers intrabar-by-intrabar. Every simulated fill accounts for realistic spreads, slippage, and liquidity.',
    icon: Activity,
    imageSrc: '/assets/replay_canvas.jpg',
    previewType: 'replay',
  },
  {
    step: '03',
    title: 'Forensic Stress Autopsy',
    badge: 'Overfitting Destruction',
    tagline: 'Walk-forward rolling envelopes and 1,000-path Monte Carlo simulations',
    description:
      'Subject the strategy to multi-year out-of-sample stress testing. Calculate probability of ruin, Sharpe degradation, and parameter sensitivity before risking real capital.',
    icon: ShieldAlert,
    imageSrc: '/assets/autopsy_workspace.jpg',
    previewType: 'autopsy',
  },
  {
    step: '04',
    title: 'Production Export',
    badge: '1-Click Deployment',
    tagline: 'Export native MetaTrader 5 Expert Advisors or Python trading daemons',
    description:
      'Instantly compile clean, typed `.mq5` Expert Advisors with OnTick handlers, stop-loss protection, and lot sizing ready for live MetaTrader 5 or automated broker APIs.',
    icon: Cpu,
    imageSrc: '/assets/quant_ide.jpg',
    previewType: 'export',
  },
];

/* -------------------------------------------------------------------------- */
/* 2. Interactive SVG Equity Curve Comparison                                 */
/* -------------------------------------------------------------------------- */
function EquityComparisonSvg({ activeStrategy }: { activeStrategy: 'strategy_a' | 'strategy_b' }) {
  // 600 x 220 viewBox: x=0..600, y=0..220. x=300 is the In-Sample / Out-of-Sample boundary.
  // Strategy A (Overfitted): climbs to y=30 at x=300 (+412%), then crashes to y=190 at x=600 (-54%).
  const pathA =
    'M 20 160 Q 90 145, 150 110 T 230 65 T 300 30 Q 360 45, 410 115 T 490 165 T 580 195';
  const areaA = `${pathA} L 580 210 L 20 210 Z`;

  // Strategy B (Causal): climbs to y=90 at x=300 (+184%), then steadily compounds to y=45 at x=600 (+162%).
  const pathB =
    'M 20 165 Q 90 150, 160 130 T 230 110 T 300 90 Q 370 78, 440 68 T 510 55 T 580 45';
  const areaB = `${pathB} L 580 210 L 20 210 Z`;

  return (
    <div className="w-full relative rounded-2xl bg-[#080B10] border border-[#202A38] p-4 select-none">
      {/* SVG Canvas */}
      <svg
        viewBox="0 0 600 220"
        className="w-full h-48 md:h-56 overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F87171" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#F87171" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34D399" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#34D399" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Baseline Grids */}
        <line x1="20" y1="30" x2="580" y2="30" stroke="#1A2332" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="20" y1="90" x2="580" y2="90" stroke="#1A2332" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="20" y1="150" x2="580" y2="150" stroke="#1A2332" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="20" y1="200" x2="580" y2="200" stroke="#1A2332" strokeWidth="1" strokeDasharray="3 3" />

        {/* Labels on y-axis */}
        <text x="24" y="26" fill="#64748B" fontSize="9" fontFamily="monospace">+400%</text>
        <text x="24" y="86" fill="#64748B" fontSize="9" fontFamily="monospace">+200%</text>
        <text x="24" y="146" fill="#64748B" fontSize="9" fontFamily="monospace">0% BASE</text>
        <text x="24" y="196" fill="#64748B" fontSize="9" fontFamily="monospace">-50% DD</text>

        {/* Vertical Partition Line: In-Sample vs Out-of-Sample Boundary */}
        <line
          x1="300"
          y1="15"
          x2="300"
          y2="210"
          stroke="#38BDF8"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          opacity="0.6"
        />

        {/* Areas under curves */}
        {activeStrategy === 'strategy_a' && (
          <path d={areaA} fill="url(#gradA)" className="transition-opacity duration-500" />
        )}
        {activeStrategy === 'strategy_b' && (
          <path d={areaB} fill="url(#gradB)" className="transition-opacity duration-500" />
        )}

        {/* Animated Curve A (Strategy A: Rose) */}
        <motion.path
          d={pathA}
          fill="none"
          stroke="#F87171"
          strokeWidth={activeStrategy === 'strategy_a' ? 2.5 : 1.2}
          strokeOpacity={activeStrategy === 'strategy_a' ? 0.95 : 0.3}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: 'easeInOut' }}
        />

        {/* Animated Curve B (Strategy B: Muted Jade) */}
        <motion.path
          d={pathB}
          fill="none"
          stroke="#34D399"
          strokeWidth={activeStrategy === 'strategy_b' ? 2.5 : 1.2}
          strokeOpacity={activeStrategy === 'strategy_b' ? 0.95 : 0.3}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: 'easeInOut', delay: 0.15 }}
        />

        {/* Marker points at boundary (x=300) */}
        <circle cx="300" cy="30" r="3.5" fill="#F87171" />
        <circle cx="300" cy="90" r="3.5" fill="#34D399" />

        {/* End markers at (x=580) */}
        <circle cx="580" cy="195" r="4" fill="#F87171" />
        <circle cx="580" cy="45" r="4" fill="#34D399" />
      </svg>

      {/* Boundary Legend Badges */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-[#1A2332]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-500" />
          <span>IN-SAMPLE (TRAINING FIT)</span>
        </div>
        <div className="flex items-center gap-1.5 text-cyan-accent/80 font-bold">
          <span>WALK-FORWARD BOUNDARY</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-accent" />
          <span>OUT-OF-SAMPLE (REALITY)</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Strategy Data                                                           */
/* -------------------------------------------------------------------------- */
interface StrategyProfile {
  id: 'strategy_a' | 'strategy_b';
  label: string;
  title: string;
  type: string;
  isOverfitted: boolean;
  verdict: string;
  metrics: {
    inSampleReturn: string;
    outSampleReturn: string;
    retentionRate: string;
    maxDrawdown: string;
    sharpeRatio: string;
    ruinProbability: string;
    sampleTrades: string;
  };
  narrative: string;
}

const STRATEGIES: Record<'strategy_a' | 'strategy_b', StrategyProfile> = {
  strategy_a: {
    id: 'strategy_a',
    label: 'STRATEGY A',
    title: 'The Overfitted Illusion',
    type: 'Multi-Indicator Curve Fit (RSI + MACD + 5 EMAs)',
    isOverfitted: true,
    verdict: 'FAILS FORENSIC AUTOPSY · HIGH RUIN RISK',
    metrics: {
      inSampleReturn: '+412.8%',
      outSampleReturn: '-54.2%',
      retentionRate: '13.1% (Catastrophic Collapse)',
      maxDrawdown: '48.6%',
      sharpeRatio: '0.41 Net',
      ruinProbability: '42.3%',
      sampleTrades: '1,420 trades',
    },
    narrative:
      'Tuned across 25 free parameters to perfectly match historical noise. Looks profitable in naive backtests, but completely collapses when exposed to real out-of-sample market regimes.',
  },
  strategy_b: {
    id: 'strategy_b',
    label: 'STRATEGY B',
    title: 'The Causal Quant Edge',
    type: 'Volatility Regime Reversion (ATR Dynamic Band + Volume)',
    isOverfitted: false,
    verdict: 'PASSES FORENSIC AUTOPSY · INSTITUTIONAL GRADE',
    metrics: {
      inSampleReturn: '+184.2%',
      outSampleReturn: '+162.8%',
      retentionRate: '88.4% (Causal Edge Retained)',
      maxDrawdown: '8.4%',
      sharpeRatio: '2.18 Net',
      ruinProbability: '0.0%',
      sampleTrades: '864 trades',
    },
    narrative:
      'Built upon structural liquidity mechanics with minimal degrees of freedom. Survives rolling 12-month walk-forward windows and 1,000 Monte Carlo trade reshuffles with zero ruin probability.',
  },
};

export function InteractiveProofSection() {
  const [activePipelineStep, setActivePipelineStep] = useState<number>(0);
  const [activeStrategyKey, setActiveStrategyKey] = useState<'strategy_a' | 'strategy_b'>('strategy_b');

  const activeStrategy = STRATEGIES[activeStrategyKey];
  const activePipeline = PIPELINE_STEPS[activePipelineStep];

  return (
    <section className="w-full py-20 relative select-none font-sans space-y-28">
      {/* ==================================================================== */}
      {/* SECTION 1: "FROM IDEA TO EVIDENCE" QUANT LIFECYCLE                   */}
      {/* ==================================================================== */}
      <motion.div
        className="max-w-6xl mx-auto px-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        variants={sectionVariants}
      >
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111722] border border-[#202A38] text-[11px] font-mono text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-cyan-accent" />
            <span>THE QUANTITATIVE PIPELINE</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-100">
            From Idea to Evidence.
          </h2>
          <p className="text-sm text-slate-400">
            A continuous, institutional research cycle uniting discretionary charting with AI algorithmic generation.
          </p>
        </div>

        {/* Stepper Tabs with Staggered Scroll Reveal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {PIPELINE_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === activePipelineStep;

            return (
              <motion.button
                key={step.step}
                type="button"
                custom={idx}
                variants={cardStagger}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                onClick={() => setActivePipelineStep(idx)}
                className={`p-4 rounded-2xl border text-left transition-all duration-300 relative cursor-pointer ${
                  isActive
                    ? 'bg-[#151C27] border-cyan-accent/40 shadow-sm'
                    : 'bg-[#0D1118]/80 border-[#202A38] hover:bg-[#151C27]/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                      isActive ? 'bg-cyan-accent/15 text-cyan-accent' : 'bg-[#111722] text-slate-500'
                    }`}
                  >
                    STEP {step.step}
                  </span>
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-cyan-accent' : 'text-slate-500'
                    }`}
                  />
                </div>
                <div className="font-bold text-slate-200 text-sm mb-1">{step.title}</div>
                <div className="text-[11px] text-slate-400 leading-snug">{step.tagline}</div>

                {isActive && (
                  <motion.div
                    layoutId="activePipelineIndicator"
                    className="absolute bottom-0 left-4 right-4 h-0.5 bg-cyan-accent/80 rounded-full"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Pipeline Step Interactive Display Card */}
        <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePipeline.step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
            >
              {/* Left Description */}
              <div className="lg:col-span-5 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111722] border border-[#202A38] text-xs font-mono text-slate-300">
                  <activePipeline.icon className="w-3.5 h-3.5 text-cyan-accent" />
                  <span>{activePipeline.badge}</span>
                </div>

                <h3 className="text-2xl font-bold text-slate-100">
                  {activePipeline.step} · {activePipeline.title}
                </h3>

                <p className="text-sm text-slate-400 leading-relaxed">
                  {activePipeline.description}
                </p>

                <div className="pt-2 flex items-center gap-3">
                  {activePipeline.previewType === 'prompt' && (
                    <Link
                      href="/app/quant"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-accent text-obsidian-base font-bold font-mono text-xs hover:bg-cyan-accent/90 transition-all shadow-hud"
                    >
                      <span>Try AI Generator</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                  {activePipeline.previewType === 'replay' && (
                    <Link
                      href="/app/backtest"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-accent text-obsidian-base font-bold font-mono text-xs hover:bg-cyan-accent/90 transition-all shadow-hud"
                    >
                      <span>Launch Replay Studio</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                  {activePipeline.previewType === 'autopsy' && (
                    <Link
                      href="/app/strategies"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-accent text-obsidian-base font-bold font-mono text-xs hover:bg-cyan-accent/90 transition-all shadow-hud"
                    >
                      <span>Inspect Forensics</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                  {activePipeline.previewType === 'export' && (
                    <Link
                      href="/app/quant"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-accent text-obsidian-base font-bold font-mono text-xs hover:bg-cyan-accent/90 transition-all shadow-hud"
                    >
                      <span>Export MQL5 EA</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>

              {/* Right Dedicated Graphic/Screenshot Preview */}
              <div className="lg:col-span-7">
                <div className="rounded-2xl border border-[#202A38] bg-[#07090E] p-3 relative overflow-hidden shadow-inner">
                  <div className="relative h-64 sm:h-72 w-full rounded-xl overflow-hidden">
                    <Image
                      src={activePipeline.imageSrc}
                      alt={activePipeline.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 600px"
                      className="object-cover object-center filter brightness-[0.95] contrast-[1.05]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#07090E]/80 via-transparent to-black/20 pointer-events-none" />

                    {/* Overlay pill indicator */}
                    <div className="absolute bottom-3 left-3 right-3 p-2.5 rounded-lg bg-[#0D1118]/90 border border-[#202A38] backdrop-blur-md flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-300 font-semibold">{activePipeline.title}</span>
                      <span className="text-cyan-accent text-[11px] font-bold">VERIFIED PIPELINE</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ==================================================================== */}
      {/* SECTION 2: STRATEGY A VS STRATEGY B (THE OVERFITTING TRAP)           */}
      {/* ==================================================================== */}
      <motion.div
        className="max-w-6xl mx-auto px-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        variants={sectionVariants}
      >
        <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-8 md:p-10 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111722] border border-[#202A38] text-[11px] font-mono text-slate-400">
              <Scale className="w-3.5 h-3.5 text-slate-400" />
              <span>FORENSIC VERIFICATION</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-100">
              Why Forensic Verification Matters.
            </h2>
            <p className="text-sm text-slate-400">
              Strategy A (Overfitted Curve) vs Strategy B (Structural Edge). Naive backtests make every strategy look profitable until live execution begins.
            </p>
          </div>

          {/* Interactive SVG Equity Comparison Chart */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5 font-bold text-slate-200">
                <LineChart className="w-4 h-4 text-cyan-accent" />
                <span>WALK-FORWARD DEGRADATION ENVELOPE</span>
              </span>
              <span className="text-[11px] text-slate-500">CLICK STRATEGY TO INSPECT</span>
            </div>
            <EquityComparisonSvg activeStrategy={activeStrategyKey} />
          </div>

          {/* Side-by-Side Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* STRATEGY A CARD (Muted, elegant warning palette) */}
            <div
              onClick={() => setActiveStrategyKey('strategy_a')}
              className={`p-6 rounded-2xl border transition-all cursor-pointer relative ${
                activeStrategyKey === 'strategy_a'
                  ? 'bg-[#0E121A] border-rose-500/40 shadow-sm'
                  : 'bg-[#0D1118]/70 border-[#202A38] hover:border-slate-600 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                  STRATEGY A · THE TRAP
                </span>
                <span className="text-[11px] font-mono text-slate-500">25 Free Parameters</span>
              </div>

              <h4 className="text-lg font-bold text-slate-100 mb-1">Naive Multi-Indicator Curve Fit</h4>
              <p className="text-xs text-slate-400 mb-4">{STRATEGIES.strategy_a.narrative}</p>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-4">
                <div className="p-2.5 rounded-lg bg-[#080B10] border border-[#202A38]">
                  <span className="text-slate-500 text-[10px] block">IN-SAMPLE RETURN</span>
                  <span className="text-slate-200 font-bold text-sm">+412.8%</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#080B10] border border-rose-500/20">
                  <span className="text-slate-500 text-[10px] block">OUT-OF-SAMPLE</span>
                  <span className="text-rose-400 font-bold text-sm">-54.2%</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#080B10] border border-[#202A38]">
                  <span className="text-slate-500 text-[10px] block">MAX DRAWDOWN</span>
                  <span className="text-slate-300 font-bold text-sm">48.6%</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#080B10] border border-rose-500/20">
                  <span className="text-slate-500 text-[10px] block">RUIN PROBABILITY</span>
                  <span className="text-rose-400 font-bold text-sm">42.3%</span>
                </div>
              </div>

              <div className="px-3 py-1.5 rounded-lg bg-[#111622] border border-rose-500/25 text-rose-300 text-xs font-mono font-medium flex items-center justify-between">
                <span>VERDICT: OVERFITTED</span>
                <span className="text-rose-400 font-bold">FAIL</span>
              </div>
            </div>

            {/* STRATEGY B CARD (Muted, elegant institutional palette) */}
            <div
              onClick={() => setActiveStrategyKey('strategy_b')}
              className={`p-6 rounded-2xl border transition-all cursor-pointer relative ${
                activeStrategyKey === 'strategy_b'
                  ? 'bg-[#0E151E] border-emerald-500/40 shadow-sm'
                  : 'bg-[#0D1118]/70 border-[#202A38] hover:border-slate-600 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  STRATEGY B · CAUSAL EDGE
                </span>
                <span className="text-[11px] font-mono text-slate-500">3 Structural Parameters</span>
              </div>

              <h4 className="text-lg font-bold text-slate-100 mb-1">Causal Volatility Regime Reversion</h4>
              <p className="text-xs text-slate-400 mb-4">{STRATEGIES.strategy_b.narrative}</p>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-4">
                <div className="p-2.5 rounded-lg bg-[#080B10] border border-[#202A38]">
                  <span className="text-slate-500 text-[10px] block">IN-SAMPLE RETURN</span>
                  <span className="text-slate-200 font-bold text-sm">+184.2%</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#080B10] border border-emerald-500/20">
                  <span className="text-slate-500 text-[10px] block">OUT-OF-SAMPLE</span>
                  <span className="text-emerald-400 font-bold text-sm">+162.8%</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#080B10] border border-[#202A38]">
                  <span className="text-slate-500 text-[10px] block">MAX DRAWDOWN</span>
                  <span className="text-slate-300 font-bold text-sm">8.4%</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#080B10] border border-emerald-500/20">
                  <span className="text-slate-500 text-[10px] block">RUIN PROBABILITY</span>
                  <span className="text-emerald-400 font-bold text-sm">0.0%</span>
                </div>
              </div>

              <div className="px-3 py-1.5 rounded-lg bg-[#0E1720] border border-emerald-500/25 text-emerald-300 text-xs font-mono font-medium flex items-center justify-between">
                <span>VERDICT: INSTITUTIONAL GRADE</span>
                <span className="text-emerald-400 font-bold">PASS</span>
              </div>
            </div>
          </div>

          {/* Retention Rate Visual Gauge (Slim, minimal, refined) */}
          <div className="p-5 rounded-2xl bg-[#080B10] border border-[#202A38] text-xs font-mono space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span>Walk-Forward Out-of-Sample Alpha Retention</span>
              <span className="text-slate-500">Benchmark: &gt; 70%</span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-slate-400">Strategy A (Overfitted Noise)</span>
                  <span className="text-rose-400 font-semibold">13.1%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#151D28] overflow-hidden">
                  <motion.div
                    className="h-full bg-rose-400/80 rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: '13.1%' }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-slate-300">Strategy B (Causal Quant Edge)</span>
                  <span className="text-emerald-400 font-semibold">88.4%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#151D28] overflow-hidden">
                  <motion.div
                    className="h-full bg-emerald-400/80 rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: '88.4%' }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: 'easeOut', delay: 0.15 }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ==================================================================== */}
      {/* SECTION 3: THE TWO SEPARATED PILLARS                                 */}
      {/* ==================================================================== */}
      <motion.div
        className="max-w-6xl mx-auto px-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        variants={sectionVariants}
      >
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111722] border border-[#202A38] text-[11px] font-mono text-slate-400">
            <span>PLATFORM ARCHITECTURE</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-100">
            Two Separated Pillars. <br />
            One Sovereign Research Command.
          </h2>
          <p className="text-sm text-slate-400">
            Discretionary replay traders and algorithmic quants operate in dedicated, zero-compromise environments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* PILLAR 1 CARD */}
          <div className="p-8 rounded-3xl border border-[#202A38] bg-[#0A0E15] relative overflow-hidden group hover:border-cyan-accent/40 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="w-11 h-11 rounded-2xl bg-cyan-accent/10 border border-cyan-accent/20 flex items-center justify-center text-cyan-accent">
                <Activity className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#111722] border border-[#202A38] text-slate-300">
                PILLAR 1 · DISCRETIONARY
              </span>
            </div>

            <h3 className="text-2xl font-bold text-slate-100 mb-2">Replay Studio</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              A TradingView-grade canvas occupying 90% of viewport. Step forward and backward
              microsecond bars, execute simulated orders with custom lot sizing, and log setup notes
              into your continuous session journal.
            </p>

            <div className="space-y-2.5 mb-8 text-xs font-mono text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-accent" />
                <span>Universal Timeframe Selector (1m, 5m, 15m, 1h, 4h, 1D)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-accent" />
                <span>On-Chart Order Execution HUD with Market, SL &amp; TP</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-accent" />
                <span>Synchronized Trading Journal &amp; Trade Ledger</span>
              </div>
            </div>

            <Link
              href="/app/backtest"
              className="w-full py-3 px-4 rounded-xl bg-cyan-accent text-obsidian-base font-bold text-xs hover:bg-cyan-accent/90 transition-all flex items-center justify-center gap-2 shadow-hud active:scale-95"
            >
              <span>Launch Replay Studio</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* PILLAR 2 CARD */}
          <div className="p-8 rounded-3xl border border-[#202A38] bg-[#0A0E15] relative overflow-hidden group hover:border-slate-500/40 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="w-11 h-11 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                <Cpu className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#111722] border border-[#202A38] text-slate-300">
                PILLAR 2 · ALGORITHMIC &amp; AI
              </span>
            </div>

            <h3 className="text-2xl font-bold text-slate-100 mb-2">Quant Trading Lab</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Algorithmic research IDE with dual support for Python Polars and MQL5 MetaTrader 5.
              Leverage natural language AI strategy generation, bidirectional code transpilation, and
              instant 1-click Expert Advisor downloads.
            </p>

            <div className="space-y-2.5 mb-8 text-xs font-mono text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-400" />
                <span>Python (Polars Engine) &amp; MQL5 (MetaTrader 5 EA)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-400" />
                <span>Real-Time Reactive Strategy Parameter AST Parser</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-400" />
                <span>Claude AI Co-Pilot &amp; Bidirectional Transpiler</span>
              </div>
            </div>

            <Link
              href="/app/quant"
              className="w-full py-3 px-4 rounded-xl bg-[#151C27] hover:bg-[#1C2636] border border-[#202A38] hover:border-slate-500/50 text-slate-200 font-semibold text-xs transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <span>Open Quant Trading Lab</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ==================================================================== */}
      {/* SECTION 4: ENGINE BENCHMARK & COMPUTATIONAL SUPERIORITY              */}
      {/* ==================================================================== */}
      <motion.div
        className="max-w-6xl mx-auto px-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        variants={sectionVariants}
      >
        <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-8 md:p-10 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111722] border border-[#202A38] text-[11px] font-mono text-slate-400">
              <Zap className="w-3.5 h-3.5 text-cyan-accent" />
              <span>ENGINE BENCHMARKS</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-100">
              Polars &amp; DuckDB Speed. Microsecond Precision.
            </h2>
            <p className="text-sm text-slate-400">
              Legacy backtesters rely on slow Pandas iteration and giant CSV files. BacktestAI streams columnar Parquet slices with zero memory copying.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-mono">
            <div className="p-6 rounded-2xl bg-[#0D1118] border border-[#202A38] space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 text-slate-300 font-bold">
                  <Zap className="w-4 h-4 text-cyan-accent" />
                  EXECUTION LATENCY
                </span>
                <span className="text-[10px] text-slate-400 bg-[#151C27] px-2 py-0.5 rounded">45x FASTER</span>
              </div>
              <div className="text-2xl font-bold text-slate-100">0.024 ms / bar</div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Native Rust Polars parallelized kernels executing complex multi-factor rules with zero Python GIL overhead.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0D1118] border border-[#202A38] space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 text-slate-300 font-bold">
                  <Database className="w-4 h-4 text-slate-400" />
                  DATA STREAMING
                </span>
                <span className="text-[10px] text-slate-400 bg-[#151C27] px-2 py-0.5 rounded">DUCKDB NATIVE</span>
              </div>
              <div className="text-2xl font-bold text-slate-100">0-Copy Parquet</div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Stream terabytes of historical OHLCV data directly from columnar disk without loading entire datasets into RAM.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0D1118] border border-[#202A38] space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 text-slate-300 font-bold">
                  <Lock className="w-4 h-4 text-slate-400" />
                  CAUSALITY LOCK
                </span>
                <span className="text-[10px] text-emerald-400/90 bg-[#151C27] px-2 py-0.5 rounded">GUARANTEED</span>
              </div>
              <div className="text-2xl font-bold text-slate-100">0.000% Look-Ahead</div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Mathematical invariant: bar $t$ never accesses information from $t+1$. No survivorship bias, no future leak.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
