// /src/components/chat/HeartPointButton.tsx
import React, { useState, useEffect } from 'react';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import HeartCelebration from '@/components/chat/HeartPointCelebration';
import { z } from 'zod';

// Response validation schemas
const PointLimitsSchema = z.object({
  remaining: z.number(),
  isSubscribed: z.union([z.boolean(), z.number()]).transform(val => Boolean(val)),
  maxDaily: z.number(),
  nextReset: z.string()
});

const PointAwardResponseSchema = z.object({
  success: z.boolean(),
  remaining: z.number(),
  nextReset: z.string()
});

const ErrorResponseSchema = z.object({
  error: z.string(),
  nextReset: z.string().optional()
});

interface HeartPointButtonProps {
  messageId: number;
  receiverId: number;
  isEligible: boolean;
  reasons: string[];
  type?: 'HP' | 'H2HP';
  awarded?: boolean;
  awardedBy?: string | null;
  className?: string;
  onAward?: () => void;
}

export default function HeartPointButton({
  messageId,
  receiverId,
  isEligible,
  reasons = [],
  type,
  awarded = false,
  awardedBy = null,
  className = '',
  onAward
}: HeartPointButtonProps) {
  const [isAwarding, setIsAwarding] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pointLimits, setPointLimits] = useState<{
    remaining: number;
    nextReset: string;
  } | null>(null);

  // Check point limits when component mounts
  useEffect(() => {
    const checkLimits = async () => {
      try {
        const response = await fetch('/api/points/limits');
        if (!response.ok) throw new Error('Failed to check point limits');
        const rawData = await response.json();
        const limits = PointLimitsSchema.parse(rawData);
        setPointLimits({
          remaining: limits.remaining,
          nextReset: limits.nextReset
        });
      } catch (err) {
        console.error('Error checking point limits:', err);
        setError('Could not check point limits');
      }
    };

    if (isEligible && !awarded) {
      void checkLimits();
    }
  }, [isEligible, awarded]);

  // Position the button based on type
  const positionClass = type === 'H2HP' 
    ? '-top-2 -right-2' 
    : '-bottom-2 -right-2';

  // Handle point award
  const handleAward = async () => {
    if (!isEligible || isAwarding || awarded) return;

    setIsAwarding(true);
    setError(null);

    try {
      const response = await fetch('/api/points/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          receiverId,
          type: 'HP',
          reasons,
          points: 1
        })
      });

      const rawData = await response.json();

      if (!response.ok) {
        const errorData = ErrorResponseSchema.parse(rawData);
        
        if (response.status === 429 && errorData.nextReset) {
          throw new Error(
            `Daily limit reached. Resets at ${new Date(errorData.nextReset).toLocaleTimeString()}`
          );
        }

        throw new Error(errorData.error || 'Failed to award point');
      }

      // Validate success response
      const data = PointAwardResponseSchema.parse(rawData);

      // Show success animation
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);

      // Update point limits
      setPointLimits({
        remaining: data.remaining,
        nextReset: data.nextReset
      });

      // Notify parent
      onAward?.();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to award point');
      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsAwarding(false);
    }
  };

  // For H2HP or already awarded points, just show status
  if (type === 'H2HP' || awarded) {
    return (
      <div 
        className={cn(
          "absolute w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center",
          type === 'H2HP' ? "text-amber-500" : "text-pink-500",
          positionClass,
          className
        )}
        title={type === 'H2HP' ? "AI Heart-to-Heart Point" : `Heart Point awarded by ${awardedBy || 'Unknown'}`}
      >
        &lt;3
      </div>
    );
  }

  // Don't show anything if not eligible and no pending award
  if (!isEligible && !isAwarding && !showSuccess) return null;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleAward}
              disabled={isAwarding || showSuccess || !pointLimits?.remaining}
              className={cn(
                `absolute ${positionClass}
                group relative w-6 h-6 
                rounded-full bg-white shadow-sm 
                text-gray-400 hover:text-pink-400
                cursor-pointer
                transition-all duration-200
                disabled:opacity-50
                disabled:hover:text-gray-400`,
                isAwarding && 'animate-pulse',
                showSuccess && 'text-pink-500',
                className
              )}
            >
              {isAwarding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span className="transform transition-transform duration-200 group-hover:scale-125">
                  &lt;3
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent 
            side="bottom" 
            className="bg-white p-2 rounded-lg shadow-lg max-w-xs"
          >
            {error ? (
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle className="w-4 h-4" />
                <p className="text-sm">{error}</p>
              </div>
            ) : showSuccess ? (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="w-4 h-4" />
                <p className="text-sm">Heart Point awarded!</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium">Award a Heart Point</p>
                <p className="text-xs text-gray-500">
                  {reasons.length > 0 
                    ? reasons.join(', ') 
                    : 'This message showed great empathy or understanding'}
                </p>
                {pointLimits && (
                  <p className="text-xs text-gray-400">
                    {pointLimits.remaining} point{pointLimits.remaining !== 1 ? 's' : ''} remaining today
                  </p>
                )}
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Celebration animation on successful award */}
      {showSuccess && (
        <HeartCelebration 
          show={showSuccess} 
          onComplete={() => setShowSuccess(false)}
          intensity="medium"
        />
      )}
    </>
  );
}