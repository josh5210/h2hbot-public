// src/types/points.ts

// Base types for point transactions
export type PointType = 'HP' | 'H2HP';

export interface PointTransaction {
  id: number;
  sender_id: number | null;  // null for AI awards
  receiver_id: number;
  message_id: number;
  points: number;
  type: PointType;
  reasons: string[];
  awarded_at: string;
}

// Rate limiting and daily points
export interface PointLimits {
  remaining: number;
  isSubscribed: boolean;
  maxDaily: number;
  nextReset: string;
}

// Point award request schema
export interface PointAwardRequest {
  messageId: number;
  receiverId: number;
  type: PointType;
  reasons: string[];
  points: number;
}

// Point award response schema
export interface PointAwardResponse {
  success: boolean;
  transactionId: number;
  remaining?: number;
  error?: string;
}

// User point statistics
export interface UserPointStats {
  userId: number;
  username: string;
  stats: {
    totalHP: number;
    totalH2HP: number;
    givenHP: number;
    level: number;
    recentActivity: Array<{
      id: number;
      type: PointType;
      points: number;
      messageId: number;
      messageContent: string;
      awardedAt: string;
      awardedBy: string | null;
    }>;
  };
}

// WebSocket event for point awards
export interface PointsAwardedEvent {
  messageId: number;
  points: number;
  type: PointType;
  awardedBy: string | null;  // null for AI awards
  awardedAt: string;
}

// Eligibility update from AI
export interface MessageEligibility {
  messageId: number;
  isEligible: boolean;
  reasons: string[];
  h2hPoints?: number;  // If present, AI is awarding H2HP points
}

// Database schema type for points_limits table
export interface DBPointLimits {
  user_id: number;
  daily_points_remaining: number;
  last_reset: string;
  is_subscribed: boolean;
}

// Extended message type with point-related fields
export interface MessageWithPoints {
  id: number;
  eligibility_status: 'pending' | 'eligible' | 'not_eligible' | 'points_awarded' | 'expired';
  eligibility_reasons: string[];
  heart_points_received: number;
  heart_points_awarded_at: string | null;
  heart_points_awarded_by: number | null;
}

// Constants for point system configuration
export const POINTS_CONFIG = {
  DEFAULT_DAILY_LIMIT: 1,
  SUBSCRIBER_DAILY_LIMIT: 10,
  MIN_POINTS_PER_AWARD: 1,
  MAX_POINTS_PER_AWARD: 1,  // Currently fixed at 1
  RESET_HOUR_UTC: 0,  // Reset at midnight UTC
} as const;