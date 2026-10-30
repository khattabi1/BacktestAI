'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Terminal,
  Cpu,
  Layers,
  ShieldCheck,
  Sparkles,
  FileCode,
  Search,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Zap,
  ArrowRight,
  Code2,
  Lock,
  Workflow,
  CheckCircle2,
  AlertTriangle,
  Info,
  Server
} from 'lucide-react';

interface DocSection {
  id: string;
  title: string;
  category: string;
  badge?: string;
  readTime: string;
  description: string;
  content: {
    overview: string;
    keyInvariants?: string[];
    codeSnippets?: {
      title: string;
      language: string;
      code: string;
    }[];
    parameters?: {
      name: string;
      type: string;
      default: string;
      description: string;
    }[];
    bestPractices?: string[];
  };
}

const DOC_SECTIONS: DocSection[] = [
  {
    id: 'quickstart',
    title: '60-Second Quickstart',
    category: 'Getting Started',
    badge: 'Core Guide',
    readTime: '3 min read',
    description: 'Spin up a causal backtest across historical tick partitions using the Python SDK or Web Terminal.',
    content: {
      overview:
        'BacktestAI provides a deterministic, zero look-ahead backtesting pipeline. With our Polars-powered simulation kernel, you can execute a 10-year tick simulation across NASDAQ-100 or Forex pairs in under 1.4 seconds.',
      keyInvariants: [
        'No future bar timestamps are readable at signal calculation time.',
        'Fills are calculated strictly at next-tick open or limit price matching order book depth.',
        'All data is read from partition-indexed Apache Parquet files without full-memory loads.'
      ],
      codeSnippets: [
        {
          title: 'Run First Backtest (Python SDK)',
          language: 'python',
          code: `from backtest_si import Engine, Strategy, MarketData

# 1. Define Causal Strategy
class EmaTrendCross(Strategy):
    fast_period: int = 12
    slow_period: int = 26
    stop_loss_pct: float = 0.015

    def on_bar(self, bar, indicators):
        if indicators.ema_fast > indicators.ema_slow and not self.has_position:
            # Order dispatched causal at next tick open
            self.buy(size=1.0, sl=bar.close * (1 - self.stop_loss_pct))
        elif indicators.ema_fast < indicators.ema_slow and self.has_position:
            self.close_position()

# 2. Execute on historical tick partition
data = MarketData.load("NQ_M1_2020_2025.parquet")
engine = Engine(initial_cash=100_000.0, slippage_model="l2_dynamic")
report = engine.run(EmaTrendCross(), data)

print(f"Sharpe: {report.sharpe_ratio:.2f} | Max DD: {report.max_drawdown_pct:.1f}%")
print(f"Execution Latency: {report.elapsed_ms}ms")`
        },
        {
          title: 'CLI Fast Launch',
          language: 'bash',
          code: `# Initialize new workspace
$ npx backtest-si init my-quant-lab
$ cd my-quant-lab

# Run deterministic backtest against local Parquet store
$ backtest-si run --strategy=strategies/ema_cross.py --symbol=NQ --from=2023-01-01 --to=2025-10-01 --slippage=0.5`
        }
      ],
      parameters: [
        { name: 'initial_cash', type: 'float', default: '100000.0', description: 'Base account capital denominated in base currency.' },
        { name: 'slippage_model', type: 'string', default: '"l2_dynamic"', description: 'Realistic fill model: fixed_bps, l2_dynamic, or zero.' },
        { name: 'commission_per_unit', type: 'float', default: '2.05', description: 'Exchange fee plus broker commission per lot/contract.' }
      ]
    }
  },
  {
    id: 'architecture',
    title: 'Core Simulation Architecture',
    category: 'Getting Started',
    readTime: '5 min read',
    description: 'Understanding the event-driven stepping kernel, Polars SIMD vectorization, and Parquet data layout.',
    content: {
      overview:
        'BacktestAI avoids the twin failures of traditional backtesting: pure vector backtesting (which leaks future data through shifted rolling windows) and pure object-oriented event loops (which are painfully slow at 10,000 bars/sec). Our dual-core architecture couples vectorized indicator computation with an event-driven tick execution state machine.',
      keyInvariants: [
        'Vectorized Phase: SIMD pre-computation of indicators using Polars Arrow arrays.',
        'Sequential Causal Phase: Zero-allocation cursor stepping through order book events.',
        'Memory Footprint: Constant O(1) memory via streaming Parquet record batches.'
      ],
      codeSnippets: [
        {
          title: 'Data Partition Layout (Disk Storage)',
          language: 'text',
          code: `data/
└── partitions/
    ├── NQ/
    │   ├── year=2024/
    │   │   ├── month=01/
    │   │   │   └── data.parquet (LZ4 compressed, sorted by timestamp_ns)
    │   │   └── month=02/
    │   └── year=2025/
    └── EURUSD/
        └── year=2025/`
        }
      ],
      bestPractices: [
        'Always verify dataset timestamp monotonic ordering before launching long sweeps.',
        'Use the built-in dataset validator: `backtest-si data verify --symbol NQ` to check for gap artifacts.'
      ]
    }
  },
  {
    id: 'causal-invariants',
    title: 'Causal Invariants & Zero Look-Ahead',
    category: 'Simulation & Engine',
    badge: 'Mathematical Invariant',
    readTime: '6 min read',
    description: 'Formal mathematical definition of causality in BacktestAI and how look-ahead leakage is prevented.',
    content: {
      overview:
        'A backtest is causally sound if and only if no decision executed at state t relies on information from state t + delta. In traditional Python backtesters, subtle bugs like indexing df.iloc[i]["high"] before bar completion introduce disastrous look-ahead bias that disappears in live markets.',
      keyInvariants: [
        'Mathematical Invariant: t_fill >= t_signal + delta_tau (where delta_tau is processing latency).',
        'Bar Finality: Close price is strictly invisible until the subsequent bar initialization tick.',
        'High/Low Extremes: During intra-bar replay, high and low are updated progressively as simulated ticks arrive.'
      ],
      codeSnippets: [
        {
          title: 'Causal Assertion Engine (Engine Guard)',
          language: 'python',
          code: `# The BacktestAI engine enforces strict timestamp immutability
def assert_causal_invariant(signal_time: int, fill_time: int, latency_ns: int):
    if fill_time < signal_time + latency_ns:
        raise CausalLeakageError(
            f"Fatal: Order filled at {fill_time}ns prior to causal horizon "
            f"({signal_time + latency_ns}ns). Possible future-bar index peek detected."
        )`
        }
      ],
      bestPractices: [
        'Never reference `bar.close` to calculate intra-bar fills. Intra-bar limit orders execute on tick arrivals.',
        'Enable the `--strict-causality` flag to audit custom indicators for forward-looking rolling window slices.'
      ]
    }
  },
  {
    id: 'fill-models',
    title: 'Realistic Fill Models & Slippage',
    category: 'Simulation & Engine',
    readTime: '4 min read',
    description: 'Sub-millisecond L2 slippage, dynamic spread widening during economic releases, and latency queuing.',
    content: {
      overview:
        'Fills in BacktestAI are simulated using realistic market microstructure models rather than naive mid-price executions. This prevents the rampant over-estimation of Sharpe ratios typical in high-frequency or breakout strategies.',
      keyInvariants: [
        'Spread Expansion: Automatic spread widening during 08:30 EST macro releases (CPI, NFP).',
        'Market Depth Impact: Slippage scales quadratically with order size relative to average tick volume.',
        'Queue Priority: Limit orders are placed at the back of the theoretical queue at that price level.'
      ],
      codeSnippets: [
        {
          title: 'Configuring L2 Slippage Matrix',
          language: 'python',
          code: `from backtest_si.models import L2SlippageModel

slippage = L2SlippageModel(
    base_spread_ticks=1.0,
    volatility_multiplier=1.45,
    session_liquidity_curve="us_rth", # Widens 3x during Tokyo/London overlap
    market_impact_decay=0.82
)

engine = Engine(slippage_model=slippage)`
        }
      ],
      parameters: [
        { name: 'base_spread_ticks', type: 'float', default: '1.0', description: 'Minimum bid-ask spread measured in instrument ticks.' },
        { name: 'volatility_multiplier', type: 'float', default: '1.5', description: 'Dynamic spread scale factor driven by 14-period ATR.' },
        { name: 'market_impact_decay', type: 'float', default: '0.8', description: 'Rate at which temporary order impact fades from the local order book.' }
      ]
    }
  },
  {
    id: 'replay-canvas',
    title: 'OpenAlgo Bar-by-Bar Replay Canvas',
    category: 'Simulation & Engine',
    badge: 'Interactive UI',
    readTime: '4 min read',
    description: 'Control bar-by-bar market replay, variable speed multipliers (0.1x to 100x), and live tick scrubbing.',
    content: {
      overview:
        'The Replay Canvas integrates OpenAlgo Charts with sub-frame synchronized timeline scrubbing. You can pause at any critical decision candle, inspect indicator buffers in memory, step forward one candle at a time, or run continuous replay.',
      keyInvariants: [
        'Deterministic State Snapshotting: Jump to any bar without re-running the entire simulation from bar 0.',
        'Visual Fill Markers: Green triangles for long entries, red triangles for short entries, with hover fill slips.',
        'Live Equity HUD: Real-time calculation of unrealized PnL, cash balance, and drawdown gauge.'
      ],
      codeSnippets: [
        {
          title: 'Keyboard Shortcuts in Replay Studio',
          language: 'text',
          code: `[Space]         Toggle Play / Pause
[Right Arrow]   Step Forward 1 Bar
[Left Arrow]    Step Backward 1 Bar
[Shift + Right] Fast Forward 10 Bars
[1] .. [5]      Set Speed Multiplier (0.5x, 1x, 5x, 25x, 100x)
[R]             Reset Replay to Session Start
[M]             Place Manual Order Marker`
        }
      ]
    }
  },
  {
    id: 'autopsy',
    title: 'Forensic Autopsy & Overfitting Detection',
    category: 'Forensic Analytics',
    badge: 'Institutional Grade',
    readTime: '7 min read',
    description: 'Statistical stress testing: parameter sensitivity cliffs, Monte Carlo resamplings, and regime clustering.',
    content: {
      overview:
        'The Forensic Autopsy module subjects your strategy to rigorous statistical stress tests. An equity curve with a 2.4 Sharpe is meaningless if a 2% shift in moving average parameters degrades profitability by 80%.',
      keyInvariants: [
        'Parameter Sensitivity Heatmap: Detects isolated spike anomalies (overfitted lucky seeds).',
        'Degradation Coefficient: Measures drop-off between in-sample training and out-of-sample test splits.',
        'Regime Clustering: Segregates trade performance by market volatility regime (Trending Low Vol, Chop, Crash).'
      ],
      codeSnippets: [
        {
          title: 'Run Automated Autopsy Suite',
          language: 'python',
          code: `from backtest_si.forensics import AutopsyReport

# Perform 1,000 Monte Carlo bootstrap permutations
autopsy = AutopsyReport.analyze(
    backtest_result=report,
    resample_iterations=1_000,
    confidence_level=0.95,
    parameter_grid_sensitivity=True
)

print(f"Deflated Sharpe Ratio (DSR): {autopsy.deflated_sharpe:.2f}")
print(f"Probability of Backtest Overfitting (PBO): {autopsy.pbo_pct:.1f}%")
print(f"Max Stress Drawdown (99th percentile): {autopsy.worst_case_drawdown_pct:.1f}%")`
        }
      ]
    }
  },
  {
    id: 'claude-copilot',
    title: 'Claude Opus 5.5 Strategy Co-Pilot',
    category: 'AI & Generation',
    badge: 'Claude Opus 5.5',
    readTime: '5 min read',
    description: 'Synthesizing causal trading algorithms with Anthropic Claude Opus 5.5, multi-turn reasoning, and Polars syntax.',
    content: {
      overview:
        'BacktestAI pairs you with Anthropic Claude Opus 5.5 as your quantitative research assistant. Claude writes causal Polars Python strategies, extracts parameter spaces, audits for look-ahead hazards, and iterates code based on backtest failure diagnostics.',
      keyInvariants: [
        'Model Backbone: Strictly Anthropic Claude Opus 5.5 for deep mathematical and coding reasoning.',
        'Causal Linting: All generated Python code is automatically parsed via AST to check for iloc peek bugs before execution.',
        'Self-Correction Loop: If backtest yields high PBO (>50%), Claude proposes structural regularizations.'
      ],
      codeSnippets: [
        {
          title: 'Natural Language Prompting Example',
          language: 'text',
          code: `User: "Write an intraday mean-reversion strategy for NQ on 5m candles.
Use a 20-period VWAP with 2.5 standard deviation Bollinger Bands.
Only enter when RSI(14) is below 28 for longs or above 72 for shorts.
Exit at VWAP touch or after 12 bars max. Include trailing stop of 0.8%."

Claude Opus 5.5:
Synthesizing causal Strategy class...
- Validating zero look-ahead: band calculation uses lagging window.
- Extracting parameter schema for optimizer.
- Done. Generated 64 lines of optimized Polars code.`
        }
      ],
      bestPractices: [
        'Always specify explicit exit conditions (time stops, trailing stops) when prompting Claude.',
        'Use the "Audit Strategy" button in the Quant IDE to have Claude inspect existing scripts.'
      ]
    }
  },
  {
    id: 'mql5-export',
    title: 'MetaTrader 5 MQL5 EA Transpiler',
    category: 'AI & Generation',
    badge: 'Production Ready',
    readTime: '6 min read',
    description: 'Compile validated Python Polars strategies directly into production-grade MQL5 Expert Advisors (.mq5).',
    content: {
      overview:
        'Translate your Python research code into native MetaTrader 5 C++ Expert Advisors with zero translation loss. The transpiler maps Python indicator calls to MT5 native indicator handles, embeds trade management state machines, and generates Clean MQL5 code ready for live terminal attachment.',
      keyInvariants: [
        'Exact Execution Match: MQL5 order routing reflects the identical fill conditions simulated in the engine.',
        'Input Parameter Decorators: Generates MT5 `input group` controls for MetaTrader Strategy Tester optimization.',
        'Risk Management Guards: Hardcoded maximum daily loss and equity protection circuit breakers.'
      ],
      codeSnippets: [
        {
          title: 'Generated MQL5 Header & Trade Handling',
          language: 'cpp',
          code: `//+------------------------------------------------------------------+
//| BacktestAI Transpiled Expert Advisor: EmaTrendCross.mq5         |
//| Generated with Claude Opus 5.5 Engine                            |
//+------------------------------------------------------------------+
#property copyright "BacktestAI Quantitative"
#property version   "1.00"
#include <Trade\\Trade.mqh>

input group "--- Strategy Parameters ---"
input int    InpFastEMA    = 12;    // Fast EMA Period
input int    InpSlowEMA    = 26;    // Slow EMA Period
input double InpStopLossPct = 1.5;   // Stop Loss Percent

CTrade trade;
int    handle_fast_ema;
int    handle_slow_ema;

int OnInit() {
   handle_fast_ema = iMA(_Symbol, _Period, InpFastEMA, 0, MODE_EMA, PRICE_CLOSE);
   handle_slow_ema = iMA(_Symbol, _Period, InpSlowEMA, 0, MODE_EMA, PRICE_CLOSE);
   trade.SetExpertMagicNumber(20261005);
   return(INIT_SUCCEEDED);
}`
        }
      ]
    }
  },
  {
    id: 'rest-api',
    title: 'REST API Specification',
    category: 'API & Developer',
    readTime: '4 min read',
    description: 'Programmatically trigger simulation runs, query backtest results, and manage strategy versions via HTTP.',
    content: {
      overview:
        'The BacktestAI FastAPI backend exposes high-performance asynchronous endpoints for automated pipeline integration, CI/CD strategy testing, and custom dashboard reporting.',
      keyInvariants: [
        'Base URL: /api/v1 (or institutional cloud endpoint).',
        'Authentication: Bearer Token via Authorization header.',
        'Rate Limits: 1,000 runs/hour on Researcher, Unlimited on Professional & Enterprise.'
      ],
      codeSnippets: [
        {
          title: 'Execute Backtest via cURL',
          language: 'bash',
          code: `curl -X POST "/api/v1/backtest/run" \\
  -H "Authorization: Bearer bsi_live_99d14f88c3a1b24" \\
  -H "Content-Type: application/json" \\
  -d '{
    "strategy_id": "strat_ema_trend_01",
    "symbol": "NQ",
    "timeframe": "M1",
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "initial_capital": 100000.0,
    "parameters": {
      "fast_period": 14,
      "slow_period": 28
    }
  }'`
        },
        {
          title: 'JSON Response Payload',
          language: 'json',
          code: `{
  "status": "success",
  "backtest_id": "bt_9024f2b1",
  "metrics": {
    "sharpe_ratio": 2.14,
    "sortino_ratio": 3.05,
    "max_drawdown_pct": 8.4,
    "total_return_pct": 34.8,
    "win_rate_pct": 58.2,
    "profit_factor": 1.76,
    "total_trades": 412
  },
  "execution_time_ms": 1184
}`
        }
      ],
      parameters: [
        { name: 'strategy_id', type: 'string', default: 'Required', description: 'Unique identifier of stored strategy script.' },
        { name: 'symbol', type: 'string', default: 'Required', description: 'Instrument ticker (e.g. NQ, ES, EURUSD, BTCUSDT).' },
        { name: 'timeframe', type: 'string', default: '"M1"', description: 'Bar aggregation: TICK, S1, M1, M5, M15, H1, D1.' }
      ]
    }
  },
  {
    id: 'ws-replay',
    title: 'WebSocket Streaming Protocol',
    category: 'API & Developer',
    readTime: '5 min read',
    description: 'Sub-millisecond real-time bar and tick streaming protocol for custom frontends and charting canvases.',
    content: {
      overview:
        'Connect directly to the replay stream to receive frame-by-frame bar updates, position changes, and HUD telemetry at up to 100x playback speeds over low-latency binary or JSON WebSockets.',
      keyInvariants: [
        'Endpoint: ws://127.0.0.1:8000/api/v1/ws/replay',
        'Stateful Controls: Send `PAUSE`, `RESUME`, `STEP`, `SET_SPEED`, `SEEK` commands mid-stream.',
        'Backpressure Handling: Automatic throttling prevents client buffer overflows at high replay speeds.'
      ],
      codeSnippets: [
        {
          title: 'JavaScript WebSocket Client',
          language: 'typescript',
          code: `const ws = new WebSocket("ws://127.0.0.1:8000/api/v1/ws/replay");

ws.onopen = () => {
  // Initialize replay session
  ws.send(JSON.stringify({
    action: "START",
    symbol: "NQ",
    from_timestamp: 1704067200,
    speed: 5.0
  }));
};

ws.onmessage = (event) => {
  const frame = JSON.parse(event.data);
  if (frame.type === "BAR_UPDATE") {
    chart.update(frame.bar);
    hud.updateEquity(frame.account.equity);
  }
};`
        }
      ]
    }
  }
];

export default function DocsPage() {
  const [activeSectionId, setActiveSectionId] = useState<string>('quickstart');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedSnippetIndex, setCopiedSnippetIndex] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return DOC_SECTIONS;
    const q = searchQuery.toLowerCase();
    return DOC_SECTIONS.filter(
      (sec) =>
        sec.title.toLowerCase().includes(q) ||
        sec.description.toLowerCase().includes(q) ||
        sec.category.toLowerCase().includes(q) ||
        sec.content.overview.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Active section data
  const activeSection = useMemo(() => {
    return (
      DOC_SECTIONS.find((sec) => sec.id === activeSectionId) || DOC_SECTIONS[0]
    );
  }, [activeSectionId]);

  // Group sections by category for sidebar
  const categories = useMemo(() => {
    const map = new Map<string, DocSection[]>();
    DOC_SECTIONS.forEach((sec) => {
      const list = map.get(sec.category) || [];
      list.push(sec);
      map.set(sec.category, list);
    });
    return Array.from(map.entries());
  }, []);

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippetIndex(index);
    setTimeout(() => {
      setCopiedSnippetIndex(null);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#080B10] text-slate-100 flex flex-col">
      {/* Top Banner / Breadcrumb Bar */}
      <div className="border-b border-[#202A38] bg-[#0A0E17]/80 backdrop-blur-sm sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono text-slate-400 truncate">
            <Link href="/" className="hover:text-slate-200 transition-colors shrink-0">
              Platform
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="text-cyan-accent font-medium shrink-0">Docs</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="text-slate-300 truncate max-w-[140px] sm:max-w-none">
              {activeSection.title}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hidden xs:flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              API v2.4 Active
            </span>
            <Link
              href="/app"
              className="text-xs font-mono text-cyan-accent hover:underline hidden sm:flex items-center gap-1"
            >
              <span>Launch Studio</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Docs Workspace Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Mobile Topic Selector Drawer Toggle */}
        <div className="lg:hidden col-span-1">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-full min-h-[44px] px-4 py-2.5 bg-[#0D1118] border border-[#202A38] rounded-xl flex items-center justify-between text-xs font-mono text-slate-200"
          >
            <div className="flex items-center gap-2 truncate">
              <BookOpen className="w-4 h-4 text-cyan-accent shrink-0" />
              <span className="text-slate-400">Topic:</span>
              <span className="font-semibold text-slate-100 truncate">{activeSection.title}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Left Sidebar: Search & Navigation */}
        <aside className={`${mobileMenuOpen ? 'block' : 'hidden lg:block'} lg:col-span-3 space-y-6`}>
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quant docs & API..."
              className="w-full min-h-[42px] pl-9 pr-4 py-2 bg-[#0D1118] border border-[#202A38] rounded-xl text-base sm:text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-accent/50 transition-colors font-mono"
            />
          </div>

          {/* Navigation Tree */}
          <div className="space-y-6">
            {categories.map(([category, items]) => {
              // Check if any item matches the search
              const visibleItems = items.filter((item) =>
                filteredSections.some((fs) => fs.id === item.id)
              );

              if (visibleItems.length === 0) return null;

              return (
                <div key={category} className="space-y-1.5">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold px-2">
                    {category}
                  </div>
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const isActive = item.id === activeSectionId;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveSectionId(item.id);
                            setMobileMenuOpen(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`w-full min-h-[40px] text-left px-3 py-2 rounded-lg text-xs font-sans transition-all flex items-center justify-between group ${
                            isActive
                              ? 'bg-cyan-accent/10 text-cyan-accent font-medium border border-cyan-accent/30 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-[#111722]/60 border border-transparent'
                          }`}
                        >
                          <span className="truncate">{item.title}</span>
                          {item.badge && (
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                isActive
                                  ? 'bg-cyan-accent/20 text-cyan-accent'
                                  : 'bg-[#1A2332] text-slate-400 group-hover:text-slate-300'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Help Card */}
          <div className="p-4 rounded-xl border border-[#202A38] bg-[#0D1118]/80 space-y-3 font-sans">
            <div className="flex items-center gap-2 text-cyan-accent font-mono text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Claude Opus AI Assistant</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Have questions about writing causal strategies? Our integrated Claude Opus 5.5 agent in the Quant Lab can inspect your code and auto-correct parameter peek errors.
            </p>
            <Link
              href="/app/quant"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-accent hover:underline pt-1 min-h-[36px]"
            >
              <span>Open Quant IDE</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="lg:col-span-9 space-y-8">
          {/* Section Header */}
          <div className="border-b border-[#202A38] pb-6 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#111722] border border-[#202A38] text-slate-400">
                {activeSection.category}
              </span>
              {activeSection.badge && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-accent/10 border border-cyan-accent/30 text-cyan-accent font-medium">
                  {activeSection.badge}
                </span>
              )}
              <span className="text-xs font-mono text-slate-400">
                {activeSection.readTime}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 font-sans">
              {activeSection.title}
            </h1>

            <p className="text-sm sm:text-base text-slate-400 leading-relaxed font-sans">
              {activeSection.description}
            </p>
          </div>

          {/* Section Body */}
          <div className="space-y-8">
            {/* Overview Section */}
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-200 font-mono flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-accent" />
                <span>Overview & Operational Theory</span>
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed font-sans bg-[#0D1118]/60 p-5 rounded-xl border border-[#1A2332]">
                {activeSection.content.overview}
              </p>
            </div>

            {/* Invariants / Key Guarantees */}
            {activeSection.content.keyInvariants && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Causal Invariants & Engine Guarantees</span>
                </h3>
                <div className="grid grid-cols-1 gap-2.5">
                  {activeSection.content.keyInvariants.map((inv, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3.5 rounded-lg bg-[#0C1017] border border-[#1A2332] text-xs text-slate-300 font-sans"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{inv}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Code Snippets with Copy Functionality */}
            {activeSection.content.codeSnippets && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
                  <FileCode className="w-3.5 h-3.5 text-cyan-accent" />
                  <span>Implementation & Reference Code</span>
                </h3>

                <div className="space-y-4">
                  {activeSection.content.codeSnippets.map((snippet, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-[#202A38] bg-[#07090E] overflow-hidden shadow-hud"
                    >
                      {/* Code Header Bar */}
                      <div className="px-4 py-2.5 bg-[#0C1017] border-b border-[#1A2332] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                          <span className="ml-2 text-xs font-mono text-slate-300 font-medium">
                            {snippet.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#111722] text-slate-400 border border-[#202A38]">
                            {snippet.language}
                          </span>
                          <button
                            onClick={() => handleCopyCode(snippet.code, idx)}
                            className="p-1.5 rounded-md hover:bg-[#1A2332] text-slate-400 hover:text-cyan-accent transition-colors flex items-center gap-1.5 text-xs font-mono"
                            title="Copy code to clipboard"
                          >
                            {copiedSnippetIndex === idx ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400 text-[10px]">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span className="text-[10px] text-slate-400">Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Code Content */}
                      <pre className="p-3 sm:p-4 text-xs font-mono text-slate-300 overflow-x-auto no-scrollbar leading-relaxed">
                        <code>{snippet.code}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parameters Table (if applicable) */}
            {activeSection.content.parameters && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
                  <Workflow className="w-3.5 h-3.5 text-cyan-accent" />
                  <span>Configuration Schema & Parameters</span>
                </h3>

                <div className="overflow-x-auto no-scrollbar rounded-xl border border-[#202A38] bg-[#0C1017] -mx-1 sm:mx-0">
                  <table className="w-full text-left text-xs font-mono min-w-[500px]">
                    <thead className="bg-[#111722] text-slate-400 border-b border-[#202A38]">
                      <tr>
                        <th className="py-2.5 px-3 sm:px-4 font-medium">Parameter</th>
                        <th className="py-2.5 px-3 sm:px-4 font-medium">Type</th>
                        <th className="py-2.5 px-3 sm:px-4 font-medium">Default</th>
                        <th className="py-2.5 px-3 sm:px-4 font-medium font-sans">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A2332] text-slate-300">
                      {activeSection.content.parameters.map((param, pIdx) => (
                        <tr key={pIdx} className="hover:bg-[#111722]/40 transition-colors">
                          <td className="py-2.5 px-3 sm:px-4 text-cyan-accent font-semibold">
                            {param.name}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 text-slate-400 text-[11px]">
                            {param.type}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 text-emerald-400 text-[11px]">
                            {param.default}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 font-sans text-slate-300 text-xs">
                            {param.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Best Practices */}
            {activeSection.content.bestPractices && (
              <div className="p-4 rounded-xl border border-cyan-accent/20 bg-cyan-accent/5 space-y-2 font-sans">
                <div className="flex items-center gap-2 text-cyan-accent font-mono text-xs font-semibold">
                  <Info className="w-4 h-4" />
                  <span>Quantitative Best Practices</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside">
                  {activeSection.content.bestPractices.map((bp, bIdx) => (
                    <li key={bIdx} className="leading-relaxed">
                      {bp}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Navigation Footer for next/prev articles */}
            <div className="pt-8 border-t border-[#202A38] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <Link
                href="/app"
                className="min-h-[44px] text-xs font-mono text-slate-400 hover:text-slate-100 flex items-center justify-center sm:justify-start gap-2"
              >
                <span>Launch Replay Terminal</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              </Link>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <span className="text-xs font-mono text-slate-400 text-center">
                  Ready to test on historical data?
                </span>
                <Link
                  href="/pricing"
                  className="min-h-[44px] w-full sm:w-auto px-4 py-2 rounded-xl bg-cyan-accent/10 border border-cyan-accent/40 text-cyan-accent hover:bg-cyan-accent/20 text-xs font-mono transition-all flex items-center justify-center"
                >
                  View Access Tiers
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
