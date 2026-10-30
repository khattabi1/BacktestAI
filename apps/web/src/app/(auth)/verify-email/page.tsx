'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  KeyRound,
} from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || 'your email';

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isResent, setIsResent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      const nextInput = document.getElementById(`pin-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`pin-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const fullPin = code.join('');
    if (fullPin.length < 6) {
      setErrorMessage('Please enter all 6 digits.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    setTimeout(() => {
      setIsLoading(false);
      setIsVerified(true);
      setTimeout(() => {
        router.push('/onboarding');
      }, 700);
    }, 500);
  };

  const handleInstantVerify = () => {
    setCode(['7', '3', '9', '1', '4', '2']);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsVerified(true);
      setTimeout(() => {
        router.push('/onboarding');
      }, 700);
    }, 300);
  };

  const handleResend = () => {
    setIsResent(true);
    setTimeout(() => setIsResent(false), 3000);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-slate-100">
          Verify Email
        </h2>
        <p className="text-xs text-slate-400">
          Enter the 6-digit code sent to <strong className="text-slate-200">{email}</strong>.
        </p>
      </div>

      {/* Error / Resend Alerts */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isResent && (
        <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 text-xs flex items-start gap-2 animate-in fade-in">
          <RefreshCw className="w-4 h-4 text-cyan-accent shrink-0 mt-0.5 animate-spin" />
          <span>Verification code resent.</span>
        </div>
      )}

      {isVerified ? (
        <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs space-y-1.5 text-center animate-in fade-in">
          <div className="flex items-center justify-center gap-2 font-semibold text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <span>Email Verified</span>
          </div>
          <p className="text-slate-300">
            Redirecting to setup wizard...
          </p>
        </div>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          {/* PIN Fields */}
          <div className="flex justify-between gap-2">
            {code.map((digit, idx) => (
              <input
                key={idx}
                id={`pin-${idx}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className="w-11 h-12 bg-[#080B10] border border-[#202A38] rounded-lg text-center text-lg font-bold font-mono text-cyan-accent focus:outline-none focus:border-cyan-accent transition-colors"
              />
            ))}
          </div>

          {/* Quick Verify Pill */}
          <div className="p-2.5 rounded-lg bg-[#111722]/80 border border-[#202A38] flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <KeyRound className="w-3.5 h-3.5 text-cyan-accent" />
              <span>Demo Quick-Fill:</span>
            </div>
            <button
              type="button"
              onClick={handleInstantVerify}
              className="px-2 py-0.5 rounded bg-[#080B10] border border-cyan-accent/30 text-cyan-accent font-mono text-[11px] hover:bg-cyan-accent/10 transition-colors"
            >
              Auto-Verify
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-lg bg-cyan-accent text-[#080B10] font-semibold text-sm hover:bg-cyan-300 active:bg-cyan-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-[#080B10] border-t-transparent rounded-full animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>Verify &amp; Continue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-[#202A38]">
            <button
              type="button"
              onClick={handleResend}
              className="hover:text-cyan-accent transition-colors"
            >
              Resend code
            </button>
            <Link href="/login" className="hover:text-slate-200 transition-colors">
              Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs font-mono text-slate-500">
          Loading...
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
