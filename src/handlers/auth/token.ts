// src/handlers/auth/token.ts
import { Request as CloudflareRequest } from '@cloudflare/workers-types';
import { Env } from '@/types/env';
import { getServerSession } from '@/lib/session';
import { WorkerError } from '@/middleware/error';
import { createSessionToken } from '@/lib/jwt';

export async function handleGetToken(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  console.log('🎫 Token request received');

  const session = await getServerSession(request, env.JWT_SECRET);
  console.log('Session check:', { hasSession: !!session, hasUser: !!session?.user });

  if (!session?.user?.id) {
    console.log('❌ No valid session');
    throw WorkerError.Unauthorized();
  }

  try {
    console.log('🔐 Creating WebSocket token for user:', session.user.id);

    // Create a short-lived token specifically for WebSocket auth
    const token = await createSessionToken(
      session.user.id,
      env.JWT_SECRET,
      session.user.name || undefined,
      session.user.email || undefined,
      300 // 5 minutes expiration
    );

    console.log('✅ Token created successfully');

    return new Response(
      JSON.stringify({ token }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ Token creation error:', error);
    throw WorkerError.Internal('Failed to create token');
  }
}