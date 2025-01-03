// src/types/profile.ts
export interface UserProfile {
    id: number;
    name: string | null;
    email: string;
    created_at: Date;
    subscription_tier: 'free' | 'basic' | 'premium' | 'enterprise';
    subscription_expires_at: Date | null;
    bio: string | null;
    location: string | null;
    timezone: string | null;
    privacy_settings: {
      show_location: boolean;
      show_timezone: boolean;
      [key: string]: boolean;
    };
    total_hp_received: number;  // New field
    total_hp_given: number;     // New field
    total_h2hp: number;
    badges: Array<{
      id: string;
      name: string;
      description: string;
      awarded_at: Date;
    }>;
  }
  
  export interface ProfileStats {
    totalChats: number;
    totalMessages: number;
    botInteractions: number;
    memberSince: Date;
    lastActive: Date;
    hpReceived: number;
    hpGiven: number;
    h2hpReceived: number;
    badgeCount: number;
  }
  
  export interface ProfileUpdateData {
    bio?: string;
    location?: string;
    timezone?: string;
    privacy_settings?: {
      show_location?: boolean;
      show_timezone?: boolean;
      [key: string]: boolean | undefined;
    };
  }