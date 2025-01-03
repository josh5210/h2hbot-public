// src/worker.ts
import { Request as CloudflareRequest } from '@cloudflare/workers-types';
import { Env } from '@/types/env';
import { handleAuth } from './handlers/auth';
import { handleGetMessages, handlePostMessage } from './handlers/messages';
import { 
  handleGetNotifications, 
  handleDeleteNotifications, 
  handleDeleteChatNotifications, 
  handleCreateNotification 
} from './handlers/notifications';
import { handleGetLimits, handleAwardPoints, handleGetStats } from './handlers/points';
import { errorHandler, WorkerError } from './middleware/error';
import { handleGetProfile, handleUpdateProfile } from './handlers/profile';
import { handleGetChats } from './handlers/chat';
import { handleDeleteChat, handleGetChat, handleMarkChatAsRead } from './handlers/chat-routes';
import { handleCreateInvite, handleGetInvites, handleRevokeInvite } from './handlers/invites';
import { handleGetInvite, handleJoinChat } from './handlers/invites/invite-routes';
import { WebSocketConnection } from './workers/WebSocketConnection';
import { handleAIResponse } from './handlers/ai';
import { handleGetBotUsage, handleIncrementBotUsage } from './handlers/bot-usage';
import { env } from 'process';

export { WebSocketConnection as ChatConnection };

// CORS headers for development
const corsHeaders = {
  'Access-Control-Allow-Origin': env.ENVIRONMENT !== 'development'
  ? 'https://h2h.bot'
  : 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Expose-Headers': 'Set-Cookie'
};

// Validate environment variables at startup
function validateEnv(env: Env) {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is not set');
  }
  if (!env.GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_SECRET is not set');
  }
}

// Handle OPTIONS requests for CORS
function handleOptions(request: CloudflareRequest) {
  if (
    request.headers.get('Origin') !== null &&
    request.headers.get('Access-Control-Request-Method') !== null
  ) {
    return new Response(null, {
      headers: corsHeaders,
    });
  }
  return new Response(null, {
    headers: {
      Allow: 'GET, POST, PUT, DELETE, OPTIONS',
    },
  });
}

const worker = {
  async fetch(request: CloudflareRequest, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Detailed URL logging for debugging
    // console.log('Incoming request:', {
    //   url: url.toString(),
    //   pathname: url.pathname,
    //   method: request.method,
    //   hasAuthCookie: request.headers.get('cookie')?.includes('auth-token') || false
    // });

    // Handle WebSocket connections
    if (url.pathname === '/ws' && request.headers.get('Upgrade') === 'websocket') {
      // Create a new WebSocket connection using Durable Objects
      try {
        // Get user ID from token
        const token = url.searchParams.get('token');
        if (!token) {
          return new Response('Unauthorized', { status: 401 });
        }

        const id = env.CHAT_CONNECTION.idFromName('chat-connections');
        const chatConnection = env.CHAT_CONNECTION.get(id);

        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          headers[key] = value;
        });

        // Create a new standard Request object
        const wsRequest = new Request(request.url, {
          method: request.method,
          headers
        });

        return chatConnection.fetch(wsRequest);
      } catch (error) {
        console.error('WebSocket connection error:', error);
        return new Response('Failed to establish WebSocket connection', { 
          status: 500 
        });
      }
    }

    validateEnv(env);

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Add CORS headers to all responses
    const addCorsHeaders = (response: Response): Response => {
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    };

    return errorHandler(request, async () => {
      const url = new URL(request.url);

      if (url.pathname === '/') {
        return addCorsHeaders(new Response(JSON.stringify({ 
          status: 'ok', 
          message: 'H2H API Server' 
        }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));
      }

      if (url.pathname === '/health') {
        return addCorsHeaders(new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), { 
          status: 200, headers: { 'Content-Type': 'application/json' }
        }));
      }
      
      // AUTH
      if (url.pathname.startsWith('/api/auth')) {
        console.log('Auth request received:', url.pathname);
        const response = await handleAuth(request, env);
        console.log('Auth response status:', response.status);
        return addCorsHeaders(response);
      }

      const chatIdMatch = url.pathname.match(/\/api\/chat\/(\d+)\/messages/);
      if (chatIdMatch) {
        const response = request.method === 'GET' 
          ? await handleGetMessages(request, env, chatIdMatch[1])
          : await handlePostMessage(request, env, chatIdMatch[1]);
        return addCorsHeaders(response);
      }

      // AI Response
      const aiRouteMatch = url.pathname.match(/\/api\/chat\/(\d+)\/ai/);
      if (aiRouteMatch && request.method === 'POST') {
        const response = await handleAIResponse(request, env, aiRouteMatch[1]);
        return addCorsHeaders(response);
      }

      // Bot usage limits
      if (url.pathname === '/api/bot/usage') {
        switch (request.method) {
          case 'GET':
            return addCorsHeaders(await handleGetBotUsage(request, env));
          case 'POST':
            return addCorsHeaders(await handleIncrementBotUsage(request, env));
          default:
            throw WorkerError.MethodNotAllowed();
        }
      }

      // Notifications
      if (url.pathname === '/api/notifications') {
        switch (request.method) {
          case 'GET': 
            const response = await handleGetNotifications(request, env);
            return addCorsHeaders(response);
          case 'POST': 
            const createResponse = await handleCreateNotification(request, env);
            return addCorsHeaders(createResponse);
          default: 
            throw WorkerError.BadRequest('Method not allowed');
        }
      }

      // Delete notifications
      if (url.pathname === '/api/notifications/delete' && request.method === 'POST') {
        const response = await handleDeleteNotifications(request, env);
        return addCorsHeaders(response);
      }

      // Delete chat notifications
      const chatNotificationsMatch = url.pathname.match(/^\/api\/notifications\/chat\/(\d+)\/delete$/);
      if (chatNotificationsMatch && request.method === 'POST') {
        const response = await handleDeleteChatNotifications(request, env, chatNotificationsMatch[1]);
        return addCorsHeaders(response);
      }

      // Profile
      if (url.pathname.match(/^\/api\/profile\/(\d+)$/)) {
        const userId = url.pathname.match(/^\/api\/profile\/(\d+)$/)?.[1];
        if (!userId) throw WorkerError.BadRequest('Invalid user ID');
        
        const response = request.method === 'GET'
          ? await handleGetProfile(request, env, userId)
          : await handleUpdateProfile(request, env, userId);
        return addCorsHeaders(response);
      }

      // Points endpoints
      if (url.pathname === '/api/points/limits' && request.method === 'GET') {
        return handleGetLimits(request, env);
      }

      if (url.pathname === '/api/points/award' && request.method === 'POST') {
        return handleAwardPoints(request, env);
      }

      if (url.pathname === '/api/points/stats' && request.method === 'GET') {
        return handleGetStats(request, env);
      }

      // Chat
      if (url.pathname === '/api/chat' && request.method === 'GET') {
        return handleGetChats(request, env);
      }

      // Delete a Chat
      if (url.pathname.match(/^\/api\/chat\/(\d+)$/) && request.method === 'DELETE') {
        const chatId = url.pathname.match(/^\/api\/chat\/(\d+)$/)?.[1];
        if (!chatId) throw WorkerError.BadRequest('Invalid chat ID');
        return handleDeleteChat(request, env, chatId);
      }

      // chat/[chatId]
      if (url.pathname.match(/^\/api\/chat\/(\d+)$/)) {
        const chatId = url.pathname.match(/^\/api\/chat\/(\d+)$/)?.[1];
        if (!chatId) throw WorkerError.BadRequest('Invalid chat ID');
        return handleGetChat(request, env, chatId);
      }
      
      if (url.pathname.match(/^\/api\/chat\/(\d+)\/read$/)) {
        const chatId = url.pathname.match(/^\/api\/chat\/(\d+)\/read$/)?.[1];
        if (!chatId) throw WorkerError.BadRequest('Invalid chat ID');
        return handleMarkChatAsRead(request, env, chatId);
      }

      // Invites
      if (url.pathname === '/api/chat/invites') {
        switch (request.method) {
          case 'GET':
            return handleGetInvites(request, env);
          case 'POST':
            return handleCreateInvite(request, env);
          case 'DELETE':
            return handleRevokeInvite(request, env);
          default:
            throw WorkerError.MethodNotAllowed();
        }
      }

      if (url.pathname.match(/^\/api\/chat\/invites\/([^\/]+)\/join$/)) {
        const code = url.pathname.match(/^\/api\/chat\/invites\/([^\/]+)\/join$/)?.[1];
        if (!code) throw WorkerError.BadRequest('Invalid invite code');
        return handleJoinChat(request, env, code);
      }
      
      if (url.pathname.match(/^\/api\/chat\/invites\/([^\/]+)$/)) {
        const code = url.pathname.match(/^\/api\/chat\/invites\/([^\/]+)$/)?.[1];
        if (!code) throw WorkerError.BadRequest('Invalid invite code');
        return handleGetInvite(request, env, code);
      }

      throw WorkerError.NotFound('Route not found');
    }).then(addCorsHeaders);
  },
};

export default worker;