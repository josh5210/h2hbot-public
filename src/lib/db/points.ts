// /src/lib/db/points.ts

import { D1Database } from '@cloudflare/workers-types';
import { query, runTransaction } from './d1-utils';
import { 
  PointType, 
  DBPointLimits, 
  PointLimits,
  UserPointStats,
  POINTS_CONFIG 
} from '@/types/points';
import { WorkerError } from '@/middleware/error';

/**
 * Check if a user needs their points reset (at midnight UTC)
 */
function needsPointsReset(lastReset: string): boolean {
  const lastResetDate = new Date(lastReset);
  const now = new Date();
  
  return lastResetDate.getUTCDate() !== now.getUTCDate() ||
         lastResetDate.getUTCMonth() !== now.getUTCMonth() ||
         lastResetDate.getUTCFullYear() !== now.getUTCFullYear();
}

/**
 * Get the next reset time (midnight UTC)
 */
function getNextReset(): Date {
  const nextReset = new Date();
  nextReset.setUTCHours(POINTS_CONFIG.RESET_HOUR_UTC, 0, 0, 0);
  if (nextReset <= new Date()) {
    nextReset.setDate(nextReset.getDate() + 1);
  }
  return nextReset;
}

/**
 * Initialize or reset a user's point limits
 */
export async function initializePointLimits(
  db: D1Database,
  userId: number,
  isSubscribed: boolean = false
): Promise<void> {
  const limit = isSubscribed ? 
    POINTS_CONFIG.SUBSCRIBER_DAILY_LIMIT : 
    POINTS_CONFIG.DEFAULT_DAILY_LIMIT;

  await query(db, `
    INSERT INTO heart_point_limits (
      user_id,
      daily_points_remaining,
      last_reset,
      is_subscribed
    ) VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      daily_points_remaining = ?,
      last_reset = CURRENT_TIMESTAMP,
      is_subscribed = ?
  `, [userId, limit, isSubscribed, limit, isSubscribed]);
}

/**
 * Get current point limits for a user
 */
export async function getPointLimits(
  db: D1Database,
  userId: number
): Promise<PointLimits> {
  // First check if user has limits set
  const result = await query<DBPointLimits>(db, `
    SELECT * FROM heart_point_limits WHERE user_id = ?
  `, [userId]);

  if (result.results.length === 0) {
    await initializePointLimits(db, userId);
    return {
      remaining: POINTS_CONFIG.DEFAULT_DAILY_LIMIT,
      isSubscribed: false,
      maxDaily: POINTS_CONFIG.DEFAULT_DAILY_LIMIT,
      nextReset: getNextReset().toISOString()
    };
  }

  const limits = result.results[0];

  // Check if we need to reset
  if (needsPointsReset(limits.last_reset)) {
    const newLimit = limits.is_subscribed ? 
      POINTS_CONFIG.SUBSCRIBER_DAILY_LIMIT : 
      POINTS_CONFIG.DEFAULT_DAILY_LIMIT;
    
    await query(db, `
      UPDATE heart_point_limits
      SET 
        daily_points_remaining = ?,
        last_reset = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `, [newLimit, userId]);

    return {
      remaining: newLimit,
      isSubscribed: limits.is_subscribed,
      maxDaily: newLimit,
      nextReset: getNextReset().toISOString()
    };
  }

  return {
    remaining: limits.daily_points_remaining,
    isSubscribed: limits.is_subscribed,
    maxDaily: limits.is_subscribed ? 
      POINTS_CONFIG.SUBSCRIBER_DAILY_LIMIT : 
      POINTS_CONFIG.DEFAULT_DAILY_LIMIT,
    nextReset: getNextReset().toISOString()
  };
}

/**
 * Award points to a user
 */
export async function awardPoints(
  db: D1Database,
  {
    messageId,
    senderId,
    receiverId,
    points,
    type,
    reasons
  }: {
    messageId: number;
    senderId: number | null;
    receiverId: number;
    points: number;
    type: PointType;
    reasons: string[];
  }
): Promise<void> {
  await runTransaction(db, async (tx) => {
    // For HP (not H2HP), verify sender has points remaining
    if (type === 'HP' && senderId) {
      const limits = await getPointLimits(tx, senderId);
      if (limits.remaining < points) {
        throw new WorkerError(
          'No points remaining for today',
          429,
          'RATE_LIMIT_EXCEEDED',
          { reset: limits.nextReset }
        );
      }

      // Deduct points from sender's limit
      await query(tx, `
        UPDATE heart_point_limits
        SET daily_points_remaining = daily_points_remaining - ?
        WHERE user_id = ?
      `, [points, senderId]);
    }

    // Create transaction record
    await query(tx, `
      INSERT INTO heart_point_transactions (
        sender_id,
        receiver_id,
        message_id,
        points,
        type,
        reasons
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [senderId, receiverId, messageId, points, type, JSON.stringify(reasons)]);

    // Update message status
    await query(tx, `
      UPDATE messages SET
        heart_points_received = heart_points_received + ?,
        heart_points_awarded_at = CURRENT_TIMESTAMP,
        heart_points_awarded_by = ?,
        eligibility_status = 'points_awarded'
      WHERE id = ?
    `, [points, senderId, messageId]);

    // Update receiver's total points
    if (type === 'HP') {
      await query(tx, `
        UPDATE users 
        SET total_hp = total_hp + ? 
        WHERE id = ?
      `, [points, receiverId]);
    } else {
      await query(tx, `
        UPDATE users 
        SET total_h2hp = total_h2hp + ? 
        WHERE id = ?
      `, [points, receiverId]);
    }
  });
}

/**
 * Get point statistics for a user
 */
export async function getUserPointStats(
  db: D1Database,
  userId: number
): Promise<UserPointStats> {
  const result = await query(db, `
    WITH stats AS (
      SELECT 
        u.id,
        u.name,
        u.total_hp,
        u.total_h2hp,
        (
          SELECT COUNT(*)
          FROM heart_point_transactions
          WHERE sender_id = ? AND type = 'HP'
        ) as given_hp,
        (
          SELECT json_group_array(json_object(
            'id', hpt.id,
            'type', hpt.type,
            'points', hpt.points,
            'messageId', hpt.message_id,
            'messageContent', m.content,
            'awardedAt', hpt.awarded_at,
            'awardedBy', u2.name
          ))
          FROM heart_point_transactions hpt
          LEFT JOIN messages m ON hpt.message_id = m.id
          LEFT JOIN users u2 ON hpt.sender_id = u2.id
          WHERE hpt.receiver_id = ?
          ORDER BY hpt.awarded_at DESC
          LIMIT 10
        ) as recent_activity
      FROM users u
      WHERE u.id = ?
    )
    SELECT * FROM stats
  `, [userId, userId, userId]);

  if (!result.results.length) {
    throw WorkerError.NotFound('User not found');
}

  const userData = result.results[0];
  
  return {
    userId,
    username: userData.name,
    stats: {
      totalHP: userData.total_hp,
      totalH2HP: userData.total_h2hp,
      givenHP: userData.given_hp,
      level: Math.floor(Math.log2(userData.total_hp + userData.total_h2hp + 1)),
      recentActivity: JSON.parse(userData.recent_activity)
    }
  };
}