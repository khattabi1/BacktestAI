'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  TrendingUp,
  Activity,
  Play,
  RotateCcw,
  Zap,
  Layers,
  Sliders,
  DollarSign,
  Maximize2,
  ChevronDown,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import type { ChartTrade, OpenAlgoBar } from '@backtest-ai/chart';

// Dynamically import OpenAlgoChart to prevent SSR canvas issues
const OpenAlgoChart = dynamic(
  () => import('@backtest-ai/chart').then((mod) => mod.OpenAlgoChart),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[450px] bg-[#080B10] flex flex-col items-center justify-center space-y-3 font-mono">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
        <span className="text-xs text-slate-400">INITIALIZING OPENALGO BOT CHART ENGINE...</span>
      </div>
    ),
  }
);

export interface BotChartVisualizerProps {
  symbol?: string;
  timeframe?: string;
  trades?: ChartTrade[];
  onRunSimulation?: () => void;
  isRunning?: boolean;
  metrics?: {
    netProfit?: number;
    netProfitPct?: number;
    winRate?: number;
    sharpeRatio?: number;
    totalTrades?: number;
  } | null;
  onSymbolChange?: (symbol: string) => void;
  onTimeframeChange?: (timeframe: string) => void;
}

export function BotChartVisualizer({
  symbol = 'BTCUSDT',
  timeframe = '1h',
  trades = [],
  onRunSimulation,
  isRunning = false,
  metrics,
  onSymbolChange,
  onTimeframeChange,
}: BotChartVisualizerProps) {
  const [bars, setBars] = useState<OpenAlgoBar[]>([]);
  const [isLoadingBars, setIsLoadingBars] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Load real historical market bars
  useEffect(() => {
    let isCancelled = false;

    async function loadBars() {
      setIsLoadingBars(true);
      setFetchError(null);
      try {
        const res = await fetch(
          `/api/v1/market-data/bars?symbol=${symbol}&timeframe=${timeframe}&limit=1000`
        );
        if (!res.ok) {
          throw new Error(`Failed to load bars: ${res.statusText}`);
        }
        const data = await res.json();
        if (!isCancelled && Array.isArray(data)) {
          const parsedBars: OpenAlgoBar[] = data.map((b: any) => ({
            time: Math.floor(new Date(b.timestamp).getTime() / 1000),
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            volume: b.volume,
          }));
          setBars(parsedBars);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('[BotChartVisualizer] Error loading bars:', err);
          setFetchError(err.message || 'Market data unavailable');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingBars(false);
        }
      }
    }

    loadBars();
    return () => {
      isCancelled = true;
    };
  }, [symbol, timeframe]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080B10] overflow-hidden select-none font-mono relative">
      {/* 1. Bot Chart Control Sub-bar */}
      <div className="h-9 bg-[#0B0F16] border-b border-[#202A38] px-3 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-3">
          {/* Symbol & Market Status */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-cyan-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {symbol}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#151C27] text-slate-300 font-semibold border border-[#202A38] text-[10px]">
              {timeframe.toUpperCase()}
            </span>
            <span className="text-[10px] text-slate-500">· Real Parquet Feed</span>
          </div>

          <div className="h-4 w-px bg-[#202A38]" />

          {/* Bot Trades Marker Summary */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">Mapped Bot Trades:</span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                trades.length > 0
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {trades.length} {trades.length === 1 ? 'Trade' : 'Trades'}
            </span>
          </div>
        </div>

        {/* Action Controls & Metrics */}
        <div className="flex items-center gap-3">
          {metrics && (
            <div className="flex items-center gap-3 text-[11px] pr-2">
              <span className="text-slate-400">
                Win Rate:{' '}
                <span className="text-slate-200 font-bold">{metrics.winRate || 0}%</span>
              </span>
              <span className="text-slate-400">
                Net PnL:{' '}
                <span
                  className={`font-bold ${
                    (metrics.netProfitPct || 0) >= 0 ? 'text-emerald-400' : 'text-crimson-risk'
                  }`}
                >
                  {(metrics.netProfitPct || 0) >= 0 ? '+' : ''}
                  {metrics.netProfitPct || 0}%
                </span>
              </span>
            </div>
          )}

          {onRunSimulation && (
            <button
              onClick={onRunSimulation}
              disabled={isRunning}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold shadow-sm transition-all ${
                isRunning
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-cyan-accent text-obsidian-base hover:bg-cyan-accent/90'
              }`}
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Simulating...</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Simulate Strategy</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 2. Chart Viewport */}
      <div className="flex-1 min-h-0 relative">
        {isLoadingBars && bars.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center space-y-3 font-mono bg-[#080B10]">
            <div className="w-7 h-7 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span className="text-xs text-slate-400">Streaming historical tick bars...</span>
          </div>
        ) : fetchError && bars.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center space-y-2 font-mono bg-[#080B10] text-crimson-risk">
            <AlertCircle className="w-6 h-6" />
            <span className="text-xs">{fetchError}</span>
          </div>
        ) : (
          <OpenAlgoChart
            bars={bars}
            trades={trades}
            symbol={symbol}
            timeframe={timeframe}
            showVolume={true}
            showReplayScrubber={true}
            onSymbolChange={onSymbolChange}
            onTimeframeChange={onTimeframeChange}
            onRunSimulation={onRunSimulation}
            isRunning={isRunning}
          />
        )}
      </div>
    </div>
  );
}
