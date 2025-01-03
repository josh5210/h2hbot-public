// src/components/chat/ChatInviteManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { 
  Link2, 
  Copy, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  AlertCircle 
} from 'lucide-react';

interface Invite {
  id: number;
  invite_code: string;
  created_at: string;
  expires_at: string;
  used_by_user: {
    id: number;
    name: string;
  } | null;
}

interface InviteLimit {
  remaining: number;
  reset: string;
}

interface ErrorResponse {
  error: string;
  remaining?: number;
  reset?: string;
}

interface CreateInviteResponse {
  invite: Invite;
  remaining: number;
  reset: string;
}

// Type guard for error responses
function isErrorResponse(data: unknown): data is ErrorResponse {
  return typeof data === 'object' && 
         data !== null && 
         'error' in data && 
         typeof (data as ErrorResponse).error === 'string';
}

export default function ChatInviteManager() {
  const [activeInvites, setActiveInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLimit, setInviteLimit] = useState<InviteLimit | null>(null);
  const [copySuccess, setCopySuccess] = useState<Record<string, boolean>>({});

  // Fetch active invites
  const fetchInvites = async () => {
    try {
      const response = await fetch('/api/chat/invites?type=active', {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          isErrorResponse(errorData) ? errorData.error : 'Failed to fetch invites'
        );
      }

      const data = await response.json() as Invite[];
      setActiveInvites(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading invites');
      console.error('Error fetching invites:', err);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  // Generate new invite link
  const generateInviteLink = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/chat/invites', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 429 && isErrorResponse(data)) {
          setInviteLimit({
            remaining: data.remaining || 0,
            reset: data.reset || new Date().toISOString()
          });
          throw new Error(data.error || 'Daily invite limit reached');
        }
        throw new Error(
          isErrorResponse(data) ? data.error : 'Failed to create invite'
        );
      }

      const createResponse = data as CreateInviteResponse;
      
      // Update invite list
      await fetchInvites();
      setInviteLimit({
        remaining: createResponse.remaining,
        reset: createResponse.reset
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy invite link to clipboard
  const copyInviteLink = async (inviteCode: string) => {
    const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopySuccess(prev => ({ ...prev, [inviteCode]: true }));
      setTimeout(() => {
        setCopySuccess(prev => ({ ...prev, [inviteCode]: false }));
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy invite link');
    }
  };

  // Revoke invite
  const revokeInvite = async (inviteId: number) => {
    try {
      const response = await fetch('/api/chat/invites', {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          isErrorResponse(errorData) ? errorData.error : 'Failed to revoke invite'
        );
      }

      // Update invite list
      await fetchInvites();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error revoking invite');
      console.error('Error revoking invite:', err);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      // Make date UTC if it's not already
      const date = dateString.endsWith('Z') ? new Date(dateString) : new Date(dateString + 'Z');
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (err) {
      console.error('Error formatting date:', err);
      return 'Invalid date';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Invite Links</h2>
        </div>
        {inviteLimit && (
          <span className="text-sm text-gray-600">
            {inviteLimit.remaining} invites remaining today
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={generateInviteLink}
        disabled={isLoading || (inviteLimit?.remaining === 0)}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Link2 className="w-5 h-5" />
        )}
        {isLoading ? 'Generating...' : 'Generate New Invite Link'}
      </button>

      {activeInvites.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">Active Invite Links</h3>
          <div className="space-y-2">
            {activeInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Expires: {formatDate(invite.expires_at)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Created: {formatDate(invite.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyInviteLink(invite.invite_code)}
                    className="p-2 text-gray-600 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
                    title="Copy invite link"
                  >
                    {copySuccess[invite.invite_code] ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => revokeInvite(invite.id)}
                    className="p-2 text-gray-600 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-md"
                    title="Revoke invite"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}