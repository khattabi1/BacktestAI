'use client';

import React from 'react';
import Link from 'next/link';
import { Terminal, ArrowLeft } from 'lucide-react';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  '475003086439-tbvm70i1i9uiqiu7msi58v2lb3g8cvnb.apps.googleusercontent.com';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <div className="min-h-screen bg-[#080B10] text-slate-100 flex flex-col font-sans selection:bg-cyan-accent/25 selection:text-cyan-accent relative">
      {/* Background Subtle Gradient & Grid */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(rgba(56, 189, 248, 0.1) 1px, transparent 1px), radial-gradient(rgba(32, 42, 56, 0.3) 1px, transparent 1px)`,
          backgroundSize: '40px 40px, 10px 10px',
          backgroundPosition: '0 0, 20px 20px',
        }}
      />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-accent/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Clean Minimal Header */}
      <header className="border-b border-[#202A38] bg-[#080B10]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded bg-[#111722] border border-cyan-accent/30 flex items-center justify-center text-cyan-accent shadow-hud group-hover:border-cyan-accent transition-colors">
              <Terminal className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-base tracking-tight text-slate-100">
              BACKTEST<span className="text-cyan-accent">AI</span>
            </span>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to website</span>
          </Link>
        </div>
      </header>

      {/* Centered Pro Card Frame */}
      <main className="flex-1 flex items-center justify-center py-6 sm:py-12 px-3 sm:px-4 relative z-10 w-full">
        <div className="w-full max-w-md mx-auto">
          <div className="relative">
            {/* Subtle glow border */}
            <div className="absolute -inset-0.5 bg-gradient-to-b from-cyan-accent/15 via-transparent to-transparent rounded-2xl blur-sm opacity-60 pointer-events-none" />
            
            {/* Card Content */}
            <div className="relative rounded-xl bg-[#0D1118]/90 border border-[#202A38] shadow-2xl p-4 sm:p-8 backdrop-blur-xl">
              {children}
            </div>
          </div>
        </div>
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-[#202A38] bg-[#080B10]/80 py-4 px-6 text-xs text-slate-500 font-mono relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>&copy; {new Date().getFullYear()} BacktestAI. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-slate-300 transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">
              Privacy
            </Link>
            <Link href="/disclaimer" className="hover:text-slate-300 transition-colors">
              Disclaimer
            </Link>
            <Link href="/status" className="hover:text-slate-300 transition-colors">
              Status
            </Link>
          </div>
        </div>
      </footer>
    </div>
    </GoogleOAuthProvider>
  );
}
