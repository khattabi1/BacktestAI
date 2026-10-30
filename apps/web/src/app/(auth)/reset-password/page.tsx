'use client';

import React, { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Lock,
  KeyRound,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get('token') || '';

  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500', text: 'text-red-400' };
    if (score === 2) return { score, label: 'Fair', color: 'bg-amber-500', text: 'text-amber-400' };
    if (score === 3) return { score, label: 'Good', color: 'bg-cyan-accent', text: 'text-cyan-accent' };
    return { score, label: 'Strong', color: 'bg-emerald-400', text: 'text-emerald-400' };
  }, [newPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token || 'si_token_direct', new_password: newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Reset failed. Token may be invalid or expired.');
      }

      setIsSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Service error. Try again.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-slate-100">
          Set New Password
        </h2>
        <p className="text-xs text-slate-400">
          Enter your reset code and choose a new password.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isSuccess ? (
        <div className="space-y-4">
          <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs space-y-1.5 animate-in fade-in">
            <div className="flex items-center gap-2 font-semibold text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Password Updated</span>
            </div>
            <p className="text-slate-300">
              Your password has been changed. You can now sign in with your new credentials.
            </p>
          </div>

          <Link
            href="/login"
            className="w-full py-2.5 px-4 rounded-lg bg-cyan-accent text-[#080B10] font-semibold text-sm hover:bg-cyan-300 active:bg-cyan-400 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <span>Proceed to Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 font-mono mb-1.5">
              Reset Token
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste reset token"
                className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-[#080B10] border border-[#202A38] rounded-lg text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-accent font-mono transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 font-mono mb-1.5">
              New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-[#080B10] border border-[#202A38] rounded-lg text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-accent font-mono transition-colors"
              />
            </div>

            {/* Minimal Strength Bar */}
            {newPassword && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-500">Strength:</span>
                  <span className={passwordStrength.text}>{passwordStrength.label}</span>
                </div>
                <div className="h-1 w-full bg-[#111722] rounded-full overflow-hidden flex gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-full flex-1 rounded-full transition-all ${
                        level <= passwordStrength.score ? passwordStrength.color : 'bg-[#1A2332]'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 font-mono mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-[#080B10] border border-[#202A38] rounded-lg text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-accent font-mono transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 min-h-[44px] rounded-lg bg-cyan-accent text-[#080B10] font-semibold text-sm hover:bg-cyan-300 active:bg-cyan-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm mt-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-[#080B10] border-t-transparent rounded-full animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <span>Update Password</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="pt-3 border-t border-[#202A38] text-center text-xs text-slate-400">
            <Link href="/login" className="text-cyan-accent hover:underline font-medium">
              Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs font-mono text-slate-500">
          Loading...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
