// src/lib/db/notifications.ts
import { D1Database } from '@cloudflare/workers-types';
import { query } from './d1-utils';

export interface Notification {
  id: number;
  userId: number;
  type: 'chat_message' | 'announcement';
  title: string;
  content: string;
  link?: string | null;
  isRead: boolean;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

// Define the database row type
interface NotificationRow {
  id: number;
  user_id: number;
  type: 'chat_message' | 'announcement';
  title: string;
  content: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  metadata: string;
}

export interface ChatNotificationCount {
  chatId: number;
  count: number;
}

export async function getNotifications(
  db: D1Database,
  userId: number,
  limit: number = 20,
  offset: number = 0
): Promise<Notification[]> {
  const result = await query<NotificationRow>(
    db,
    `
    SELECT 
      id,
      user_id,
      type,
      title,
      content,
      link,
      is_read,
      created_at,
      metadata
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
    `,
    [userId, limit, offset]
  );

  // Transform rows to match Notification interface
  return result.results.map(row => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    content: row.content,
    link: row.link,
    isRead: false,
    createdAt: new Date(row.created_at + 'Z'),
    metadata: JSON.parse(row.metadata)
  }));
}

export async function getUnreadCount(
  db: D1Database,
  userId: number
): Promise<number> {
  const result = await query<{ count: number }>(
    db,
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ?',
    [userId]
  );

  return result.results[0].count;
}

export async function getChatNotificationCounts(
  db: D1Database,
  userId: number
): Promise<ChatNotificationCount[]> {
  const result = await query<{ chat_id: number; count: number }>(
    db,
    `
    SELECT 
      JSON_EXTRACT(metadata, '$.chatId') as chat_id,
      COUNT(*) as count
    FROM notifications
    WHERE user_id = ? 
      AND type = 'chat_message'
      AND JSON_EXTRACT(metadata, '$.chatId') IS NOT NULL
    GROUP BY JSON_EXTRACT(metadata, '$.chatId')
    `,
    [userId]
  );

  return result.results.map(row => ({
    chatId: row.chat_id,
    count: row.count
  }));
}

export async function deleteNotifications(
  db: D1Database,
  userId: number,
  notificationIds: number[]
): Promise<void> {
  if (notificationIds.length === 0) return;

  const placeholders = notificationIds.map(() => '?').join(',');
  
  await query(
    db,
    `
    DELETE FROM notifications
    WHERE user_id = ?
      AND id IN (${placeholders})
    `,
    [userId, ...notificationIds]
  );
}

export async function deleteNotificationsByChat(
  db: D1Database,
  userId: number,
  chatId: number
): Promise<void> {
  await query(
    db,
    `
    DELETE FROM notifications
    WHERE user_id = ?
      AND type = 'chat_message'
      AND JSON_EXTRACT(metadata, '$.chatId') = ?
    `,
    [userId, chatId]
  );
}

export async function createNotification(
  db: D1Database,
  {
    userId,
    type,
    title,
    content,
    link,
    metadata = {}
  }: {
    userId: number;
    type: 'chat_message' | 'announcement';
    title: string;
    content: string;
    link?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<Notification> {
  const result = await query<NotificationRow>(
    db,
    `
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      link,
      metadata
    ) VALUES (?, ?, ?, ?, ?, ?)
    RETURNING *
    `,
    [
      userId,
      type,
      title,
      content,
      link || null,
      JSON.stringify(metadata)
    ]
  );

  const row = result.results[0];
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    content: row.content,
    link: row.link,
    isRead: row.is_read === true,
    createdAt: new Date(row.created_at + 'Z'),
    metadata: JSON.parse(row.metadata)
  };
}

export async function createChatMessageNotification(
  db: D1Database,
  userId: number,
  chatId: number,
  senderName: string,
  messageContent: string
): Promise<Notification> {
  return createNotification(db, {
    userId,
    type: 'chat_message',
    title: `New message from ${senderName}`,
    content: messageContent.substring(0, 100) + (messageContent.length > 100 ? '...' : ''),
    link: `/chat/${chatId}`,
    metadata: {
      chatId,
      senderName
    }
  });
}