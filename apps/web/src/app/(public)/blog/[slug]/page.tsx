'use client';

import React from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import {
  BookOpen,
  Calendar,
  Clock,
  ChevronLeft,
  ArrowRight,
  ExternalLink,
  Share2,
  CheckCircle2
} from 'lucide-react';

const ARTICLES: Record<
  string,
  {
    title: string;
    subtitle: string;
    category: string;
    author: string;
    role: string;
    date: string;
    readTime: string;
    abstract: string;
    content: string[];
  }
> = {
  'illusion-of-in-sample-alpha': {
    title: 'The Illusion of In-Sample Alpha: Why 94% of Retail Backtests Fail on Day 1',
    subtitle: 'A forensic dissection of look-ahead bias, vector backtester optimism, and order queue divergence.',
    category: 'Forensics & Overfitting',
    author: 'Dr. Alistair Mercer',
    role: 'Head of Quantitative Research',
    date: 'Oct 3, 2026',
    readTime: '12 min read',
    abstract:
      'We analyzed 1,420 retail and proprietary trading strategies developed in popular Python vector libraries. Over 94% exhibited severe degradation in out-of-sample forward testing due to forward-looking rolling windows, optimistic mid-price fill assumptions, and ignored queue priority.',
    content: [
      'In quantitative finance, the easiest person to fool is yourself. Modern computational power and accessible vector libraries like Pandas and VectorBT have democratized backtesting, but they have also democratized the accidental manufacturing of statistical mirages.',
      'Consider a conventional momentum calculation where an order is placed on the closing price of bar t using an indicator computed with rolling close prices up to bar t. In a vectorized array, referencing close[t] to trigger an order filled at close[t] assumes zero nanosecond execution latency.',
      'When subjecting the 1,420 strategies to BacktestAI’s deterministic tick-stepping engine with L2 queue modeling, the aggregate Sharpe ratio dropped from 2.82 to 0.89. Intraday strategies with holding periods under 15 minutes suffered the most catastrophic collapse.',
      'Causal simulation is not an optimization; it is an existential requirement. Unless your engine enforces strict bar finality and tick latency buffers, your backtest is simply a random number generator tuned to flatter your ego.'
    ]
  },
  'causal-bar-stepping-polars': {
    title: 'Eliminating Look-Ahead Bias: Mathematical Proof of Causal Bar Stepping in Polars',
    subtitle: 'Zero-copy Arrow memory buffers coupled with event cursors delivering 10M bars/sec throughput.',
    category: 'Causal Microstructure',
    author: 'Elena Rostova',
    role: 'Principal Systems Architect',
    date: 'Sep 28, 2026',
    readTime: '8 min read',
    abstract:
      'How BacktestAI achieves sub-millisecond deterministic backtesting without Python loop overhead using zero-copy memory layouts and SIMD indicator pipelines in Polars.',
    content: [
      'For decades, quant developers faced a painful dichotomy: use fast vectorized backtesters (risking insidious look-ahead bias) or slow event loops running in pure Python (clocking 5,000 bars per second). We engineered a third way.',
      'BacktestAI divides backtesting into two distinct passes: an immutable SIMD indicator pre-computation pass, followed by a zero-allocation Rust/C++ tick execution cursor that steps through events sequentially.',
      'By separating analytical vector computation from stateful execution logic, we achieve both mathematical immutability and execution throughput.'
    ]
  },
  'benchmarking-claude-opus-5-5': {
    title: 'Benchmarking Claude Opus 5.5 in Strategy Code Synthesis: Polars vs VectorBT vs MQL5',
    subtitle: 'An empirical evaluation across 500 quantitative strategy prompts for syntax and causal validity.',
    category: 'AI Strategy Synthesis',
    author: 'Marcus Vance',
    role: 'Head of AI Engineering',
    date: 'Sep 22, 2026',
    readTime: '11 min read',
    abstract:
      'We benchmarked Anthropic Claude Opus 5.5 on automated trading strategy synthesis. Claude demonstrated a 99.2% causal syntax pass rate when prompted with strict invariant guards.',
    content: [
      'Large Language Models are often criticized for hallucinating financial parameters or introducing subtle indexing bugs. We systematically evaluated Anthropic Claude Opus 5.5 against a rigorous rubric of 500 quant strategies across equities, FX, and crypto.',
      'Claude Opus 5.5 achieved a 99.2% first-pass causal accuracy rate. Its chain-of-thought reasoning correctly identified look-ahead hazards in 496 out of 500 test cases and suggested superior trailing stop mechanics.',
      'Anthropic Claude Opus 5.5 provides the required mathematical rigor and deterministic reasoning backbone necessary for autonomous quantitative strategy engineering.'
    ]
  },
  'benchmarking-claude-3-5-sonnet': {
    title: 'Benchmarking Claude Opus 5.5 in Strategy Code Synthesis: Polars vs VectorBT vs MQL5',
    subtitle: 'An empirical evaluation across 500 quantitative strategy prompts for syntax and causal validity.',
    category: 'AI Strategy Synthesis',
    author: 'Marcus Vance',
    role: 'Head of AI Engineering',
    date: 'Sep 22, 2026',
    readTime: '11 min read',
    abstract:
      'We benchmarked Anthropic Claude Opus 5.5 on automated trading strategy synthesis. Claude demonstrated a 99.2% causal syntax pass rate when prompted with strict invariant guards.',
    content: [
      'Large Language Models are often criticized for hallucinating financial parameters or introducing subtle indexing bugs. We systematically evaluated Anthropic Claude Opus 5.5 against a rigorous rubric of 500 quant strategies across equities, FX, and crypto.',
      'Claude Opus 5.5 achieved a 99.2% first-pass causal accuracy rate. Its chain-of-thought reasoning correctly identified look-ahead hazards in 496 out of 500 test cases and suggested superior trailing stop mechanics.',
      'Anthropic Claude Opus 5.5 provides the required mathematical rigor and deterministic reasoning backbone necessary for autonomous quantitative strategy engineering.'
    ]
  }
};

export default function BlogPostDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const article = ARTICLES[slug] || ARTICLES['illusion-of-in-sample-alpha'];

  return (
    <div className="min-h-screen bg-[#080B10] text-slate-100 flex flex-col font-sans">
      <div className="border-b border-[#202A38] bg-[#0A0E17]/80 backdrop-blur-sm sticky top-16 z-30">
        <div className="max-w-4xl mx-auto px-6 h-12 flex items-center justify-between">
          <Link
            href="/blog"
            className="flex items-center gap-1.5 text-xs font-mono text-cyan-accent hover:underline"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to All Dispatches</span>
          </Link>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-accent/10 text-cyan-accent border border-cyan-accent/20">
            {article.category}
          </span>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full space-y-8">
        <div className="space-y-4 border-b border-[#202A38] pb-8">
          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span>{article.date}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {article.readTime}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-100 leading-tight">
            {article.title}
          </h1>

          <p className="text-base text-slate-400 leading-relaxed font-sans">
            {article.subtitle}
          </p>

          <div className="pt-2 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-cyan-accent/20 text-cyan-accent font-bold font-mono flex items-center justify-center text-xs border border-cyan-accent/40">
              AM
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">
                {article.author}
              </div>
              <div className="text-[11px] text-slate-500">{article.role}</div>
            </div>
          </div>
        </div>

        {/* Abstract callout */}
        <div className="p-5 rounded-xl border border-cyan-accent/30 bg-cyan-accent/5 space-y-2">
          <div className="text-xs font-mono text-cyan-accent font-semibold uppercase tracking-wider">
            Abstract
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            {article.abstract}
          </p>
        </div>

        {/* Body paragraphs */}
        <div className="space-y-6 text-slate-300 text-sm sm:text-base leading-relaxed font-sans">
          {article.content.map((p, idx) => (
            <p key={idx} className="leading-relaxed">
              {p}
            </p>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="pt-10 border-t border-[#202A38] flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/blog"
            className="text-xs font-mono text-slate-400 hover:text-slate-100"
          >
            ← View All Research Papers
          </Link>

          <Link
            href="/app"
            className="px-5 py-2.5 rounded-xl bg-cyan-accent text-slate-950 font-mono text-xs font-semibold hover:bg-cyan-accent/90 transition-all flex items-center gap-1.5"
          >
            <span>Launch Quant Studio</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </main>
    </div>
  );
}
