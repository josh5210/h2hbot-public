// src/handlers/auth.ts
import { Request as CloudflareRequest } from '@cloudflare/workers-types';
import { Env } from '@/types/env';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { createSessionToken } from '@/lib/jwt';
import { query } from '@/lib/db/d1-utils';
import { getServerSession } from '@/lib/session';
import { handleForgotPassword, handleResetPassword } from './auth/password-reset';
import { getGoogleOAuthURL } from '@/lib/google-auth';
import { handleGoogleAuth } from './auth/google';
import { handleGetToken } from './auth/token';


// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  turnstileToken: z.string().min(1, 'Challenge response is required'),
});

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  turnstileToken: z.string().min(1, 'Challenge response is required'),
});

interface TurnstileResponse {
  success: boolean;
  challenge_ts: string;
  hostname: string;
  error_codes?: string[];
}

async function verifyTurnstileToken(token: string, env: Env): Promise<boolean> {
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
    });

    const data = await response.json();
    
    // Type guard function
    const isTurnstileResponse = (value: unknown): value is TurnstileResponse => {
      return (
        typeof value === 'object' &&
        value !== null &&
        'success' in value &&
        typeof value.success === 'boolean'
      );
    };

    if (!isTurnstileResponse(data)) {
      console.error('Invalid Turnstile response format:', data);
      return false;
    }

    if (!data.success && data.error_codes) {
      console.error('Turnstile verification failed:', data.error_codes);
    }

    return data.success;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

export async function handleAuth(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace('/api/auth', '');

  try {
    switch (pathname) {
      case '/token':
        return handleGetToken(request, env);
      
      case '/login':
      case '/signin':
        return handleLogin(request, env);
      
      case '/signup':
      case '/register':
        return handleSignup(request, env);
      
      case '/signout':
      case '/logout':
        return handleLogout(request, env);
      
      case '/session':
        return handleSession(request, env);

      case '/forgot-password':
        return handleForgotPassword(request, env);
        
      case '/reset-password':
        return handleResetPassword(request, env);

      case '/google':
        console.log('Creating Google Auth URL');
        const googleUrl = await getGoogleOAuthURL(env);
        console.log('Generated Google Auth URL:', googleUrl);
        return new Response(null, {
          status: 302,
          headers: {
            Location: googleUrl
          }
        });
      
      case '/google/callback':
        return handleGoogleAuth(request, env);     
      
      default:
        return new Response(
          JSON.stringify({ error: 'Route not found' }),
          { status: 404 }
        );
    }
  } catch (error) {
    console.error('Auth error:', error);
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }),
      { status: 500 }
    );
  }
}

async function handleLogin(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405 }
    );
  }

  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error.errors[0].message }),
        { status: 400 }
      );
    }

    // Verify turnstile token
    const isValidToken = await verifyTurnstileToken(result.data.turnstileToken, env);
    if (!isValidToken) {
      return new Response(
        JSON.stringify({ error: 'Invalid challenge response' }),
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    // Find user
    const userResult = await query(
      env.DB,
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    const user = userResult.results[0];

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401 }
      );
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401 }
      );
    }

  try {
    const token = await createSessionToken(
      user.id.toString(),
      env.JWT_SECRET,
      user.name || undefined,
      user.email
    );

    // Set cookie options
    const cookieOptions = [
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      process.env.NODE_ENV === 'production' ? 'Domain=h2h.bot' : '',
      `Max-Age=${30 * 24 * 60 * 60}`
    ].filter(Boolean);

    return new Response(
      JSON.stringify({
        user: {
          id: user.id.toString(),
          name: user.name,
          email: user.email
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `auth-token=${token}; ${cookieOptions.join('; ')}`
        }
      }
    );
  } catch (error) {
    console.error('Token creation failed:', error);
    throw error;
  }
  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to login' }),
      { status: 500 }
    );
  }
}

async function handleSignup(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405 }
    );
  }

  try {
    const body = await request.json();
    const result = signupSchema.safeParse(body);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error.errors[0].message }),
        { status: 400 }
      );
    }

    // Verify turnstile token
    const isValidToken = await verifyTurnstileToken(result.data.turnstileToken, env);
    if (!isValidToken) {
      return new Response(
        JSON.stringify({ error: 'Invalid challenge response' }),
        { status: 400 }
      );
    }

    const { name, email, password } = result.data;

    // Check if user exists
    const existingUser = await query(
      env.DB,
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.results.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Email already registered' }),
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user and initialize points limit
    const userResult = await query(
      env.DB,
      `
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
      RETURNING id, name, email
      `,
      [name, email, passwordHash]
    );

    const user = userResult.results[0];

    // Initialize heart point limits for the new user
    await query(
      env.DB,
      `
      INSERT INTO heart_point_limits (user_id, daily_points_remaining)
      VALUES (?, 1)
      `,
      [user.id]
    );

    // Create session token for automatic login
    const token = await createSessionToken(
      user.id.toString(),
      env.JWT_SECRET,
      user.name,
      user.email
    );

    // Set cookie options
    const cookieOptions = [
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      process.env.NODE_ENV === 'production' ? 'Domain=h2h.bot' : '',
      `Max-Age=${30 * 24 * 60 * 60}`
    ].filter(Boolean);

    return new Response(
      JSON.stringify({
        user: {
          id: user.id.toString(),
          name: user.name,
          email: user.email
        },
        message: 'Account created successfully'
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `auth-token=${token}; ${cookieOptions.join('; ')}`
        }
      }
    );

  } catch (error) {
    console.error('Signup error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create account. Please try again.' }),
      { status: 500 }
    );
  }
}

export async function handleLogout(
  request: CloudflareRequest,
  _env: Env
): Promise<Response> {
  // Parse URL to check for provider
  const url = new URL(request.url);
  const isGoogleLogout = url.searchParams.get('provider') === 'google';

  // Set cookie options
  const cookieOptions = [
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    process.env.NODE_ENV === 'production' ? 'Domain=h2h.bot' : '',
    'Max-Age=0'  // Immediately expire the cookie
  ].filter(Boolean).join('; ');

  // Create headers instance
  const headers = new Headers();
  
  // Add cookie clearing headers
  headers.append('Set-Cookie', `auth-token=; ${cookieOptions}`);
  
  if (isGoogleLogout) {
    // Clear additional Google-related cookies if needed
    headers.append('Set-Cookie', `g_state=; ${cookieOptions}`);
    headers.append('Set-Cookie', `oauth_state=; ${cookieOptions}`);
  }

  return new Response('Logged out', {
    status: 200,
    headers
  });
}

async function handleSession(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  try {
    const cookie = request.headers.get('cookie');

    if (!cookie) {
      return new Response(
        JSON.stringify({ user: null }),
        { status: 200 }
      );
    }

    // Split cookies
    const cookies = cookie.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('auth-token='));
    const token = authCookie?.split('=')?.[1];
    if (!token) {
      console.log('No auth token found in cookies');
      return new Response(
        JSON.stringify({ user: null }),
        { status: 200 }
      );
    }

    // Get user from database
    const session = await getServerSession(request, env.JWT_SECRET);

    if (!session) {
      console.log('Session verification failed');
      return new Response(
        JSON.stringify({ user: null, error: 'Invalid session' }),
        { status: 200 }
      );
    }

    if (!session.user) {
      console.log('No user in session');
      return new Response(
        JSON.stringify({ user: null, error: 'No user in session' }),
        { status: 200 }
      );
    }

    const userResult = await query(
      env.DB,
      'SELECT id, name, email FROM users WHERE id = ?',
      [session.user.id]
    );

    const user = userResult.results[0];

    return new Response(
      JSON.stringify({
        user: user ? {
          id: user.id.toString(),
          name: user.name,
          email: user.email
        } : null
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error('Session error:', error);
    return new Response(
      JSON.stringify({ user: null }),
      { status: 200 }
    );
  }
}