// src/handlers/invites/invite-routes.ts
import { Request as CloudflareRequest } from '@cloudflare/workers-types';
import { Env } from '@/types/env';
import { WorkerError } from '@/middleware/error';
import { getServerSession } from '@/lib/session';
import { query, runTransaction } from '@/lib/db/d1-utils';

// GET /api/chat/invites/:code
export async function handleGetInvite(
  _request: CloudflareRequest,
  env: Env,
  code: string
): Promise<Response> {
  try {
    console.log('Fetching invite details for code:', code);

    // Check if invite exists and is valid
    const result = await query(
      env.DB,
      `
      SELECT 
        i.*,
        u.name as creator_name,
        c.id as conversation_id
      FROM chat_invites i
      JOIN users u ON i.creator_id = u.id
      JOIN conversations c ON i.chat_id = c.id
      WHERE i.invite_code = ?
        AND i.active = 1
        AND i.used_by IS NULL
        AND i.expires_at > datetime('now')
      `,
      [code]
    );

    console.log('Database result:', result.results);

    if (result.results.length === 0) {
      const response = {
        valid: false,
        error: 'Invite code not found'
      };
      console.log('Sending invalid invite response:', response);
      return new Response(JSON.stringify(response), { status: 200 });
    }

    const invite = result.results[0];
    console.log('Raw invite data:', invite);

    if (!invite.conversation_id) {
      const response = {
        valid: false,
        error: 'Invalid chat link'
      };
      console.log('Sending invalid chat response:', response);
      return new Response(JSON.stringify(response), { status: 200 });
    }

    const response = {
      valid: true as const,
      createdBy: invite.creator_name,
      expiresAt: invite.expires_at,
      chatId: invite.conversation_id
    };

    console.log('Sending valid invite response:', response);
    return new Response(JSON.stringify(response), { status: 200 });
  } catch (error) {
    console.error('Get invite error:', error);
    throw WorkerError.Database('Failed to fetch invite details');
  }
}

// POST /api/chat/invites/:code/join
export async function handleJoinChat(
  request: CloudflareRequest,
  env: Env,
  code: string
): Promise<Response> {
  const session = await getServerSession(request, env.JWT_SECRET);
  if (!session?.user?.id) {
    throw WorkerError.Unauthorized();
  }

  try {
    const userId = Number(session.user.id);

    // Get invite details first
    const inviteResult = await query(
      env.DB,
      `
      SELECT *
      FROM chat_invites
      WHERE invite_code = ?
        AND active = 1
        AND used_by IS NULL
        AND expires_at > datetime('now')
      `,
      [code]
    );

    if (inviteResult.results.length === 0) {
      throw WorkerError.BadRequest('Invalid or expired invite code');
    }

    const invite = inviteResult.results[0];

    // Check if user is already in the chat
    const membershipResult = await query(
      env.DB,
      `
      SELECT 1
      FROM conversation_participants
      WHERE conversation_id = ? AND user_id = ?
      `,
      [invite.chat_id, userId]
    );

    if (membershipResult.results.length > 0) {
      return new Response(
        JSON.stringify({ 
          chatId: invite.chat_id,
          message: 'Already a member of this chat'
        }),
        { status: 200 }
      );
    }

    // Add user to chat in a transaction
    await runTransaction(env.DB, async (tx) => {
      // Add user to chat
      await query(
        tx,
        `INSERT INTO conversation_participants (conversation_id, user_id)
         VALUES (?, ?)`,
        [invite.chat_id, userId]
      );
      
      // Mark invite as used
      await query(
        tx,
        `UPDATE chat_invites
         SET used_by = ?,
             used_at = CURRENT_TIMESTAMP,
             active = 0
         WHERE id = ?`,
        [userId, invite.id]
      );

      // Check if this is the second participant (making the chat active)
      const participantCount = await query(
        tx,
        `SELECT COUNT(*) as count 
         FROM conversation_participants 
         WHERE conversation_id = ?`,
        [invite.chat_id]
      );

      // If this is the second participant, create the welcome message
      if (participantCount.results[0].count === 2) {
        // Don't create system join message, the welcome message will cover it
        await query(
          tx,
          `UPDATE conversations 
           SET has_welcome_message = FALSE 
           WHERE id = ?`,
          [invite.chat_id]
        );
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        chatId: invite.chat_id
      }),
      { status: 200 }
    );

  } catch (error) {
    if (error instanceof WorkerError) throw error;
    throw WorkerError.Database('Failed to join chat');
  }
}