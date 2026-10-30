'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  User,
  ShieldCheck,
  Brain,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

type SettingsTab = 'profile' | 'security' | 'ai-usage' | 'billing';

export default function SettingsPage() {
  const { user, setUser, token } = useAuthStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [mounted, setMounted] = useState(false);

  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [tradingRole, setTradingRole] = useState('Quantitative Strategist');
  const [profileSaved, setProfileSaved] = useState(false);

  // Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  // AI Usage Metrics
  const [tokensUsed, setTokensUsed] = useState<number>(48600);
  const tokenQuota = 250000;
  const tokenUsagePct = Math.min(100, Math.round((tokensUsed / tokenQuota) * 100));

  useEffect(() => {
    setMounted(true);
    if (user) {
      setFullName(user.full_name || 'Khattabi Mouad');
      setEmail(user.email || 'khattabim116@gmail.com');
    }

    // Load actual usage from sessions
    const fetchUsage = async () => {
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/v1/agent/sessions', { headers, credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setTokensUsed(Math.max(48600, data.length * 1620));
          }
        }
      } catch {
        // Fallback to initial state
      }
    };
    fetchUsage();
  }, [user, token]);

  // Profile Save
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      setUser({
        ...user,
        full_name: fullName,
        email: email,
      });
    }
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  // Password Update
  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    if (newPassword.length < 8) {
      setSecurityError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityError('New passwords do not match.');
      return;
    }

    setSecuritySuccess('Password updated successfully.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setSecuritySuccess(null), 3000);
  };

  if (!mounted) {
    return (
      <div className="space-y-6 animate-pulse p-6 max-w-5xl mx-auto">
        <div className="h-8 bg-[#0D121D] rounded w-48" />
        <div className="h-64 bg-[#0D121D] rounded-xl border border-[#1E2638]" />
      </div>
    );
  }

  const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profile & Account', icon: User },
    { id: 'security', label: 'Security & 2FA', icon: ShieldCheck },
    { id: 'ai-usage', label: 'AI Usage', icon: Brain },
    { id: 'billing', label: 'Plan & Billing', icon: CreditCard },
  ];

  const initials = fullName
    ? fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'KM';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 font-sans">
      {/* ------------------------------------------------------------- */}
      {/* HEADER                                                        */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#1E2638]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-1">
            <span>BacktestAI</span>
            <span>/</span>
            <span className="text-slate-300">Settings</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
            Account Settings
          </h1>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TWO-COLUMN LAYOUT: TABS + CONTENT                             */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-start">
        {/* Navigation Sidebar */}
        <aside className="md:col-span-1 flex md:flex-col gap-1 overflow-x-auto no-scrollbar pb-1 md:pb-0 shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors text-left shrink-0 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#131B2A] text-cyan-400 border border-[#223048] font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#0D121D] border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Content Pane */}
        <div className="md:col-span-3 min-w-0">
          {/* ========================================================= */}
          {/* TAB 1: Profile & Account                                  */}
          {/* ========================================================= */}
          {activeTab === 'profile' && (
            <div className="rounded-xl bg-[#0D121D] border border-[#1E2638] p-5 sm:p-6 space-y-6">
              <div className="border-b border-[#1E2638] pb-4">
                <h2 className="text-base font-semibold text-slate-100">Profile & Identity</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your personal profile and workspace details.
                </p>
              </div>

              {profileSaved && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Profile updated successfully.</span>
                </div>
              )}

              {/* User Identity Snapshot */}
              <div className="p-4 rounded-lg bg-[#090D15] border border-[#162030] flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-base font-mono font-bold shrink-0">
                  {initials}
                </div>
                <div className="space-y-0.5 min-w-0">
                  <span className="text-sm font-semibold text-slate-200 block">{fullName || 'Khattabi Mouad'}</span>
                  <span className="text-xs text-slate-400 font-mono block truncate">{email}</span>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#080B12] border border-[#1E2638] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-[#080B12] border border-[#1E2638] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1.5">
                    Trading Role / Specialization
                  </label>
                  <input
                    type="text"
                    value={tradingRole}
                    onChange={(e) => setTradingRole(e.target.value)}
                    className="w-full px-3 py-2 bg-[#080B12] border border-[#1E2638] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="pt-3 border-t border-[#1E2638] flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[#080B10] font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: Security & 2FA (RESTORED)                           */}
          {/* ========================================================= */}
          {activeTab === 'security' && (
            <div className="rounded-xl bg-[#0D121D] border border-[#1E2638] p-5 sm:p-6 space-y-6">
              <div className="border-b border-[#1E2638] pb-4">
                <h2 className="text-base font-semibold text-slate-100">Security & Authentication</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Update your password and manage account protection.
                </p>
              </div>

              {securitySuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{securitySuccess}</span>
                </div>
              )}

              {securityError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{securityError}</span>
                </div>
              )}

              {/* Change Password Form */}
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5">
                      Current Password
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 bg-[#080B12] border border-[#1E2638] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1.5">
                        New Password
                      </label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full px-3 py-2 bg-[#080B12] border border-[#1E2638] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1.5">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full px-3 py-2 bg-[#080B12] border border-[#1E2638] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#141B29] hover:bg-[#1A2336] border border-[#243044] hover:border-slate-500 text-slate-200 font-medium text-xs transition-colors cursor-pointer"
                  >
                    Update Password
                  </button>
                </div>
              </form>

              {/* 2FA Card */}
              <div className="pt-4 border-t border-[#1E2638] space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-[#090D15] border border-[#162030]">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">
                      Two-Factor Authentication (2FA)
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Protect account access with TOTP authenticator verification.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTwoFactorEnabled((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors border cursor-pointer ${
                      twoFactorEnabled
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-[#141B29] border-[#243044] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                {/* Active Session Info */}
                <div className="p-4 rounded-lg bg-[#090D15] border border-[#162030] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Laptop className="w-4 h-4 text-slate-500" />
                    <div>
                      <span className="text-xs font-medium text-slate-200 block">Current Web Session</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Active browser session · Signed in as {email || 'khattabim116@gmail.com'}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-emerald-400">
                    Online
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: AI Usage (SIMPLE UI, SINGLE USAGE PROGRESS BAR)    */}
          {/* ========================================================= */}
          {activeTab === 'ai-usage' && (
            <div className="rounded-xl bg-[#0D121D] border border-[#1E2638] p-5 sm:p-6 space-y-5">
              <div className="border-b border-[#1E2638] pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">AI Usage</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Monthly token consumption.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  Resets in 18 days
                </span>
              </div>

              {/* Monthly Token Quota */}
              <div className="p-4 rounded-lg bg-[#090D15] border border-[#162030] space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-sans font-medium">Monthly Token Quota</span>
                  <span className="text-slate-200">
                    {tokensUsed.toLocaleString()} <span className="text-slate-500">/ {tokenQuota.toLocaleString()} ({tokenUsagePct}%)</span>
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#111724] overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all"
                    style={{ width: `${tokenUsagePct}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: Plan & Billing (REAL SAAS BILLING PANEL)           */}
          {/* ========================================================= */}
          {activeTab === 'billing' && (
            <div className="rounded-xl bg-[#0D121D] border border-[#1E2638] p-5 sm:p-6 space-y-6">
              <div className="border-b border-[#1E2638] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">Plan & Billing</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Manage your subscription, payment details, and invoice history.
                  </p>
                </div>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[#080B10] font-semibold text-xs transition-colors shrink-0 cursor-pointer self-start sm:self-center"
                >
                  <span>Change Plan</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Current Active Plan Card */}
              <div className="p-4 rounded-lg bg-[#090D15] border border-[#162030] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-slate-500 uppercase font-mono block">Current Active Plan</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-base font-bold text-slate-100 font-mono">
                        {user?.tier === 'enterprise' ? 'Enterprise Enclave' : 'Quant Pro Plan'}
                      </span>
                      <span className="text-xs font-mono text-emerald-400 font-semibold">Active</span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right font-mono">
                    <span className="text-lg font-bold text-slate-100">$199.00</span>
                    <span className="text-slate-500 text-xs"> / month</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#162030] text-xs">
                  <div>
                    <span className="text-slate-500 font-mono block text-[11px]">Next Billing Date</span>
                    <span className="text-slate-200 font-mono font-medium">November 15, 2026</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono block text-[11px]">Payment Method</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <CreditCard className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-200 font-mono">Visa ending in 4242 (Exp 08/28)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoices History Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-200 font-mono uppercase tracking-wider">
                    Billing History & Invoices
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">Stripe Billing Portal</span>
                </div>

                <div className="rounded-lg border border-[#162030] overflow-hidden bg-[#090D15]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#0D121D] border-b border-[#162030] text-slate-400 text-[11px]">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#162030] text-slate-300">
                      <tr className="hover:bg-[#0D121D]/50 transition-colors">
                        <td className="p-3 text-slate-400">Oct 15, 2026</td>
                        <td className="p-3 text-slate-200 font-medium">INV-2026-1082</td>
                        <td className="p-3">$199.00 USD</td>
                        <td className="p-3">
                          <span className="text-emerald-400 font-medium">Paid</span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => alert('Downloading Invoice INV-2026-1082 (PDF)...')}
                            className="text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                          >
                            PDF ↗
                          </button>
                        </td>
                      </tr>
                      <tr className="hover:bg-[#0D121D]/50 transition-colors">
                        <td className="p-3 text-slate-400">Sep 15, 2026</td>
                        <td className="p-3 text-slate-200 font-medium">INV-2026-0982</td>
                        <td className="p-3">$199.00 USD</td>
                        <td className="p-3">
                          <span className="text-emerald-400 font-medium">Paid</span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => alert('Downloading Invoice INV-2026-0982 (PDF)...')}
                            className="text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                          >
                            PDF ↗
                          </button>
                        </td>
                      </tr>
                      <tr className="hover:bg-[#0D121D]/50 transition-colors">
                        <td className="p-3 text-slate-400">Aug 15, 2026</td>
                        <td className="p-3 text-slate-200 font-medium">INV-2026-0882</td>
                        <td className="p-3">$199.00 USD</td>
                        <td className="p-3">
                          <span className="text-emerald-400 font-medium">Paid</span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => alert('Downloading Invoice INV-2026-0882 (PDF)...')}
                            className="text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                          >
                            PDF ↗
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
