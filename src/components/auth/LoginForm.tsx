// src/components/auth/LoginForm.tsx
'use client'

import { useState, useRef } from 'react';
import { auth } from '@/lib/api/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../providers/AuthProvider';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { refresh } = useAuth();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>();

  const redirectUrl = searchParams?.get('redirect') || '/chat';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    if (!turnstileToken) {
      setError('Please complete the challenge first');
      setLoading(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const form = event.currentTarget;
    if (form.method.toLowerCase() !== 'post') {
      console.error('Form method is not POST:', form.method);
      return;
    }

    try {
      const response = await auth.login({ email, password, turnstileToken });
      
      if (response.user) {
        await refresh();
        router.push(redirectUrl);
        router.refresh();
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      // Reset the Turnstile widget after a failed attempt
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleSignIn = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-md mx-4">
        <div className="mb-8">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            Sign in to your account
          </h2>
        </div>
        
        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Google Sign In - Only shown when email login is hidden */}
          <div className={`transform transition-all duration-300 ${
            showEmailLogin ? 'h-0 opacity-0' : 'h-auto opacity-100'
          }`}>
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-md bg-white px-4 py-2 text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>
          </div>

          {/* Toggle Button */}
          <button
            onClick={() => setShowEmailLogin(!showEmailLogin)}
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <span>
              {showEmailLogin ? 'Continue with Google' : 'Continue with Email'}
            </span>
            {showEmailLogin ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Email Login Form */}
          <div className={`transform transition-all duration-300 ease-in-out overflow-hidden ${
            showEmailLogin ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          }`}>
            <form className="space-y-6" onSubmit={handleSubmit} method="post">
              <div className="space-y-4 rounded-md shadow-sm">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-900">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-900">
                      Password
                    </label>
                    <Link 
                      href={`/forgot-password?redirect=${encodeURIComponent(redirectUrl)}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-500 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
              </div>

              <Turnstile
                ref={turnstileRef}
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''}
                onSuccess={(token) => setTurnstileToken(token)}
                onError={() => {
                  setError('Failed to verify you are human. Please try again.');
                  setTurnstileToken(null);
                }}
                onExpire={() => {
                  setTurnstileToken(null);
                }}
                className="flex justify-center"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </div>

          {/* Sign Up Link - Always visible */}
          <div className="text-center pt-2">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <Link 
                href={`/signup?redirect=${encodeURIComponent(redirectUrl)}`}
                className="font-medium text-blue-600 hover:text-blue-500 hover:underline"
              >
                Sign up here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}