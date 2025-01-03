// /src/components/providers/NotificationProvider.tsx
"use client";

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './WebSocketContext';
import { useAuth } from './AuthProvider';
import { WS_EVENTS } from '@/lib/websocket/events';
import { notifications } from '@/lib/api/notifications';
import { usePathname } from 'next/navigation';
import { getEventBus } from '@/lib/events/eventBus';

interface NotificationResponse {
    notifications: Array<{
      id: number;
      userId: number;
      type: 'chat_message' | 'announcement';
      title: string;
      content: string;
      link?: string | null;
      isRead: boolean;
      createdAt: string;
      metadata: Record<string, unknown>;
    }>;
    unreadCount: number;
    limit: number;
    offset: number;
  }

export interface Notification {
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

export interface NotificationCounts {
total: number;
byChat: Record<string, number>;
}

export interface NotificationContextType {
  notifications: Notification[];
  counts: NotificationCounts;
  deleteNotification: (notificationId: number) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  deleteNotificationsByChat: (chatId: number) => Promise<void>;
}

export const NotificationContext = createContext<NotificationContextType | null>(null);

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts>({ total: 0, byChat: {} });
  const { isConnected, sendMessage } = useWebSocket();
  const { status } = useAuth();
  const pathname = usePathname();

    // Debug WebSocket connection status
    useEffect(() => {
        console.log('🔌 WebSocket connection status:', isConnected);
        }, [isConnected]);
        
  // Helper to calculate counts
  const updateCounts = useCallback((notifications: Notification[]) => {
    const byChat: Record<string, number> = {};
    
    notifications.forEach(notification => {
      if (notification.type === 'chat_message' && notification.metadata?.chatId) {
        const chatId = String(notification.metadata.chatId);
        byChat[chatId] = (byChat[chatId] || 0) + 1;
      }
    });

    setCounts({
      total: notifications.length,
      byChat
    });
  }, []);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    try {
        const response = await notifications.getNotifications();
        const data = response as NotificationResponse;
        const fetchedNotifications = data.notifications.map(n => ({
          ...n,
          createdAt: new Date(n.createdAt)
        }));
      setAllNotifications(fetchedNotifications);
      updateCounts(fetchedNotifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [updateCounts]);

  // Initial fetch
  useEffect(() => {
    if (status === 'authenticated') {
      fetchNotifications();
    }
  }, [status, fetchNotifications]);

   // Helper to safely get chatId from metadata
   const getChatIdFromMetadata = (metadata: Record<string, unknown>): number | undefined => {
    if (typeof metadata.chatId === 'number') {
      return metadata.chatId;
    }
    const parsed = parseInt(String(metadata.chatId));
    return isNaN(parsed) ? undefined : parsed;
  };

  // Delete a single notification
  const deleteNotification = async (notificationId: number) => {
    try {
      await notifications.deleteNotifications([notificationId]);
      
      // Update local state
      const updatedNotifications = allNotifications.filter(n => n.id !== notificationId);
      setAllNotifications(updatedNotifications);
      updateCounts(updatedNotifications);

      // Get chat ID if it's a chat notification
      const notification = allNotifications.find(n => n.id === notificationId);
      if (notification?.type === 'chat_message' && notification.metadata?.chatId && isConnected) {
        const chatId = getChatIdFromMetadata(notification.metadata);
        if (chatId) {
          sendMessage({
            type: WS_EVENTS.NOTIFICATION_DELETED,
            payload: { notificationId, chatId }
          });
        }
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  // Delete all notifications
  const deleteAllNotifications = async () => {
    try {
      const notificationIds = allNotifications.map(n => n.id);
      await notifications.deleteNotifications(notificationIds);
      
      // Update local state
      setAllNotifications([]);
      updateCounts([]);

      if (isConnected) {
        // Group chat IDs for WebSocket notification
        const chatIds = new Set(
          allNotifications
            .filter(n => n.type === 'chat_message' && n.metadata?.chatId)
            .map(n => n.metadata.chatId as number)
        );

        sendMessage({
          type: WS_EVENTS.NOTIFICATION_CLEARED,
          payload: { chatIds: Array.from(chatIds) }
        });
      }
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
    }
  };

  // Delete notifications for a specific chat
  const deleteNotificationsByChat = async (chatId: number) => {
    try {
      await notifications.deleteNotificationsByChat(chatId);
      
      // Update local state
      const updatedNotifications = allNotifications.filter(n => 
        !(n.type === 'chat_message' && n.metadata?.chatId === chatId)
      );
      setAllNotifications(updatedNotifications);
      updateCounts(updatedNotifications);

      if (isConnected) {
        sendMessage({
          type: WS_EVENTS.NOTIFICATION_CLEARED,
          payload: { chatIds: [chatId] }
        });
      }
    } catch (error) {
      console.error('Failed to delete chat notifications:', error);
    }
  };

  // Handle incoming WebSocket events
  useEffect(() => {
    if (!isConnected) return;

    // Handle new notifications
    const handleNewNotification = (notification: Notification) => {
      // Don't add notification if user is in the relevant chat
      if (notification.type === 'chat_message' && 
          notification.metadata?.chatId && 
          pathname === `/chat/${notification.metadata.chatId}`) {
        return;
      }

      setAllNotifications(prev => {
        const updated = [notification, ...prev];
        updateCounts(updated);
        return updated;
      });
    };

    // Handle deleted notifications
    const handleNotificationDeleted = (data: { notificationId: number, chatId?: number }) => {
      setAllNotifications(prev => {
        const updated = prev.filter(n => n.id !== data.notificationId);
        updateCounts(updated);
        return updated;
      });
    };

    // Handle cleared notifications
    const handleNotificationsCleared = (data: { chatIds: number[] }) => {
      setAllNotifications(prev => {
        const updated = prev.filter(n => 
          !(n.type === 'chat_message' && 
            n.metadata?.chatId && 
            data.chatIds.includes(n.metadata.chatId as number))
        );
        updateCounts(updated);
        return updated;
      });
    };

    // Subscribe to events
    const eventBus = getEventBus();
    const unsubscribeNew = eventBus.on('notification:new', handleNewNotification);
    const unsubscribeDelete = eventBus.on('notification:deleted', handleNotificationDeleted);
    const unsubscribeClear = eventBus.on('notification:cleared', handleNotificationsCleared);

    return () => {
      unsubscribeNew();
      unsubscribeDelete();
      unsubscribeClear();
    };
  }, [isConnected, pathname, updateCounts]);

  const value = {
    notifications: allNotifications,
    counts,
    deleteNotification,
    deleteAllNotifications,
    deleteNotificationsByChat,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}