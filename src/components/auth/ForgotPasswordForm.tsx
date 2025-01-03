// /src/components/auth/ForgotPasswordForm.tsx
'use client'

import { useState } from 'react';
import Link from 'next/link';

interface ForgotPasswordResponse {
  message: string;
  resetUrl?: string;  // Optional, only present in development
  error?: string;
}

export default function ForgotPasswordForm() {
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
        credentials: 'include'
      });

      const data = await response.json() as ForgotPasswordResponse;

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
      }

      setSuccess('If an account exists with this email, you will receive password reset instructions.');

      // For development, display the reset URL if provided
      if (process.env.NODE_ENV === 'development' && data.resetUrl) {
        console.log('Reset URL:', data.resetUrl);
      }

      // Clear the form
      (event.target as HTMLFormElement).reset();
      
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
            If an account exists with this email, you&apos;ll receive password reset instructions.
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

          <div className="space-y-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400"
            >
              {loading ? 'Sending...' : 'Send reset instructions'}
            </button>

            <div className="text-center">
              <Link 
                href="/login" 
                className="text-sm font-medium text-blue-600 hover:text-blue-500 hover:underline"
              >
                Back to login
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}