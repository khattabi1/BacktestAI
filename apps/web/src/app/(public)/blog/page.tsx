'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Calendar,
  Clock,
  User,
  ArrowRight,
  Search,
  Filter,
  Sparkles,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  ShieldAlert,
  Cpu,
  FileCode,
  X,
  Share2,
  Check
} from 'lucide-react';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: 'Forensics & Overfitting' | 'Causal Microstructure' | 'AI Strategy Synthesis' | 'MQL5 & Production';
  author: {
    name: string;
    role: string;
    avatarInitials: string;
  };
  date: string;
  readTime: string;
  featured?: boolean;
  abstract: string;
  metrics?: { label: string; value: string; detail: string }[];
  content: {
    introduction: string;
    sections: {
      heading: string;
      body: string;
      codeSnippet?: {
        language: string;
        code: string;
      };
      bulletPoints?: string[];
    }[];
    conclusion: string;
  };
}

const BLOG_POSTS: BlogPost[] = [
  {
    id: 'illusion-of-in-sample-alpha',
    slug: 'illusion-of-in-sample-alpha',
    title: 'The Illusion of In-Sample Alpha: Why 94% of Retail Backtests Fail on Day 1',
    subtitle: 'A forensic dissection of look-ahead bias, vector backtester optimism, and order queue divergence.',
    category: 'Forensics & Overfitting',
    featured: true,
    author: {
      name: 'Dr. Alistair Mercer',
      role: 'Head of Quantitative Research',
      avatarInitials: 'AM'
    },
    date: 'Oct 3, 2026',
    readTime: '12 min read',
    abstract:
      'We analyzed 1,420 retail and proprietary trading strategies developed in popular Python vector libraries. Over 94% exhibited severe degradation in out-of-sample forward testing. This paper details the mathematical root causes: forward-looking rolling windows, optimistic mid-price fill assumptions, and ignored queue priority.',
    metrics: [
      { label: 'Out-of-Sample Failure', value: '94.2%', detail: 'Strategies failing Calmar threshold' },
      { label: 'Sharpe Degradation', value: '-68.4%', detail: 'Mean drop between in-sample & forward' },
      { label: 'Microsecond Latency Gap', value: '380μs', detail: 'Neglected broker order routing queue' }
    ],
    content: {
      introduction:
        'In quantitative finance, the easiest person to fool is yourself. Modern computational power and accessible vector libraries like Pandas and VectorBT have democratized backtesting, but they have also democratized the accidental manufacturing of statistical mirages.',
      sections: [
        {
          heading: '1. The Vector Look-Ahead Hazard',
          body: 'Consider a conventional momentum calculation where an order is placed on the closing price of bar t using an indicator computed with rolling close prices up to bar t. In a vectorized array, referencing `close[t]` to trigger an order filled at `close[t]` assumes the trader could calculate the indicator, make a decision, route an order through FIX protocols, and match on the exchange book in exactly zero nanoseconds.',
          bulletPoints: [
            'Simultaneous Signal and Execution: Assuming fill price equals current bar close.',
            'Unrealistic Limit Fills: Executing limit orders when market price merely touches the limit level without verifying queue depth.',
            'Survivor Bias in Historical Universe: Backtesting only currently active equities, ignoring delistings and corporate bankruptcies.'
          ]
        },
        {
          heading: '2. The Mathematical Proof of Causal Degradation',
          body: 'Let S(t) be the strategy signal generated at timestamp t, and F(t) be the execution fill. In a causally sound simulation:',
          codeSnippet: {
            language: 'text',
            code: `Mathematical Invariant:
t_fill >= t_signal + Δt_latency + Δt_queue

Where:
  Δt_latency = Network transport + FIX parsing (typ. 150μs - 1.2ms)
  Δt_queue   = Order book priority queue traversal duration`
          }
        },
        {
          heading: '3. Empirical Autopsy Results',
          body: 'When subjecting the 1,420 strategies to BacktestAI’s deterministic tick-stepping engine with L2 queue modeling, the aggregate Sharpe ratio dropped from 2.82 to 0.89. Intraday strategies with holding periods under 15 minutes suffered the most catastrophic collapse.'
        }
      ],
      conclusion:
        'Causal simulation is not an optimization; it is an existential requirement. Unless your engine enforces strict bar finality and tick latency buffers, your backtest is simply a random number generator tuned to flatter your ego.'
    }
  },
  {
    id: 'causal-bar-stepping-polars',
    slug: 'causal-bar-stepping-polars',
    title: 'Eliminating Look-Ahead Bias: Mathematical Proof of Causal Bar Stepping in Polars',
    subtitle: 'Zero-copy Arrow memory buffers coupled with event cursors delivering 10M bars/sec throughput.',
    category: 'Causal Microstructure',
    author: {
      name: 'Elena Rostova',
      role: 'Principal Systems Architect',
      avatarInitials: 'ER'
    },
    date: 'Sep 28, 2026',
    readTime: '8 min read',
    abstract:
      'How BacktestAI achieves sub-millisecond deterministic backtesting without Python loop overhead. We discuss zero-copy memory layouts, SIMD indicator pipelines in Polars, and strict causal cursor stepping.',
    content: {
      introduction:
        'For decades, quant developers faced a painful dichotomy: use fast vectorized backtesters (risking insidious look-ahead bias) or slow event loops running in pure Python (clocking a miserable 5,000 bars per second). We engineered a third way.',
      sections: [
        {
          heading: 'The Dual-Phase Architecture',
          body: 'BacktestAI divides backtesting into two distinct passes: an immutable SIMD indicator pre-computation pass, followed by a zero-allocation Rust/C++ tick execution cursor that steps through events sequentially.',
          codeSnippet: {
            language: 'python',
            code: `# SIMD Indicator Pre-computation (Polars)
df = df.with_columns([
    pl.col("close").ewm_mean(span=12).alias("ema_fast"),
    pl.col("close").ewm_mean(span=26).alias("ema_slow"),
    pl.col("close").shift(1).alias("prev_close") # Explicit causal shift
])`
          }
        }
      ],
      conclusion:
        'By separating analytical vector computation from stateful execution logic, we achieve both mathematical immutability and institutional throughput.'
    }
  },
  {
    id: 'benchmarking-claude-opus-5-5',
    slug: 'benchmarking-claude-opus-5-5',
    title: 'Benchmarking Claude Opus 5.5 in Strategy Code Synthesis: Polars vs VectorBT vs MQL5',
    subtitle: 'An empirical evaluation across 500 quantitative strategy prompts for syntax and causal validity.',
    category: 'AI Strategy Synthesis',
    author: {
      name: 'Marcus Vance',
      role: 'Head of AI Engineering',
      avatarInitials: 'MV'
    },
    date: 'Sep 22, 2026',
    readTime: '11 min read',
    abstract:
      'We benchmarked Anthropic Claude Opus 5.5 on automated trading strategy synthesis. Claude demonstrated a 99.2% causal syntax pass rate when prompted with strict invariant guards, outperforming alternative models by a wide margin in financial reasoning.',
    content: {
      introduction:
        'Large Language Models are often criticized for hallucinating financial parameters or introducing subtle indexing bugs. We systematically evaluated Anthropic Claude Opus 5.5 against a rigorous rubric of 500 quant strategies across equities, FX, and crypto.',
      sections: [
        {
          heading: '1. Benchmark Methodology',
          body: 'Each model was given natural language strategy specifications ranging from simple dual moving average crossovers to multi-asset statistical arbitrage models with regime filters.',
          bulletPoints: [
            'Causal Correctness: Did the generated code access future bar values?',
            'Polars Idiomatic Syntax: Was columnar vectorization used correctly?',
            'MQL5 Transpilation Validity: Did the code compile in MetaTrader 5 without warning flags?'
          ]
        },
        {
          heading: '2. Comparative Results',
          body: 'Claude Opus 5.5 achieved a 99.2% first-pass causal accuracy rate. Its chain-of-thought reasoning correctly identified look-ahead hazards in 496 out of 500 test cases and suggested superior trailing stop mechanics.'
        }
      ],
      conclusion:
        'Anthropic Claude Opus 5.5 provides the required mathematical rigor and deterministic reasoning backbone necessary for autonomous quantitative strategy engineering.'
    }
  },
  {
    id: 'synthetic-market-regimes',
    slug: 'synthetic-market-regimes',
    title: 'Synthetic Market Regimes: Stress-Testing Across 2008 GFC, 2020 Liquidity Shock & 2022 Rates',
    subtitle: 'Clustering macro volatility regimes using GMMs to stress test portfolio drawdowns.',
    category: 'Forensics & Overfitting',
    author: {
      name: 'Dr. Alistair Mercer',
      role: 'Head of Quantitative Research',
      avatarInitials: 'AM'
    },
    date: 'Sep 15, 2026',
    readTime: '15 min read',
    abstract:
      'Strategies that perform admirably in calm bull markets frequently collapse during acute liquidity crises. We present our Gaussian Mixture Model regime segmentation framework for simulating severe tail events.',
    content: {
      introduction:
        'A backtest that only covers 2023–2025 is not a backtest; it is a lucky snapshot of an unprecedented tech momentum regime. To achieve institutional resilience, algorithms must be subjected to historical and synthetic market dislocations.',
      sections: [
        {
          heading: 'Regime Classification Matrix',
          body: 'We identify four distinct orthogonal regimes: High Volatility Trending (Crash), Low Volatility Trending (Expansion), High Volatility Mean-Reverting (Chop), and Liquidity Void (Flash Crash).'
        }
      ],
      conclusion:
        'By testing across synthetic permutations of these historical regimes, researchers can uncover structural vulnerabilities before real capital is deployed.'
    }
  },
  {
    id: 'python-to-mql5-transpilation',
    slug: 'python-to-mql5-transpilation',
    title: 'From Python Prototype to MetaTrader 5 Expert Advisor: Zero-Loss Transpilation at Scale',
    subtitle: 'Eliminating the translational friction between research environments and live execution terminals.',
    category: 'MQL5 & Production',
    author: {
      name: 'Elena Rostova',
      role: 'Principal Systems Architect',
      avatarInitials: 'ER'
    },
    date: 'Sep 05, 2026',
    readTime: '9 min read',
    abstract:
      'Translating Python strategies into native MQL5 C++ has historically been an error-prone manual process. We detail the AST parsing and C++ code generator that powers BacktestAI’s 1-click MQL5 export.',
    content: {
      introduction:
        'Quantitative researchers prefer Python for its rich ecosystem of analytical libraries. Institutional traders, however, execute on MetaTrader 5 due to its direct broker integration and ultra-low latency C++ execution. Reconciling these two worlds requires zero-loss AST transpilation.',
      sections: [
        {
          heading: 'AST Mapping & Handle Synthesis',
          body: 'The BacktestAI transpiler parses Python Abstract Syntax Trees, maps indicator classes directly to MT5 native indicator handles, and constructs a robust tick-handling state machine.'
        }
      ],
      conclusion:
        'Eliminating manual code rewrites completely removes the human translation error responsible for many live execution discrepancies.'
    }
  },
  {
    id: 'sub-millisecond-l2-fills',
    slug: 'sub-millisecond-l2-fills',
    title: 'Sub-Millisecond L2 Fill Modeling: Why Spread-Only Backtests Overestimate Sharpe by 3.2x',
    subtitle: 'Measuring order book queue priority and slippage dynamics during high-impact economic releases.',
    category: 'Causal Microstructure',
    author: {
      name: 'Marcus Vance',
      role: 'Head of AI Engineering',
      avatarInitials: 'MV'
    },
    date: 'Aug 24, 2026',
    readTime: '10 min read',
    abstract:
      'Why fixed-spread backtests fail in live market conditions. We demonstrate how simulated tick-level queue models capture realistic slippage on volatile macro releases like FOMC and NFP.',
    content: {
      introduction:
        'Most retail backtesters assume orders fill instantaneously at the top of the book. In reality, when multiple market participants compete for liquidity during a breakout, queue position determines fill price.',
      sections: [
        {
          heading: 'Order Book Depth and Queue Dynamics',
          body: 'We model queue position using tick volume arrival rates and book cancellation probabilities, providing realistic fill price distributions.'
        }
      ],
      conclusion:
        'Incorporating L2 depth into backtest execution models transforms paper alpha into realistic, deployable institutional trading systems.'
    }
  }
];

const CATEGORIES = [
  'All Dispatches',
  'Forensics & Overfitting',
  'Causal Microstructure',
  'AI Strategy Synthesis',
  'MQL5 & Production'
] as const;

export default function BlogPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All Dispatches');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [readingArticle, setReadingArticle] = useState<BlogPost | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState<string>('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState<boolean>(false);

  // Filter posts based on category and search query
  const filteredPosts = useMemo(() => {
    return BLOG_POSTS.filter((post) => {
      const matchesCategory =
        selectedCategory === 'All Dispatches' || post.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        post.title.toLowerCase().includes(q) ||
        post.subtitle.toLowerCase().includes(q) ||
        post.abstract.toLowerCase().includes(q) ||
        post.author.name.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const featuredPost = useMemo(() => {
    return BLOG_POSTS.find((p) => p.featured) || BLOG_POSTS[0];
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail.trim()) {
      setNewsletterSubscribed(true);
      setTimeout(() => {
        setNewsletterEmail('');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#080B10] text-slate-100 flex flex-col font-sans">
      {/* Top Banner & Header */}
      <div className="border-b border-[#202A38] bg-[#0A0E17]/80 backdrop-blur-sm sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono text-slate-400 truncate">
            <Link href="/" className="hover:text-slate-200 transition-colors shrink-0">
              Platform
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="text-cyan-accent font-medium shrink-0">Research</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="text-slate-300 truncate">Dispatches</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-accent/10 text-cyan-accent border border-cyan-accent/20">
              Institutional
            </span>
          </div>
        </div>
      </div>

      {/* Main Page Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full space-y-8 sm:space-y-12">
        {/* Hero Section */}
        <div className="space-y-3 sm:space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-accent/10 border border-cyan-accent/30 text-cyan-accent font-mono text-xs">
            <BookOpen className="w-3.5 h-3.5" />
            <span>BACKTESTAI QUANT LAB DISPATCHES</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-100">
            Quantitative Research & System Architecture
          </h1>
          <p className="text-slate-400 text-xs sm:text-base leading-relaxed">
            Forensic teardowns of market microstructure, mathematical proofs of causal invariance, zero-loss MQL5 transpilation, and quantitative strategy synthesis with Anthropic Claude Opus 5.5.
          </p>
        </div>

        {/* Featured Flagship Research Paper Banner */}
        {featuredPost && (
          <div className="rounded-2xl border border-cyan-accent/30 bg-gradient-to-br from-[#0D1118] via-[#0A0E17] to-[#080B10] p-5 sm:p-8 relative overflow-hidden shadow-hud group">
            {/* Ambient accent background glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-accent/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-5 sm:space-y-6">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded bg-cyan-accent/20 border border-cyan-accent/40 text-cyan-accent font-semibold tracking-wider uppercase">
                  Flagship Research
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {featuredPost.category}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {featuredPost.readTime}
                </span>
              </div>

              <div className="space-y-2 sm:space-y-3 max-w-4xl">
                <h2 className="text-xl sm:text-3xl font-bold tracking-tight text-slate-100 group-hover:text-cyan-accent transition-colors">
                  {featuredPost.title}
                </h2>
                <p className="text-slate-300 text-xs sm:text-base leading-relaxed font-sans">
                  {featuredPost.abstract}
                </p>
              </div>

              {/* Empirical Metrics Bar */}
              {featuredPost.metrics && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-1 sm:pt-2">
                  {featuredPost.metrics.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 sm:p-3.5 rounded-xl bg-[#080B10]/80 border border-[#202A38] space-y-1"
                    >
                      <div className="text-[11px] font-mono text-slate-400">
                        {m.label}
                      </div>
                      <div className="text-lg sm:text-2xl font-bold font-mono text-cyan-accent">
                        {m.value}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {m.detail}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Author & Read Action */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-[#1A2332]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-accent/20 border border-cyan-accent/40 text-cyan-accent font-mono text-xs flex items-center justify-center font-bold shrink-0">
                    {featuredPost.author.avatarInitials}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      {featuredPost.author.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {featuredPost.author.role} · {featuredPost.date}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setReadingArticle(featuredPost)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-cyan-accent text-slate-950 font-medium text-xs font-mono hover:bg-cyan-accent/90 transition-all flex items-center justify-center gap-2 shadow-hud"
                >
                  <span>Read Full Paper</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs & Search Bar */}
        <div className="space-y-4 pt-4 sm:pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            {/* Category Pills (horizontally scrollable on mobile) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-cyan-accent/20 text-cyan-accent border border-cyan-accent/40 font-medium shadow-sm'
                        : 'bg-[#0D1118] text-slate-400 border border-[#202A38] hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-auto md:min-w-[260px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search publications..."
                className="w-full min-h-[42px] pl-9 pr-4 py-2 bg-[#0D1118] border border-[#202A38] rounded-xl text-base sm:text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-accent/50 transition-colors font-mono"
              />
            </div>
          </div>
        </div>

        {/* Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredPosts.map((post) => (
            <article
              key={post.id}
              className="rounded-xl border border-[#202A38] bg-[#0D1118] hover:border-cyan-accent/40 transition-all p-6 flex flex-col justify-between space-y-4 group hover:shadow-hud"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-[#111722] border border-[#202A38] text-[10px] text-cyan-accent">
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1 text-[11px]">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {post.readTime}
                  </span>
                </div>

                <h3
                  onClick={() => setReadingArticle(post)}
                  className="text-base sm:text-lg font-bold text-slate-100 group-hover:text-cyan-accent transition-colors cursor-pointer leading-snug"
                >
                  {post.title}
                </h3>

                <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                  {post.abstract}
                </p>
              </div>

              <div className="pt-4 border-t border-[#1A2332] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-800 text-[10px] font-mono text-slate-300 flex items-center justify-center font-bold">
                    {post.author.avatarInitials}
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    {post.author.name}
                  </div>
                </div>

                <button
                  onClick={() => setReadingArticle(post)}
                  className="text-xs font-mono text-cyan-accent hover:underline flex items-center gap-1"
                >
                  <span>Read Paper</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </article>
          ))}
        </div>

        {filteredPosts.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <p className="text-slate-400 font-mono text-sm">
              No quantitative publications match your criteria.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('All Dispatches');
                setSearchQuery('');
              }}
              className="text-xs font-mono text-cyan-accent hover:underline"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Newsletter Subscription Block */}
        <div className="rounded-2xl border border-[#202A38] bg-[#0A0E17] p-8 sm:p-10 space-y-6 relative overflow-hidden">
          <div className="max-w-2xl space-y-3">
            <div className="text-xs font-mono text-cyan-accent uppercase tracking-wider font-semibold">
              Research Distribution Channel
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
              Subscribe to Institutional Quant Dispatches
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Bi-weekly technical publications on market microstructure, statistical overfitting detection, and AI strategy execution. Zero promotional spam, pure mathematical rigor.
            </p>
          </div>

          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 max-w-md">
            <input
              type="email"
              required
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="quant-desk@firm.com"
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#080B10] border border-[#202A38] text-base sm:text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-accent/50 flex-1"
            />
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-cyan-accent/10 border border-cyan-accent/40 text-cyan-accent hover:bg-cyan-accent/20 font-mono text-xs font-medium transition-all shrink-0 flex items-center justify-center gap-1.5"
            >
              {newsletterSubscribed ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Subscribed</span>
                </>
              ) : (
                <>
                  <span>Subscribe</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Interactive Article Reading Modal */}
      {readingArticle && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6 overflow-y-auto">
          <div className="bg-[#0A0E17] border border-[#202A38] rounded-t-2xl sm:rounded-2xl max-w-4xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl relative my-auto">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#202A38] flex items-center justify-between sticky top-0 bg-[#0A0E17]/95 backdrop-blur-sm z-20">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-accent/10 text-cyan-accent border border-cyan-accent/30 uppercase tracking-wider">
                  {readingArticle.category}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {readingArticle.readTime}
                </span>
              </div>

              <button
                onClick={() => setReadingArticle(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#1A2332] transition-colors"
                title="Close Article"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Article Body */}
            <div className="p-4 sm:p-8 space-y-5 sm:space-y-6 overflow-y-auto font-sans leading-relaxed text-slate-300 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <div className="space-y-2 sm:space-y-3 border-b border-[#1A2332] pb-5 sm:pb-6">
                <h2 className="text-xl sm:text-3xl font-bold text-slate-100 font-sans tracking-tight">
                  {readingArticle.title}
                </h2>
                <p className="text-xs sm:text-base text-slate-400">
                  {readingArticle.subtitle}
                </p>

                <div className="flex items-center gap-2.5 sm:gap-3 pt-2 text-xs font-mono text-slate-400">
                  <div className="w-7 h-7 rounded-full bg-cyan-accent/20 text-cyan-accent font-bold flex items-center justify-center text-xs shrink-0">
                    {readingArticle.author.avatarInitials}
                  </div>
                  <div>
                    <span className="text-slate-200 font-semibold">
                      {readingArticle.author.name}
                    </span>{' '}
                    · {readingArticle.author.role} · {readingArticle.date}
                  </div>
                </div>
              </div>

              {/* Introduction */}
              <div className="text-xs sm:text-base text-slate-200 leading-relaxed font-sans bg-[#0D1118]/70 p-3.5 sm:p-4 rounded-xl border border-[#1A2332]">
                {readingArticle.content.introduction}
              </div>

              {/* Sections */}
              {readingArticle.content.sections.map((sec, idx) => (
                <div key={idx} className="space-y-3 pt-2 sm:pt-4">
                  <h3 className="text-sm sm:text-lg font-bold text-slate-100 font-mono">
                    {sec.heading}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                    {sec.body}
                  </p>

                  {sec.bulletPoints && (
                    <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside bg-[#080B10] p-3 sm:p-4 rounded-xl border border-[#1A2332]">
                      {sec.bulletPoints.map((bp, bpIdx) => (
                        <li key={bpIdx} className="leading-relaxed">
                          {bp}
                        </li>
                      ))}
                    </ul>
                  )}

                  {sec.codeSnippet && (
                    <div className="rounded-xl border border-[#202A38] bg-[#07090E] p-3 sm:p-4 font-mono text-xs text-cyan-accent overflow-x-auto no-scrollbar">
                      <pre>
                        <code>{sec.codeSnippet.code}</code>
                      </pre>
                    </div>
                  )}
                </div>
              ))}

              {/* Conclusion */}
              <div className="pt-5 sm:pt-6 border-t border-[#1A2332] space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-cyan-accent font-semibold">
                  Conclusion & Research Takeaways
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 italic leading-relaxed">
                  {readingArticle.content.conclusion}
                </p>
              </div>

              {/* CTA Inside Modal */}
              <div className="pt-5 sm:pt-6 border-t border-[#1A2332] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                <span className="text-xs font-mono text-slate-400 text-center sm:text-left">
                  Verify these findings in your own quant lab:
                </span>
                <Link
                  href="/app"
                  onClick={() => setReadingArticle(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-cyan-accent text-slate-950 font-mono text-xs font-semibold hover:bg-cyan-accent/90 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Launch Replay Terminal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
