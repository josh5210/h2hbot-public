// src/lib/api/auth.ts
import { getApiUrl } from '@/lib/config';

export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  turnstileToken: string;
}

export interface SignupCredentials extends LoginCredentials {
  name: string;
}

interface ApiError {
    error: string;
  }

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

// Type guard to check if an unknown value is an ApiError
function isApiError(value: unknown): value is ApiError {
    return (
      typeof value === 'object' && 
      value !== null && 
      'error' in value && 
      typeof (value as ApiError).error === 'string'
    );
  }

export const auth = {
  
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${getApiUrl()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Login failed:', data);
        throw new Error(
          isApiError(data) ? data.error : 'Failed to login'
        );
      }
      console.log('Login successful:', data);

  // Type guard for login response
  if (
    typeof data === 'object' && 
    data !== null &&
    'user' in data &&
    typeof data.user === 'object' &&
    data.user !== null &&
    'id' in data.user &&
    'email' in data.user &&
    'name' in data.user &&
    typeof data.user.id === 'string' &&
    typeof data.user.email === 'string' &&
    (typeof data.user.name === 'string' || data.user.name === null)
  ) {
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name
      }
    };
  }

  throw new Error('Invalid response format from server');
},

  async signup(credentials: SignupCredentials): Promise<AuthResponse> {
    const response = await fetch(`${getApiUrl()}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
          isApiError(data) ? data.error : 'Failed to create account'
        );
      }

  // Type guard to verify the response shape
  if (
    typeof data === 'object' && 
    data !== null &&
    'user' in data &&
    typeof data.user === 'object' &&
    data.user !== null &&
    'id' in data.user &&
    'email' in data.user &&
    'name' in data.user &&
    typeof data.user.id === 'string' &&
    typeof data.user.email === 'string' &&
    (typeof data.user.name === 'string' || data.user.name === null)
  ) {
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name
      }
    };
  }

  throw new Error('Invalid response format from server');
},

async logout() {
  try {
    // Clear local session
    await fetch(`${getApiUrl()}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });

    // Clear all auth-related localStorage items
    localStorage.removeItem('auth_token');
    localStorage.removeItem('g_state');
    localStorage.removeItem('oauth_state');

    // Clear all auth-related sessionStorage items
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('g_state');
    sessionStorage.removeItem('oauth_state');

    // Force reload the page to clear any in-memory state
    window.location.reload();
  } catch (error) {
    console.error('Logout failed:', error);
    throw error;
  }
},

  async getSession() {
    console.log('Fetching session from:', `${getApiUrl()}/api/auth/session`);
    const response = await fetch(`${getApiUrl()}/api/auth/session`, {
      credentials: 'include',
    });

    if (!response.ok) {
      console.log('Session response not ok');
      return null;
    }

    const data = await response.json();
    return data;
  }
};