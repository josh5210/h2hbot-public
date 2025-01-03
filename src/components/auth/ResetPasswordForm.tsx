// /src/components/auth/ResetPasswordForm.tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface ResetPasswordResponse {
  message: string;
  error?: string;
}

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const token = searchParams?.get('token');

  if (!token) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-gray-900">
        <div className="w-full max-w-md space-y-8 p-6 bg-white rounded-xl shadow-md mx-4">
          <div className="text-center text-red-600">
            Invalid or missing reset token. Please request a new password reset link.
          </div>
          <div className="text-center">
            <Link 
              href="/forgot-password" 
              className="text-sm font-medium text-blue-600 hover:text-blue-500 hover:underline"
            >
              Request new reset link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
        credentials: 'include'
      });

      const data = await response.json() as ResetPasswordResponse;

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess('Password successfully reset. You can now login with your new password.');
      
      // Redirect to login page after a short delay
      setTimeout(() => {
        router.push('/login');
      }, 3000);
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-md space-y-8 p-6 bg-white rounded-xl shadow-md mx-4">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your new password below
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-900">
                New Password
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
                Confirm New Password
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400"
          >
            {loading ? 'Resetting password...' : 'Reset password'}
          </button>

          <div className="text-center">
            <Link 
              href="/login" 
              className="text-sm font-medium text-blue-600 hover:text-blue-500 hover:underline"
            >
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}