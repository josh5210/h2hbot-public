// src/app/login/page.tsx
import { Suspense } from 'react';
import { Metadata } from 'next';
import LoginForm from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Login to your account',
};

export default function LoginPage() {
  return (
    <Suspense 
      fallback={
        <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-gray-900">
          <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-md mx-4">
            <div className="animate-pulse flex flex-col space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-blue-200 rounded"></div>
            </div>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}