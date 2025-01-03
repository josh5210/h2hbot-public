import { WebSocketMessage } from "./types";

// src/lib/websocket/events.ts
export const WS_EVENTS = {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    MESSAGE: 'message',
    ROOM_JOIN: 'room:join',
    ROOM_LEAVE: 'room:leave',
    CHAT_MESSAGE: 'chat:message',
    ERROR: 'error',
    NOTIFICATIONS_READ: 'notifications:read',
    POINTS_AWARDED: 'points:awarded',
    NOTIFICATION_CREATED: 'notification:created',
    NOTIFICATION_DELETED: 'notification:deleted',
    NOTIFICATION_CLEARED: 'notification:cleared'
  } as const;
  
  export type WebSocketEventMap = {
    [WS_EVENTS.CONNECT]: void;
    [WS_EVENTS.DISCONNECT]: void;
    [WS_EVENTS.MESSAGE]: WebSocketMessage;
    [WS_EVENTS.ROOM_JOIN]: { roomId: string };
    [WS_EVENTS.ROOM_LEAVE]: { roomId: string };
    [WS_EVENTS.CHAT_MESSAGE]: {
        roomId: string | number;
        message: {
          id: number;
          conversation_id: number;
          user_id: number | null;
          content: string;
          is_ai: boolean | number;
          sender_name: string | null;
          created_at: string;
          eligibility_status: 'pending' | 'eligible' | 'not_eligible' | 'points_awarded' | 'expired';
          eligibility_reasons: string[] | string;
          heart_points_received: number;
          heart_points_awarded_at: string | null;
          heart_points_awarded_by: number | null;
        }
      };
    [WS_EVENTS.NOTIFICATIONS_READ]: {
        chatId: number;
      };
    [WS_EVENTS.POINTS_AWARDED]: {
        messageId: number;
        points: number;
        type: 'HP' | 'H2HP';
        awardedBy: string | null;  // null for AI awards
        awardedAt: string;
      };
    [WS_EVENTS.NOTIFICATION_CREATED]: {
      id: number;
      userId: number;
      type: 'chat_message' | 'announcement';
      title: string;
      content: string;
      link?: string | null;
      isRead: boolean;
      createdAt: Date;
      metadata: Record<string, unknown>;
    };
    [WS_EVENTS.NOTIFICATION_DELETED]: {
      notificationId: number;
      chatId?: number;
    };
    [WS_EVENTS.NOTIFICATION_CLEARED]: {
        chatIds: number[];
    };
    [WS_EVENTS.ERROR]: Error;
};