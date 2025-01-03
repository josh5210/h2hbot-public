// src/handlers/auth/google.ts
import { Request as CloudflareRequest } from '@cloudflare/workers-types';
import { Env } from '@/types/env';
import { query } from '@/lib/db/d1-utils';
import { createSessionToken } from '@/lib/jwt';
import { WorkerError } from '@/middleware/error';
import { getGoogleTokens, getGoogleUser } from '@/lib/google-auth';

export async function handleGoogleAuth(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    throw WorkerError.BadRequest('No code provided');
  }

  try {
    // Exchange code for tokens
    const tokens = await getGoogleTokens(code, env);

    // Get user info from Google
    const googleUser = await getGoogleUser(tokens.access_token, tokens.id_token);

    // Extract first name only
    const firstName = googleUser.given_name || googleUser.name?.split(' ')[0] || 'User';

    // Check if user exists
    const existingUser = await query(
      env.DB,
      'SELECT * FROM users WHERE email = ?',
      [googleUser.email]
    );

    let userId: number;

    if (existingUser.results.length === 0) {
      // Create new user
      const userResult = await query(
        env.DB,
        `
        INSERT INTO users (name, email, password_hash)
        VALUES (?, ?, 'GOOGLE_AUTH')
        RETURNING id
        `,
        [firstName, googleUser.email]
      );
      userId = userResult.results[0].id;

      // Initialize heart point limits
      await query(
        env.DB,
        `
        INSERT INTO heart_point_limits (user_id, daily_points_remaining)
        VALUES (?, 1)
        `,
        [userId]
      );
    } else {
      userId = existingUser.results[0].id;
      // update existing user's name to first name if it's not set
      if (!existingUser.results[0].name) {
        await query(
          env.DB,
          'UPDATE users SET name = ? WHERE id = ?',
          [firstName, userId]
        );
      }
    }

    // Create session token
    const token = await createSessionToken(
      userId.toString(),
      env.JWT_SECRET,
      googleUser.name,
      googleUser.email
    );

    // Set cookie options
    const cookieOptions = [
      'Path=/',
      'HttpOnly',
      env.ENVIRONMENT === 'production' ? 'Secure' : '',
      env.ENVIRONMENT === 'production' ? 'Domain=h2h.bot' : '',
      'SameSite=Lax',
      `Max-Age=${30 * 24 * 60 * 60}`
    ].filter(Boolean);

    const cookieHeader = `auth-token=${token}; ${cookieOptions.join('; ')}`;
    
    // Create immediate response to set cookie
    const response = new Response(null, {
      status: 302,
      headers: new Headers({
        'Location': `${env.NEXT_PUBLIC_APP_URL}/chat`,
        'Set-Cookie': cookieHeader,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': env.NEXT_PUBLIC_APP_URL,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
        'Access-Control-Expose-Headers': 'Set-Cookie',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      })
    });

    return response;
  
    } catch (error) {
      console.error('Google auth error details:', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error,
        code: code ? code.substring(0, 10) + '...' : null
      });
  
      const errorUrl = new URL('/login', env.NEXT_PUBLIC_APP_URL);
      errorUrl.searchParams.set('error', 'GoogleAuthFailed');
      errorUrl.searchParams.set('details', error instanceof Error ? error.message : 'Unknown error');
      
      return new Response(null, {
        status: 302,
        headers: {
          Location: errorUrl.toString()
        }
      });
    }
  }
