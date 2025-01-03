// src/lib/websocket/WebSocketManager.ts
import { EventEmitter } from 'events';
import { WebSocketState, WebSocketConfig, WebSocketMessage, RoomSubscription } from './types';
import { WS_EVENTS } from './events';
import { getEventBus } from '@/lib/events/eventBus';

export class WebSocketManager extends EventEmitter {
  eventBus = getEventBus();
  private socket: WebSocket | null = null;
  private state: WebSocketState = 'disconnected';
  private config: Required<WebSocketConfig>;
  private reconnectAttempts = 0;
  private messageQueue: WebSocketMessage[] = [];
  private rooms: Set<RoomSubscription> = new Set();
  private authToken: string | null = null;

  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      debug: false,
      ...config
    };
  }

  public setAuthToken(token: string) {
    this.authToken = token;
  }

  public connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    const url = new URL(this.config.url);
    if (this.authToken) {
      url.searchParams.set('token', this.authToken);
    }

    this.socket = new WebSocket(url);
    this.state = 'connecting';
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      this.state = 'connected';
      this.reconnectAttempts = 0;
      this.emit(WS_EVENTS.CONNECT);
      this.processMessageQueue();
      this.rejoinRooms();
    };

    this.socket.onclose = () => {
      this.state = 'disconnected';
      this.emit(WS_EVENTS.DISCONNECT);
      this.handleReconnect();
    };

    this.socket.onerror = (error) => {
      this.emit(WS_EVENTS.ERROR, error);
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch {
        this.emit(WS_EVENTS.ERROR, new Error('Invalid message format'));
      }
    };
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      this.emit(WS_EVENTS.ERROR, new Error('Max reconnection attempts reached'));
      return;
    }

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts));
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log('📥 WebSocket received:', {
      type: message.type,
      payload: message.payload
    });
    
    // this.emit(WS_EVENTS.MESSAGE, message);

    switch (message.type) {
      case WS_EVENTS.CHAT_MESSAGE: {
        console.log('📨 Processing chat message:', message.payload);
        const { roomId, message: chatMessage } = message.payload;
        
        this.eventBus.emit('chat:message', {
          chatId: String(roomId),
          message: {
            ...chatMessage,
            is_ai: Boolean(chatMessage.is_ai),
            eligibility_reasons: Array.isArray(chatMessage.eligibility_reasons) 
              ? chatMessage.eligibility_reasons 
              : []
          }
        });
        break;
      }

      case WS_EVENTS.NOTIFICATION_CREATED: {
        console.log('🔔 Processing new notification:', message.payload);
        const notification = message.payload;

        this.eventBus.emit('notification:new', {
          ...notification,
          createdAt: new Date(notification.createdAt)
        });
        break;
      }

      case WS_EVENTS.NOTIFICATION_DELETED: {
        console.log('🗑️ Processing notification deletion:', message.payload);
        const { notificationId, chatId } = message.payload;

        this.eventBus.emit('notification:deleted', {
          notificationId,
          chatId
        });
        break;
      }

      case WS_EVENTS.NOTIFICATION_CLEARED: {
        console.log('🧹 Processing notifications cleared:', message.payload);
        const { chatIds } = message.payload;

        this.eventBus.emit('notification:cleared', {
          chatIds
        });
        break;
      }

      case WS_EVENTS.NOTIFICATIONS_READ: {
        console.log('👀 Processing notifications read:', message.payload);
        const { chatId } = message.payload;

        this.eventBus.emit('notifications:read', {
          chatId
        });
        break;
      }

      case WS_EVENTS.POINTS_AWARDED: {
        console.log('🏆 Processing points awarded:', message.payload);
        const { messageId, points, type, awardedBy, awardedAt } = message.payload;

        this.eventBus.emit('points:awarded', {
          messageId,
          points,
          type,
          awardedBy,
          awardedAt
        });
        break;
      }
    }
  }

  // Tracking of active rooms
  private activeRooms = new Set<string>();

  public joinRoom(roomId: string): void {
    console.log('Room state before join:', {
      roomId,
      activeRooms: Array.from(this.activeRooms),
      connectionState: this.state
    });
    
    if (this.activeRooms.has(roomId)) {
      console.log('🔄 Already in room:', roomId);
      return;
    }
    
    this.activeRooms.add(roomId);
    console.log('📊 Active rooms:', Array.from(this.activeRooms));
    
    if (this.state === 'connected') {
      this.sendMessage({
        type: WS_EVENTS.ROOM_JOIN,
        payload: { roomId }
      });
    }
  }

  public leaveRoom(roomId: string): void {
    this.rooms.forEach(sub => {
      if (sub.roomId === roomId) {
        this.rooms.delete(sub);
      }
    });

    if (this.state === 'connected') {
      this.sendMessage({
        type: WS_EVENTS.ROOM_LEAVE,
        payload: { roomId }
      });
    }
  }

  private rejoinRooms(): void {
    this.rooms.forEach(subscription => {
      this.sendMessage({
        type: WS_EVENTS.ROOM_JOIN,
        payload: { roomId: subscription.roomId }
      });
    });
  }

  public sendMessage(message: WebSocketMessage): void {
    console.log('📤 WebSocketManager sending message:', message);
    
    if (this.state !== 'connected') {
      console.log('📦 Queueing message - not connected');
      this.messageQueue.push(message);
      return;
    }
  
    this.socket?.send(JSON.stringify(message));
    console.log('📨 Message sent to WebSocket');
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  public disconnect(): void {
    this.socket?.close();
    this.socket = null;
    this.state = 'disconnected';
  }
}