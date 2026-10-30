'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, TrendingUp, DollarSign, Bitcoin, Gem, BarChart2, ArrowRight } from 'lucide-react';

export interface MarketSymbolDef {
  symbol: string;
  name: string;
  category: 'Crypto' | 'Forex' | 'Commodities' | 'Equities';
  price: string;
  change: string;
  up: boolean;
  basePrice: number;
}

export const AVAILABLE_SYMBOLS: MarketSymbolDef[] = [
  { symbol: 'BTCUSDT', name: 'Bitcoin / Tether USDT', category: 'Crypto', price: '64,250.00', change: '+2.41%', up: true, basePrice: 64250 },
  { symbol: 'ETHUSDT', name: 'Ethereum / Tether USDT', category: 'Crypto', price: '3,480.50', change: '+1.82%', up: true, basePrice: 3480 },
  { symbol: 'XAUUSD', name: 'Gold / US Dollar', category: 'Commodities', price: '2,364.80', change: '+0.65%', up: true, basePrice: 2364.8 },
  { symbol: 'EURUSD', name: 'Euro / US Dollar', category: 'Forex', price: '1.0845', change: '+0.14%', up: true, basePrice: 1.0845 },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', category: 'Forex', price: '1.2980', change: '-0.21%', up: false, basePrice: 1.2980 },
  { symbol: 'SPY', name: 'S&P 500 ETF Trust', category: 'Equities', price: '562.10', change: '-0.22%', up: false, basePrice: 562.1 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', category: 'Equities', price: '121.40', change: '+3.15%', up: true, basePrice: 121.4 },
];

interface SymbolSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (symbolDef: MarketSymbolDef) => void;
}

export function SymbolSearchModal({ isOpen, onClose, onSelectSymbol }: SymbolSearchModalProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const categories = ['ALL', 'Crypto', 'Forex', 'Commodities', 'Equities'] as const;

  const filtered = AVAILABLE_SYMBOLS.filter((item) => {
    const matchesCat = activeCategory === 'ALL' || item.category === activeCategory;
    const q = query.toLowerCase();
    const matchesQ =
      item.symbol.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q);
    return matchesCat && matchesQ;
  });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeCategory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onSelectSymbol(filtered[selectedIndex]);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Crypto':
        return <Bitcoin className="w-3.5 h-3.5 text-amber-400" />;
      case 'Commodities':
        return <Gem className="w-3.5 h-3.5 text-yellow-500" />;
      case 'Forex':
        return <DollarSign className="w-3.5 h-3.5 text-emerald-edge" />;
      default:
        return <BarChart2 className="w-3.5 h-3.5 text-cyan-accent" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-obsidian-base/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-xl bg-obsidian-card border border-obsidian-border rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-obsidian-border bg-obsidian-sub">
          <Search className="w-5 h-5 text-cyan-accent mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbol (e.g. BTCUSDT, XAUUSD, EURUSD, NVDA, SPY)..."
            className="w-full bg-transparent text-slate-text placeholder-slate-muted focus:outline-none text-sm font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-muted hover:text-slate-subtext mr-2 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[10px] font-mono text-slate-muted border border-obsidian-border rounded px-1.5 py-0.5 bg-obsidian-base">
            ESC
          </span>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-obsidian-border/70 bg-obsidian-sub/40 text-xs font-mono">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeCategory === cat
                  ? 'bg-cyan-accent/20 text-cyan-accent border border-cyan-accent/40 shadow-hud'
                  : 'text-slate-muted hover:text-slate-subtext hover:bg-obsidian-elevated'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="max-h-72 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-muted">
              <p className="text-sm">No symbols matching &quot;{query}&quot;</p>
              <p className="text-xs text-slate-muted mt-1">Try &apos;BTC&apos;, &apos;Gold&apos;, or &apos;EUR&apos;</p>
            </div>
          ) : (
            filtered.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.symbol}
                  onClick={() => {
                    onSelectSymbol(item);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-cyan-accent/15 border border-cyan-accent/40 text-slate-text shadow-sm'
                      : 'hover:bg-obsidian-sub text-slate-subtext border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-obsidian-elevated border border-obsidian-border/80">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-text">
                          {item.symbol}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-obsidian-base border border-obsidian-border text-slate-muted">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-muted truncate">{item.name}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3 font-mono">
                    <div className="font-semibold text-slate-text text-sm">{item.price}</div>
                    <div
                      className={`text-xs flex items-center justify-end gap-0.5 ${
                        item.up ? 'text-emerald-edge' : 'text-crimson-risk'
                      }`}
                    >
                      <TrendingUp className={`w-3 h-3 ${!item.up && 'rotate-180'}`} />
                      <span>{item.change}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-obsidian-border bg-obsidian-sub/80 text-[11px] text-slate-muted font-mono">
          <span>↑↓ Navigate · ↵ Select · Esc Close</span>
          <span className="text-cyan-accent">TradingView Asset Selector</span>
        </div>
      </div>
    </div>
  );
}
