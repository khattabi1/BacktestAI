'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,

} from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '@/stores/authStore';
import { QuantLoader } from '@/components/common/QuantLoader';

function LoginForm() {
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const { token, isAuthenticated } = useAuthStore.getState();
    if (token && isAuthenticated) {
      router.replace(targetDestination);
    }
  }, [router, targetDestination]);

  const handleQuickFillDemo = () => {
    setEmail('quant@backtestai.io');
    setPassword('quant2026');
    setErrorMessage(null);
  };

  const googleLogin = useGoogleLogin({
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
          throw new Error(data.detail || 'Google sign-in failed.');
        }

        setAuth(data.user, data.token);
        setSuccessMessage(`Signed in as ${userInfo.email}. Redirecting...`);

        setTimeout(() => {
          window.location.href = targetDestination;
        }, 300);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Google sign-in error.';
        setErrorMessage(message);
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: (errorResponse) => {
      setIsGoogleLoading(false);
      setErrorMessage(errorResponse.error_description || 'Google sign-in was canceled.');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Invalid email or password.');
      }

      setAuth(data.user, data.token);
      setSuccessMessage('Signed in successfully. Redirecting...');

      setTimeout(() => {
        window.location.href = targetDestination;
      }, 300);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-in error.';
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
          Sign In
        </h2>
        <p className="text-xs text-slate-400">
          Enter your credentials to access your quantitative workspace.
        </p>
      </div>


      {/* Google OAuth Button */}
      <div>
        <button
          type="button"
          onClick={() => googleLogin()}
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
          or
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

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-slate-300 font-mono">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-cyan-accent hover:underline font-mono"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-[#080B10] border border-[#202A38] rounded-lg text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-accent font-mono transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-400">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded bg-[#080B10] border-[#202A38] text-cyan-accent focus:ring-0 focus:ring-offset-0 w-4 h-4"
            />
            <span>Remember me</span>
          </label>
          <button
            type="button"
            onClick={handleQuickFillDemo}
            className="text-[11px] text-slate-500 hover:text-cyan-accent font-mono transition-colors p-1"
          >
            Demo fill
          </button>
        </div>

        <button
          type="submit"
          disabled={isLoading || isGoogleLoading}
          className="w-full py-2.5 px-4 min-h-[44px] rounded-lg bg-cyan-accent text-[#080B10] font-semibold text-sm hover:bg-cyan-300 active:bg-cyan-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm mt-2 cursor-pointer"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-[#080B10] border-t-transparent rounded-full animate-spin" />
              <span>Signing In...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Alternative Signup link */}
      <div className="pt-3 border-t border-[#202A38] text-center text-xs text-slate-400">
        <span>Don&apos;t have an account? </span>
        <Link
          href={rawRedirect ? `/signup?redirect_to=${encodeURIComponent(rawRedirect)}` : '/signup'}
          className="text-cyan-accent hover:underline font-medium"
        >
          Create Account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 flex justify-center">
          <QuantLoader size="md" label="INITIALIZING..." />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
