// src/lib/db/bot-usage.ts
import { D1Database } from '@cloudflare/workers-types';
import { query } from './d1-utils';

export interface BotUsageLimit {
  weeklyUses: number;
  lastReset: string;
  isSubscribed: boolean;
  remainingUses: number;
}

export async function getBotUsage(
  db: D1Database,
  userId: number
): Promise<BotUsageLimit> {
  // First ensure user has a record
  await query(
    db,
    `
    INSERT INTO bot_usage_limits (user_id, weekly_uses, last_reset)
    VALUES (?, 0, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO NOTHING
    `,
    [userId]
  );

  // Get both user subscription status and usage
  const result = await query(
    db,
    `
    SELECT 
      COALESCE(b.weekly_uses, 0) as weekly_uses,
      COALESCE(b.last_reset, CURRENT_TIMESTAMP) as last_reset,
      u.subscription_tier != 'free' as is_subscribed
    FROM users u
    LEFT JOIN bot_usage_limits b ON u.id = b.user_id
    WHERE u.id = ?
    `,
    [userId]
  );

  const usage = result.results[0];
  
  // Check if we need to reset (it's been more than a week)
  const lastReset = new Date(usage.last_reset);
  const now = new Date();
  const weekInMs = 7 * 24 * 60 * 60 * 1000;
  
  if (now.getTime() - lastReset.getTime() > weekInMs) {
    // Reset the counter
    await query(
      db,
      `
      INSERT INTO bot_usage_limits (user_id, weekly_uses, last_reset)
      VALUES (?, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        weekly_uses = 0,
        last_reset = CURRENT_TIMESTAMP
      `,
      [userId]
    );
    
    return {
      weeklyUses: 0,
      lastReset: now.toISOString(),
      isSubscribed: Boolean(usage.is_subscribed),
      remainingUses: usage.is_subscribed ? 200 : 20
    };
  }

  const limit = usage.is_subscribed ? 200 : 20;
  return {
    weeklyUses: usage.weekly_uses,
    lastReset: usage.last_reset,
    isSubscribed: Boolean(usage.is_subscribed),
    remainingUses: Math.max(0, limit - usage.weekly_uses)
  };
}

export async function incrementBotUsage(
  db: D1Database,
  userId: number
): Promise<BotUsageLimit> {
  await query(
    db,
    `
    INSERT INTO bot_usage_limits (user_id, weekly_uses, last_reset)
    VALUES (?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      weekly_uses = weekly_uses + 1
    `,
    [userId]
  );

  return getBotUsage(db, userId);
}