'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  HelpCircle,
  Search,
  BookOpen,
  Terminal,
  Cpu,
  BarChart2,
  FileCode,
  Database,
  ShieldAlert,
  ArrowRight,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';

interface HelpCategory {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  articles: { title: string; href: string }[];
}

const CATEGORIES: HelpCategory[] = [
  {
    id: 'engine',
    icon: Terminal,
    title: 'Deterministic Engine & Causality',
    desc: 'Mathematical invariants, zero look-ahead bias proofs, and event loop architecture.',
    articles: [
      { title: 'Understanding Zero Look-Ahead Bias Invariant', href: '/docs' },
      { title: 'Accounting Models: Margin, Spread & Slippage', href: '/docs' },
      { title: 'Intrabar Resolution & Candle Tick Slicing', href: '/docs' },
    ],
  },
  {
    id: 'replay',
    icon: BarChart2,
    title: 'Replay Studio & OpenAlgo Charts',
    desc: 'TradingView-grade canvas, manual order HUD, and session journal synchronizations.',
    articles: [
      { title: 'Managing Persistent Backtest Sessions', href: '/docs' },
      { title: 'Placing On-Chart Bracket & Market Orders', href: '/docs' },
      { title: 'Keyboard Shortcuts for Candle-by-Candle Replay', href: '/docs' },
    ],
  },
  {
    id: 'ai-copilot',
    icon: Cpu,
    title: 'Claude AI Strategy Co-Pilot',
    desc: 'Prompt engineering for quant trading, AST schema extraction, and dual-language translation.',
    articles: [
      { title: 'Generating Python Polars Strategies with Claude Opus 5.5', href: '/docs' },
      { title: 'Transpiling Python to MetaTrader 5 MQL5 Expert Advisors', href: '/docs' },
      { title: 'Fixing Syntax & AST Compilation Errors Automatically', href: '/docs' },
    ],
  },
  {
    id: 'data',
    icon: Database,
    title: 'DuckDB & Parquet Data Pipeline',
    desc: 'Columnar storage layout, zero-copy querying, and custom tick CSV/Parquet uploads.',
    articles: [
      { title: 'Partition Hierarchy: data/parquet/{market}/{symbol}', href: '/docs' },
      { title: 'Importing Custom 1-Minute & Tick Datasets', href: '/docs' },
      { title: 'Validating Timestamp Continuity & Missing Bars', href: '/docs' },
    ],
  },
  {
    id: 'mql5',
    icon: FileCode,
    title: 'MQL5 Expert Advisor Export',
    desc: 'Compiling exported .mq5 files, prop firm challenge configuration, and live risk buffers.',
    articles: [
      { title: 'Compiling .mq5 in MetaEditor Without External DLLs', href: '/docs' },
      { title: 'Configuring Trailing Stops & Lot Sizing Classes', href: '/docs' },
      { title: 'Deploying EAs to MetaTrader 5 Live & Demo Accounts', href: '/docs' },
    ],
  },
  {
    id: 'autopsy',
    icon: Layers,
    title: 'Forensic Autopsy & Overfitting',
    desc: '1,000-iteration Monte Carlo stress testing and 12-window Walk-Forward degradation.',
    articles: [
      { title: 'Interpreting the Underwater Drawdown Curve', href: '/docs' },
      { title: 'Monte Carlo Ruin Probability Thresholds', href: '/docs' },
      { title: 'Detecting Regime Dependencies in Out-of-Sample Windows', href: '/docs' },
    ],
  },
];

const FAQS = [
  {
    q: 'How does BacktestAI prevent look-ahead bias?',
    a: 'Every bar in BacktestAI is processed in a strict sequential event loop where state at timestamp t has zero memory access to future bars t+1. All indicator buffers, ATR windows, and pending limit orders calculate strictly over historical lookback intervals.',
  },
  {
    q: 'Can I use BacktestAI without coding knowledge?',
    a: 'Yes. The Replay Studio provides an interactive discretionary trading interface with manual buy/sell buttons, SL/TP brackets, and auto-logging trade blotters. Additionally, our Claude AI Co-Pilot generates algorithmic strategies directly from plain-English prompts.',
  },
  {
    q: 'What data formats are supported for custom market imports?',
    a: 'You can upload CSV or Apache Parquet files containing UTC timestamps, Open, High, Low, Close, and Volume columns. Our DuckDB ingest pipeline automatically formats and indexes the data into partitioned columnar Parquet files.',
  },
  {
    q: 'Are exported MQL5 Expert Advisors standalone?',
    a: 'Yes. All exported .mq5 scripts are 100% standalone, native MetaTrader 5 Expert Advisors with full OnTick handlers and zero external dependencies or proprietary runtime DLLs required.',
  },
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const filteredCategories = CATEGORIES.filter((cat) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      cat.title.toLowerCase().includes(q) ||
      cat.desc.toLowerCase().includes(q) ||
      cat.articles.some((a) => a.title.toLowerCase().includes(q))
    );
  });

  return (
    <div className="py-10 sm:py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-10 sm:space-y-16">
      {/* Header with Search */}
      <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111722] border border-[#202A38] text-[11px] font-mono text-cyan-accent">
          <BookOpen className="w-3.5 h-3.5" />
          <span>KNOWLEDGE BASE & SUPPORT · BACKTESTAI</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-100">
          How can we help your research?
        </h1>
        <p className="text-xs sm:text-base text-slate-400 leading-relaxed">
          Search comprehensive technical guides, architecture specifications, and quantitative workflows.
        </p>

        {/* Search Bar */}
        <div className="relative max-w-2xl mx-auto pt-2">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search docs, invariants, MQL5 export, DuckDB..."
            className="w-full min-h-[48px] pl-12 pr-4 py-3 sm:py-4 rounded-2xl bg-[#0D1118] border border-[#202A38] text-base sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-accent/60 shadow-2xl transition-all font-mono"
          />
        </div>
      </div>

      {/* Categories Grid */}
      <div className="space-y-4">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-400 font-semibold">
          KNOWLEDGE CATEGORIES ({filteredCategories.length})
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredCategories.map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="rounded-2xl border border-[#202A38] bg-[#0A0E15] p-5 sm:p-6 space-y-4 hover:border-slate-600 transition-all shadow-xl flex flex-col justify-between"
              >
                <div className="space-y-2.5 sm:space-y-3">
                  <div className="w-9 h-9 rounded-xl bg-[#111722] border border-[#202A38] flex items-center justify-center text-cyan-accent">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-100 text-sm sm:text-base font-sans">{cat.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">{cat.desc}</p>
                </div>

                <div className="border-t border-[#151D28] pt-3 space-y-1 font-mono text-xs">
                  {cat.articles.map((art) => (
                    <Link
                      key={art.title}
                      href={art.href}
                      className="min-h-[36px] flex items-center justify-between text-slate-400 hover:text-cyan-accent transition-colors py-1 group"
                    >
                      <span className="truncate pr-2">{art.title}</span>
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Link>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Top FAQs */}
      <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-5 sm:p-8 md:p-10 space-y-6 shadow-2xl">
        <div className="space-y-1">
          <span className="text-xs font-mono uppercase tracking-widest text-cyan-accent font-semibold">
            FREQUENTLY ASKED QUESTIONS
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
            Quick Technical Clarifications
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={faq.q}
                className="rounded-2xl border border-[#1A2332] bg-[#0D1118] overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between text-slate-200 hover:text-cyan-accent transition-colors gap-3"
                >
                  <span className="font-semibold text-xs sm:text-sm font-sans">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                      isOpen ? 'rotate-180 text-cyan-accent' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-slate-400 font-sans text-xs leading-relaxed border-t border-[#151D28] pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Escalation CTA */}
      <div className="rounded-2xl border border-[#202A38] bg-[#0D1118] p-5 sm:p-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-6">
        <div className="space-y-1 max-w-2xl">
          <div className="text-sm font-bold text-slate-100 font-sans">
            Couldn&apos;t find an answer in the documentation?
          </div>
          <p className="text-xs text-slate-400 font-sans">
            Open a ticket with our quantitative engineering desk. Professional and Enterprise tiers receive guaranteed 24-hour and 1-hour response SLAs.
          </p>
        </div>
        <Link
          href="/support"
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-cyan-accent text-obsidian-base font-mono text-xs font-bold hover:bg-cyan-accent/90 transition-all shadow-hud shrink-0 flex items-center justify-center"
        >
          Open Support Ticket
        </Link>
      </div>
    </div>
  );
}
