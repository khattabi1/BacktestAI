'use client';

import React, { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '@/stores/authStore';
import { QuantLoader } from '@/components/common/QuantLoader';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  const rawRedirect = searchParams.get('redirect_to');
  const targetDestination =
    rawRedirect &&
    rawRedirect.startsWith('/') &&
    !rawRedirect.startsWith('//') &&
    !rawRedirect.includes('\\')
      ? rawRedirect
      : '/app/quant';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tier, setTier] = useState<'researcher' | 'pro' | 'enterprise'>('researcher');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500', text: 'text-red-400' };
    if (score === 2) return { score, label: 'Fair', color: 'bg-amber-500', text: 'text-amber-400' };
    if (score === 3) return { score, label: 'Good', color: 'bg-cyan-accent', text: 'text-cyan-accent' };
    return { score, label: 'Strong', color: 'bg-emerald-400', text: 'text-emerald-400' };
  }, [password]);

  const googleSignup = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsGoogleLoading(true);
      setErrorMessage(null);

      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userInfo = await userInfoRes.json();

        if (!userInfoRes.ok || !userInfo.email) {
          throw new Error('Failed to retrieve verified Google profile.');
        }

        const response = await fetch('/api/v1/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userInfo.email,
            name: userInfo.name || userInfo.email.split('@')[0],
            credential: tokenResponse.access_token,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || 'Google sign-up failed.');
        }

        setAuth(data.user, data.token);
        setSuccessMessage(`Account created as ${userInfo.email}. Redirecting...`);

        setTimeout(() => {
          router.push(targetDestination);
        }, 600);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Google sign-up error.';
        setErrorMessage(message);
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: (errorResponse) => {
      setIsGoogleLoading(false);
      setErrorMessage(errorResponse.error_description || 'Google sign-up was canceled.');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setErrorMessage('Please accept the terms and risk disclosure to proceed.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          tier,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed. Check your inputs.');
      }

      setAuth(data.user, data.token);
      setSuccessMessage('Account created successfully. Redirecting...');

      setTimeout(() => {
        router.push(targetDestination);
      }, 600);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration error.';
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
          Create Account
        </h2>
        <p className="text-xs text-slate-400">
          Join institutional quantitative researchers and algorithmic traders.
        </p>
      </div>

      {/* Google OAuth Button */}
      <div>
        <button
          type="button"
          onClick={() => googleSignup()}
          disabled={isGoogleLoading || isLoading}
          className="w-full py-2.5 px-4 rounded-lg bg-[#111722] hover:bg-[#151D2B] border border-[#202A38] hover:border-slate-500 text-slate-200 text-sm font-medium transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-50"
        >
          {isGoogleLoading ? (
            <span className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>Continue with Google</span>
        </button>
      </div>

      {/* Divider */}
      <div className="relative flex items-center justify-center">
        <div className="w-full border-t border-[#202A38]" />
        <span className="bg-[#0D1118] px-3 text-[11px] font-mono text-slate-500 uppercase tracking-wider absolute">
          or register with email
        </span>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-start gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-medium text-slate-300 font-mono mb-1.5">
            Full Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alexander Morgan"
              className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-[#080B10] border border-[#202A38] rounded-lg text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-accent font-sans transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 font-mono mb-1.5">
            Work Email
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
              placeholder="alexander@hedgefund.com"
              className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-[#080B10] border border-[#202A38] rounded-lg text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-accent font-mono transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 font-mono mb-1.5">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-[#080B10] border border-[#202A38] rounded-lg text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-accent font-mono transition-colors"
            />
          </div>

          {/* Strength Indicator */}
          {password && (
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

        {/* Terms */}
        <div className="pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-400">
            <input
              type="checkbox"
              required
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 rounded bg-[#080B10] border-[#202A38] text-cyan-accent focus:ring-0 focus:ring-offset-0 w-4 h-4"
            />
            <span className="leading-tight">
              I agree to the{' '}
              <Link href="/terms" target="_blank" className="text-cyan-accent hover:underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/disclaimer" target="_blank" className="text-cyan-accent hover:underline">
                CFTC 4.41 Disclosure
              </Link>
              .
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading || isGoogleLoading}
          className="w-full py-2.5 px-4 min-h-[44px] rounded-lg bg-cyan-accent text-[#080B10] font-semibold text-sm hover:bg-cyan-300 active:bg-cyan-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm mt-2 cursor-pointer"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-[#080B10] border-t-transparent rounded-full animate-spin" />
              <span>Creating Account...</span>
            </>
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Alternative Login link */}
      <div className="pt-3 border-t border-[#202A38] text-center text-xs text-slate-400">
        <span>Already have an account? </span>
        <Link
          href={rawRedirect ? `/login?redirect_to=${encodeURIComponent(rawRedirect)}` : '/login'}
          className="text-cyan-accent hover:underline font-medium"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 flex justify-center">
          <QuantLoader size="md" label="INITIALIZING..." />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
