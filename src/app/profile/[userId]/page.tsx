// src/app/profile/[userId]/page.tsx
'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { Loader2 } from 'lucide-react';
import { UserProfile, ProfileStats } from '@/types/profile';
import UserAvatar from '@/components/UserAvatar';
import { formatDistanceToNow } from 'date-fns';
import ProfileEditor from '@/components/ProfileEditor';
import {z} from 'zod';

interface ProfileData {
  profile: UserProfile;
  stats: ProfileStats;
}

const PointsCard = ({ stats }: { stats: ProfileStats }) => (
  <div className="bg-white rounded-xl shadow-md p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-4">Heart Points</h2>
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-gray-600">HP Received</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{stats.hpReceived}</span>
          <span className="text-pink-500">❤️</span>
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-gray-600">HP Given</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{stats.hpGiven}</span>
          <span className="text-pink-500">❤️</span>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">H2HP Received</span>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{stats.h2hpReceived}</span>
            <span className="text-pink-500">💖</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ActivityCard = ({ stats }: { stats: ProfileStats }) => (
  <div className="bg-white rounded-xl shadow-md p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity</h2>
    <div className="space-y-3">
      <div className="flex justify-between">
        <span className="text-gray-600">Total Chats</span>
        <span className="font-semibold text-gray-900">{stats.totalChats}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Messages Sent</span>
        <span className="font-semibold text-gray-900">{stats.totalMessages}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Bot Interactions</span>
        <span className="font-semibold text-gray-900">{stats.botInteractions}</span>
      </div>
    </div>
  </div>
);

const _BadgesCard = ({ profile }: { profile: UserProfile }) => (
  <div className="bg-white rounded-xl shadow-md p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-4">Badges</h2>
    {profile.badges.length > 0 ? (
      <div className="grid grid-cols-3 gap-4">
        {profile.badges.map((badge) => (
          <div 
            key={badge.id}
            className="flex flex-col items-center"
            title={`${badge.name}\n${badge.description}`}
          >
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              🏆
            </div>
            <span className="text-xs text-gray-600 mt-1">{badge.name}</span>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-gray-500 text-center">Badges coming soon!</p>
    )}
  </div>
);

function isProfileData(data: unknown): data is ProfileData {
  if (!data || typeof data !== 'object') return false;
  
  // Check profile object
  const hasProfile = 'profile' in data && typeof data.profile === 'object' && data.profile !== null;
  if (!hasProfile) return false;

  const profile = data.profile as Record<string, unknown>;
  const hasProfileFields = 
    typeof profile.id === 'number' &&
    typeof profile.name === 'string' &&
    (profile.bio === null || typeof profile.bio === 'string') &&
    (profile.location === null || typeof profile.location === 'string') &&
    typeof profile.privacy_settings === 'object' &&
    profile.privacy_settings !== null;

  // Check stats object
  const hasStats = 'stats' in data && typeof data.stats === 'object' && data.stats !== null;
  if (!hasStats) return false;

  const stats = data.stats as Record<string, unknown>;
  const hasStatsFields = 
    typeof stats.totalChats === 'number' &&
    typeof stats.totalMessages === 'number' &&
    typeof stats.botInteractions === 'number' &&
    typeof stats.hpReceived === 'number' &&
    typeof stats.h2hpReceived === 'number' &&
    typeof stats.hpGiven === 'number' &&
    typeof stats.memberSince === 'string';

  return hasProfileFields && hasStatsFields;
}

export default function ProfilePage() {
  const params = useParams();
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [ , setIsSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/profile/${params.userId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }
        const data = await response.json();

        if (!isProfileData(data)) {
          throw new Error('Invalid profile data received from server');
        }

        setProfileData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (params.userId) {
      void fetchProfile();
    }
  }, [params.userId]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-gray-900 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-md p-6 max-w-md w-full m-4">
          <p className="text-red-600 text-center">
            {error || 'Profile not found'}
          </p>
        </div>
      </div>
    );
  }

  const { profile, stats } = profileData;
  const isOwnProfile = user?.id === params.userId;
  const memberSince = formatDistanceToNow(new Date(stats.memberSince + 'Z'), { addSuffix: true })
  
  // Zod schema for API response validation
  const ProfileResponseSchema = z.object({
    profile: z.object({
      id: z.number(),
      name: z.string().nullable(),
      email: z.string(),
      created_at: z.string(),
      subscription_tier: z.enum(['free', 'basic', 'premium', 'enterprise']),
      subscription_expires_at: z.string().nullable(),
      bio: z.string().nullable(),
      location: z.string().nullable(),
      timezone: z.string().nullable(),
      privacy_settings: z.object({
        show_location: z.boolean(),
        show_timezone: z.boolean()
      }).and(z.record(z.boolean())),  // Allow additional boolean properties
      total_hp_received: z.number(),
      total_hp_given: z.number(),
      total_h2hp: z.number(),
      badges: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        awarded_at: z.string()
      }))
    }),
    stats: z.object({
      totalChats: z.number(),
      totalMessages: z.number(),
      botInteractions: z.number(),
      memberSince: z.string(),
      lastActive: z.string(),
      hpReceived: z.number(),
      hpGiven: z.number(),
      h2hpReceived: z.number(),
      badgeCount: z.number()
    })
  });

  const ErrorResponseSchema = z.object({
    error: z.string()
  });

  const handleSaveProfile = async (newName: string) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/profile/${params.userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update profile' }));
        // Try to parse as error response
        const parsedError = ErrorResponseSchema.safeParse(errorData);
        throw new Error(
          parsedError.success ? parsedError.data.error : 'Failed to update profile'
        );
      }

      const rawData = await response.json();
      
      // Validate the response data
      const validatedData = ProfileResponseSchema.parse(rawData);
      
      // Transform string dates to Date objects
      setProfileData({
        profile: {
          ...validatedData.profile,
          created_at: new Date(validatedData.profile.created_at),
          subscription_expires_at: validatedData.profile.subscription_expires_at 
            ? new Date(validatedData.profile.subscription_expires_at)
            : null,
          badges: validatedData.profile.badges.map(badge => ({
            ...badge,
            awarded_at: new Date(badge.awarded_at)
          }))
        },
        stats: {
          ...validatedData.stats,
          memberSince: new Date(validatedData.stats.memberSince),
          lastActive: new Date(validatedData.stats.lastActive)
        }
      });
      
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Profile Header */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-start gap-6">
            <UserAvatar 
              name={profile.name || 'User'} 
              size="lg"
              disableLink
            />
            <div className="flex-1">
              {isEditing ? (
                <ProfileEditor 
                  initialName={profile.name || ''} 
                  onSave={handleSaveProfile}
                  onCancel={() => setIsEditing(false)}
                />
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {profile.name || 'Anonymous User'}
                  </h1>
                  <p className="text-sm text-gray-500">
                    Member since {memberSince}
                  </p>
                  {profile.bio && (
                    <p className="mt-4 text-gray-700">{profile.bio}</p>
                  )}
                  {profile.location && profile.privacy_settings.show_location && (
                    <p className="mt-2 text-sm text-gray-600">📍 {profile.location}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <ActivityCard stats={stats} />
          <PointsCard stats={stats} />
          {/* Badges added later <BadgesCard profile={profile} /> */}
        </div>

        {/* Edit Profile Button (only shown on own profile) */}
        {isOwnProfile && !isEditing && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <button
              onClick={() => setIsEditing(true)}
              className="w-full bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 transition-colors"
            >
              Edit Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}