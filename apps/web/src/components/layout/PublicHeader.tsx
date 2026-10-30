'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Terminal, ArrowRight, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/features/backtesting', label: 'Engine' },
  { href: '/features/charts', label: 'Charts' },
  { href: '/features/analytics', label: 'Forensics' },
  { href: '/features/intelligence', label: 'AI Lab' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'Docs' },
  { href: '/blog', label: 'Blog' },
];

export function PublicHeader() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-[#202A38] bg-[#080B10]/85 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group">
            <div className="w-8 h-8 rounded bg-[#111722] border border-cyan-accent/30 flex items-center justify-center text-cyan-accent shadow-hud group-hover:border-cyan-accent transition-colors">
              <Terminal className="w-4 h-4" />
            </div>
            <span className="font-semibold text-base sm:text-lg tracking-tight text-slate-100">
              BACKTEST<span className="text-cyan-accent">-SI</span>
            </span>
          </Link>
          <span className="hidden sm:inline-block text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-cyan-accent/10 border border-cyan-accent/30 text-cyan-accent font-mono">
            QUANT CORE
          </span>
        </div>

        {/* Center Nav Links with Active Indicator */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-sans">
          {NAV_LINKS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/features' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'text-cyan-accent font-medium'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <span>{item.label}</span>
                {isActive && <span className="w-1 h-1 rounded-full bg-cyan-accent" />}
              </Link>
            );
          })}
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/login"
            className="hidden sm:inline-block text-sm text-slate-400 hover:text-slate-100 transition-colors px-3 py-1.5"
          >
            Sign In
          </Link>
          <Link
            href="/app"
            className="text-xs sm:text-sm font-medium bg-cyan-accent/10 text-cyan-accent border border-cyan-accent/40 hover:bg-cyan-accent/20 px-3 sm:px-4 py-2 rounded-xl transition-all shadow-hud flex items-center gap-1.5 sm:gap-2 font-mono min-h-[38px]"
          >
            <span className="hidden xs:inline">Launch</span>
            <span>Terminal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-[#111722] border border-[#202A38] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            aria-label="Toggle Public Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5 text-cyan-accent" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-[#202A38] bg-[#0A0E15]/95 backdrop-blur-xl px-4 py-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-2">
            {NAV_LINKS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/features' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`p-2.5 rounded-lg text-xs font-mono transition-colors flex items-center justify-between min-h-[44px] ${
                    isActive
                      ? 'bg-cyan-accent/10 text-cyan-accent border border-cyan-accent/30 font-bold'
                      : 'bg-[#111722] text-slate-300 hover:text-white border border-[#202A38]'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-accent" />}
                </Link>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#202A38] flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-[#111722] hover:bg-[#182030] text-slate-300 text-xs font-mono font-medium border border-[#202A38] flex items-center justify-center text-center"
            >
              Sign In to Account
            </Link>
            <Link
              href="/app"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-cyan-accent text-obsidian-base text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-hud"
            >
              <span>Launch Terminal Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
