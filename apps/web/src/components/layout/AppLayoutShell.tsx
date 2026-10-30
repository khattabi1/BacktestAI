'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore, syncAuthCookie } from '@/stores/authStore';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { CommandSearchModal } from './CommandSearchModal';
import { QuantLoader } from '@/components/common/QuantLoader';

interface AppLayoutShellProps {
  children: React.ReactNode;
}

export function AppLayoutShell({ children }: AppLayoutShellProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    // 1. Check in-memory Zustand store first
    if (token && isAuthenticated) {
      syncAuthCookie(token);
      setIsAuthorized(true);
      return;
    }

    // 2. Check localStorage in case store hydration is slightly delayed
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('backtest-ai-auth');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.state?.token && parsed?.state?.isAuthenticated) {
            syncAuthCookie(parsed.state.token);
            setIsAuthorized(true);
            return;
          }
        }
      } catch {
        // Fall through to unauthenticated
      }

      // Explicitly unauthorized: redirect to login preserving full path & query
      setIsAuthorized(false);
      const currentPath = window.location.pathname + window.location.search;
      router.replace(`/login?redirect_to=${encodeURIComponent(currentPath)}`);
    }
  }, [token, isAuthenticated, router]);

  // Full-bleed edge-to-edge layout for quantitative workspaces (Backtest Workspace, Quant Lab & SI Agent)
  const isFullBleed = pathname.startsWith('/app/backtest/workspace') || pathname.startsWith('/app/quant') || pathname.startsWith('/app/si');
  const isQuantPage = pathname.startsWith('/app/quant');

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // While verifying authorization or if unauthenticated: render institutional loader ONLY (Zero DOM/FOUC Leakage)
  if (!isAuthorized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-obsidian-base font-sans antialiased text-slate-text">
        <QuantLoader
          size="lg"
          label="VERIFYING INSTITUTIONAL ACCESS..."
          sublabel="Securing session and authenticating quantitative workspace..."
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-obsidian-base font-sans antialiased text-slate-text">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Header - Hidden on Quant Lab to maximize vertical workspace */}
        {!isQuantPage && <AppHeader onOpenSearch={() => setIsSearchOpen(true)} />}

        {/* Dynamic Route Content */}
        {isFullBleed ? (
          <main className="flex-1 overflow-hidden bg-obsidian-base w-full h-full flex flex-col min-w-0 p-0 m-0">
            {children}
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto bg-obsidian-base p-3 sm:p-5 md:p-6 pb-12 md:pb-6">
            <div className="max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
        )}
      </div>

      {/* Global Cmd+K Search Modal */}
      <CommandSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
}
