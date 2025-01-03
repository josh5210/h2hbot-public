'use client';

import React, { Suspense } from 'react';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="animate-pulse">Loading...</div>
      </div>
    </div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

export default ResetPasswordPage;