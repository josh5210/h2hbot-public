// src/app/invite/[code]/page.tsx
'use client';

export const runtime = 'edge';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';
import { Loader2, Link2, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { z } from 'zod';

// Validation schema for invite response
const InviteDetailsSchema = z.discriminatedUnion('valid', [
  // Valid invite
  z.object({
    valid: z.literal(true),
    createdBy: z.string(),
    expiresAt: z.string(),
    chatId: z.number().positive()
  }),
  // Invalid invite
  z.object({
    valid: z.literal(false),
    error: z.string()
  })
]);

const JoinChatResponseSchema = z.object({
  success: z.boolean(),
  chatId: z.number().positive(),
  message: z.string().optional()
});


const ErrorResponseSchema = z.object({
  error: z.string()
});

// Type guard for error responses
const isErrorResponse = (data: unknown): data is z.infer<typeof ErrorResponseSchema> => {
  try {
    ErrorResponseSchema.parse(data);
    return true;
  } catch {
    return false;
  }
};

type InviteDetails = z.infer<typeof InviteDetailsSchema>;

export default function InvitePage() {
  const { code } = useParams();
  const { user, status } = useAuth();
  const router = useRouter();
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const validateInvite = async () => {
      try {
        const response = await fetch(`/api/chat/invites/${code}`);
        const data = await response.json();

        // Debug log the raw response
        console.log('Raw invite response:', data);
    
        try {
          // Try to validate as invite details first
          const validatedData = InviteDetailsSchema.parse(data);
          console.log('Validated data:', validatedData);
          
          if (!validatedData.valid) {
            throw new Error(validatedData.error || 'Invalid invite link');
          }
          
          setInviteDetails(validatedData);
        } catch (validationError) {
          console.log('Validation error details:', validationError);
          // If it's a Zod error, format it nicely
          if (validationError instanceof z.ZodError) {
            const errorMessages = validationError.errors.map(err => 
              `${err.path.join('.')}: ${err.message}`
            ).join('\n');
            throw new Error(`Invalid invite data: ${errorMessages}`);
          }

          // If both validations fail, throw the original validation error
          throw validationError;
        }
      } catch (err) {
        console.error('Invite validation error:', err);
        setError(
          err instanceof Error 
            ? err.message 
            : 'Failed to validate invite'
        );
      } finally {
        setIsLoading(false);
      }
    };

    validateInvite();
  }, [code]);

  const joinChat = async () => {
    if (!user) return;
    
    setIsJoining(true);
    setError(null);

    try {
      const response = await fetch(`/api/chat/invites/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = isErrorResponse(data) ? data.error : 'Failed to join chat';
        throw new Error(errorMessage);
      }

      // Validate that we got a chat ID back
      const validatedData = JoinChatResponseSchema.parse(data);
      router.push(`/chat/${validatedData.chatId}`);
    } catch (err) {
      console.error('Join chat error:', err);
      setError(
        err instanceof z.ZodError 
          ? 'Invalid response from server'
          : err instanceof Error ? err.message : 'Failed to join chat'
      );
      setIsJoining(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-md flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (error || !inviteDetails?.valid) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-md">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invite Link</h2>
            <p className="text-gray-600 mb-6">
              {error || 'This invite link is invalid or has expired.'}
            </p>
            <Link 
              href="/chat"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Go to Chats
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-md">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Link2 className="w-12 h-12 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Chat Invitation</h2>
          <p className="text-gray-600 mb-6">
            You&apos;ve been invited by <span className="font-medium">{inviteDetails.createdBy}</span> to join a chat
          </p>

          {status === 'loading' ? (
            <div className="flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : status === 'authenticated' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm">Signed in as {user?.name || user?.email}</span>
              </div>
              <button
                onClick={joinChat}
                disabled={isJoining}
                className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 gap-2"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Joining Chat...
                  </>
                ) : (
                  <>
                    Join Chat
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Please sign in or create an account to join this chat
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  href={`/login?redirect=/invite/${code}`}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Sign In
                </Link>
                <Link
                  href={`/signup?redirect=/invite/${code}`}
                  className="inline-flex items-center justify-center rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Create Account
                </Link>
              </div>
            </div>
          )}

          <div className="mt-6 text-xs text-gray-500">
            This invite will expire on {formatDate(inviteDetails.expiresAt)}
          </div>
        </div>
      </div>
    </div>
  );
}