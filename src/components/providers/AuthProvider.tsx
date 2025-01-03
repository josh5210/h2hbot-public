// src/components/providers/AuthProvider.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '@/lib/api/auth';

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface AuthContextType {
  user: User | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  refresh: () => Promise<void>;
}

interface SessionResponse {
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  status: 'loading',
  refresh: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  const checkSession = async () => {
    try {
      const session = await auth.getSession() as SessionResponse;
      
      if (session?.user) {
        setUser(session.user);
        setStatus('authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setUser(null);
      setStatus('unauthenticated');
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const value = {
    user,
    status,
    refresh: checkSession
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;