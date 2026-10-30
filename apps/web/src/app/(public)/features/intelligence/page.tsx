'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Cpu,
  Sparkles,
  ArrowRight,
  FileCode,
  CheckCircle2,
  GitBranch,
  Terminal,
  Zap,
} from 'lucide-react';

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const AI_CAPABILITIES = [
  {
    title: 'Natural Language Prompt-to-Strategy',
    description: 'Describe an entry thesis in plain text. Claude quantitative reasoning translates market concepts into typed parameter schemas with stop-loss and take-profit bounds.',
    tag: 'Claude Opus 5.5',
  },
  {
    title: 'Bidirectional Python ↔ MQL5 Translation',
    description: 'Seamless cross-compilation between vectorized Python Polars research code and production MetaTrader 5 MQL5 Expert Advisors with zero manual rewriting.',
    tag: 'Bidirectional AST',
  },
  {
    title: 'Reactive Parameter Extraction',
    description: 'Instant AST parsing extracts input parameters, default values, and step sizes, automatically generating reactive UI sliders and parameter matrix grids.',
    tag: 'Real-time AST',
  },
  {
    title: '1-Click Standalone EA Download',
    description: 'Download production-ready `.mq5` Expert Advisors with OnTick event loops, trade manager classes, and risk filters ready to drop into MetaTrader 5 terminal.',
    tag: '1-Click Export',
  },
];

export default function IntelligenceFeaturePage() {
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
            <Cpu className="w-3.5 h-3.5 text-cyan-accent" />
            <span>AI QUANT RESEARCH CO-PILOT</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-100">
            From Plain English <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-accent via-slate-200 to-violet-400">
              to MetaTrader 5 EA in Seconds.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Harness Claude quantitative reasoning to formulate mathematical hypotheses, translate Python logic into native MQL5, and export production trading algorithms.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/app/quant"
              className="px-6 py-3 rounded-xl bg-cyan-accent text-obsidian-base font-bold font-mono text-xs hover:bg-cyan-accent/90 transition-all shadow-hud"
            >
              Open Quant Trading Lab
            </Link>
          </div>
        </motion.div>
      </section>

      {/* 2. Visual AI Synthesis Blueprint */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-3 sm:p-5 shadow-2xl relative overflow-hidden">
          <div className="relative h-[380px] sm:h-[480px] w-full rounded-2xl overflow-hidden">
            <Image
              src="/assets/ai_synthesis_flow.jpg"
              alt="AI Quantitative Strategy Synthesis Blueprint"
              fill
              sizes="(max-width: 1200px) 100vw, 1200px"
              className="object-cover object-center filter brightness-[0.98] contrast-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E15]/70 via-transparent to-black/20 pointer-events-none" />

            <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-[#0D1118]/90 border border-[#202A38] backdrop-blur-md flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-cyan-accent animate-ping" />
                <span className="text-slate-200 font-bold">CLAUDE QUANT COPILOT :: ACTIVE</span>
              </div>
              <div className="text-slate-400 text-[11px] hidden sm:block">
                DUAL SYNTAX: PYTHON POLARS + MQL5 EA
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core AI Capabilities */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {AI_CAPABILITIES.map((cap) => (
            <div
              key={cap.title}
              className="p-7 rounded-3xl border border-[#202A38] bg-[#0A0E15] space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#111722] border border-[#202A38] flex items-center justify-center text-cyan-accent">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#111722] border border-[#202A38] text-slate-300">
                  {cap.tag}
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-100">{cap.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                {cap.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Action Card */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-8 md:p-10 shadow-2xl text-center space-y-4">
          <h2 className="text-2xl font-bold text-slate-100">
            Generate Your First Algorithm in Quant Lab
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Experience dual-language code generation, parameter schema reactivity, and instant 1-click EA export.
          </p>
          <div className="pt-2">
            <Link
              href="/app/quant"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-accent text-obsidian-base font-bold font-mono text-xs hover:bg-cyan-accent/90 transition-all shadow-hud"
            >
              <span>Open Quant Trading Lab</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
