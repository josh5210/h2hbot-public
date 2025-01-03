// src/handlers/messages.ts
import { Request as CloudflareRequest } from '@cloudflare/workers-types';
import { Env } from '@/types/env';
import { getServerSession } from '@/lib/session';
import { WorkerError } from '@/middleware/error';
import { 
  createMessage, 
  getParticipantIdsForChat,
  isUserInConversation,
  DBMessage,
  query
} from '@/lib/db/d1-utils';
import { createChatMessageNotification } from '@/lib/db/notifications';
import { z } from 'zod';
import { WS_EVENTS } from '@/lib/websocket/events';

const messageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty'),
  isAi: z.boolean().optional(),
});

const MessageSchema = z.object({
  id: z.number(),
  conversation_id: z.number(),
  user_id: z.number().nullable(),
  content: z.string(),
  is_ai: z.union([z.boolean(), z.number()]).transform(val => Boolean(val)),
  sender_name: z.string().nullable(),
  created_at: z.string(),
  eligibility_status: z.enum(['pending', 'eligible', 'not_eligible', 'points_awarded', 'expired']),
  eligibility_reasons: z.union([
    z.array(z.string()),
    z.string()
  ]).transform(val => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    }
    return val;
  }),
  heart_points_received: z.number(),
  heart_points_awarded_at: z.string().nullable(),
  heart_points_awarded_by: z.number().nullable()
});

interface ChatParticipant {
  id: number;
  name: string;
}

// Safe JSON parse helper
function tryParseJSON(jsonString: string, fallback: unknown = null) {
  try {
    return jsonString ? JSON.parse(jsonString) : fallback;
  } catch (e) {
    console.error('JSON parse error:', e);
    return fallback;
  }
}

export async function handleGetMessages(
  request: CloudflareRequest,
  env: Env,
  chatId: string
): Promise<Response> {
  // Validate JWT secret exists
  if (!env.JWT_SECRET) {
    console.error('JWT_SECRET is not configured');
    throw WorkerError.Internal('Authentication configuration error');
  }

  // Get session with error handling
  try {
    const session = await getServerSession(request, env.JWT_SECRET);
    if (!session?.user?.id) {
      throw WorkerError.Unauthorized('Authentication required');
    }

    const userId = Number(session.user.id);
    const chatIdNum = Number(chatId);

    // Verify user has access to chat
    const hasAccess = await isUserInConversation(env.DB, userId, chatIdNum);
    if (!hasAccess) {
      throw WorkerError.Forbidden('You do not have access to this chat');
    }

    // Check if chat exists and has welcome message
    const chatResult = await query(
      env.DB,
      `SELECT c.has_welcome_message,
              GROUP_CONCAT(u.id) as participant_ids,
              GROUP_CONCAT(u.name) as participant_names
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        JOIN users u ON cp.user_id = u.id
        WHERE c.id = ?
        GROUP BY c.id`,
      [chatIdNum]
    );

    if (chatResult.results.length === 0) {
      throw WorkerError.NotFound('Chat not found');
    }

    const chat = chatResult.results[0];

    // Parse query parameters for pagination
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50); // Max 50 messages per request
    const beforeId = Number(url.searchParams.get('before')) || null;

    // Build the query based on pagination parameters
    let messagesQuery = `
      SELECT m.*
      FROM messages m
      WHERE m.conversation_id = ?
    `;
    const queryParams: (number | string)[] = [chatIdNum];

    if (beforeId) {
      messagesQuery += ' AND m.id < ?';
      queryParams.push(beforeId);
    }

    messagesQuery += `
      ORDER BY m.created_at DESC
      LIMIT ?
    `;
    queryParams.push(limit);

    const result = await query(env.DB, messagesQuery, queryParams);

    // Reverse the messages to maintain chronological order
    const messages = result.results.reverse();

    // If this is the initial load (no beforeId) and chat doesn't have welcome message,
    // create it and include it in the response
    if (!beforeId && !chat.has_welcome_message) {
      // Get existing messages first to check for duplicates
      const existingMessages = messages;
      
      // Check if we already have a welcome message (prevent duplicates)
      const hasExistingWelcome = existingMessages.some(
        msg => msg.is_ai && msg.content.includes('Welcome') && msg.sender_name === 'H2Hbot'
      );
    
      if (!hasExistingWelcome) {
        const participantIds = chat.participant_ids.split(',');
        const participantNames = chat.participant_names.split(',');
        
        const participants = participantIds.map((id: string, index: number) => ({
          id: Number(id),
          name: participantNames[index]
        }));
    
        const welcomeMessage = await createWelcomeMessage(env.DB, chatIdNum, participants);
        messages.unshift(welcomeMessage);
      }
    }

    // Transform messages to include computed fields
    const transformedMessages = messages.map(msg => ({
      ...msg,
      is_ai: Boolean(msg.is_ai),
      eligibility_reasons: Array.isArray(msg.eligibility_reasons) 
        ? msg.eligibility_reasons 
        : tryParseJSON(msg.eligibility_reasons, []),
      canAwardPoints: msg.user_id !== userId && 
                     !Boolean(msg.is_ai) && 
                     msg.eligibility_status === 'eligible' && 
                     msg.heart_points_received === 0,
      pointsAwarded: msg.heart_points_received > 0,
      awardedBy: msg.heart_points_awarded_by ? {
        id: msg.heart_points_awarded_by,
        at: msg.heart_points_awarded_at
      } : null
    }));

    return new Response(
      JSON.stringify(transformedMessages),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    if (error instanceof WorkerError) throw error;
    console.error('Message retrieval error:', error);
    throw WorkerError.Internal('Failed to fetch messages');
  }
}
  
export async function handlePostMessage(
    request: CloudflareRequest,
    env: Env,
    chatId: string
  ): Promise<Response> {
    console.log('📥 handlePostMessage started:', { chatId });

    const session = await getServerSession(request, env.JWT_SECRET);
  
    if (!session?.user?.id) {
      console.log('❌ No session or user ID');
      throw WorkerError.Unauthorized();
    }
  
    const userId = Number(session.user.id);
    const userName = session.user.name || 'Unknown User';
    const chatIdNum = Number(chatId);

    console.log('👤 User info:', { userId, userName, chatId: chatIdNum });
  
    if (!await isUserInConversation(env.DB, userId, chatIdNum)) {
      throw WorkerError.Forbidden('You do not have access to this chat');
    }
  
    try {
      const body = await request.json();
      const result = messageSchema.safeParse(body);
      console.log('👤 User info:', { userId, userName, chatId: chatIdNum });
  
      if (!result.success) {
        console.log('❌ Message validation failed:', result.error);
        throw WorkerError.BadRequest(result.error.errors[0].message);
      }
  
      console.log('💾 Creating message in database...');
      const message = await createMessage(env.DB, {
        conversationId: chatIdNum,
        userId: result.data.isAi ? null : userId,
        content: result.data.content,
        isAi: result.data.isAi || false,
        senderName: result.data.isAi ? 'H2Hbot' : userName
      });
      console.log('✅ Message created:', message);
      
      console.log('👥 Getting chat participants...');
      const allParticipantIds = await getParticipantIdsForChat(env.DB, chatIdNum);
      console.log('Participants:', allParticipantIds);
      const otherParticipantIds = allParticipantIds.filter(id => id !== userId);
  
      await Promise.all(
        otherParticipantIds.map((participantId: number) =>
          createChatMessageNotification(
            env.DB,
            participantId,
            chatIdNum,
            userName,
            result.data.content
          )
        )
      );

      const validatedMessage = MessageSchema.parse(message);

      console.log('Broadcasting validated message:', validatedMessage);

      // Broadcast via WebSocket
      try {
        console.log('📡 Getting ChatConnection DO...', {
          chatId,
          hasBinding: !!env.CHAT_CONNECTION,
        });
        
        if (!env.CHAT_CONNECTION) {
          throw new Error('CHAT_CONNECTION binding is missing');
        }
        const chatConnectionId = env.CHAT_CONNECTION.idFromName('chat-connections');
        console.log('🔑 Created DO ID:', chatConnectionId.toString());

        const chatConnection = env.CHAT_CONNECTION.get(chatConnectionId);
        console.log('📡 Got ChatConnection instance');
        
        console.log('📢 Preparing broadcast payload:', {
          type: WS_EVENTS.CHAT_MESSAGE,
          payload: {
            roomId: chatIdNum,
            message: message
          }
        });

        const broadcastResponse = await chatConnection.fetch(new Request('http://internal/broadcast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: WS_EVENTS.CHAT_MESSAGE,
            payload: {
              roomId: chatIdNum,
              message: message
            }
          })
        }));
      
        console.log('📢 Broadcast response:', {
          status: broadcastResponse.status,
          ok: broadcastResponse.ok,
          statusText: broadcastResponse.statusText
        });

        if (!broadcastResponse.ok) {
          throw new Error(`Broadcast failed: ${broadcastResponse.statusText}`);
        }

      } catch (wsError) {
        console.error('❌ WebSocket broadcast error:', wsError);
          // Log the full error details
          if (wsError instanceof Error) {
            console.error('Error details:', {
              message: wsError.message,
              stack: wsError.stack,
              name: wsError.name
            });
          }
      }

      return new Response(
        JSON.stringify(message),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } catch (error) {
      console.error('❌ Message handling error:', error);
      if (error instanceof WorkerError) throw error;
      throw WorkerError.Database('Failed to send message', { chatId });
    }
}

// Welcome message for new chats
async function createWelcomeMessage(
  db: D1Database,
  chatId: number,
  participants: ChatParticipant[]
): Promise<DBMessage> {
  // Create participant name list
  const participantNames = participants.map(p => p.name || 'Unknown User').join(' and ');
  
  const welcomeContent = `Welcome ${participantNames}! 👋

I'm H2Hbot, your AI chat assistant. I'm here to help facilitate meaningful conversations and understanding between you.

Some quick tips:
• Include "@bot" in your message when you'd like my input or assistance
• I can suggest conversation topics if you're not sure where to start
• I can help guide discussions and provide perspective when needed

I look forward to helping you have a great conversation! Feel free to start chatting whenever you're ready.`;

  // Create the welcome message
  const message = await createMessage(db, {
    conversationId: chatId,
    userId: null,
    content: welcomeContent,
    isAi: true,
    senderName: 'H2Hbot',
    eligibilityStatus: 'not_eligible'
  });

  // Mark the chat as having its welcome message
  await query(
    db,
    `UPDATE conversations 
     SET has_welcome_message = TRUE 
     WHERE id = ?`,
    [chatId]
  );

  return message;
}