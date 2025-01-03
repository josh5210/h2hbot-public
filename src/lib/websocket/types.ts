// src/lib/websocket/types.ts
import type { WebSocketEventMap } from './events';

export type WebSocketState = 'connecting' | 'connected' | 'disconnected';

export type WebSocketMessage = {
  [K in keyof WebSocketEventMap]: {
    type: K;
    payload: WebSocketEventMap[K];
  }
}[keyof WebSocketEventMap];

export interface RoomSubscription {
  roomId: string;
  lastSeenMessageId?: number;
}

export interface WebSocketConfig {
  url: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  debug?: boolean;
}