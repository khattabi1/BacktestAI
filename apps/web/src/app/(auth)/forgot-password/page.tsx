'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Recovery request failed.');
      }

      setIsSubmitted(true);
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
          Reset Password
        </h2>
        <p className="text-xs text-slate-400">
          Enter your email to receive recovery instructions.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isSubmitted ? (
        <div className="space-y-4">
          <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs space-y-1.5 animate-in fade-in">
            <div className="flex items-center gap-2 font-semibold text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Recovery Link Sent</span>
            </div>
            <p className="text-slate-300">
              If an account exists for <strong className="text-white">{email}</strong>,
              we sent a reset link to your inbox.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#111722] border border-[#202A38] text-xs space-y-1.5 font-mono">
            <div className="text-slate-400">Demo Fast-Track:</div>
            <Link
              href="/reset-password?token=si_demo_token"
              className="inline-flex items-center gap-1.5 text-cyan-accent hover:underline text-xs"
            >
              <span>Test Reset Flow Directly</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <Link
            href="/login"
            className="w-full py-2 px-4 rounded-lg bg-[#111722] border border-[#202A38] text-slate-300 hover:text-white hover:border-slate-600 text-xs font-medium transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 font-mono mb-1.5">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@fund.com"
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
                <span>Sending...</span>
              </>
            ) : (
              <>
                <span>Send Reset Link</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="pt-3 border-t border-[#202A38] text-center text-xs text-slate-400">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
