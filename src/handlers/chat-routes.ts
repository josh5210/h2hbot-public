// /src/handlers/chat-routes.ts
import { Request as CloudflareRequest } from '@cloudflare/workers-types';
import { Env } from '@/types/env';
import { getServerSession } from '@/lib/session';
import { WorkerError } from '@/middleware/error';
import { query } from '@/lib/db/d1-utils';

export async function handleGetChat(
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
    // Get chat details with participants
    const result = await query(
      env.DB,
      `
      WITH chat_info AS (
        SELECT 
          c.*,
          GROUP_CONCAT(u.id) as participant_ids,
          GROUP_CONCAT(u.name) as participant_names
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        JOIN users u ON cp.user_id = u.id
        WHERE c.id = ?
        GROUP BY c.id
      )
      SELECT *
      FROM chat_info
      WHERE id IN (
        SELECT conversation_id 
        FROM conversation_participants 
        WHERE user_id = ?
      )
      `,
      [chatIdNum, userId]
    );

    if (result.results.length === 0) {
      throw WorkerError.NotFound('Chat not found or access denied');
    }

    const chat = result.results[0];
    return new Response(
      JSON.stringify({
        ...chat,
        participant_ids: chat.participant_ids.split(',').map(Number),
        participant_names: chat.participant_names.split(',')
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    if (error instanceof WorkerError) throw error;
    throw WorkerError.Database('Failed to fetch chat details');
  }
}

export async function handleMarkChatAsRead(
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
    await query(
      env.DB,
      `
      UPDATE conversation_participants
      SET 
        unread_count = 0,
        last_read_at = CURRENT_TIMESTAMP
      WHERE 
        conversation_id = ?
        AND user_id = ?
      `,
      [chatIdNum, userId]
    );

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch {
    throw WorkerError.Database('Failed to mark chat as read');
  }
}

export async function handleUpdateChat(
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
    await query(
      env.DB,
      `
      UPDATE conversations
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ? 
      AND id IN (
        SELECT conversation_id 
        FROM conversation_participants 
        WHERE user_id = ?
      )
      `,
      [chatIdNum, userId]
    );

    return new Response(
      JSON.stringify({ message: 'Chat updated successfully' }),
      { status: 200 }
    );
  } catch {
    throw WorkerError.Database('Failed to update chat');
  }
}

export async function handleDeleteChat(
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
    // First verify user is in the chat
    const participantCheck = await query(
      env.DB,
      `SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?`,
      [chatIdNum, userId]
    );

    if (participantCheck.results.length === 0) {
      throw WorkerError.Forbidden('You do not have access to this chat');
    }

    // Remove user from chat participants
    await query(
      env.DB,
      `DELETE FROM conversation_participants WHERE conversation_id = ? AND user_id = ?`,
      [chatIdNum, userId]
    );

    // Check if this was the last participant
    const remainingParticipants = await query(
      env.DB,
      `SELECT COUNT(*) as count FROM conversation_participants WHERE conversation_id = ?`,
      [chatIdNum]
    );

    // If no participants left, delete the entire chat
    if (remainingParticipants.results[0].count === 0) {
      await query(
        env.DB,
        `DELETE FROM conversations WHERE id = ?`,
        [chatIdNum]
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    if (error instanceof WorkerError) throw error;
    throw WorkerError.Database('Failed to delete chat');
  }
}