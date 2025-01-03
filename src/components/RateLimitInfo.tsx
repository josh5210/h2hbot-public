// src/components/RateLimitInfo.tsx
'use client';

import { useEffect, useState } from 'react';

export function RateLimitInfo() {
  const [limits, _setLimits] = useState<{
    remaining: number;
    reset: string;
  } | null>(null);

  useEffect(() => {
    const headers = new Headers();
    if (limits?.remaining !== undefined) {
      headers.append('X-RateLimit-Remaining', limits.remaining.toString());
    }
  }, [limits]);

  if (!limits) return null;

  return (
    <div className="text-xs text-gray-500">
      {limits.remaining} AI requests remaining
    </div>
  );
}