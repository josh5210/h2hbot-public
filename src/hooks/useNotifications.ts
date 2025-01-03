// /src/hooks/useNotifications.ts
import { useContext } from 'react';
import { NotificationContext } from '@/components/providers/NotificationProvider';

export function useNotifications() {
  const context = useContext(NotificationContext);
  
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }

  return {
    // All notifications
    notifications: context.notifications,
    
    // Notification counts
    totalCount: context.counts.total,
    getChatCount: (chatId: string | number) => 
      context.counts.byChat[String(chatId)] || 0,
    
    // Actions
    deleteNotification: context.deleteNotification,
    deleteAllNotifications: context.deleteAllNotifications,
    deleteNotificationsByChat: context.deleteNotificationsByChat,
    
    // Helper functions
    getNotificationsForChat: (chatId: string | number) => 
      context.notifications.filter(
        n => n.type === 'chat_message' && 
        n.metadata?.chatId === Number(chatId)
      )
  };
}