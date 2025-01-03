// src/handlers/profile.ts
import { Request as CloudflareRequest } from '@cloudflare/workers-types';
import { Env } from '@/types/env';
import { getServerSession } from '@/lib/session';
import { WorkerError } from '@/middleware/error';
import { z } from 'zod';
import { query } from '@/lib/db/d1-utils';

// Define validation schema for name
const nameSchema = z
  .string()
  .min(1, "Name must be at least 1 character long")
  .max(20, "Name cannot exceed 20 characters")
  // Disallow special characters and numbers, allow spaces and hyphens
  .regex(
    /^[a-zA-Z\s-]+$/,
    "Name can only contain letters, spaces, and hyphens"
  )
  .transform(str => {
    // Trim extra spaces and normalize to single spaces
    return str.replace(/\s+/g, ' ').trim();
  });

const updateProfileSchema = z.object({
  name: nameSchema
});

export async function handleGetProfile(
  request: CloudflareRequest,
  env: Env,
  userId: string
): Promise<Response> {
  const session = await getServerSession(request, env.JWT_SECRET);

  if (!session?.user?.id) {
    throw WorkerError.Unauthorized();
  }

  const viewerId = Number(session.user.id);
  const profileId = Number(userId);

  try {
    // Get basic profile data
    const profileResult = await query(
      env.DB,
      `
      SELECT 
        id,
        name,
        email,
        bio,
        location,
        timezone,
        privacy_settings,
        created_at
      FROM users 
      WHERE id = ?
      `,
      [profileId]
    );

    if (!profileResult.results.length) {
      throw WorkerError.NotFound('Profile not found');
    }

    const profile = profileResult.results[0];

    // Get stats
    const statsResult = await query(
      env.DB,
      `
      SELECT
        (SELECT COUNT(DISTINCT conversation_id) 
         FROM conversation_participants 
         WHERE user_id = ?) as total_chats,
        (SELECT COUNT(*) 
         FROM messages 
         WHERE user_id = ?) as total_messages,
        (SELECT COUNT(*) 
         FROM messages 
         WHERE user_id = ? AND is_ai = 1) as bot_interactions,
        (SELECT total_hp FROM users WHERE id = ?) as hp_received,
        (SELECT total_h2hp FROM users WHERE id = ?) as h2hp_received,
        (SELECT COUNT(*) 
         FROM heart_point_transactions 
         WHERE sender_id = ? AND type = 'HP') as hp_given
      `,
      [profileId, profileId, profileId, profileId, profileId, profileId]
    );

    const stats = statsResult.results[0];

    // Filter private information based on privacy settings
    const privacySettings = JSON.parse(profile.privacy_settings);
    if (viewerId !== profileId) {
      if (!privacySettings.show_location) {
        profile.location = null;
      }
      if (!privacySettings.show_timezone) {
        profile.timezone = null;
      }
    }

    return new Response(
      JSON.stringify({
        profile: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          bio: profile.bio,
          location: profile.location,
          timezone: profile.timezone,
          privacy_settings: privacySettings,
          created_at: profile.created_at
        },
        stats: {
          totalChats: stats.total_chats,
          totalMessages: stats.total_messages,
          botInteractions: stats.bot_interactions,
          hpReceived: stats.hp_received,
          h2hpReceived: stats.h2hp_received,
          hpGiven: stats.hp_given,
          memberSince: profile.created_at
        }
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    if (error instanceof WorkerError) throw error;
    throw WorkerError.Database('Failed to fetch profile data');
  }
}

export async function handleUpdateProfile(
  request: CloudflareRequest,
  env: Env,
  userId: string
): Promise<Response> {
  const session = await getServerSession(request, env.JWT_SECRET);

  if (!session?.user?.id) {
    throw WorkerError.Unauthorized();
  }

  const currentUserId = Number(session.user.id);
  const profileId = Number(userId);

  if (currentUserId !== profileId) {
    throw WorkerError.Forbidden('You can only update your own profile');
  }

  try {
    const body = await request.json();
    const result = updateProfileSchema.safeParse(body);

    if (!result.success) {
      throw WorkerError.BadRequest(result.error.errors[0].message);
    }

    // Wrap everything in a try-catch for better error tracking
    try {
      // Update name in the database
      await query(
        env.DB,
        `
        UPDATE users 
        SET name = ?
        WHERE id = ?
        `,
        [result.data.name, profileId]
      );

      // Fetch updated profile data
      const [profileResult, statsResult] = await Promise.all([
        query(
          env.DB,
          `
          SELECT 
            id, name, email, created_at, bio, location, timezone,
            privacy_settings, subscription_tier, subscription_expires_at,
            total_hp as total_hp_received,
            (SELECT COALESCE(SUM(points), 0)
            FROM heart_point_transactions
            WHERE sender_id = users.id AND type = 'HP') as total_hp_given,
            total_h2hp
          FROM users 
          WHERE id = ?
          `,
          [profileId]
        ),
        query(
          env.DB,
          `
          WITH user_stats AS (
            SELECT 
              COUNT(DISTINCT cp.conversation_id) as total_chats,
              COUNT(m.id) as total_messages,
              COUNT(CASE WHEN m.is_ai = 1 THEN 1 END) as bot_interactions,
              -- (SELECT COUNT(*) FROM user_badges WHERE user_id = ?) as badge_count,
              MAX(m.created_at) as last_active
            FROM conversation_participants cp
            LEFT JOIN messages m ON cp.conversation_id = m.conversation_id AND m.user_id = cp.user_id
            WHERE cp.user_id = ?
          )
          SELECT 
            total_chats,
            total_messages,
            bot_interactions,
            --badge_count,
            last_active,
            (SELECT total_hp FROM users WHERE id = ?) as hp_received,
            (SELECT total_h2hp FROM users WHERE id = ?) as h2hp_received,
            (SELECT COUNT(*) 
            FROM heart_point_transactions 
            WHERE sender_id = ? AND type = 'HP') as hp_given
          FROM user_stats
          `,
        // [profileId, profileId, profileId, profileId, profileId]
          [profileId, profileId, profileId, profileId]
        ),
        // Fetch badges
        // query(
        //   env.DB,
        //   `
        //   SELECT badge_id as id, badge_id as name, '' as description, awarded_at
        //   FROM user_badges
        //   WHERE user_id = ?
        //   ORDER BY awarded_at DESC
        //   `,
        //   [profileId]
        // )
      ]);

    if (profileResult.results.length === 0) {
      throw WorkerError.NotFound('Profile not found');
    }

    const profile = profileResult.results[0];
    const stats = statsResult.results[0];
    // const badges = profileResult.results;

    // Ensure proper date formatting
    const created_at = new Date(profile.created_at).toISOString();
    const subscription_expires_at = profile.subscription_expires_at 
      ? new Date(profile.subscription_expires_at).toISOString() 
      : null;

    // Parse privacy settings with defaults
    const privacy_settings = {
      show_location: false,
      show_timezone: false,
      ...JSON.parse(profile.privacy_settings || '{}')
    };

    return new Response(
      JSON.stringify({
        profile: {
          ...profile,
          created_at,
          subscription_expires_at,
          privacy_settings,
          // badges: badges.map(badge => ({
          //   ...badge,
          //   awarded_at: new Date(badge.awarded_at).toISOString()
          // }))
          badges: []
        },
        stats: {
          totalChats: stats.total_chats || 0,
          totalMessages: stats.total_messages || 0,
          botInteractions: stats.bot_interactions || 0,
          hpReceived: stats.hp_received || 0,
          hpGiven: stats.hp_given || 0,
          h2hpReceived: stats.h2hp_received || 0,
          badgeCount: stats.badge_count || 0,
          memberSince: created_at,
          lastActive: stats.last_active ? new Date(stats.last_active).toISOString() : created_at
        }
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (dbError) {
    console.error('Database error:', dbError);
    throw WorkerError.Database('Failed to fetch updated profile data');
  }

} catch (error) {
  console.error('Profile update error:', error);
  if (error instanceof WorkerError) throw error;
  throw WorkerError.Internal('Failed to update profile');
}
}