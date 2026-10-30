'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  LineChart,
  Layers,
  BookOpen,
  GitCompare,
  Terminal,
  Activity,
  Cpu,
  Users,
  ChevronRight,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink,
  LogOut,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  exact?: boolean;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        name: 'Dashboard',
        href: '/app',
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    label: 'Backtest & Replay',
    items: [
      {
        name: 'Backtest Studio',
        href: '/app/backtest',
        icon: LineChart,
      },
      {
        name: 'Trading Journal',
        href: '/app/journal',
        icon: BookOpen,
      },
    ],
  },
  {
    label: 'Quant & AI Lab',
    items: [
      {
        name: 'Quant Trading Lab',
        href: '/app/quant',
        icon: Cpu,
        badge: 'AI',
      },
      {
        name: 'Strategy Library',
        href: '/app/strategies',
        icon: Layers,
      },
      {
        name: 'Strategy Comparison',
        href: '/app/compare',
        icon: GitCompare,
      },
      {
        name: 'Quant Community',
        href: '/app/community',
        icon: Users,
        badge: 'Hub',
      },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Mobile drawer window event listeners
  useEffect(() => {
    const handleOpenMobile = () => setIsMobileOpen(true);
    const handleCloseMobile = () => setIsMobileOpen(false);
    const handleToggleMobile = () => setIsMobileOpen((prev) => !prev);

    window.addEventListener('open-mobile-sidebar', handleOpenMobile);
    window.addEventListener('close-mobile-sidebar', handleCloseMobile);
    window.addEventListener('toggle-mobile-sidebar', handleToggleMobile);

    return () => {
      window.removeEventListener('open-mobile-sidebar', handleOpenMobile);
      window.removeEventListener('close-mobile-sidebar', handleCloseMobile);
      window.removeEventListener('toggle-mobile-sidebar', handleToggleMobile);
    };
  }, []);

  // Auto-close mobile drawer on route navigation
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
    const isQuant = pathname.startsWith('/app/quant');
    const stored = localStorage.getItem('backtest_ai_sidebar_collapsed');

    const evaluateCollapse = () => {
      const isCompact = typeof window !== 'undefined' && window.innerWidth < 1366;
      if (stored !== null) {
        if (isQuant && isCompact && stored === 'false') {
          setIsCollapsed(true);
        } else {
          setIsCollapsed(stored === 'true');
        }
      } else {
        if (isCompact || isQuant) {
          setIsCollapsed(true);
        }
      }
    };

    evaluateCollapse();
    window.addEventListener('resize', evaluateCollapse);
    return () => window.removeEventListener('resize', evaluateCollapse);
  }, [pathname]);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('backtest_ai_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    logout();
    window.location.href = '/login';
  };

  const isNavActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <>
      {/* 1. Mobile Off-Canvas Slide-Over Drawer (< md screens) */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition-opacity duration-300 ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Dimmed Blurred Backdrop */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />

        {/* Slide-in Drawer Container */}
        <aside
          className={`absolute top-0 bottom-0 left-0 w-72 bg-[#090D15] border-r border-[#1C2738] flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-in-out select-none ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Top Section */}
          <div className="flex-1 overflow-y-auto">
            {/* Mobile Brand Header */}
            <div className="h-16 px-4 border-b border-[#182334] flex items-center justify-between bg-[#0A0F18]">
              <Link
                href="/app"
                onClick={() => setIsMobileOpen(false)}
                className="flex items-center gap-2.5 min-w-0"
              >
                <div className="w-8 h-8 rounded-lg bg-obsidian-card border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm shrink-0">
                  <Terminal className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-sm tracking-tight text-slate-100 block leading-none truncate">
                    BACKTEST<span className="text-cyan-400">AI</span>
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono tracking-wider block mt-0.5 truncate">
                    SUPER INTELLIGENT
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#121A26] border border-transparent hover:border-[#1E2B3E] transition-all"
                title="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Navigation Groups */}
            <nav className="p-3 space-y-4">
              {NAV_GROUPS.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1">
                  {group.label && (
                    <div className="px-3 pt-2 pb-1 flex items-center">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-semibold truncate">
                        {group.label}
                      </span>
                    </div>
                  )}

                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isNavActive(item);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          active
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35 shadow-sm'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-[#121824]'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-cyan-400' : 'text-slate-500'}`} />
                        <span className="flex-1 truncate">{item.name}</span>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>

          {/* Bottom User Profile Section with Safe Area Inset */}
          <div
            className="p-3 border-t border-[#182334] bg-[#0A0F18] space-y-2"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-mono text-xs font-bold shrink-0">
                {user?.full_name ? user.full_name.slice(0, 2).toUpperCase() : 'SI'}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-slate-200 block truncate">
                  {user?.full_name || 'Senior Trader'}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {user?.email || 'Quantitative Researcher'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* 2. Desktop Persistent Sidebar (>= md screens) */}
      <aside
        className={`hidden md:flex ${
          isCollapsed ? 'w-16' : 'w-64'
        } border-r border-obsidian-border bg-obsidian-sub flex-col justify-between shrink-0 select-none z-30 transition-all duration-300 ease-in-out`}
      >
        {/* Top Section */}
        <div>
          {/* Brand Header */}
          <div
            className={`h-16 border-b border-obsidian-border flex items-center transition-all ${
              isCollapsed ? 'px-2 justify-center flex-col gap-1' : 'px-4 justify-between'
            }`}
          >
            {!isCollapsed ? (
              <>
                <Link href="/app" className="flex items-center gap-2.5 group min-w-0">
                <div className="w-8 h-8 rounded-lg bg-obsidian-card border border-cyan-accent/40 flex items-center justify-center text-cyan-accent shadow-hud group-hover:border-cyan-accent transition-colors shrink-0">
                  <Terminal className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-sm tracking-tight text-slate-text block leading-none truncate">
                    BACKTEST<span className="text-cyan-accent">AI</span>
                  </span>
                  <span className="text-[9px] text-slate-muted font-mono tracking-wider block mt-0.5 truncate">
                    SUPER INTELLIGENT
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={toggleCollapse}
                className="p-1.5 rounded-lg text-slate-muted hover:text-cyan-accent hover:bg-obsidian-card border border-transparent hover:border-obsidian-border transition-all shrink-0"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={toggleCollapse}
                className="w-9 h-9 rounded-lg bg-obsidian-card border border-cyan-accent/40 flex items-center justify-center text-cyan-accent shadow-hud hover:border-cyan-accent hover:bg-obsidian-elevated transition-all"
                title="Expand sidebar"
              >
                <Terminal className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className={`pt-3 space-y-3 ${isCollapsed ? 'px-2' : 'px-3'}`}>
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {group.label && (
                isCollapsed ? (
                  <div className="h-px bg-obsidian-border my-2 mx-1" />
                ) : (
                  <div className="px-3 pt-2 pb-1 flex items-center">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-semibold truncate">
                      {group.label}
                    </span>
                  </div>
                )
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(item);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={isCollapsed ? item.name : undefined}
                    className={`flex items-center rounded-lg text-xs font-medium transition-all group ${
                      isCollapsed
                        ? 'justify-center p-2.5 relative'
                        : 'justify-between px-3 py-2'
                    } ${
                      active
                        ? 'bg-cyan-accent/10 text-cyan-accent border border-cyan-accent/30 shadow-hud'
                        : 'text-slate-subtext hover:bg-obsidian-elevated/70 hover:text-slate-text border border-transparent'
                    }`}
                  >
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 min-w-0'}`}>
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          active
                            ? 'text-cyan-accent'
                            : 'text-slate-muted group-hover:text-slate-text'
                        }`}
                      />
                      {!isCollapsed && <span className="truncate">{item.name}</span>}
                    </div>

                    {!isCollapsed && item.badge && (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap transition-colors ${
                          active
                            ? 'bg-cyan-accent/20 text-cyan-accent font-semibold border border-cyan-accent/40'
                            : 'bg-obsidian-card text-cyan-accent/80 border border-cyan-accent/20 group-hover:text-cyan-accent'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {isCollapsed && item.badge && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-cyan-accent" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom User Profile Section */}
      <div className={`border-t border-obsidian-border bg-obsidian-base/60 transition-all ${isCollapsed ? 'p-2' : 'p-3 space-y-2'}`}>
        {!mounted ? (
          <div className="p-2 rounded-lg bg-obsidian-card border border-obsidian-border animate-pulse flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-obsidian-elevated" />
          </div>
        ) : user ? (
          isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Link
                href="/app/settings"
                title={`${user.full_name || 'Quant Trader'} (${user.email || 'trader'})`}
                className="relative w-8 h-8 rounded-full bg-cyan-accent/15 border border-cyan-accent/40 flex items-center justify-center text-cyan-accent text-xs font-mono font-bold hover:scale-105 transition-transform"
              >
                {user.full_name
                  ? user.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  : 'QU'}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-edge border border-obsidian-card" />
              </Link>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                title="Sign Out"
                className="p-1 rounded text-slate-muted hover:text-red-400 hover:bg-red-950/30 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-obsidian-card border border-obsidian-border flex items-center justify-between gap-2.5 shadow-sm group">
              <Link
                href="/app/settings"
                className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-85 transition-opacity"
              >
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full bg-cyan-accent/15 border border-cyan-accent/40 flex items-center justify-center text-cyan-accent text-xs font-mono font-bold">
                    {user.full_name
                      ? user.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()
                      : 'QU'}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-edge border border-obsidian-card" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-text truncate block leading-tight">
                      {user.full_name || 'Quant Trader'}
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-accent/15 border border-cyan-accent/40 text-cyan-accent shrink-0 shadow-sm leading-none">
                      PRO
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-muted font-mono truncate block leading-tight mt-0.5">
                    {user.email || 'trader@backtestai.io'}
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                title="Sign Out"
                className="p-1.5 rounded-md text-slate-muted hover:text-red-400 hover:bg-red-950/30 transition-colors shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        ) : (
          isCollapsed ? (
            <Link
              href="/login"
              title="Sign In"
              className="w-8 h-8 rounded-lg bg-obsidian-card border border-obsidian-border hover:border-cyan-accent/40 flex items-center justify-center text-slate-muted hover:text-cyan-accent transition-all mx-auto"
            >
              <UserIcon className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              href="/login"
              className="p-2.5 rounded-lg bg-obsidian-card border border-obsidian-border hover:border-cyan-accent/40 flex items-center justify-between gap-2 text-xs font-medium text-slate-subtext hover:text-cyan-accent transition-all shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-obsidian-elevated border border-obsidian-border flex items-center justify-center text-slate-muted">
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
                <span>Sign In</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-muted" />
            </Link>
          )
        )}

        {/* Quick External Links (When not collapsed) */}
        {!isCollapsed && (
          <div className="flex items-center justify-between px-2 pt-1 text-[10px] text-slate-muted">
            <Link
              href="/"
              className="hover:text-cyan-accent transition-colors flex items-center gap-1 font-mono"
            >
              <ExternalLink className="w-3 h-3" />
              Landing Page
            </Link>
            <span className="font-mono">v0.1.0</span>
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => !isLoggingOut && setShowLogoutConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-[#0D1118] border border-[#202A38] shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-red-950/50 border border-red-800/60 flex items-center justify-center text-red-400 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Confirm Sign Out
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Are you sure you want to end your current session? You will be redirected to the sign-in page.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#202A38] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                className="px-3.5 py-1.5 rounded-lg bg-[#111722] hover:bg-[#151D2B] border border-[#202A38] text-slate-300 text-xs font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing Out...</span>
                  </>
                ) : (
                  <span>Sign Out</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
    </>
  );
}
