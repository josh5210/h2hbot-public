// src/workers/WebSocketConnection.ts
import { WS_EVENTS } from '@/lib/websocket/events';
import { decode } from '@/lib/jwt';
import { Env } from '@/types/env';
import { z } from 'zod';
import { WebSocketMessage } from '@/lib/websocket/types';

// Message validation schema
const BroadcastMessageSchema = z.object({
  type: z.string(),
  payload: z.union([
    // Chat Message Schema
    z.object({
      roomId: z.string().or(z.number()),
      message: z.object({
        id: z.number(),
        conversation_id: z.number(),
        user_id: z.number().nullable(),
        content: z.string(),
        is_ai: z.union([z.boolean(), z.number()]),
        sender_name: z.string().nullable(),
        created_at: z.string(),
        eligibility_status: z.enum(['pending', 'eligible', 'not_eligible', 'points_awarded', 'expired']),
        eligibility_reasons: z.string().or(z.array(z.string())),
        heart_points_received: z.number(),
        heart_points_awarded_at: z.string().nullable(),
        heart_points_awarded_by: z.number().nullable()
      })
    }),
    // Notification Created Schema
    z.object({
      id: z.number(),
      userId: z.number(),
      type: z.enum(['chat_message', 'announcement']),
      title: z.string(),
      content: z.string(),
      link: z.string().nullable().optional(),
      isRead: z.boolean(),
      createdAt: z.union([z.string(), z.date()]),
      metadata: z.record(z.unknown())
    }),
    // Notification Deleted Schema
    z.object({
      notificationId: z.number(),
      chatId: z.number().optional()
    }),
    // Notifications Cleared Schema
    z.object({
      chatIds: z.array(z.number())
    }),
    // Other payload schemas...
  ])
});


interface ActiveSession {
  id: string;
  userId: string;
  userName: string | null;
  socket: WebSocket;
  rooms: Set<string>;
}

export class WebSocketConnection {
  private activeConnections: Map<string, ActiveSession> = new Map();
  private roomParticipants: Map<string, Set<string>> = new Map(); // roomId -> sessionIds
  private state: DurableObjectState;
  private env: Env;
  private initialized = false;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  
    // Add periodic cleanup
    this.state.blockConcurrencyWhile(async () => {
      const id = setInterval(() => this.cleanupStaleConnections(), 60000); // Every minute
      this.state.waitUntil((async () => {
        // Cleanup timer on shutdown
        await new Promise(() => {}); // Never resolves
        clearInterval(id);
      })());
    });
  }
  
  private async cleanupStaleConnections() {
    for (const [sessionId, session] of this.activeConnections) {
      if (session.socket.readyState !== WebSocket.OPEN) {
        await this.handleSessionClose(sessionId);
      }
    }
  }

  private async initialize() {
    if (this.initialized) return;

    // Load stored room memberships
    const storedRooms = await this.state.storage.get('rooms') as Record<string, string[]> || {};
    Object.entries(storedRooms).forEach(([roomId, sessionIds]) => {
      this.roomParticipants.set(roomId, new Set(sessionIds));
    });

    this.initialized = true;
    console.log('📊 Initialized rooms:', Array.from(this.roomParticipants.keys()));
  }

  private async saveState() {
    // Only store room memberships
    const roomsToStore: Record<string, string[]> = {};
    this.roomParticipants.forEach((sessions, roomId) => {
      roomsToStore[roomId] = Array.from(sessions);
    });

    await this.state.storage.put('rooms', roomsToStore);
    console.log('💾 Saved state - Rooms:', Object.keys(roomsToStore));
  }

  async fetch(request: Request) {
    if (request.headers.get('Upgrade') === 'websocket') {
      const token = new URL(request.url).searchParams.get('token');
      if (!token) {
        return new Response('Unauthorized', { status: 401 });
      }
      const pair = new WebSocketPair();
      await this.handleSession(pair[1], token);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (request.url.includes('/broadcast')) {
      return this.handleBroadcast(request);
    }

    return new Response('Not found', { status: 404 });
  }

  async handleSession(webSocket: WebSocket, token: string) {
    await this.initialize();

    try {
      // Verify token and get user info
      const payload = await decode(token, this.env.JWT_SECRET);
      const sessionId = crypto.randomUUID();

      const session: ActiveSession = {
        id: sessionId,
        userId: payload.sub,
        userName: payload.name || null,
        socket: webSocket,
        rooms: new Set()
      };

      this.activeConnections.set(sessionId, session);

      console.log(`🔌 New connection attempt - Session ID: ${sessionId}`);
      // Log active connections count
      console.log(`👥 Active connections: ${this.activeConnections.size}`);
      
      webSocket.accept();

      webSocket.addEventListener('message', async msg => {
        try {
          const data = JSON.parse(msg.data as string);
          await this.handleMessage(sessionId, data);
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });

      webSocket.addEventListener('close', () => {
        this.handleSessionClose(sessionId);
      });

      return sessionId;
    } catch (error) {
      webSocket.close(1008, 'Authentication failed');
      console.error('WebSocket authentication error:', error);
      throw error;
    }
  }

  private async handleMessage(sessionId: string, message: WebSocketMessage) {
    const session = this.activeConnections.get(sessionId);
    if (!session) return;

    switch (message.type) {
      case WS_EVENTS.ROOM_JOIN:
        await this.handleRoomJoin(session, message.payload.roomId);
        break;
      case WS_EVENTS.ROOM_LEAVE:
        await this.handleRoomLeave(session, message.payload.roomId);
        break;
    }
  }

  private async handleRoomJoin(session: ActiveSession, roomId: string | number) {
    const roomKey = String(roomId);

    console.log('Room join details:', {
      roomKey,
      sessionId: session.id,
      existingParticipants: this.roomParticipants.get(roomKey)?.size || 0,
      allRooms: Array.from(this.roomParticipants.keys())
    });

    session.rooms.add(roomKey);
    if (!this.roomParticipants.has(roomKey)) {
      this.roomParticipants.set(roomKey, new Set());
    }
    this.roomParticipants.get(roomKey)?.add(session.id);

    await this.saveState();
  }

  private async handleRoomLeave(session: ActiveSession, roomId: string | number) {
    const roomKey = String(roomId);

    console.log('🚪 Leaving room:', { sessionId: session.id, roomKey });
    
    session.rooms.delete(roomKey);
    this.roomParticipants.get(roomKey)?.delete(session.id);
    
    await this.saveState();
  }

  private async handleSessionClose(sessionId: string) {
      const session = this.activeConnections.get(sessionId);
      if (!session) return;

      // Remove from all rooms
      for (const roomId of session.rooms) {
        const roomParticipants = this.roomParticipants.get(roomId);
        if (roomParticipants) {
          roomParticipants.delete(sessionId);
          // If room is empty, remove it entirely
          if (roomParticipants.size === 0) {
            this.roomParticipants.delete(roomId);
          }
        }
      }

      this.activeConnections.delete(sessionId);
      await this.saveState();
      console.log('Session closed, new state:', {
        activeConnections: this.activeConnections.size,
        rooms: Array.from(this.roomParticipants.entries()).map(([id, participants]) => ({
          id,
          count: participants.size
        }))
      });
    }

  private async handleBroadcast(request: Request): Promise<Response> {
    await this.initialize();
    
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const rawMessage = await request.json();
      console.log('📢 Received broadcast message:', rawMessage);

      const validatedMessage = BroadcastMessageSchema.parse(rawMessage);

      // For notification events, broadcast to all connected users
      if (validatedMessage.type === WS_EVENTS.NOTIFICATION_DELETED || 
          validatedMessage.type === WS_EVENTS.NOTIFICATION_CLEARED) {
        let broadcastCount = 0;
        
        // Broadcast to all active connections
        for (const [_, session] of this.activeConnections) {
          if (session.socket.readyState === WebSocket.OPEN) {
            session.socket.send(JSON.stringify(validatedMessage));
            broadcastCount++;
          } else {
            await this.handleSessionClose(session.id);
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            recipients: broadcastCount 
          }),
          { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // For chat messages and other room-specific events
      const { roomId } = 'roomId' in validatedMessage.payload 
        ? validatedMessage.payload 
        : { roomId: null };

      if (!roomId) {
        return new Response('Room ID required for this message type', { status: 400 });
      }

      const roomIdString = String(roomId);
      const roomSessions = this.roomParticipants.get(roomIdString);

      console.log('Broadcasting to room:', {
        roomId: roomIdString,
        participantCount: roomSessions?.size || 0,
        activeConnections: this.activeConnections.size,
        participants: Array.from(roomSessions || []).map(id => ({
          id,
          userId: this.activeConnections.get(id)?.userId
        }))
      });

      if (!roomSessions) {
        console.log('❌ Room not found:', roomIdString);
        return new Response('Room not found', { status: 404 });
      }

      let broadcastCount = 0;

      // Broadcast to all active connections in the room
      for (const sessionId of roomSessions) {
        const session = this.activeConnections.get(sessionId);
        if (!session) {
          roomSessions.delete(sessionId);
          continue;
        }
        if (session.socket.readyState === WebSocket.OPEN) {
          session.socket.send(JSON.stringify(validatedMessage));
          broadcastCount++;
        } else {
          await this.handleSessionClose(sessionId);
        }
      }

      await this.saveState(); // Save cleaned up state

      return new Response(
        JSON.stringify({ 
          success: true, 
          recipients: broadcastCount 
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } catch (error) {
      console.error('Broadcast error:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }
}
