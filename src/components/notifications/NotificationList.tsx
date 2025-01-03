// src/components/notifications/NotificationList.tsx
'use client';

import { Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { z } from 'zod';
import { useEffect, useState } from 'react';

interface Notification {
  id: number;
  userId: number;
  type: 'chat_message' | 'announcement';
  title: string;
  content: string;
  link?: string | null;
  isRead: boolean;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

const NotificationResponseSchema = z.object({
  notifications: z.array(z.object({
    id: z.number(),
    userId: z.number(),
    type: z.enum(['chat_message', 'announcement']),
    title: z.string(),
    content: z.string(),
    link: z.string().nullable().optional(),
    isRead: z.boolean(),
    createdAt: z.string(),
    metadata: z.record(z.unknown())
  })),
  unreadCount: z.number()
});

export default function NotificationList() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      setError(null);
      const response = await fetch('/api/notifications');
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const rawData = await response.json();
      const data = NotificationResponseSchema.parse(rawData);
      
      const transformedNotifications = data.notifications.map(n => ({
        ...n,
        createdAt: new Date(n.createdAt)
      }));

      setNotifications(transformedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No notifications
      </div>
    );
  }

  return (
    <div className="max-h-[400px] overflow-y-auto">
      {notifications.map((notification) => (
        <a
          key={notification.id}
          href={notification.link || '#'}
          className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${
            !notification.isRead ? 'bg-blue-50' : ''
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {notification.title}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {notification.content}
              </p>
            </div>
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}