// src/lib/rateLimit.ts
import { D1Database } from '@cloudflare/workers-types';
import { query } from './db/d1-utils';

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: Date;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxInvitesPerDay: number;

  private constructor() {
    this.windowMs = 60 * 60 * 1000; // 1 hour
    this.maxRequests = Number(process.env.AI_RATE_LIMIT_MAX_REQUESTS) || 100;
    this.maxInvitesPerDay = Number(process.env.MAX_INVITES_PER_DAY) || 10;
  }

  public static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  public async createRateLimitTables(db: D1Database) {
    try {
      // Create rate_limits table
      await query(db, `
        CREATE TABLE IF NOT EXISTS rate_limits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          request_count INTEGER DEFAULT 1,
          window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id)
        )
      `);

      // Create invite_limits table
      await query(db, `
        CREATE TABLE IF NOT EXISTS invite_limits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          invite_count INTEGER DEFAULT 0,
          last_reset DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id)
        )
      `);

      // Create indexes
      await query(db, 
        'CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id ON rate_limits(user_id)'
      );
      
      await query(db,
        'CREATE INDEX IF NOT EXISTS idx_invite_limits_user_id ON invite_limits(user_id)'
      );

      console.log('Rate limit tables created successfully');
    } catch (error) {
      console.error('Error creating rate limit tables:', error);
      throw error;
    }
  }

  public async checkRateLimit(
    db: D1Database,
    userId: number
  ): Promise<RateLimitResult> {
    try {
      const now = new Date();
      
      // Get current rate limit record for user
      const result = await query(db,
        'SELECT * FROM rate_limits WHERE user_id = ?',
        [userId]
      );

      const record = result.results[0];

      if (!record) {
        // First request for this user
        await query(db,
          'INSERT INTO rate_limits (user_id, request_count, window_start) VALUES (?, 1, ?)',
          [userId, now.toISOString()]
        );
        
        return {
          success: true,
          remaining: this.maxRequests - 1,
          reset: new Date(now.getTime() + this.windowMs)
        };
      }

      const windowStart = new Date(record.window_start);
      const windowEnd = new Date(windowStart.getTime() + this.windowMs);

      if (now > windowEnd) {
        // Window has expired, reset counts
        await query(db,
          'UPDATE rate_limits SET request_count = 1, window_start = ? WHERE user_id = ?',
          [now.toISOString(), userId]
        );
        
        return {
          success: true,
          remaining: this.maxRequests - 1,
          reset: new Date(now.getTime() + this.windowMs)
        };
      }

      if (record.request_count >= this.maxRequests) {
        // Rate limit exceeded
        return {
          success: false,
          remaining: 0,
          reset: windowEnd
        };
      }

      // Increment request count
      await query(db,
        'UPDATE rate_limits SET request_count = request_count + 1 WHERE user_id = ?',
        [userId]
      );

      return {
        success: true,
        remaining: this.maxRequests - (record.request_count + 1),
        reset: windowEnd
      };

    } catch (error) {
      console.error('Rate limit check error:', error);
      // On error, allow the request but log the error
      return {
        success: true,
        remaining: 999,
        reset: new Date(Date.now() + this.windowMs)
      };
    }
  }

  public async checkInviteLimit(
    db: D1Database,
    userId: number
  ): Promise<RateLimitResult> {
    try {
      const now = new Date();
      
      // First try to get existing record
      const result = await query(db, `
        SELECT * FROM invite_limits 
        WHERE user_id = ?
      `, [userId]);
  
      const record = result.results[0];
      
      if (!record) {
        // Create new record if none exists
        await query(db,
          'INSERT INTO invite_limits (user_id, invite_count, last_reset) VALUES (?, 0, ?)',
          [userId, now.toISOString()]
        );
        
        return {
          success: true,
          remaining: this.maxInvitesPerDay,
          reset: this.getNextReset(now)
        };
      }
  
      // Check if we need to reset counts (new day)
      const lastReset = new Date(record.last_reset);
      if (this.shouldReset(lastReset)) {
        await query(db,
          `UPDATE invite_limits 
           SET invite_count = 0, 
               last_reset = ? 
           WHERE user_id = ?`,
          [now.toISOString(), userId]
        );
        
        return {
          success: true,
          remaining: this.maxInvitesPerDay,
          reset: this.getNextReset(now)
        };
      }
  
      // Check if limit exceeded
      if (record.invite_count >= this.maxInvitesPerDay) {
        return {
          success: false,
          remaining: 0,
          reset: this.getNextReset(lastReset)
        };
      }
  
      // Increment invite count
      await query(db,
        `UPDATE invite_limits 
         SET invite_count = invite_count + 1 
         WHERE user_id = ?`,
        [userId]
      );
  
      return {
        success: true,
        remaining: this.maxInvitesPerDay - (record.invite_count + 1),
        reset: this.getNextReset(lastReset)
      };
  
    } catch (error) {
      console.error('Invite limit check error:', error);
      throw error;
    }
  }

  // Helper method to determine if we should reset counts
  private shouldReset(lastReset: Date): boolean {
    const now = new Date();
    return lastReset.getUTCDate() !== now.getUTCDate() ||
          lastReset.getUTCMonth() !== now.getUTCMonth() ||
          lastReset.getUTCFullYear() !== now.getUTCFullYear();
  }

  // Helper method to get next reset time
  private getNextReset(from: Date): Date {
    const reset = new Date(from);
    reset.setUTCDate(reset.getUTCDate() + 1);
    reset.setUTCHours(0, 0, 0, 0);
    return reset;
  }
}

// Helper function for rate limiting
export async function rateLimit(
  db: D1Database,
  userId: number
): Promise<RateLimitResult> {
  return RateLimiter.getInstance().checkRateLimit(db, userId);
}

// Helper function for invite limiting
export async function checkInviteLimit(
  db: D1Database,
  userId: number
): Promise<RateLimitResult> {
   return RateLimiter.getInstance().checkInviteLimit(db, userId);
}