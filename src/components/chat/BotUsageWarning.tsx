// src/components/chat/BotUsageWarning.tsx
import React from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

interface BotUsageWarningProps {
  remainingUses: number;
  isSubscribed: boolean;
  className?: string;
}

export default function BotUsageWarning({
  remainingUses,
  isSubscribed,
  className = ''
}: BotUsageWarningProps) {
  if (isSubscribed || remainingUses > 5) return null;

  return (
    <div className={`flex items-center gap-2 text-sm ${
      remainingUses === 0 ? 'text-red-600' : 'text-yellow-600'
    } ${className}`}>
      <AlertCircle className="w-4 h-4" />
      {remainingUses === 0 ? (
        <span>
          You&apos;ve reached your weekly @bot limit.{' '}
          <Link 
            href="/subscribe" 
            className="font-medium hover:underline"
          >
            Subscribe for more!
          </Link>
        </span>
      ) : (
        <span>
          {remainingUses} @bot uses remaining this week.{' '}
          <Link 
            href="/subscribe" 
            className="font-medium hover:underline"
          >
            Need more?
          </Link>
        </span>
      )}
    </div>
  );
}