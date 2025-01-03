// src/handlers/invites.ts
import { Request as CloudflareRequest } from '@cloudflare/workers-types';
import { Env } from '@/types/env';
import { getServerSession } from '@/lib/session';
import { WorkerError } from '@/middleware/error';
import { query } from '@/lib/db/d1-utils';
import { checkInviteLimit } from '@/lib/rateLimit';
import crypto from 'crypto';
import { z } from 'zod';

const RevokeInviteSchema = z.object({
    inviteId: z.number(),
  });

export async function handleGetInvites(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  const session = await getServerSession(request, env.JWT_SECRET);

  if (!session?.user?.id) {
    throw WorkerError.Unauthorized();
  }

  const userId = Number(session.user.id);
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'active';

  try {
    let invitesQuery = `
      SELECT 
        i.*,
        CASE 
          WHEN u.id IS NOT NULL THEN json_object('id', u.id, 'name', u.name)
          ELSE NULL
        END as used_by_user
      FROM chat_invites i
      LEFT JOIN users u ON i.used_by = u.id
      WHERE i.creator_id = ?
    `;

    if (type === 'active') {
      invitesQuery += ` AND i.active = 1
        AND (i.used_by IS NULL AND i.expires_at > datetime('now'))`;
    } else if (type === 'used') {
      invitesQuery += ` AND i.used_by IS NOT NULL`;
    }

    invitesQuery += ` ORDER BY i.created_at DESC`;

    const result = await query(env.DB, invitesQuery, [userId]);
    return new Response(JSON.stringify(result.results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    throw WorkerError.Database('Failed to fetch invites');
  }
}

export async function handleCreateInvite(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  const session = await getServerSession(request, env.JWT_SECRET);

  if (!session?.user?.id) {
    throw WorkerError.Unauthorized();
  }

  const userId = Number(session.user.id);

  // Check rate limit
  const rateLimitResult = await checkInviteLimit(env.DB, userId);
  if (!rateLimitResult.success) {
    return new Response(
      JSON.stringify({
        error: 'Daily invite limit reached',
        reset: rateLimitResult.reset,
        remaining: rateLimitResult.remaining
      }),
      { status: 429 }
    );
  }

  try {
    // First create the chat
    const chatResult = await query(
      env.DB,
      `
      INSERT INTO conversations (created_at, updated_at)
      VALUES (CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
      `
    );
    
    const chatId = chatResult.results[0].id;
    console.log('Created new chat with ID:', chatId);
    
    // Add the creator to the chat
    await query(
      env.DB,
      `
      INSERT INTO conversation_participants (conversation_id, user_id)
      VALUES (?, ?)
      `,
      [chatId, userId]
    );

    // Generate unique invite code
    const inviteCode = crypto.randomBytes(8).toString('hex');
    
    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const result = await query(
      env.DB,
      `
      INSERT INTO chat_invites (
        invite_code,
        creator_id,
        chat_id,
        expires_at,
        active
      ) VALUES (?, ?, ?, ?, ?)
      RETURNING id
      `,
      [inviteCode, userId, chatId, expiresAt.toISOString(), 1]
    );

    console.log('Created invite with ID:', result.results[0].id, 'for chat:', chatId);

    const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/invite/${inviteCode}`;

    return new Response(
      JSON.stringify({
        id: result.results[0].id,
        inviteCode,
        inviteUrl,
        chatId,
        expiresAt,
        remaining: rateLimitResult.remaining
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Create invite error:', error);
    throw WorkerError.Database('Failed to create invite');
  }
}

export async function handleRevokeInvite(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  const session = await getServerSession(request, env.JWT_SECRET);

  if (!session?.user?.id) {
    throw WorkerError.Unauthorized();
  }

  try {
    const rawBody = await request.json();
    const { inviteId } = RevokeInviteSchema.parse(rawBody);
    const userId = Number(session.user.id);

    const result = await query(
      env.DB,
      `
      UPDATE chat_invites
      SET active = 0
      WHERE 
        id = ?
        AND creator_id = ?
        AND used_by IS NULL
      RETURNING id
      `,
      [inviteId, userId]
    );

    if (result.results.length === 0) {
      throw WorkerError.NotFound('Invalid invite or not authorized to revoke');
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof WorkerError) throw error;
    throw WorkerError.Database('Failed to revoke invite');
  }
}