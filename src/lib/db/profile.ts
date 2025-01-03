// src/lib/db/profile.ts
import { D1Database } from '@cloudflare/workers-types';
import { query } from './d1-utils';
import { UserProfile, ProfileStats, ProfileUpdateData } from '@/types/profile';

// Badge structure
interface DBBadge {
  id: string | null;
  name: string;
  description: string;
  awarded_at: string;
}

// Type for update query values
type ProfileUpdateValue = string | null | number;

export async function canViewProfile(
  db: D1Database,
  viewerId: number,
  profileId: number
): Promise<boolean> {
  // Users can always view their own profile
  if (viewerId === profileId) return true;
  
  // Check if users have a conversation together
  const result = await query(
    db,
    `
    SELECT 1 
    FROM conversation_participants cp1
    JOIN conversation_participants cp2 
      ON cp1.conversation_id = cp2.conversation_id
    WHERE cp1.user_id = ? AND cp2.user_id = ?
    LIMIT 1
    `,
    [viewerId, profileId]
  );
  
  return result.results.length > 0;
}

export async function getProfileStats(
  db: D1Database,
  userId: number
): Promise<ProfileStats> {
  // Get all stats in a single query
  const result = await query(
    db,
    `
    WITH chat_stats AS (
      SELECT 
        COUNT(DISTINCT conversation_id) as total_chats,
        COUNT(*) as total_messages
      FROM messages 
      WHERE user_id = ?
    ),
    points_stats AS (
      SELECT
        COALESCE(SUM(points) FILTER (WHERE type = 'HP'), 0) as hp_received,
        COALESCE(SUM(points) FILTER (WHERE type = 'H2HP'), 0) as h2hp_received
      FROM heart_point_transactions
      WHERE receiver_id = ?
    ),
    points_given AS (
      SELECT COALESCE(SUM(points), 0) as hp_given
      FROM heart_point_transactions
      WHERE sender_id = ? AND type = 'HP'
    ),
    user_data AS (
      SELECT 
        bot_interactions,
        created_at,
        COALESCE(
          (SELECT MAX(created_at) FROM messages WHERE user_id = u.id),
          created_at
        ) as last_active
      FROM users u
      WHERE u.id = ?
    )
    SELECT
      cs.total_chats,
      cs.total_messages,
      ps.hp_received,
      ps.h2hp_received,
      pg.hp_given,
      ud.bot_interactions,
      (SELECT COUNT(*) FROM user_badges WHERE user_id = ?) as badge_count,
      ud.created_at as member_since,
      ud.last_active
    FROM chat_stats cs
    CROSS JOIN points_stats ps
    CROSS JOIN points_given pg
    CROSS JOIN user_data ud
    `,
    [userId, userId, userId, userId, userId]
  );
  const stats = result.results[0];
  
  // Type check and safely convert bot_interactions
  const botInteractions = typeof stats.bot_interactions === 'number' 
  ? stats.bot_interactions 
  : Number(stats.bot_interactions) || 0;
  
  return {
    totalChats: Number(stats.total_chats),
    totalMessages: Number(stats.total_messages),
    botInteractions: botInteractions,
    memberSince: new Date(stats.member_since),
    lastActive: new Date(stats.last_active),
    hpGiven: Number(stats.hp_given),
    hpReceived: Number(stats.hp_received),
    h2hpReceived: Number(stats.h2hp_received),
    badgeCount: Number(stats.badge_count)
  };
}

export async function getUserProfile(
  db: D1Database,
  userId: number
): Promise<UserProfile | null> {
  const result = await query(
    db,
    `
    SELECT 
      u.id,
      u.name,
      u.email,
      u.created_at,
      u.subscription_tier,
      u.subscription_expires_at,
      u.bio,
      u.location,
      u.timezone,
      u.privacy_settings,
      u.total_hp as total_hp_received,
      (
        SELECT COALESCE(SUM(points), 0)
        FROM heart_point_transactions
        WHERE sender_id = u.id AND type = 'HP'
      ) as total_hp_given,
      u.total_h2hp,
      json_group_array(
        json_object(
          'id', ub.badge_id,
          'name', ub.badge_id,
          'description', '',
          'awarded_at', ub.awarded_at
        )
      ) as badges
    FROM users u
    LEFT JOIN user_badges ub ON u.id = ub.user_id
    WHERE u.id = ?
    GROUP BY u.id
    `,
    [userId]
  );

  if (result.results.length === 0) {
    return null;
  }

  const row = result.results[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    created_at: new Date(row.created_at),
    subscription_tier: row.subscription_tier,
    subscription_expires_at: row.subscription_expires_at ? new Date(row.subscription_expires_at) : null,
    bio: row.bio,
    location: row.location,
    timezone: row.timezone,
    privacy_settings: JSON.parse(row.privacy_settings),
    total_hp_received: Number(row.total_hp_received),
    total_hp_given: Number(row.total_hp_given),
    total_h2hp: Number(row.total_h2hp),
    badges: JSON.parse(row.badges).filter((badge: DBBadge) => badge.id !== null) // Filter out null badges from LEFT JOIN
  };
}

export async function updateUserProfile(
  db: D1Database,
  userId: number, 
  data: ProfileUpdateData
): Promise<UserProfile> {
  // Validate bio length
  if (data.bio && data.bio.length > 500) {
    throw new Error('Bio cannot exceed 500 characters');
  }

  // Build the update query dynamically based on provided fields
  const updates: string[] = [];
  const values: ProfileUpdateValue[] = [];

  if (data.bio !== undefined) {
    updates.push('bio = ?');
    values.push(data.bio);
  }
  if (data.location !== undefined) {
    updates.push('location = ?');
    values.push(data.location);
  }
  if (data.timezone !== undefined) {
    updates.push('timezone = ?');
    values.push(data.timezone);
  }
  if (data.privacy_settings !== undefined) {
    updates.push('privacy_settings = ?');
    values.push(JSON.stringify(data.privacy_settings));
  }

  // Add userId to values array
  values.push(userId);

  // Get updated profile
  const updatedProfile = await getUserProfile(db, userId);
  if (!updatedProfile) {
    throw new Error('Failed to retrieve updated profile');
  }

  return updatedProfile;
}