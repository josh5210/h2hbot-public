// /src/components/providers/WebSocketProviderWrapper.tsx
'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useEffect, useState } from 'react';
import { WebSocketProvider } from './WebSocketContext';
import { usePathname } from 'next/navigation';

interface TokenResponse {
    token: string;
  }

export function WebSocketProviderWrapper({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const { user, status } = useAuth();
  const [authToken, setAuthToken] = useState<string | undefined>();
  const pathname = usePathname();

  // Only fetch token when authenticated
  const shouldConnectWebSocket = status === 'authenticated' && user?.id;

  useEffect(() => {
    async function getToken() {
      if (!shouldConnectWebSocket) {
        setAuthToken(undefined);
        return;
      }

      try {
        console.log('Fetching WebSocket token...');
        const response = await fetch('/api/auth/token');
        
        if (!response.ok) {
          throw new Error(`Token fetch failed: ${response.status}`);
        }
        
        const data = await response.json() as TokenResponse;
        
        if (!data.token) {
          throw new Error('No token received');
        }

        console.log('WebSocket token received');
        setAuthToken(data.token);
      } catch (error) {
        console.error('Failed to get WebSocket token:', error);
        setAuthToken(undefined);
      }
    }

    void getToken();
  }, [user?.id, status, shouldConnectWebSocket]);

  // Debug logging
  useEffect(() => {
    console.log('WebSocketProviderWrapper state:', {
      isAuthenticated: status === 'authenticated',
      hasUser: !!user,
      hasToken: !!authToken,
      pathname,
      shouldConnect: shouldConnectWebSocket
    });
  }, [status, user, authToken, pathname, shouldConnectWebSocket]);

  // Always render the provider, but only connect when needed
  return (
    <WebSocketProvider 
      authToken={shouldConnectWebSocket ? authToken : undefined}
    >
      {children}
    </WebSocketProvider>
  );
}