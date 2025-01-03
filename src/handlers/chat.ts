// src/handlers/chat.ts
import { Request as CloudflareRequest } from '@cloudflare/workers-types';
import { Env } from '@/types/env';
import { getServerSession } from '@/lib/session';
import { WorkerError } from '@/middleware/error';
import { query } from '@/lib/db/d1-utils';

export async function handleGetChats(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  const session = await getServerSession(request, env.JWT_SECRET);

  if (!session?.user?.id) {
    throw WorkerError.Unauthorized();
  }

  const userId = Number(session.user.id);

  try {
    const result = await query(
      env.DB,
      `
      WITH chat_info AS (
        SELECT 
          c.id,
          c.updated_at,
          (
            SELECT m.created_at
            FROM messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ) as latest_message_time,
          (
            SELECT COUNT(*)
            FROM messages m
            WHERE m.conversation_id = c.id
            AND m.created_at > COALESCE(cp.last_read_at, datetime('1970-01-01'))
            AND m.user_id != ?
          ) as unread_count,
          GROUP_CONCAT(u.name) as participant_names,
          GROUP_CONCAT(u.id) as participant_ids
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        JOIN users u ON cp.user_id = u.id
        WHERE c.id IN (
          SELECT conversation_id 
          FROM conversation_participants 
          WHERE user_id = ?
        )
        GROUP BY c.id
      )
      SELECT 
        id,
        updated_at,
        latest_message_time,
        unread_count,
        participant_names,
        participant_ids
      FROM chat_info
      ORDER BY COALESCE(latest_message_time, updated_at) DESC
      `,
      [userId, userId]
    );

    // Transform the results
    const chats = result.results.map(chat => ({
      id: chat.id,
      updated_at: chat.updated_at,
      latest_message_time: chat.latest_message_time,
      unread_count: chat.unread_count,
      participant_names: chat.participant_names.split(','),
      participant_ids: chat.participant_ids.split(',').map(Number)
    }));

    return new Response(
      JSON.stringify(chats),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch {
    throw WorkerError.Database('Failed to fetch chats');
  }
}