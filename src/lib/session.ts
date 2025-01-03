// src/lib/session.ts
import { Request as CloudflareRequest} from '@cloudflare/workers-types';
import { decode } from '@/lib/jwt';

export interface Session {
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
}

export async function getServerSession(
  request: CloudflareRequest,
  secret: string
): Promise<Session | null> {
  try {
    // Get session token from cookie
    const cookie = request.headers.get('cookie');
    // console.log('Raw cookie header:', cookie);

    if (!cookie) {
      console.log('No cookie found');
      return null;
    }

    // Parse cookies more carefully
    const cookies = cookie.split(';').reduce((acc: Record<string, string>, curr) => {
      const [key, value] = curr.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});


    // console.log('Parsed cookies:', cookies);
    const token = cookies['auth-token'];

    if (!token) return null;

    try {
      const payload = await decode(token, secret);
      // console.log('Successfully decoded payload:', payload);

      if (!payload?.sub) return null;

      return {
        user: {
          id: payload.sub,
          name: payload.name || null,
          email: payload.email || null
        }
      };
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}