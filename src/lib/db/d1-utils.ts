// src/lib/db/d1-utils.ts
import { D1Database, D1Result } from '@cloudflare/workers-types';

export type SQLValue = string | number | boolean | null;

export interface CreateMessageParams {
  conversationId: number;
  userId: number | null;
  content: string;
  isAi: boolean;
  senderName: string;
  eligibilityStatus?: 'pending' | 'eligible' | 'not_eligible' | 'points_awarded' | 'expired';
  eligibilityReasons?: string[];
}

export interface DBMessage {
  id: number;
  conversation_id: number;
  user_id: number | null;
  content: string;
  is_ai: boolean;
  created_at: string;
  sender_name: string | null;
  eligibility_status: 'pending' | 'eligible' | 'not_eligible' | 'points_awarded' | 'expired';
  eligibility_reasons: string[];
  heart_points_received: number;
  heart_points_awarded_at: string | null;
  heart_points_awarded_by: number | null;
}

interface MessageEligibility {
  isEligible: boolean;
  reasons: string[];
  h2hPoints?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T = any>(
  db: D1Database,
  sql: string,
  params: SQLValue[] = []
): Promise<D1Result<T>> {
  try {
    const stmt = db.prepare(sql).bind(...params);
    return await stmt.all();
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export async function createMessage(
  db: D1Database,
  params: CreateMessageParams
): Promise<DBMessage> {
  const result = await query<DBMessage>(
    db,
    `
    INSERT INTO messages (
      conversation_id,
      user_id,
      content,
      is_ai,
      sender_name,
      eligibility_status,
      eligibility_reasons
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING *
    `,
    [
      params.conversationId,
      params.userId,
      params.content,
      params.isAi ? 1 : 0,
      params.senderName,
      params.eligibilityStatus || 'pending',
      JSON.stringify(params.eligibilityReasons || [])
    ]
  );

  return result.results[0];
}

export async function getParticipantIdsForChat(
  db: D1Database,
  chatId: number
): Promise<number[]> {
  const result = await query<{ user_id: number }>(
    db,
    'SELECT user_id FROM conversation_participants WHERE conversation_id = ? ORDER BY user_id',
    [chatId]
  );
  
  return result.results.map(row => row.user_id);
}

export async function getMessagesForConversation(
  db: D1Database,
  conversationId: number
): Promise<DBMessage[]> {
  const result = await query<DBMessage>(
    db,
    `
    SELECT m.*
    FROM messages m
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
    `,
    [conversationId]
  );
  
  return result.results;
}

export async function isUserInConversation(
  db: D1Database,
  userId: number,
  conversationId: number
): Promise<boolean> {
  const result = await query(
    db,
    'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
    [conversationId, userId]
  );
  
  return result.results.length > 0;
}

// Determine status based on eligibility and H2H points
export async function updateMessageEligibility(
  db: D1Database,
  messageId: number,
  eligibility: MessageEligibility
): Promise<DBMessage> {
  const status = eligibility.h2hPoints ? 'points_awarded' : 
                 eligibility.isEligible ? 'eligible' : 
                 'not_eligible';

  const result = await query<DBMessage>(
    db,
    `
    UPDATE messages
    SET 
      eligibility_status = ?,
      eligibility_reasons = ?,
      heart_points_received = COALESCE(?, heart_points_received)
    WHERE id = ?
    RETURNING *
    `,
    [
      status,
      JSON.stringify(eligibility.reasons),
      eligibility.h2hPoints || null,
      messageId
    ]
  );

  if (result.results.length === 0) {
    throw new Error('Message not found');
  }

  return result.results[0];
}

export async function runTransaction<T>(
  db: D1Database,
  callback: (tx: D1Database) => Promise<T>
): Promise<T> {
  // D1 automatically wraps everything in a transaction
  return callback(db);
}