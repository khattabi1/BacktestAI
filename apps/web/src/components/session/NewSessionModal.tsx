'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Play, DollarSign, Sparkles, Calendar } from 'lucide-react';
import { useSessionStore } from '@/stores/sessionStore';

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AvailableSymbol {
  market: string;
  symbol: string;
  timeframe: string;
  file_count: number;
}

const DEFAULT_AVAILABLE_SYMBOLS = [
  { symbol: 'XAUUSD', market: 'forex' },
  { symbol: 'BTCUSDT', market: 'crypto' },
];

export function NewSessionModal({ isOpen, onClose }: NewSessionModalProps) {
  const router = useRouter();
  const { createSession } = useSessionStore();

  const [sessionName, setSessionName] = useState('');
  const [symbol, setSymbol] = useState<string>('XAUUSD');
  const [availableSymbols, setAvailableSymbols] = useState<{ symbol: string; market: string }[]>(DEFAULT_AVAILABLE_SYMBOLS);
  const [initialBalance, setInitialBalance] = useState<number>(100000);
  const [leverage, setLeverage] = useState<number>(30);

  // Available data range bounds from parquet
  const [availableRange, setAvailableRange] = useState<{ start_date: string; end_date: string }>({
    start_date: '2010-01-01',
    end_date: '2026-10-02',
  });
  const [startDate, setStartDate] = useState<string>('2025-01-01');
  const [endDate, setEndDate] = useState<string>('2026-10-02');

  // Background sync for available symbols
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function syncSymbols() {
      try {
        const res = await fetch('/api/v1/market-data/symbols');
        if (res.ok) {
          const data: AvailableSymbol[] = await res.json();
          if (isMounted && Array.isArray(data) && data.length > 0) {
            const uniqueMap = new Map<string, { symbol: string; market: string }>();
            data.forEach((item) => {
              if (!uniqueMap.has(item.symbol)) {
                uniqueMap.set(item.symbol, { symbol: item.symbol, market: item.market });
              }
            });
            const list = Array.from(uniqueMap.values());
            setAvailableSymbols(list);
          }
        }
      } catch {
        // Silently keep DEFAULT_AVAILABLE_SYMBOLS
      }
    }

    syncSymbols();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Sync available date range for selected symbol
  useEffect(() => {
    if (!isOpen || !symbol) return;

    let isMounted = true;
    async function fetchRange() {
      try {
        const res = await fetch(`/api/v1/market-data/range?symbol=${encodeURIComponent(symbol)}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.start_date && data.end_date) {
            setAvailableRange({
              start_date: data.start_date,
              end_date: data.end_date,
            });
            // Update end date to match max available if out of bounds
            if (!endDate || endDate > data.end_date) {
              setEndDate(data.end_date);
            }
          }
        }
      } catch {
        // Keep existing bounds
      }
    }

    fetchRange();
    return () => {
      isMounted = false;
    };
  }, [isOpen, symbol]);

  if (!isOpen) return null;

  // Replay window calculations for progress line
  const minTime = new Date(availableRange.start_date).getTime();
  const maxTime = new Date(availableRange.end_date).getTime();
  const totalSpan = Math.max(1, maxTime - minTime);
  const sTime = Math.max(minTime, new Date(startDate || availableRange.start_date).getTime());
  const eTime = Math.min(maxTime, new Date(endDate || availableRange.end_date).getTime());
  const leftPct = Math.max(0, Math.min(100, ((sTime - minTime) / totalSpan) * 100));
  const widthPct = Math.max(2, Math.min(100 - leftPct, ((eTime - sTime) / totalSpan) * 100));

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSymbol = symbol || (availableSymbols[0]?.symbol ?? 'XAUUSD');
    const finalName = sessionName.trim() || `${finalSymbol} Replay Session`;

    const newSession = createSession({
      name: finalName,
      symbol: finalSymbol,
      timeframe: '1h',
      startDate: startDate || availableRange.start_date,
      endDate: endDate || availableRange.end_date,
      initialBalance: Number(initialBalance) || 100000,
      strategyId: 'manual-replay',
      strategyName: 'Manual Replay',
      parameters: {},
      config: {
        initialCapital: Number(initialBalance) || 100000,
        leverage,
      },
    });

    onClose();
    if (newSession && newSession.id) {
      router.push(`/app/backtest/workspace?session=${encodeURIComponent(newSession.id)}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div
        className="fixed inset-0 bg-obsidian-base/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl max-h-[92vh] sm:max-h-[85vh] bg-obsidian-card border border-obsidian-border rounded-2xl shadow-2xl p-4 sm:p-6 z-10 my-auto flex flex-col space-y-4 animate-in fade-in zoom-in-95 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-obsidian-border pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-accent/10 border border-cyan-accent/30 flex items-center justify-center text-cyan-accent shadow-hud shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-text">Create Backtest Session</h2>
              <p className="text-[11px] sm:text-xs text-slate-muted">Initialize an isolated research sandbox with dedicated capital and audit trail.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-muted hover:text-slate-text hover:bg-obsidian-elevated min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleCreate} className="space-y-4 text-xs font-sans flex-1 overflow-y-auto pr-1">
          {/* Session Name */}
          <div className="space-y-1.5">
            <label className="text-slate-subtext font-medium">Session Name</label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g., Gold 2024 Institutional Replay, BTC Momentum Sandbox..."
              className="w-full px-3.5 py-2 rounded-lg bg-obsidian-sub border border-obsidian-border text-slate-text placeholder-slate-muted focus:outline-none focus:border-cyan-accent/50 text-xs"
            />
          </div>

          {/* Trading Pair & Leverage */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-slate-subtext font-medium">Trading Pair</label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-obsidian-sub border border-obsidian-border text-slate-text text-xs focus:outline-none focus:border-cyan-accent/50 cursor-pointer font-mono"
              >
                {availableSymbols.map((item) => (
                  <option key={item.symbol} value={item.symbol}>
                    {item.symbol} ({item.market.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-subtext font-medium">Account Leverage</label>
              <select
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-obsidian-sub border border-obsidian-border text-slate-text text-xs focus:outline-none focus:border-cyan-accent/50 cursor-pointer font-mono"
              >
                <option value={1}>1:1 (Spot)</option>
                <option value={10}>1:10 (Conservative)</option>
                <option value={30}>1:30 (Institutional)</option>
                <option value={50}>1:50 (Active)</option>
                <option value={100}>1:100 (High)</option>
              </select>
            </div>
          </div>

          {/* Replay Date Range (Keep date picker only with progress line in bottom) */}
          <div className="space-y-3 p-3.5 rounded-xl bg-obsidian-sub/70 border border-obsidian-border">
            <label className="text-slate-text font-semibold text-xs flex items-center gap-1.5 font-sans">
              <Calendar className="w-3.5 h-3.5 text-cyan-accent" />
              <span>Replay Date Range</span>
            </label>

            {/* Date Pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-muted font-mono">Start Date</span>
                <input
                  type="date"
                  value={startDate}
                  min={availableRange.start_date}
                  max={endDate || availableRange.end_date}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-obsidian-card border border-obsidian-border text-slate-text font-mono text-xs focus:outline-none focus:border-cyan-accent/50"
                  required
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-muted font-mono">End Date</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || availableRange.start_date}
                  max={availableRange.end_date}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-obsidian-card border border-obsidian-border text-slate-text font-mono text-xs focus:outline-none focus:border-cyan-accent/50"
                  required
                />
              </div>
            </div>

            {/* Simple Progress Line at Bottom */}
            <div className="space-y-1 pt-1.5">
              <div className="relative w-full h-1.5 rounded-full bg-obsidian-card border border-obsidian-border overflow-hidden">
                <div
                  className="absolute h-full bg-cyan-accent rounded-full transition-all duration-300"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-muted">
                <span>Start: {availableRange.start_date}</span>
                <span>End: {availableRange.end_date}</span>
              </div>
            </div>
          </div>

          {/* Initial Balance */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-subtext font-medium">Initial Session Capital ($)</label>
              <div className="flex items-center gap-1.5">
                {[10000, 50000, 100000].map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => setInitialBalance(preset)}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-obsidian-sub hover:bg-obsidian-elevated text-cyan-accent border border-obsidian-border"
                  >
                    ${preset.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-slate-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(Number(e.target.value))}
                className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-obsidian-sub border border-obsidian-border text-slate-text font-mono text-xs focus:outline-none focus:border-cyan-accent/50"
              />
            </div>
          </div>

          {/* Submit */}
          <div
            className="pt-3 border-t border-obsidian-border flex items-center justify-end gap-3 shrink-0"
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg bg-obsidian-sub hover:bg-obsidian-elevated text-slate-text text-xs font-medium transition-colors cursor-pointer min-h-[44px] flex items-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-cyan-accent hover:bg-cyan-accent/90 text-obsidian-base font-semibold text-xs transition-all shadow-hud flex items-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Initialize Session</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
