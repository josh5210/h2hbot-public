// /src/handlers/ai.ts

import { Request as CloudflareRequest } from '@cloudflare/workers-types';
import { Env } from '@/types/env';
import { WorkerError } from '@/middleware/error';
import { getServerSession } from '@/lib/session';
import { 
  isUserInConversation, 
  createMessage,
  getMessagesForConversation,
  updateMessageEligibility,
  query,
  runTransaction
} from '@/lib/db/d1-utils';
import Anthropic from '@anthropic-ai/sdk';
import { AIConfigManager } from '@/lib/ai/configManager';
import { handleAIAwardPoints } from './points';
import { WS_EVENTS } from '@/lib/websocket/events';
import { AIResponseHandler } from './ai-response';

// Types
type MessageRole = "assistant" | "user";

interface ConversationMessage {
  role: MessageRole;
  content: string;
}

export async function handleAIResponse(
  request: CloudflareRequest,
  env: Env,
  chatId: string
): Promise<Response> {
  try {
    // Validate session
    const session = await getServerSession(request, env.JWT_SECRET);
    if (!session?.user?.id) {
      throw WorkerError.Unauthorized();
    }

    const userId = Number(session.user.id);
    const chatIdNum = Number(chatId);

    // Verify user is in the chat
    if (!await isUserInConversation(env.DB, userId, chatIdNum)) {
      throw WorkerError.Forbidden('You do not have access to this chat');
    }

    // Get recent messages for context
    const messages = await getMessagesForConversation(env.DB, chatIdNum);
    const recentMessages = messages.slice(-10);

    // Format conversation context
    const conversationContext: ConversationMessage[] = recentMessages.map(msg => ({
      role: msg.is_ai ? "assistant" : "user",
      content: `[${msg.id}] ${msg.sender_name || 'Unknown'}: ${msg.content.trim()}`
    }));

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY
    });

    // Get AI configuration
    const configManager = AIConfigManager.getInstance();
    const config = configManager.getConfig();

    // Get AI response
    const response = await anthropic.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      system: config.systemPrompt,
      messages: conversationContext,
      temperature: 0.7
    });

    // log the raw response
    console.log(response);
    
    // Extract content from Anthropic response
    const messageContent = AIResponseHandler.extractMessageContent(response);
    
    // Clean and parse the response with fallback handling
    const parsedResponse = AIResponseHandler.cleanAndParseResponse(messageContent);

    try {
      // Create AI message
      const savedMessage = await createMessage(env.DB, {
        conversationId: chatIdNum,
        userId: null,
        content: parsedResponse.response,
        isAi: true,
        senderName: 'H2Hbot'
      });

      // Find the last message containing @bot (this triggered the AI response)
      const triggerMessage = [...recentMessages]
      .reverse()
      .find(msg => 
        msg.user_id === userId && 
        msg.content.toLowerCase().includes('@bot')
      );

      if (!triggerMessage) {
        throw new Error('Could not find trigger message');
      }

      await runTransaction(env.DB, async (tx) => {
        // Log the interaction
        await query(
          tx,
          `
          INSERT INTO bot_interactions_log (
            user_id,
            message_id,
            conversation_id,
            ai_message_id
          ) VALUES (?, ?, ?, ?)
          `,
          [userId, triggerMessage.id, chatIdNum, savedMessage.id]
        );
  
        // Increment the user's bot_interactions count
        await query(
          tx,
          `
          UPDATE users 
          SET bot_interactions = bot_interactions + 1 
          WHERE id = ?
          `,
          [userId]
        );
      });

      // Process eligibility updates and H2HP awards
      if (parsedResponse.analysis?.eligibleMessages) {
        await runTransaction(env.DB, async (tx) => {
          for (const msgAnalysis of parsedResponse.analysis.eligibleMessages) {
            // Update message eligibility
            await updateMessageEligibility(tx, msgAnalysis.messageId, {
              isEligible: msgAnalysis.isEligible,
              reasons: msgAnalysis.reasons
            });

            // If H2HP points should be awarded
            if (msgAnalysis.h2hPoints && msgAnalysis.h2hPoints > 0) {
              const message = await query(tx, 
                'SELECT user_id FROM messages WHERE id = ?', 
                [msgAnalysis.messageId]
              );

              if (message.results[0]?.user_id) {
                // Award H2HP points
                await handleAIAwardPoints(
                  tx, // Pass the transaction
                  msgAnalysis.messageId,
                  message.results[0].user_id,
                  msgAnalysis.h2hPoints,
                  msgAnalysis.reasons
                );

                // Broadcast points award via WebSocket
                const id = env.CHAT_CONNECTION.idFromName('chat-connections');
                const chatConnection = env.CHAT_CONNECTION.get(id);

                await chatConnection.fetch('http://internal/broadcast', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: WS_EVENTS.POINTS_AWARDED,
                    payload: {
                      messageId: msgAnalysis.messageId,
                      points: msgAnalysis.h2hPoints,
                      type: 'H2HP',
                      awardedBy: null,
                      awardedAt: new Date().toISOString()
                    }
                  })
                });
              }
            }
          }
        });
      }
      
      // Get the Durable Object for broadcasting
      const id = env.CHAT_CONNECTION.idFromName('chat-connections');
      const chatConnection = env.CHAT_CONNECTION.get(id);

      console.log('🤖 Broadcasting AI message:', {
        chatId: chatIdNum,
        messageId: savedMessage.id,
      });

      // Send broadcast request to Durable Object
      const broadcastResponse = await chatConnection.fetch('http://internal/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: WS_EVENTS.CHAT_MESSAGE,
          payload: {
            roomId: chatIdNum,
            message: savedMessage
          }
        })
      });

      if (!broadcastResponse.ok) {
        console.error('❌ Failed to broadcast AI message:', {
          status: broadcastResponse.status,
          statusText: broadcastResponse.statusText
        });
      }

      // Return both the message and analysis
      return new Response(
        JSON.stringify({
          message: savedMessage,
          analysis: parsedResponse.analysis
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );

    } catch (error) {
      // If we found a trigger message but AI response failed, log the failed interaction
      const triggerMessage = [...recentMessages]
      .reverse()
      .find(msg => 
        msg.user_id === userId && 
        msg.content.toLowerCase().includes('@bot')
      );

      if (triggerMessage) {
        await query(
          env.DB,
          `
          INSERT INTO bot_interactions_log (
            user_id,
            message_id,
            conversation_id,
            success
          ) VALUES (?, ?, ?, FALSE)
          `,
          [userId, triggerMessage.id, chatIdNum]
        );
      }

      console.error('AI processing error:', error);
      throw error;
    }

  } catch (error) {
    console.error('AI processing error:', error);
    if (error instanceof WorkerError) throw error;
    throw WorkerError.Internal('Failed to process AI response');
  }
}