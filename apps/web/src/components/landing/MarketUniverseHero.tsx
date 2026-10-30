'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Activity,
  Cpu,
  ArrowRight,
  Sparkles,
  Zap,
  TrendingUp,
  ShieldCheck,
  Sliders,
  Layers,
  Terminal,
  RefreshCw,
  Search,
  CheckCircle2,
} from 'lucide-react';

interface MarketPreset {
  symbol: string;
  name: string;
  price: number;
  change: string;
  changePositive: boolean;
  baseSigma: number;
  liquidityBids: number[];
  liquidityAsks: number[];
  strategyId: string;
  strategyName: string;
  expectedValue: string;
  profitFactor: string;
  winRate: string;
  maxDrawdown: string;
  sharpe: string;
}

const MARKET_PRESETS: Record<string, MarketPreset> = {
  XAUUSD: {
    symbol: 'XAUUSD',
    name: 'Gold / US Dollar',
    price: 2648.35,
    change: '+1.14%',
    changePositive: true,
    baseSigma: 4.8,
    liquidityBids: [2642.5, 2640.0, 2636.5],
    liquidityAsks: [2652.0, 2655.0, 2658.5],
    strategyId: 'SI-042',
    strategyName: 'SI-042 Volatility Reversion',
    expectedValue: '+0.37 R',
    profitFactor: '2.18',
    winRate: '68.4%',
    maxDrawdown: '7.4%',
    sharpe: '2.42',
  },
  BTCUSDT: {
    symbol: 'BTCUSDT',
    name: 'Bitcoin / Tether USD',
    price: 68420.0,
    change: '+3.48%',
    changePositive: true,
    baseSigma: 850.0,
    liquidityBids: [67800, 67250, 66500],
    liquidityAsks: [69100, 69800, 70500],
    strategyId: 'SI-088',
    strategyName: 'SI-088 Momentum Expansion',
    expectedValue: '+0.52 R',
    profitFactor: '2.45',
    winRate: '64.2%',
    maxDrawdown: '9.8%',
    sharpe: '2.68',
  },
  EURUSD: {
    symbol: 'EURUSD',
    name: 'Euro / US Dollar',
    price: 1.0842,
    change: '-0.18%',
    changePositive: false,
    baseSigma: 0.0022,
    liquidityBids: [1.0825, 1.081, 1.079],
    liquidityAsks: [1.0865, 1.088, 1.0905],
    strategyId: 'SI-019',
    strategyName: 'SI-019 London Breakout',
    expectedValue: '+0.29 R',
    profitFactor: '1.94',
    winRate: '62.8%',
    maxDrawdown: '5.2%',
    sharpe: '2.15',
  },
};

type ScanState = 'IDLE' | 'SCANNING' | 'EXTRACTING' | 'VECTORIZING' | 'VALIDATING' | 'LOCKED';

export function MarketUniverseHero() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('XAUUSD');
  const [scanState, setScanState] = useState<ScanState>('IDLE');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanlineX, setScanlineX] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const activeMarket = MARKET_PRESETS[selectedSymbol];

  // Mouse hover coordinate tracking across canvas
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos(null);
  };

  // Trigger the Institutional [Analyze Market] Scan Sequence
  const handleTriggerAnalysis = () => {
    if (scanState !== 'IDLE' && scanState !== 'LOCKED') return;

    setScanState('SCANNING');
    setScanProgress(0);
    setScanlineX(0);

    const startTime = Date.now();
    const duration = 2400; // 2.4 seconds total sequence

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.floor((elapsed / duration) * 100));
      setScanProgress(progress);
      setScanlineX(progress);

      if (progress < 25) {
        setScanState('SCANNING');
      } else if (progress < 50) {
        setScanState('EXTRACTING');
      } else if (progress < 75) {
        setScanState('VECTORIZING');
      } else if (progress < 100) {
        setScanState('VALIDATING');
      } else {
        clearInterval(interval);
        setScanState('LOCKED');
        setTimeout(() => setScanlineX(null), 800);
      }
    }, 30);
  };

  // Generate synthetic price points for the living SVG wave
  const wavePoints = useMemo(() => {
    const points: { x: number; y: number }[] = [];
    const count = 40;
    for (let i = 0; i <= count; i++) {
      const x = (i / count) * 100;
      // Multi-sine wave generating institutional trending structure
      const y =
        50 +
        Math.sin(i * 0.35) * 18 +
        Math.cos(i * 0.7) * 12 +
        (i > 25 ? Math.sin((i - 25) * 0.8) * 10 : 0);
      points.push({ x, y });
    }
    return points;
  }, []);

  const svgPathD = useMemo(() => {
    if (wavePoints.length === 0) return '';
    return wavePoints.reduce((acc, curr, idx) => {
      if (idx === 0) return `M ${curr.x} ${curr.y}`;
      return `${acc} L ${curr.x} ${curr.y}`;
    }, '');
  }, [wavePoints]);

  const svgAreaD = useMemo(() => {
    if (wavePoints.length === 0) return '';
    return `${svgPathD} L 100 100 L 0 100 Z`;
  }, [svgPathD, wavePoints]);

  return (
    <div className="w-full relative z-10 select-none">
      {/* 1. Instrument Switcher & Telemetry Banner */}
      <div className="max-w-6xl mx-auto px-4 mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Market Selector Chips */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-[#0D1118] border border-[#202A38]">
          {Object.values(MARKET_PRESETS).map((preset) => {
            const active = preset.symbol === selectedSymbol;
            return (
              <button
                key={preset.symbol}
                onClick={() => {
                  setSelectedSymbol(preset.symbol);
                  setScanState('IDLE');
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  active
                    ? 'bg-cyan-accent/15 text-cyan-accent border border-cyan-accent/40 shadow-hud'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#151C27]'
                }`}
              >
                <span>{preset.symbol}</span>
                <span
                  className={`text-[10px] font-mono ${
                    preset.changePositive ? 'text-emerald-400' : 'text-crimson-risk'
                  }`}
                >
                  {preset.change}
                </span>
              </button>
            );
          })}
        </div>

        {/* Live Engine Protocol Badge */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0D1118] border border-[#202A38] text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-accent" />
            </span>
            <span>POLARS VECTOR ENGINE</span>
            <span className="text-slate-600">·</span>
            <span className="text-emerald-400">0.000% BIAS</span>
          </div>

          <button
            onClick={handleTriggerAnalysis}
            disabled={scanState !== 'IDLE' && scanState !== 'LOCKED'}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-cyan-accent text-obsidian-base hover:bg-cyan-accent/90 font-bold font-mono text-xs transition-all shadow-hud active:scale-95 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>
              {scanState === 'IDLE' || scanState === 'LOCKED'
                ? 'Analyze Market'
                : `${scanState} (${scanProgress}%)`}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Master Living Market Universe Display Card */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="rounded-2xl border border-[#202A38] bg-[#0A0E15] p-2 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          {/* Sub-Header Window Frame */}
          <div className="px-4 py-2.5 border-b border-[#202A38]/70 flex items-center justify-between bg-[#0D1118]/80 rounded-t-xl text-xs font-mono">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-crimson-risk/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-edge/70" />
              </div>
              <span className="text-slate-300 font-bold tracking-tight">
                LIVING_MARKET_UNIVERSE :: {activeMarket.symbol}_M1
              </span>
            </div>

            <div className="flex items-center gap-4 text-slate-400 text-[11px]">
              <div>
                <span className="text-slate-500">SPOT:</span>{' '}
                <span className="text-slate-100 font-bold font-mono-nums">
                  ${activeMarket.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-500">VOLATILITY (σ):</span>{' '}
                <span className="text-cyan-accent">±{activeMarket.baseSigma}</span>
              </div>
              <div>
                <span className="text-slate-500">FEED:</span>{' '}
                <span className="text-emerald-400">DUCKDB_PARQUET</span>
              </div>
            </div>
          </div>

          {/* Interactive Universe Viewport Canvas */}
          <div
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="relative h-[340px] w-full overflow-hidden bg-[#07090E] cursor-crosshair select-none"
          >
            {/* Fine 1px Computational Grid */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(to right, #202A38 1px, transparent 1px), linear-gradient(to bottom, #202A38 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />

            {/* Resting Institutional Liquidity Blocks (Order Book Depth) */}
            {activeMarket.liquidityAsks.map((price, idx) => (
              <div
                key={`ask-${idx}`}
                className="absolute right-0 flex items-center justify-between px-3 text-[10px] font-mono text-crimson-risk/80 border-t border-b border-crimson-risk/20 bg-crimson-risk/5 pointer-events-none transition-opacity"
                style={{
                  top: `${18 + idx * 11}%`,
                  width: `${60 - idx * 12}%`,
                  height: '18px',
                }}
              >
                <span>RESTING ASKS :: ${price.toFixed(2)}</span>
                <span>{(184 - idx * 32).toFixed(1)} LOTS</span>
              </div>
            ))}

            {activeMarket.liquidityBids.map((price, idx) => (
              <div
                key={`bid-${idx}`}
                className="absolute right-0 flex items-center justify-between px-3 text-[10px] font-mono text-emerald-edge/80 border-t border-b border-emerald-edge/20 bg-emerald-edge/5 pointer-events-none transition-opacity"
                style={{
                  bottom: `${12 + idx * 11}%`,
                  width: `${65 - idx * 14}%`,
                  height: '18px',
                }}
              >
                <span>RESTING BIDS :: ${price.toFixed(2)}</span>
                <span>{(240 - idx * 45).toFixed(1)} LOTS</span>
              </div>
            ))}

            {/* Gaussian Probability Distribution Bell Curve Envelope (SVG) */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <defs>
                <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.25" />
                  <stop offset="60%" stopColor="#8B5CF6" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#080B10" stopOpacity="0.0" />
                </linearGradient>

                <linearGradient id="laserBeam" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.0" />
                  <stop offset="50%" stopColor="#22D3EE" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* +1σ / -1σ Standard Deviation Confidence Bands */}
              <path
                d="M 0 35 Q 25 25, 50 28 T 100 20"
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="0.8"
                strokeDasharray="2 2"
                opacity="0.5"
              />
              <path
                d="M 0 75 Q 25 80, 50 78 T 100 70"
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="0.8"
                strokeDasharray="2 2"
                opacity="0.5"
              />

              {/* Shaded Liquidity Gradient Area */}
              <path d={svgAreaD} fill="url(#curveGradient)" />

              {/* Living Vector Path */}
              <path
                d={svgPathD}
                fill="none"
                stroke="#22D3EE"
                strokeWidth="1.5"
                className="drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"
              />

              {/* Dynamic Market Invariant Nodes */}
              {wavePoints.filter((_, i) => i % 8 === 0).map((pt, idx) => (
                <g key={idx}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="2"
                    fill="#22D3EE"
                    className="animate-pulse"
                  />
                  <circle cx={pt.x} cy={pt.y} r="4" fill="none" stroke="#22D3EE" strokeWidth="0.5" opacity="0.6" />
                </g>
              ))}
            </svg>

            {/* Kinetic Scanline Laser Beam */}
            {scanlineX !== null && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none transition-all duration-75 z-20"
                style={{
                  left: `${scanlineX}%`,
                  width: '3px',
                  boxShadow: '0 0 25px 4px #22D3EE, 0 0 50px 10px rgba(34,211,238,0.3)',
                  backgroundColor: '#E0F2FE',
                }}
              >
                <div className="absolute top-3 -left-12 px-2 py-0.5 rounded bg-cyan-accent text-obsidian-base font-mono font-bold text-[9px] whitespace-nowrap shadow-hud">
                  SCAN :: {scanState}
                </div>
              </div>
            )}

            {/* Interactive Cursor Crosshair & Inspection Tooltip */}
            {mousePos && (
              <>
                <div
                  className="absolute top-0 bottom-0 border-l border-cyan-accent/40 pointer-events-none"
                  style={{ left: `${mousePos.x}px` }}
                />
                <div
                  className="absolute left-0 right-0 border-t border-cyan-accent/40 pointer-events-none"
                  style={{ top: `${mousePos.y}px` }}
                />
                <div
                  className="absolute z-30 p-2 rounded-lg bg-[#0F1622]/95 border border-cyan-accent/50 shadow-hud text-[10px] font-mono pointer-events-none space-y-1"
                  style={{
                    left: `${Math.min(canvasRef.current?.clientWidth || 800 - 150, mousePos.x + 15)}px`,
                    top: `${Math.min(canvasRef.current?.clientHeight || 300 - 90, mousePos.y + 15)}px`,
                  }}
                >
                  <div className="text-cyan-accent font-bold">NODE :: GAUSSIAN_SAMPLE</div>
                  <div className="text-slate-300">
                    PX: ${(activeMarket.price + (340 - mousePos.y) * 0.05).toFixed(2)}
                  </div>
                  <div className="text-slate-400">
                    Z-SCORE: {(((170 - mousePos.y) / 170) * 2.5).toFixed(2)}σ
                  </div>
                </div>
              </>
            )}

            {/* In-Canvas Bottom Status Bar */}
            <div className="absolute bottom-3 left-4 right-4 z-10 flex items-center justify-between text-[11px] font-mono pointer-events-none">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0F1622]/80 border border-[#202A38] text-slate-300">
                <Activity className="w-3.5 h-3.5 text-cyan-accent animate-pulse" />
                <span>
                  {scanState === 'IDLE' && 'Live Gaussian Volatility Wave Active'}
                  {scanState === 'SCANNING' && 'Laser sweep: Scanning resting liquidity blocks...'}
                  {scanState === 'EXTRACTING' && 'Fitting probability density envelopes (±2.5σ)...'}
                  {scanState === 'VECTORIZING' && 'Zero look-ahead Polars historical backtest loop...'}
                  {scanState === 'VALIDATING' && 'Verifying Monte Carlo & Walk-Forward invariants...'}
                  {scanState === 'LOCKED' && `Strategy Solved & Locked: ${activeMarket.strategyId}`}
                </span>
              </div>

              <div className="px-3 py-1.5 rounded-lg bg-[#0F1622]/80 border border-[#202A38] text-slate-400">
                <span>FPS: 120 · MEMORY: 0 BYTES COPY</span>
              </div>
            </div>
          </div>

          {/* 3. The Living Strategy Card: SI-042 Forensic Reveal HUD */}
          <div className="p-4 bg-[#0B0F16] border-t border-[#202A38] rounded-b-xl">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
              {/* Strategy Identity */}
              <div className="p-3 rounded-xl bg-[#111722] border border-[#202A38] space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>DISCOVERED ALPHA</span>
                  <span className="text-cyan-accent font-bold">{activeMarket.strategyId}</span>
                </div>
                <div className="text-xs font-bold text-slate-100 truncate">
                  {activeMarket.strategyName}
                </div>
                <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Causality Invariant Verified</span>
                </div>
              </div>

              {/* Expected Value */}
              <div className="p-3 rounded-xl bg-[#111722] border border-[#202A38] space-y-0.5">
                <span className="text-[10px] text-slate-500 font-mono block">EXPECTED VALUE</span>
                <span className="text-xl font-bold font-mono-nums text-emerald-400 block">
                  {activeMarket.expectedValue}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block">Per Execution Cycle</span>
              </div>

              {/* Profit Factor */}
              <div className="p-3 rounded-xl bg-[#111722] border border-[#202A38] space-y-0.5">
                <span className="text-[10px] text-slate-500 font-mono block">PROFIT FACTOR</span>
                <span className="text-xl font-bold font-mono-nums text-cyan-accent block">
                  {activeMarket.profitFactor}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block">Gross Win / Gross Loss</span>
              </div>

              {/* Win Rate & Max DD */}
              <div className="p-3 rounded-xl bg-[#111722] border border-[#202A38] space-y-0.5">
                <span className="text-[10px] text-slate-500 font-mono block">WIN RATE / MAX DD</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold font-mono-nums text-slate-100">
                    {activeMarket.winRate}
                  </span>
                  <span className="text-xs font-mono text-crimson-risk">
                    (-{activeMarket.maxDrawdown})
                  </span>
                </div>
                <span className="text-[10px] text-violet-400 font-mono block">
                  Sharpe: {activeMarket.sharpe}
                </span>
              </div>

              {/* Direct Launch CTAs */}
              <div className="flex flex-col gap-2">
                <Link
                  href={`/app/backtest?symbol=${activeMarket.symbol}&strategy=${activeMarket.strategyId.toLowerCase()}`}
                  className="w-full py-2 px-3 rounded-lg bg-cyan-accent text-obsidian-base font-bold text-xs hover:bg-cyan-accent/90 transition-all flex items-center justify-center gap-1.5 shadow-hud"
                >
                  <Activity className="w-3.5 h-3.5 fill-current" />
                  <span>Replay Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <Link
                  href="/app/quant"
                  className="w-full py-1.5 px-3 rounded-lg bg-[#151C27] hover:bg-[#1E293B] border border-[#202A38] text-slate-300 hover:text-cyan-accent font-semibold text-[11px] transition-all flex items-center justify-center gap-1.5"
                >
                  <Cpu className="w-3 h-3 text-cyan-accent" />
                  <span>Inspect Code &amp; MQL5</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
