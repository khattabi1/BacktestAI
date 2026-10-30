'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  LayoutDashboard,
  LineChart,
  Layers,
  BookOpen,
  GitCompare,
  TrendingUp,
  Activity,
  X,
  ArrowRight,
  Terminal,
  Users,
} from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Action' | 'Instrument';
  path?: string;
  icon: React.ElementType;
  description?: string;
  badge?: string;
}

const COMMANDS: CommandItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    category: 'Navigation',
    path: '/app',
    icon: LayoutDashboard,
    description: 'Executive quant command center and telemetry summary',
  },
  {
    id: 'backtest',
    title: 'Backtest Workspace',
    category: 'Navigation',
    path: '/app/backtest',
    icon: LineChart,
    description: 'Interactive OpenAlgo charting, parameter inspector, and run trigger',
    badge: 'Core Engine',
  },
  {
    id: 'strategies',
    title: 'Strategy Library',
    category: 'Navigation',
    path: '/app/strategies',
    icon: Layers,
    description: 'Inspect, configure, and manage algorithmic trading strategies',
  },
  {
    id: 'journal',
    title: 'Research Journal',
    category: 'Navigation',
    path: '/app/journal',
    icon: BookOpen,
    description: 'Hypothesis tracker, setup notes, and forensic trade autopsy',
  },
  {
    id: 'compare',
    title: 'Strategy Comparison Matrix',
    category: 'Navigation',
    path: '/app/compare',
    icon: GitCompare,
    description: 'Side-by-side run matrix comparing Sharpe, Return, and Drawdown',
  },
  {
    id: 'community',
    title: 'Quant Community & Hub',
    category: 'Navigation',
    path: '/app/community',
    icon: Users,
    description: 'Explore shared Open Source & Verified Pro EAs with 5Y verified benchmarks',
    badge: 'Hub',
  },
  {
    id: 'run-backtest',
    title: 'Launch New Backtest Session',
    category: 'Action',
    path: '/app/backtest',
    icon: Activity,
    description: 'Initialize a fresh deterministic backtesting session with DuckDB data',
    badge: 'Fast Action',
  },
  {
    id: 'sym-eurusd',
    title: 'EURUSD · FX Major Pair',
    category: 'Instrument',
    path: '/app/backtest?symbol=EURUSD',
    icon: TrendingUp,
    description: 'Euro / US Dollar 1-Hour DuckDB dataset',
    badge: 'Parquet',
  },
  {
    id: 'sym-btcusdt',
    title: 'BTCUSDT · Crypto Perpetual',
    category: 'Instrument',
    path: '/app/backtest?symbol=BTCUSDT',
    icon: TrendingUp,
    description: 'Bitcoin / Tether 1-Hour DuckDB dataset',
    badge: 'Parquet',
  },
];

interface CommandSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandSearchModal({ isOpen, onClose }: CommandSearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filteredCommands = COMMANDS.filter((cmd) => {
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      (cmd.description && cmd.description.toLowerCase().includes(q)) ||
      cmd.category.toLowerCase().includes(q)
    );
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
  }, [query]);

  const handleSelect = (item: CommandItem) => {
    if (item.path) {
      router.push(item.path);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        handleSelect(filteredCommands[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-obsidian-base/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-2xl bg-obsidian-card border border-obsidian-border rounded-xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150"
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
            placeholder="Search strategies, symbols, navigation, or commands..."
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
          <span className="text-[11px] font-mono text-slate-muted border border-obsidian-border rounded px-1.5 py-0.5 bg-obsidian-base">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-slate-muted">
              <Terminal className="w-8 h-8 mx-auto mb-2 opacity-40 text-cyan-accent" />
              <p className="text-sm">No commands or symbols matching &quot;{query}&quot;</p>
              <p className="text-xs text-slate-muted mt-1">Try &apos;backtest&apos;, &apos;strategies&apos;, or &apos;EURUSD&apos;</p>
            </div>
          ) : (
            filteredCommands.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-cyan-accent/10 border border-cyan-accent/30 text-slate-text'
                      : 'hover:bg-obsidian-sub/60 text-slate-subtext border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-md ${
                        isSelected
                          ? 'bg-cyan-accent/20 text-cyan-accent'
                          : 'bg-obsidian-elevated text-slate-subtext'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${isSelected ? 'text-slate-text font-semibold' : ''}`}>
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-obsidian-border text-cyan-accent">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-slate-muted truncate mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-muted px-1.5 py-0.5 rounded bg-obsidian-base">
                      {item.category}
                    </span>
                    <ArrowRight
                      className={`w-3.5 h-3.5 ${
                        isSelected ? 'text-cyan-accent translate-x-0.5 transition-transform' : 'opacity-0'
                      }`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-obsidian-border bg-obsidian-sub/80 text-[11px] text-slate-muted font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span className="text-cyan-accent/80">BacktestAI Global Navigator</span>
        </div>
      </div>
    </div>
  );
}
