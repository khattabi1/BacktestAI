'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  Search,
} from 'lucide-react';

interface AppHeaderProps {
  onOpenSearch: () => void;
}

export function AppHeader({ onOpenSearch }: AppHeaderProps) {
  const pathname = usePathname();

  const getPageTitle = () => {
    if (pathname === '/app') return 'Command Dashboard';
    if (pathname.startsWith('/app/backtest/workspace')) return 'Backtest Workspace';
    if (pathname.startsWith('/app/backtest')) return 'Backtest Studio';
    if (pathname.startsWith('/app/strategies')) return 'Strategy Library';
    if (pathname.startsWith('/app/journal')) return 'Research Journal';
    if (pathname.startsWith('/app/compare')) return 'Multi-Strategy Matrix';
    if (pathname.startsWith('/app/community')) return 'Quant Community';
    if (pathname.startsWith('/app/settings')) return 'Settings';
    if (pathname.startsWith('/app/si')) return 'Super Intelligence';
    return 'Research Workspace';
  };

  return (
    <header className="h-16 border-b border-obsidian-border bg-obsidian-base/95 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between shrink-0 z-20">
      {/* Left: Mobile Drawer [☰] + Context Breadcrumb / Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Drawer Trigger */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-sidebar'))}
          className="md:hidden p-2 -ml-1 text-slate-300 hover:text-cyan-accent active:text-cyan-accent transition-colors shrink-0"
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Link
            href="/app"
            className="hidden sm:inline text-xs font-mono text-slate-muted hover:text-cyan-accent transition-colors shrink-0"
          >
            BacktestAI
          </Link>
          <span className="hidden sm:inline text-xs text-slate-muted font-mono">/</span>
          <h1 className="text-xs sm:text-sm font-semibold text-slate-text tracking-tight truncate">
            {getPageTitle()}
          </h1>
        </div>
      </div>

      {/* Right: Quick Search */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Global Search Bar Trigger */}
        <button
          onClick={onOpenSearch}
          type="button"
          className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-1.5 rounded-lg bg-obsidian-card hover:bg-obsidian-elevated border border-obsidian-border hover:border-slate-muted/40 text-xs text-slate-muted transition-all group shadow-sm"
          title="Search or jump to (Ctrl+K)"
          aria-label="Search"
        >
          <Search className="w-3.5 h-3.5 text-cyan-accent/80 group-hover:text-cyan-accent transition-colors" />
          <span className="hidden sm:inline font-sans text-xs">Search or jump to...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-obsidian-sub border border-obsidian-border text-slate-subtext">
            Ctrl+K
          </kbd>
        </button>
      </div>
    </header>
  );
}
