// src/components/providers/WebSocketContext.tsx
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { WebSocketManager } from '@/lib/websocket/WebSocketManager';
import { WS_EVENTS } from '@/lib/websocket/events';
import { WebSocketMessage } from '@/lib/websocket/types';
import { getEventBus } from '@/lib/events/eventBus';
const eventBus = getEventBus();

interface WebSocketContextValue {
  sendMessage: (message: WebSocketMessage) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ 
  children,
  authToken 
}: { 
  children: React.ReactNode;
  authToken?: string;
}) {
  const wsRef = useRef<WebSocketManager | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Set up WebSocket message handling
  useEffect(() => {
    if (!wsRef.current) return;

    const handleMessage = (message: WebSocketMessage) => {
      console.log('🔄 WebSocketContext handling message:', {
        type: message.type,
        payload: message.payload
      });

      if (message.type === 'chat:message') {
        const payload = message.payload;
        console.log('📨 WebSocketContext preparing to emit chat message:', {
          chatId: String(payload.roomId),
          messageId: payload.message.id,
          activeListeners: eventBus.getListenerCount('chat:message')
        });
        
        eventBus.emit('chat:message', {
          chatId: String(payload.roomId),
          message: {
            ...payload.message,
            is_ai: Boolean(payload.message.is_ai),
            eligibility_reasons: Array.isArray(payload.message.eligibility_reasons) 
              ? payload.message.eligibility_reasons 
              : []
          }
        });
      }
    };

    console.log('🎧 Setting up WebSocketContext message handler');
    wsRef.current.on(WS_EVENTS.MESSAGE, handleMessage);
    
    return () => {
      console.log('🔌 Cleaning up WebSocketContext message handler');
      if (wsRef.current) {
        wsRef.current.off(WS_EVENTS.MESSAGE, handleMessage);
      }
    };
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!authToken) {
      console.log('🔑 No auth token, skipping WebSocket connection');
      return;
    }

    // Get WebSocket URL from environment
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) {
      console.error('❌ WebSocket URL not configured');
      return;
    }

    console.log('🔌 Initializing WebSocket connection');
    const wsManager = new WebSocketManager({
      url: wsUrl,
      debug: process.env.NODE_ENV === 'development',
      reconnectAttempts: 5,
      reconnectDelay: 1000
    });

    wsManager.setAuthToken(authToken);
    wsRef.current = wsManager;

    // Set up event handlers
    wsManager.on(WS_EVENTS.CONNECT, () => {
      console.log('🟢 WebSocket connected');
      setIsConnected(true);
    });

    wsManager.on(WS_EVENTS.DISCONNECT, () => {
      console.log('🔴 WebSocket disconnected');
      setIsConnected(false);
    });

    wsManager.on(WS_EVENTS.ERROR, (error) => {
      console.error('❌ WebSocket error:', {
        error,
        url: wsUrl,
        env: process.env.NODE_ENV
      });
    });

    // Connect to WebSocket server
    console.log('🔄 Attempting WebSocket connection...');
    wsManager.connect();

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up WebSocket connection');
      wsManager.disconnect();
      wsRef.current = null;
    };
  }, [authToken]);

  const value = {
    sendMessage: (message: WebSocketMessage) => {
      console.log('📤 WebSocketContext sending message:', message);
      wsRef.current?.sendMessage(message);
    },
    joinRoom: (roomId: string) => {
      console.log('🚪 WebSocketContext joining room:', roomId);
      wsRef.current?.joinRoom(roomId);
    },
    leaveRoom: (roomId: string) => {
      console.log('🚪 WebSocketContext leaving room:', roomId);
      wsRef.current?.leaveRoom(roomId);
    },
    isConnected
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};