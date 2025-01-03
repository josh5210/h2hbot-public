// /src/handlers/notifications.ts
import { Request as CloudflareRequest } from '@cloudflare/workers-types';
import { Env } from '@/types/env';
import { getServerSession } from '@/lib/session';
import { WorkerError } from '@/middleware/error';
import { z } from 'zod';
import {
  getNotifications,
  getUnreadCount,
  getChatNotificationCounts,
  deleteNotifications,
  deleteNotificationsByChat,
  createNotification
} from '@/lib/db/notifications';
import { WS_EVENTS } from '@/lib/websocket/events';

const deleteNotificationsSchema = z.object({
  notificationIds: z.array(z.number())
});

const createNotificationSchema = z.object({
  type: z.enum(['chat_message', 'announcement']),
  title: z.string(),
  content: z.string(),
  link: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export async function handleGetNotifications(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  const session = await getServerSession(request, env.JWT_SECRET);

  if (!session?.user?.id) {
    throw WorkerError.Unauthorized();
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const userId = Number(session.user.id);

  try {
    const [notifications, unreadCount, chatCounts] = await Promise.all([
      getNotifications(env.DB, userId, limit, offset),
      getUnreadCount(env.DB, userId),
      getChatNotificationCounts(env.DB, userId)
    ]);

    return new Response(
      JSON.stringify({
        notifications,
        unreadCount,
        chatCounts,
        limit,
        offset
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch {
    throw WorkerError.Database('Failed to fetch notifications');
  }
}

export async function handleDeleteNotifications(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  const session = await getServerSession(request, env.JWT_SECRET);

  if (!session?.user?.id) {
    throw WorkerError.Unauthorized();
  }

  const body = await request.json();
  const result = deleteNotificationsSchema.safeParse(body);

  if (!result.success) {
    throw WorkerError.BadRequest(result.error.errors[0].message);
  }

  const userId = Number(session.user.id);

  try {
    await deleteNotifications(env.DB, userId, result.data.notificationIds);
    
    // Get updated counts
    const [unreadCount, chatCounts] = await Promise.all([
      getUnreadCount(env.DB, userId),
      getChatNotificationCounts(env.DB, userId)
    ]);

    // Broadcast deletion via WebSocket
    const id = env.CHAT_CONNECTION.idFromName('chat-connections');
    const chatConnection = env.CHAT_CONNECTION.get(id);

    await chatConnection.fetch('http://internal/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: WS_EVENTS.NOTIFICATION_DELETED,
        payload: { 
          notificationIds: result.data.notificationIds
        }
      })
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        unreadCount,
        chatCounts
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch {
    throw WorkerError.Database('Failed to delete notifications');
  }
}

export async function handleDeleteChatNotifications(
  request: CloudflareRequest,
  env: Env,
  chatId: string
): Promise<Response> {
  const session = await getServerSession(request, env.JWT_SECRET);

  if (!session?.user?.id) {
    throw WorkerError.Unauthorized();
  }

  const userId = Number(session.user.id);
  const chatIdNum = Number(chatId);

  try {
    await deleteNotificationsByChat(env.DB, userId, chatIdNum);
    
    // Get updated counts
    const [unreadCount, chatCounts] = await Promise.all([
      getUnreadCount(env.DB, userId),
      getChatNotificationCounts(env.DB, userId)
    ]);

    // Broadcast deletion via WebSocket
    const id = env.CHAT_CONNECTION.idFromName('chat-connections');
    const chatConnection = env.CHAT_CONNECTION.get(id);

    await chatConnection.fetch('http://internal/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: WS_EVENTS.NOTIFICATION_CLEARED,
        payload: { 
          chatIds: [chatIdNum]
        }
      })
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        unreadCount,
        chatCounts
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch {
    throw WorkerError.Database('Failed to delete chat notifications');
  }
}

export async function handleCreateNotification(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  const session = await getServerSession(request, env.JWT_SECRET);

  if (!session?.user?.id) {
    throw WorkerError.Unauthorized();
  }

  const body = await request.json();
  const result = createNotificationSchema.safeParse(body);

  if (!result.success) {
    throw WorkerError.BadRequest(result.error.errors[0].message);
  }

  try {
    const notification = await createNotification(env.DB, {
      userId: Number(session.user.id),
      ...result.data
    });

    // Broadcast new notification via WebSocket
    const id = env.CHAT_CONNECTION.idFromName('chat-connections');
    const chatConnection = env.CHAT_CONNECTION.get(id);

    await chatConnection.fetch('http://internal/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: WS_EVENTS.NOTIFICATION_CREATED,
        payload: notification
      })
    });

    return new Response(
      JSON.stringify(notification),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch {
    throw WorkerError.Database('Failed to create notification');
  }
}