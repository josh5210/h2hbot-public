// /src/app/chat/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useWebSocket } from '@/components/providers/WebSocketContext';
import ChatInviteManager from '@/components/chat/ChatInviteManager';
import ChatListWithSearch from '@/components/chat/ChatListWithSearch';
import { Chat } from '@/types/chat';
import { getEventBus } from '@/lib/events/eventBus';
const eventBus = getEventBus();

type FetchStatus = 'loading' | 'idle' | 'error' | 'success';

interface FetchState {
  status: FetchStatus;
  error: string | null;
  lastUpdated: Date | null;
}

interface ErrorResponse {
  error: string;
}

// Type guard for error response
function isErrorResponse(data: unknown): data is ErrorResponse {
  return typeof data === 'object' && 
         data !== null && 
         'error' in data && 
         typeof (data as ErrorResponse).error === 'string';
}

export default function ChatListPage() {
  const { user, status: authStatus } = useAuth();
  const { isConnected } = useWebSocket();
  const [chats, setChats] = useState<Chat[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>({
    status: 'idle' as FetchStatus,
    error: null,
    lastUpdated: null
  });

  const fetchChats = async (showLoading = true) => {
    try {
      if (showLoading) {
        setFetchState(prev => ({ ...prev, status: 'loading' }));
      }

      const response = await fetch('/api/chat');
      
      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 401) {
          throw new Error('Please log in to view your chats');
        }
        if (response.status === 403) {
          throw new Error('You don\'t have permission to view these chats');
        }
        
        const errorData = await response.json().catch(() => null);
        throw new Error(
          (isErrorResponse(errorData) ? errorData.error : null) || 
          `Failed to fetch chats (${response.status})`
        );
      }

      const data = await response.json() as Chat[];
      
      setChats(data);
      setFetchState({
        status: 'success',
        error: null,
        lastUpdated: new Date()
      });
    } catch (err) {
      console.error('Error fetching chats:', err);
      setFetchState(prev => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to load chats'
      }));
    }
  };

  // Subscribe to chat events
  useEffect(() => {
    // Handle notifications being marked as read
    const handleNotificationsRead = (data: { chatId: number }) => {
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === data.chatId 
            ? { ...chat, unread_count: 0 }
            : chat
        )
      );
    };

    // Handle new messages
    const handleNewMessage = () => {
      fetchChats(false); // Refresh chats without showing loading state
    };

    // Subscribe to events
    const unsubscribeNotifications = eventBus.on('notifications:read', handleNotificationsRead);
    const unsubscribeMessages = eventBus.on('chat:message', handleNewMessage);
    
    return () => {
      unsubscribeNotifications();
      unsubscribeMessages();
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    if (authStatus === 'authenticated' && user?.id) {
      fetchChats();
    }
  }, [authStatus, user?.id]);

  if (authStatus === 'loading' || fetchState.status === 'loading') {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-400">Loading your chats...</p>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-900">
        <div className="bg-white rounded-xl shadow-md p-6 max-w-md mx-4">
          <p className="text-gray-900 text-center">
            Please log in to view your chats
          </p>
        </div>
      </div>
    );
  }
  
  const isLoading = fetchState.status === ('loading' as FetchStatus);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-900 relative">
      <div className="max-w-4xl mx-auto p-6 space-y-6 relative">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Heart 2 Heart Chats</h1>
            {fetchState.lastUpdated && (
              <button
                onClick={() => fetchChats()}
                disabled={isLoading}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                title={`Last updated: ${fetchState.lastUpdated.toLocaleTimeString()}`}
              >
               <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
          </div>
        </div>

        {/* Error Message */}
        {fetchState.error && (
          <div className="rounded-xl bg-red-50 p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-800">{fetchState.error}</p>
              <button
                onClick={() => fetchChats()}
                className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Socket Connection Warning */}
        {!isConnected && fetchState.status === 'success' && (
          <div className="rounded-xl bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">
              Real-time updates are currently unavailable. You may need to refresh manually to see new messages.
            </p>
          </div>
        )}

        {/* Invite manager */}
        <ChatInviteManager />

        {/* Chat List with Search */}
        <ChatListWithSearch 
          chats={chats} 
          onChatsUpdate={setChats}  // Pass the update function
        />
      </div>
    </div>
  );
}