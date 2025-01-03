// /src/handlers/points.ts
import { Request as CloudflareRequest } from '@cloudflare/workers-types';
import { Env } from '@/types/env';
import { getServerSession } from '@/lib/session';
import { WorkerError } from '@/middleware/error';
import { z } from 'zod';
import { 
  getPointLimits, 
  awardPoints, 
  getUserPointStats 
} from '@/lib/db/points';
import { WS_EVENTS } from '@/lib/websocket/events';

// Validation schemas
const awardPointsSchema = z.object({
  messageId: z.number(),
  receiverId: z.number(),
  type: z.enum(['HP', 'H2HP']),
  reasons: z.array(z.string()),
  points: z.number().min(1).max(1)
});

/**
 * GET /api/points/limits
 * Get current point limits for the authenticated user
 */
export async function handleGetLimits(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  const session = await getServerSession(request, env.JWT_SECRET);
  if (!session?.user?.id) {
    throw WorkerError.Unauthorized();
  }

  try {
    const limits = await getPointLimits(env.DB, Number(session.user.id));
    
    return new Response(
      JSON.stringify({
        ...limits,
        isSubscribed: Boolean(limits.isSubscribed) // Ensure boolean
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Failed to fetch points limits:', error);
    throw WorkerError.Database('Failed to fetch points limits');
  }
}

/**
 * POST /api/points/award
 * Award points to a message
 */
export async function handleAwardPoints(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  const session = await getServerSession(request, env.JWT_SECRET);
  if (!session?.user?.id) {
    throw WorkerError.Unauthorized();
  }

  try {
    const body = await request.json();
    const result = awardPointsSchema.safeParse(body);
    if (!result.success) {
      throw WorkerError.BadRequest(result.error.errors[0].message);
    }

    const { messageId, receiverId, type, reasons, points } = result.data;
    const senderId = Number(session.user.id);

    // Award the points
    await awardPoints(env.DB, {
      messageId,
      senderId,
      receiverId,
      points,
      type,
      reasons
    });

    // Broadcast via WebSocket
    try {
      const id = env.CHAT_CONNECTION.idFromName('chat-connections');
      const chatConnection = env.CHAT_CONNECTION.get(id);
      
      await chatConnection.fetch('http://internal/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: WS_EVENTS.POINTS_AWARDED,
          payload: {
            messageId,
            points,
            type,
            awardedBy: session.user.name || 'Unknown User',
            awardedAt: new Date().toISOString()
          }
        })
      });
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
      // Continue even if broadcast fails
    }

    // Get updated limits
    const limits = await getPointLimits(env.DB, senderId);

    return new Response(
      JSON.stringify({
        success: true,
        remaining: limits.remaining,
        nextReset: limits.nextReset
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    if (error instanceof WorkerError) throw error;
    
    console.error('Failed to award points:', error);
    throw WorkerError.Database('Failed to award points');
  }
}

/**
 * GET /api/points/stats?userId={userId}
 * Get point statistics for a user
 */
export async function handleGetStats(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  const session = await getServerSession(request, env.JWT_SECRET);
  if (!session?.user?.id) {
    throw WorkerError.Unauthorized();
  }

  try {
    // Get target user ID from query params or use current user
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get('userId') || session.user.id;
    
    const stats = await getUserPointStats(env.DB, Number(targetUserId));

    return new Response(
      JSON.stringify(stats),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    if (error instanceof WorkerError) throw error;
    throw WorkerError.Database('Failed to fetch points statistics');
  }
}

/**
 * POST /api/points/ai-award
 * Internal handler for AI-awarded H2HP points
 */
export async function handleAIAwardPoints(
  db: D1Database,
  messageId: number,
  receiverId: number,
  points: number,
  reasons: string[]
): Promise<void> {
  // This should only be called internally by the AI handler
  try {
    await awardPoints(db, {
      messageId,
      senderId: null, // null indicates AI award
      receiverId,
      points,
      type: 'H2HP',
      reasons
    });
  } catch (error) {
    console.error('Failed to award AI points:', error);
    throw WorkerError.Database('Failed to award AI points');
  }
}