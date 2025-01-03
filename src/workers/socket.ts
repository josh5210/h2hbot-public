// src/workers/socket.ts
import { decode, JWTPayload } from '@/lib/jwt';
import { Env as BaseEnv } from '@/types/env';

export interface ExtendedJWTPayload extends JWTPayload {
  sub: string; // Ensure sub is always present
}

// Extend the base Env interface with WebSocket specific bindings
export interface Env extends BaseEnv {
  CHAT_CONNECTION: DurableObjectNamespace;
}
  
const socketWorker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Get user ID from auth token
      const userId = await getUserIdFromRequest(request, env);
      if (!userId) {
        return new Response('Unauthorized', { status: 401 });
      }

      // Create a new Durable Object ID based on the user ID
      const id = env.CHAT_CONNECTION.idFromName(userId);
      const chatConnection = env.CHAT_CONNECTION.get(id);

      // Forward the request to the Durable Object
      return chatConnection.fetch(request);
    } catch (error) {
      console.error('WebSocket connection error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
  
async function getUserIdFromRequest(request: Request, env: Env): Promise<string | null> {
    // Get the auth token from the request headers  
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }
  
    const token = authHeader.slice(7);
    try {
      // Verify and decode the token
      const payload = await verifyToken(token, env);
      return payload.sub;
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }
  
export async function verifyToken(token: string, env: Env): Promise<ExtendedJWTPayload> {
    if (!env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }
  
    try {
      // Decode and verify the token
      const payload = await decode(token, env.JWT_SECRET);
  
      // Ensure required fields are present
      if (!payload.sub) {
        throw new Error('Invalid token: missing subject (sub)');
      }
  
      // Check token expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token has expired');
      }
  
      // Return the validated payload with guaranteed sub field
      return {
        ...payload,
        sub: payload.sub
      };
  
    } catch (error) {
      // Add context to verification errors
      const message = error instanceof Error ? error.message : 'Token verification failed';
      throw new Error(`WebSocket authentication failed: ${message}`);
    }
  }

export default socketWorker;