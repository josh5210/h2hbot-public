// app/chat/[chatId]/page.tsx
'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useWebSocket } from '@/components/providers/WebSocketContext';
import ChatInterface from '@/components/chat/ChatInterface';
import ChatAvatarGroup from '@/components/ChatAvatarGroup';
import { notifications } from '@/lib/api/notifications';
import { z } from 'zod';
import { WS_EVENTS } from '@/lib/websocket/events';

interface Chat {
  id: number;
  participant_ids: number[];
  participant_names: string[];
  updated_at: string;
}

interface ParticipantInfo {
  participant1Name: string;
  participant2Name: string;
}

const ChatResponseSchema = z.object({
  id: z.number(),
  participant_ids: z.array(z.number()),
  participant_names: z.array(z.string()),
  updated_at: z.string()
});

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user, status } = useAuth();
  const { isConnected, joinRoom, leaveRoom, sendMessage } = useWebSocket();
  const [chat, setChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantInfo>({
    participant1Name: '',
    participant2Name: ''
  });

  // Join chat room and delete notifications
  useEffect(() => {
    const initializeChat = async () => {
      if (!isConnected || !params.chatId || status !== 'authenticated') return;

      try {
        // Join WebSocket room
        joinRoom(params.chatId as string);

        // Delete notifications for this chat
        await notifications.deleteNotificationsByChat(Number(params.chatId));

        // Send WebSocket event to notify other clients
        sendMessage({
          type: WS_EVENTS.NOTIFICATIONS_READ,
          payload: { chatId: Number(params.chatId) }
        });
      } catch (error) {
        console.error('Error initializing chat:', error);
      }
    };

    initializeChat();

    return () => {
      if (params.chatId) {
        leaveRoom(params.chatId as string);
      }
    };
  }, [isConnected, params.chatId, status, joinRoom, leaveRoom, sendMessage]);

  // Fetch chat details
  useEffect(() => {
    const fetchChatDetails = async () => {
      try {
        const response = await fetch(`/api/chat/${params.chatId}`);
        
        if (!response.ok) {
          if (response.status === 401) {
            router.push(`/login?redirect=/chat/${params.chatId}`);
            return;
          }
          if (response.status === 403) {
            setError('You do not have access to this chat');
            return;
          }
          if (response.status === 404) {
            setError('Chat not found');
            return;
          }
          throw new Error('Failed to fetch chat details');
        }

        const data = await response.json();
        const validatedData = ChatResponseSchema.parse(data);
        setChat(validatedData);
        
        // Find current user's index and the other participant's index
        const currentUserIndex = validatedData.participant_ids.indexOf(Number(user?.id));
        const otherUserIndex = currentUserIndex === 0 ? 1 : 0;
        
        setParticipants({
          participant1Name: validatedData.participant_names[otherUserIndex] || 'Unknown User',
          participant2Name: validatedData.participant_names[currentUserIndex] || 'Unknown User'
        });

      } catch (err) {
        console.error('Error fetching chat details:', err);
        setError('Error loading chat');
      }
    };

    if (params.chatId && status === 'authenticated' && user?.id) {
      fetchChatDetails();
    }
  }, [params.chatId, status, user?.id, router]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-400">Loading chat...</p>
        </div>
      </div>
    );
  }

  // Authentication check
  if (status === 'unauthenticated') {
    router.push(`/login?redirect=/chat/${params.chatId}`);
    return null;
  }

  // Error state
  if (error) {
    return (
      <div className="h-[calc(100vh-64px)] bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
            <button
              onClick={() => router.push('/chat')}
              className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
            >
              Return to chat list
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state while fetching chat data
  if (!chat) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-400">Loading chat details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] bg-gray-900">
      <div className="relative h-full max-w-4xl mx-auto">
        {/* Connection warning */}
        {!isConnected && (
          <div className="absolute top-0 left-0 right-0 p-4 z-50">
            <div className="bg-yellow-50 rounded-xl p-4 shadow-md">
              <p className="text-sm text-yellow-800">
                Connection lost. Messages may be delayed.
              </p>
            </div>
          </div>
        )}
        
        {/* Avatar Group */}
        <div className="absolute top-7 z-40">
          <ChatAvatarGroup 
            participant1Name={participants.participant1Name}
            participant2Name={participants.participant2Name}
          />
        </div>
        
        {/* Chat Interface */}
        <ChatInterface chatId={params.chatId as string} />
      </div>
    </div>
  );
}