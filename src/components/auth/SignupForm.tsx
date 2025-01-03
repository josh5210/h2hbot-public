// src/components/auth/SignupForm.tsx
'use client';

import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/api/auth';
import { useAuth } from '../providers/AuthProvider';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { refresh } = useAuth();
  const [nameError, setNameError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showEmailSignup, setShowEmailSignup] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>();

  // Get the redirect URL from query parameters
  const redirectUrl = searchParams?.get('redirect') || '/chat';

  const handleGoogleSignIn = () => {
    setLoading(true);
    window.location.href = '/api/auth/google';
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNameError(null);  // Reset name error
    setLoading(true);
    
    if (!turnstileToken) {
      setError('Please complete the challenge first');
      setLoading(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
  
    // Name length validation
    if (name.length > 20) {
      setNameError('Name must be 20 characters or less');
      setLoading(false);
      // Reset Turnstile on validation error
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      // Reset Turnstile on validation error
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      return;   
    }
  
    try {
      // Use the auth utility
      const result = await auth.signup({
        name,
        email,
        password,
        turnstileToken
      });
  
    // After successful signup, log the user in
    if (result.user) {
      await refresh();
      router.push(redirectUrl);
      router.refresh();
    }
  } catch (error) {
    if (error instanceof Error) {
      setError(error.message);
    } else {
      setError('An unexpected error occurred. Please try again.');
    }
    // Reset Turnstile on any error
    turnstileRef.current?.reset();
    setTurnstileToken(null);
  } finally {
    setLoading(false);
  }
}

return (
  <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-gray-900">
    <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-md mx-4">
      <div className={`transition-all duration-300 ${
          showEmailSignup ? 'mb-0' : 'mb-8'  // Reduce margin when expanded
        }`}>        
        <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
          Create your account
        </h2>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Google Sign Up - Only shown when email signup is hidden */}
        <div className={`transform transition-all duration-300 ${
          showEmailSignup ? 'h-0 opacity-0' : 'h-auto opacity-100'
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
            Sign up with Google
          </button>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setShowEmailSignup(!showEmailSignup)}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <span>
            {showEmailSignup ? 'Sign up with Google' : 'Sign up with Email'}
          </span>
          {showEmailSignup ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Email Signup Form */}
        <div className={`transform transition-all duration-300 ease-in-out overflow-hidden ${
          showEmailSignup ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-3 rounded-md shadow-sm">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-900">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  maxLength={20}
                  autoComplete="name"
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
                {nameError && (
                  <p className="mt-1 text-sm text-red-600">{nameError}</p>
                )}
              </div>

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
                <label htmlFor="password" className="block text-sm font-medium text-gray-900">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-900">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
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
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </form>
        </div>

        {/* Sign In Link - Always visible */}
        <div className="text-center pt-2">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link 
              href={`/login?redirect=${encodeURIComponent(redirectUrl)}`}
              className="font-medium text-blue-600 hover:text-blue-500 hover:underline"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  </div>
);
}