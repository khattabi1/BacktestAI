'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import NotFound from '@/app/not-found';
import { useAuthStore, syncAuthCookie } from '@/stores/authStore';
import { QuantLoader } from '@/components/common/QuantLoader';
import {
  Activity,
  Users,
  Layers,
  Cpu,
  Database,
  Coins,
  CreditCard,
  Gauge,
  ScrollText,
  ToggleLeft,
  Server,
  Terminal,
  ArrowLeft,
  RefreshCw,
  ShieldAlert,
  Menu,
  X,
} from 'lucide-react';

interface AdminNavGroup {
  label: string;
  items: {
    name: string;
    href: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Command Center',
    items: [
      { name: 'System Overview', href: '/admin', icon: Activity },
      { name: 'User Management', href: '/admin/users', icon: Users },
      { name: 'Strategies & Runs', href: '/admin/strategies', icon: Layers },
      { name: 'Bugs & Reports Center', href: '/admin/reports', icon: ShieldAlert },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, token, user, logout } = useAuthStore();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  React.useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    // 1. Check direct zustand state
    if (token && isAuthenticated) {
      syncAuthCookie(token);
      const userRole = (user?.role || '').toLowerCase();
      const userEmail = (user?.email || '').toLowerCase();
      const hasClearance = userRole === 'admin' || userEmail === 'khattabim116@gmail.com' || userEmail === 'admin@backtestai.io';

      setIsAdminAuthorized(hasClearance);
      setIsCheckingAuth(false);
      return;
    }

    // 2. Check localStorage fallback
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('backtest-ai-auth');
        if (raw) {
          const parsed = JSON.parse(raw);
          const st = parsed?.state;
          if (st?.token && st?.isAuthenticated) {
            syncAuthCookie(st.token);
            const userRole = (st.user?.role || '').toLowerCase();
            const userEmail = (st.user?.email || '').toLowerCase();
            const hasClearance = userRole === 'admin' || userEmail === 'khattabim116@gmail.com' || userEmail === 'admin@backtestai.io';

            setIsAdminAuthorized(hasClearance);
            setIsCheckingAuth(false);
            return;
          }
        }
      } catch { }

      // Unauthenticated -> redirect to login
      setIsCheckingAuth(false);
      setIsAdminAuthorized(false);
      const currentPath = window.location.pathname + window.location.search;
      router.replace(`/login?redirect_to=${encodeURIComponent(currentPath)}`);
    }
  }, [token, isAuthenticated, user, router]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  if (isCheckingAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#080B10] font-mono text-slate-text">
        <QuantLoader
          size="lg"
          label="VERIFYING ADMINISTRATIVE CLEARANCE..."
          sublabel="Securing session and authenticating control telemetry..."
        />
      </div>
    );
  }

  // If user does not have admin role, mask route as 404 Not Found
  if (!isAdminAuthorized) {
    return <NotFound />;
  }

  const renderNavContent = () => (
    <>
      <div>
        {/* Header */}
        <div className="h-14 px-4 border-b border-[#202A38] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#111722] border border-cyan-accent/40 flex items-center justify-center text-cyan-accent">
              <Terminal className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-semibold text-xs tracking-tight text-slate-100 block">
                BACKTEST<span className="text-cyan-400"> AI</span>
              </span>
              <span className="text-[9px] font-mono text-cyan-400 tracking-wider block">
                ADMIN CONSOLE
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
              STAFF
            </span>
            {mobileDrawerOpen && (
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="md:hidden p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)]">
          {ADMIN_NAV.map((group, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-widest text-slate-500 font-semibold">
                {group.label}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`min-h-[40px] flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${isActive
                        ? 'bg-cyan-accent/10 text-cyan-accent border border-cyan-accent/30 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#111722] border border-transparent'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-accent' : 'text-slate-500'}`} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#111722] border border-[#202A38] text-slate-300">
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

      {/* Bottom Status & Back Link */}
      <div className="p-3 border-t border-[#202A38] bg-[#080B10] space-y-2 text-xs">
        <div className="p-2 rounded bg-[#111722] border border-[#202A38] flex items-center justify-between font-mono text-[10px]">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>CLUSTER TELEMETRY</span>
          </div>
          <span className="text-emerald-400">ONLINE</span>
        </div>

        <Link
          href="/app"
          className="min-h-[38px] w-full py-1.5 px-2.5 rounded bg-[#111722] hover:bg-[#151D2B] border border-[#202A38] text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-2 text-xs font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to User Workspace</span>
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#080B10] text-slate-100 font-sans selection:bg-cyan-accent/25 selection:text-cyan-accent">
      {/* Desktop Admin Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-[#202A38] bg-[#0A0E15] flex-col justify-between shrink-0 select-none z-30">
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer Slide-Over */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-[#0A0E15] border-r border-[#202A38] flex flex-col justify-between z-10 shadow-2xl pb-[max(1rem,env(safe-area-inset-bottom))] animate-in slide-in-from-left duration-200">
            {renderNavContent()}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 border-b border-[#202A38] bg-[#0A0E15]/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden min-h-[40px] min-w-[40px] -ml-1 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-[#111722]"
              aria-label="Open Admin Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 truncate">
              <span className="hidden sm:inline text-xs font-mono text-slate-500 uppercase">LOCATION:</span>
              <span className="text-xs font-mono text-cyan-accent font-semibold truncate max-w-[180px] sm:max-w-none">
                {pathname}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              className="min-h-[36px] py-1.5 px-3 rounded-lg bg-[#111722] hover:bg-[#151D2B] border border-[#202A38] text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-accent' : ''}`} />
              <span className="hidden xs:inline">Refresh</span>
            </button>
          </div>
        </header>

        {/* Dynamic Route View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#080B10]">
          {children}
        </main>
      </div>
    </div>
  );
}
