// /src/lib/api/notifications.ts
import { getApiUrl } from '@/lib/config';

export const notifications = {
  async getNotifications() {
    const response = await fetch(`${getApiUrl()}/api/notifications`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
  },

  async deleteNotifications(notificationIds: number[]) {
    const response = await fetch(`${getApiUrl()}/api/notifications/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ notificationIds }),
    });
    if (!response.ok) throw new Error('Failed to delete notifications');
    return response.json();
  },

  async deleteNotificationsByChat(chatId: number) {
    const response = await fetch(`${getApiUrl()}/api/notifications/chat/${chatId}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to delete chat notifications');
    return response.json();
  }
};