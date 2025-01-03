// /src/components/chat/ChatInterface.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Send } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/components/providers/AuthProvider';
import { useWebSocket } from '@/components/providers/WebSocketContext';
import AIAvatar from '@/components/AIAvatar';
import UserAvatar from '@/components/UserAvatar';
import { format, isToday, isYesterday, isValid, parseISO } from 'date-fns';
import AutoResizeTextarea from './AutoResizeTextarea';
import { CHAT_CONSTANTS } from '@/lib/constants/chat';
import { WS_EVENTS } from '@/lib/websocket/events';
import { getEventBus } from '@/lib/events/eventBus';
import { ExtendedDBMessage } from '@/types/chat';
import HeartPointButton from './HeartPointButton';
import { BOT_USAGE_CONFIG, isWithinBotLimit } from '@/lib/constants/bot';
import BotUsageWarning from './BotUsageWarning';

interface BotUsageInfo {
  weeklyUses: number;
  lastReset: string;
  isSubscribed: boolean;
  remainingUses: number;
}

const BotUsageResponseSchema = z.object({
  weeklyUses: z.number(),
  lastReset: z.string(),
  isSubscribed: z.boolean(),
  remainingUses: z.number()
});

// Message schemas for better type safety
const BaseMessageSchema = z.object({
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
  }).default([]),
  heart_points_received: z.number(),
  heart_points_awarded_at: z.string().nullable(),
  heart_points_awarded_by: z.number().nullable()
});

// Extended schema for messages with optional fields
const MessageSchema = BaseMessageSchema.extend({
  isThinking: z.boolean().optional(),
  canAwardPoints: z.boolean().optional(),
  pointsAwarded: z.boolean().optional(),
  awardedBy: z.object({
    id: z.number(),
    at: z.string().nullable()
  }).nullable().optional()
});

// AI response schema
const AIResponseSchema = z.object({
  message: BaseMessageSchema.extend({
    isThinking: z.boolean().optional(),
    canAwardPoints: z.boolean().optional(),
    pointsAwarded: z.boolean().optional(),
    awardedBy: z.object({
      id: z.number(),
      at: z.string().nullable()
    }).nullable().optional()
  }),
  analysis: z.object({
    eligibleMessages: z.array(z.object({
      messageId: z.number(),
      isEligible: z.boolean(),
      reasons: z.array(z.string()),
      h2hPoints: z.number().optional()
    }))
  })
});

interface Message extends z.infer<typeof MessageSchema> {
  sendStatus?: 'sending' | 'sent';
}

type EligibilityUpdate = z.infer<typeof AIResponseSchema>['analysis']['eligibleMessages'][number];

interface ExtendedMessage extends Message {
  heart_points_type?: 'HP' | 'H2HP';
  heart_points_awarded_by_name?: string | null;
  isThinking?: boolean;
}

interface ChatInterfaceProps {
  chatId: string;
}

interface MessageGroup {
  date: Date;
  messages: Message[];
  key: string;
}

// Helper functions for date handling
const formatDateSeparator = (date: Date) => {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, M/d/yy');
};

// Helper function to safely create Date objects
const safeParseDate = (dateString: string): Date => {
  try {
    const parsed = parseISO(dateString);
    return isValid(parsed) ? parsed : new Date();
  } catch {
    return new Date();
  }
};

// Function to group messages by date
const groupMessagesByDate = (messages: Message[]): MessageGroup[] => {
  const groups: MessageGroup[] = [];
  let groupCount = 0;
  
  // Helper function that's only called when we know we have a valid date
  const addGroup = (date: Date, msgs: Message[]) => {
    if (!isValid(date)) {
      // If we have thinking messages, group them with the current time
      const hasThinkingMessages = msgs.some(m => 'isThinking' in m && m.isThinking);
      if (hasThinkingMessages) {
        date = new Date();
      } else {
        console.error('Invalid date detected:', date);
        date = new Date(); // Fallback to current date for non-thinking messages
      }
    }
    
    try {
      groups.push({
        date,
        messages: [...msgs],
        key: `date-${date.toISOString()}-${groupCount}`
      });
      groupCount++;
    } catch (error) {
      console.error('Error adding message group:', error);
      // Fallback using timestamp if toISOString fails
      groups.push({
        date,
        messages: [...msgs],
        key: `date-${date.getTime()}-${groupCount}`
      });
      groupCount++;
    }
  };

  let currentDate: Date | null = null;
  let currentMessages: Message[] = [];
  
  messages.forEach(message => {
    // Special handling for thinking messages - group them with current time
    if ('isThinking' in message && message.isThinking) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      if (!currentDate || currentDate.getTime() !== now.getTime()) {
        if (currentMessages.length > 0 && currentDate) {
          addGroup(currentDate, currentMessages);
        }
        currentDate = now;
        currentMessages = [message];
      } else {
        currentMessages.push(message);
      }
      return;
    }

    // Regular message handling
    if (!message.created_at) {
      console.error('Message missing created_at:', message);
      return;
    }

    const messageDate = safeParseDate(message.created_at + 'Z');
    if (!isValid(messageDate)) {
      console.error('Invalid message date:', message.created_at);
      return;
    }
    
    messageDate.setHours(0, 0, 0, 0);

    if (!currentDate || currentDate.getTime() !== messageDate.getTime()) {
      if (currentMessages.length > 0 && currentDate) {
        addGroup(currentDate, currentMessages);
      }
      currentDate = messageDate;
      currentMessages = [message];
    } else {
      currentMessages.push(message);
    }
  });

  if (currentMessages.length > 0 && currentDate) {
    addGroup(currentDate, currentMessages);
  }

  return groups;
};

const DateSeparator = ({ date }: { date: Date }) => (
  <div className="flex items-center justify-center my-4">
    <div className="border-t border-gray-300 flex-grow" />
    <div className="mx-4 text-sm text-gray-500 px-2 py-1 bg-gray-100 rounded-full">
      {formatDateSeparator(date)}
    </div>
    <div className="border-t border-gray-300 flex-grow" />
  </div>
);

const ChatInterface = ({ chatId }: ChatInterfaceProps) => {
  const { user } = useAuth();
  const { sendMessage, isConnected } = useWebSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingMessageId, setTypingMessageId] = useState<number | null>(null);
  const [displayedContent, setDisplayedContent] = useState<Record<number, string>>({});
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [botUsage, setBotUsage] = useState<BotUsageInfo | null>(null);
  const [ ,setIsFetchingUsage] = useState(false);
  const [botUsageError, setBotUsageError] = useState<string | null>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [oldestLoadedMessageId, setOldestLoadedMessageId] = useState<number | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [optimisticMessageId, setOptimisticMessageId] = useState<number | null>(null);
  const [sendStatus, setSendStatus] = useState<'sending' | 'sent' | null>(null);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const eventBus = useMemo(() => getEventBus(), []);

  // Fetching bot usage (for weekly limits)
  useEffect(() => {
    const fetchBotUsage = async () => {
      if (!user?.id) return;
      
      try {
        setIsFetchingUsage(true);
        setBotUsageError(null);
        const response = await fetch('/api/bot/usage');

      if (!response.ok) {
        console.error('Bot usage fetch failed:', response.status);
        throw new Error('Failed to fetch bot usage data');
      }        
      
      const rawData = await response.json();
      console.log('Bot usage response:', rawData); // Debug log

      const validatedData = BotUsageResponseSchema.parse(rawData);
      setBotUsage(validatedData);
      } catch (err) {
        console.error('Error fetching bot usage:', err);
        setBotUsageError(err instanceof Error ? err.message : 'Failed to check bot usage');
      } finally {
        setIsFetchingUsage(false);
      }
    };
  
    fetchBotUsage();
  }, [user?.id]);

  // Event handling for HP awards
  useEffect(() => {
    const handlePointsAwarded = (data: {
      messageId: number;
      points: number;
      type: 'HP' | 'H2HP';
      awardedBy: string | null;
      awardedAt: string;
    }) => {
      setMessages(prev => prev.map(message => {
        if (message.id === data.messageId) {
          return {
            ...message,
            heart_points_received: data.points,
            heart_points_type: data.type,
            heart_points_awarded_by_name: data.awardedBy,
            heart_points_awarded_at: data.awardedAt,
            eligibility_status: 'points_awarded'
          };
        }
        return message;
      }));
    };
  
    const unsubscribe = eventBus.on('points:awarded', handlePointsAwarded);
    return () => unsubscribe();
  }, [eventBus]);

  // Func for animated typing of AI messages
  const animateTyping = (message: Message, onComplete: () => void) => {
    let currentLength = 0;
    
    const animate = () => {
      const charsToAdd = CHAT_CONSTANTS.TYPING_SPEED.CHARS_PER_FRAME;
      
      // Add multiple characters at once
      currentLength = Math.min(
        currentLength + charsToAdd, 
        message.content.length
      );
  
      setDisplayedContent(prev => ({
        ...prev,
        [message.id]: message.content.slice(0, currentLength)
      }));
  
      if (currentLength < message.content.length) {
        requestAnimationFrame(animate);
      } else {
        onComplete();
        }
      };
    
  
    requestAnimationFrame(animate);
  };
  
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, []);  

  const fetchMessages = useCallback(async (beforeMessageId?: number) => {
    try {
      const queryParams = new URLSearchParams({
        limit: '20',
        ...(beforeMessageId && { before: beforeMessageId.toString() })
      });

      const response = await fetch(`/api/chat/${chatId}/messages?${queryParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      const data = await response.json();
      const validatedMessages = z.array(MessageSchema).parse(data);
      
      // Initialize displayed content for all messages
      const initialContent: Record<number, string> = {};
      validatedMessages.forEach(msg => {
        initialContent[msg.id] = msg.content;
      });
      setDisplayedContent(prev => ({ ...prev, ...initialContent }));
      
      // Update hasMoreMessages based on response
      setHasMoreMessages(validatedMessages.length === 20);

      if (validatedMessages.length > 0) {
        setOldestLoadedMessageId(Math.min(...validatedMessages.map(m => m.id)));
      }

      // If this is a "load more" request, prepend messages
      if (beforeMessageId) {
        const container = messagesContainerRef.current;
        if (container) {
          // Store the current scroll height and position before adding new messages
          const prevScrollHeight = container.scrollHeight;
          const prevScrollTop = container.scrollTop;
      
          setMessages(prev => [...validatedMessages, ...prev]);
      
          // After React renders the new messages, adjust the scroll position
          requestAnimationFrame(() => {
            // The new scroll height minus the old scroll height gives us the height of the new content
            const newScrollHeight = container.scrollHeight;
            const heightDifference = newScrollHeight - prevScrollHeight;
            
            // Adjust the scroll position by the height of the new content
            container.scrollTop = prevScrollTop + heightDifference;
          });
        } else {
          setMessages(prev => [...validatedMessages, ...prev]);
        }
      } else {
        // Initial load
        setMessages(validatedMessages);
        if (isFirstLoad) {
          // Scroll to bottom immediately after setting messages
          requestAnimationFrame(() => {
            const container = messagesContainerRef.current;
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
            setIsFirstLoad(false);
          });
        }
      }

      setInitialLoadComplete(true);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load messages');
    }
  }, [chatId, scrollToBottom]);

  // Scroll handler for infinite scroll
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current || isFetchingMore || !hasMoreMessages) return;

    const { scrollTop } = messagesContainerRef.current;
    // If scrolled near the top (e.g., within 100px) and we have more messages
    if (scrollTop < 100) {
      setIsFetchingMore(true);
      // Convert null to undefined before passing to fetchMessages
      fetchMessages(oldestLoadedMessageId || undefined)
        .finally(() => setIsFetchingMore(false));
    }
  }, [fetchMessages, hasMoreMessages, isFetchingMore, oldestLoadedMessageId]);

  // Scroll event listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Initial fetch
  useEffect(() => {
    if (user?.id) {
      void fetchMessages();
    }
  }, [user?.id, fetchMessages]);

  // Join room
  useEffect(() => {
    if (!isConnected) return;
    
    console.log('🚪 Joining chat room:', chatId);
    sendMessage({
      type: WS_EVENTS.ROOM_JOIN,
      payload: { roomId: chatId }
    });
  
    return () => {
      console.log('🚪 Leaving chat room:', chatId);
      sendMessage({
        type: WS_EVENTS.ROOM_LEAVE,
        payload: { roomId: chatId }
      });
    };
  }, [chatId, isConnected, sendMessage]);

  // Memoize message handler to prevent recreation
  const handleNewMessage = useCallback((data: { chatId: string; message: Message }) => {
    if (data.chatId !== chatId) {
      console.log('⚠️ Message for wrong chat, ignoring');
      return;
    }

    setMessages(prev => {   
      // Check for matching optimistic message
      const optimisticMessage = prev.find(m => 
        m.sendStatus === 'sending' && 
        m.content === data.message.content &&
        m.user_id === data.message.user_id
      );

      // For AI messages, animate the typing
      if (data.message.is_ai) {
        setTypingMessageId(data.message.id);
        animateTyping(data.message, () => {
          setTypingMessageId(null);
        });
      }

      //Replace optimistic message with real message
      if (optimisticMessage) {
        console.log('Replacing optimistic message:', optimisticMessage.id);
        setOptimisticMessageId(null);
        setSendStatus(null);
        return prev.map(m => 
          m.id === optimisticMessage.id ? data.message : m
        );
      }

      // Only add if not already present
      if (prev.some(m => m.id === data.message.id)) {
        return prev;
      }

      return [...prev, data.message];
    });
  }, [chatId, animateTyping]);
  
  // Separate effect for event listener
  useEffect(() => {
    if (!isConnected) return;
    
    // Set up message listener once
    console.log('🎧 Setting up message listener');
    const unsubscribe = eventBus.on('chat:message', handleNewMessage);
    
    return () => {
      console.log('🧹 Cleaning up chat message listener');
      unsubscribe();
    };
  // Only depend on isConnected and chatId
  }, [isConnected, chatId]);

  // send message, no optimistic
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
  
    const messageContent = newMessage.trim();
    if (!messageContent || isLoading || messageContent.length > CHAT_CONSTANTS.MESSAGE_LENGTH.MAX) {
      return;
    }
  
    console.log('💬 Attempting to send message:', messageContent);
    setIsLoading(true);
    setError(null);
    setNewMessage(''); // Clear input immediately
 
    // Create optimistic message
    const optimisticMessage: Message = {
      id: Date.now(), // Temporary ID
      conversation_id: Number(chatId),
      user_id: Number(user?.id),
      content: messageContent,
      is_ai: false,
      created_at: new Date().toISOString(),
      sender_name: user?.name || 'You',
      eligibility_status: 'pending',
      eligibility_reasons: [],
      heart_points_received: 0,
      heart_points_awarded_at: null,
      heart_points_awarded_by: null,
      sendStatus: 'sending'
    };

    // Add optimistic message to UI
    setMessages(prev => [...prev, optimisticMessage]);
    setOptimisticMessageId(optimisticMessage.id);
    setSendStatus('sending');
    scrollToBottom();

    try {
      const response = await fetch(`/api/chat/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent }),
      });
  
      if (!response.ok) throw new Error('Failed to send message');
      
      // Update send status
      setSendStatus('sent');

      // If message contains @bot, trigger AI response
      if (messageContent.includes('@bot')) {
        await handleBotResponse();
      }

      // The actual message will come through WebSocket
      console.log('✅ Message sent to server successfully');
    } catch (err) {
      console.error('❌ Message send error:', err);
      setError('Failed to send message');
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      setNewMessage(messageContent); // Restore the message on error
      setSendStatus(null);
      setOptimisticMessageId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBotResponse = async () => {
    try {
      console.log('🤖 Requesting AI response...');
      
      // Create a thinking message
      const thinkingMessage: ExtendedDBMessage = {
        id: Date.now(), // Temporary ID
        conversation_id: Number(chatId),
        user_id: null,
        content: '',
        is_ai: true,
        created_at: new Date().toISOString(),
        sender_name: 'H2Hbot',
        eligibility_status: 'not_eligible',
        eligibility_reasons: [],
        heart_points_received: 0,
        heart_points_awarded_at: null,
        heart_points_awarded_by: null,
        isThinking: true,
        canAwardPoints: false,
        pointsAwarded: false,
        awardedBy: null
      };
  
      // Add thinking message to UI
      setMessages(prev => [...prev, thinkingMessage]);
      scrollToBottom();
      
      // Check bot usage limits before API call
      if (botUsage && !isWithinBotLimit(botUsage.weeklyUses, botUsage.isSubscribed)) {
        // Remove thinking message after a delay and show limit message
        setTimeout(() => {
          setMessages(prev => {
            const newMessages = prev.filter(msg => msg.id !== thinkingMessage.id);
            return [...newMessages, {
              ...thinkingMessage,
              id: Date.now(),
              content: BOT_USAGE_CONFIG.LIMIT_REACHED_RESPONSE,
              isThinking: false
            }];
          });
          scrollToBottom();
        }, 2000);

        return;
      }

      // Increment usage before making AI request
      const incrementResponse = await fetch('/api/bot/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!incrementResponse.ok) {
        throw new Error('Failed to increment bot usage');
      }

      // Get the updated usage
      const newUsage = await incrementResponse.json();
      setBotUsage(BotUsageResponseSchema.parse(newUsage));
      
      // Request AI response
      const aiResponse = await fetch(`/api/chat/${chatId}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages })
      });
  
      if (!aiResponse.ok) {
        throw new Error('Failed to get AI response');
      }
  
      // Parse and validate the response
      const rawData = await aiResponse.json();
      const aiData = AIResponseSchema.safeParse(rawData);

      if (!aiData.success) {
        console.error('AI response validation error:', aiData.error);
        throw new Error('Invalid AI response format');
      }

      // Process eligibility updates and H2HP awards
      if (aiData.data.analysis?.eligibleMessages) {
        setMessages(prev => prev.map(msg => {
          const analysis = aiData.data.analysis.eligibleMessages.find(
            (m: { messageId: number }) => m.messageId === msg.id
          );
          
          if (!analysis) return msg;

          return {
            ...msg,
            eligibility_status: analysis.isEligible ? 'eligible' : 'not_eligible',
            eligibility_reasons: analysis.reasons,
            heart_points_received: analysis.h2hPoints || 0,
            heart_points_type: analysis.h2hPoints ? 'H2HP' : undefined
          };
        }));
      }
      
      // Remove thinking message
      setMessages(prev => prev.filter(msg => msg.id !== thinkingMessage.id));
  
    // Broadcast AI message via WebSocket if connected
    if (isConnected) {
      // Transform the message to ensure it matches the expected type
      const wsMessage = {
        ...aiData.data.message,
        eligibility_reasons: aiData.data.message.eligibility_reasons || [], // Ensure this is always present
        is_ai: Number(aiData.data.message.is_ai) // Convert boolean to number if needed
      };

      sendMessage({
        type: WS_EVENTS.CHAT_MESSAGE,
        payload: {
          roomId: chatId,
          message: wsMessage
        }
      });
    }

      // Process any point awards from AI analysis
      if (aiData.data.analysis?.eligibleMessages) {
        processEligibilityUpdates(aiData.data.analysis.eligibleMessages);
      }

      // After successful response, update usage
      // debug
      console.log("***Fetching /api/bot/usage***");
      const usageResponse = await fetch('/api/bot/usage');
      if (usageResponse.ok) {
        const rawUsage = await usageResponse.json();
        const validatedUsage = BotUsageResponseSchema.parse(rawUsage);
        setBotUsage(validatedUsage);
      }
  
    } catch (error) {
      console.error('AI response error:', error);
      setError('Failed to get AI response');
      
      // Remove thinking message on error
      setMessages(prev => prev.filter(msg => !msg.isThinking));
    }
  };
  
  // Add helper function to process eligibility updates
  const processEligibilityUpdates = (eligibilityUpdates: EligibilityUpdate[]) => {
    setMessages(prev => prev.map(message => {
      const update = eligibilityUpdates.find(u => u.messageId === message.id);
      if (!update) return message;
  
      return {
        ...message,
        eligibility_status: update.isEligible ? 'eligible' : 'not_eligible',
        eligibility_reasons: update.reasons,
        heart_points_received: update.h2hPoints || message.heart_points_received,
        canAwardPoints: update.isEligible && !message.heart_points_received
      };
    }));
  };

  // Group messages and scroll handling
  const messageGroups = groupMessagesByDate(messages);
  
  // clean up the typing state when unmounting or when messages change
  useEffect(() => {
    return () => {
      setTypingMessageId(null);
      setDisplayedContent({});
    };
  }, []);

  useEffect(() => {
    // Only auto-scroll if a new message was added at the end
    // and we're not fetching older messages
    if (initialLoadComplete && !isFetchingMore && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const isNewMessage = lastMessage.created_at.endsWith('Z') 
        ? new Date(lastMessage.created_at).getTime() > Date.now() - 1000  // Within last second
        : new Date(lastMessage.created_at + 'Z').getTime() > Date.now() - 1000;
      
      if (isNewMessage) {
        scrollToBottom();
      }
    }
  }, [messages, initialLoadComplete, isFetchingMore, scrollToBottom]);

  return (
    <div className="fixed inset-0 top-16 bg-gray-900">
      <div className="h-full max-w-4xl mx-auto w-full p-6 flex flex-col relative">
        {/* Error Message */}
        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-6 flex-shrink-0">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Loading indicator for fetching more messages */}
        {isFetchingMore && (
          <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-full text-sm z-10">
            Loading more messages...
          </div>
        )}

        {/* Messages Container */}
        <div 
          ref={messagesContainerRef} 
          className="flex-1 bg-white rounded-xl shadow-md p-6 overflow-y-auto mb-6 min-h-0"
        >
          <div className="space-y-4">
            {messageGroups.map((group) => (
              <React.Fragment key={group.key}>
                <DateSeparator date={group.date} />
                {group.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex flex-col ${
                      message.is_ai
                      ? 'items-center px-4 sm:px-12' // Reduced padding on mobile
                      : message.user_id === Number(user?.id)
                        ? 'items-end'
                        : 'items-start'
                    }`}
                  >           
                    <div
                      className={`relative group p-4 rounded-xl shadow-sm flex-shrink-0 break-words whitespace-pre-wrap ${
                        message.is_ai
                        ? 'w-full sm:w-[80%] max-w-full sm:max-w-[80%] bg-gray-700 text-white' // Full width on mobile, 80% on desktop
                        : message.user_id === Number(user?.id)
                          ? 'max-w-[70%] bg-blue-600 text-white'
                          : 'max-w-[70%] bg-gray-700 text-white'
                      }`}
                      style={{ width: message.is_ai ? '90%' : 'auto' }}
                    >
                    <div className="flex items-center gap-2 mb-2">
                      {message.is_ai ? (
                        <AIAvatar 
                          state={message.isThinking ? 'thinking' : 
                                typingMessageId === message.id ? 'talking' : 
                                'idle'}
                          mood="happy"
                          className="text-sm text-white whitespace-nowrap"
                        />
                      ) : (
                        <UserAvatar 
                          name={message.sender_name || 'Unknown'}
                          userId={message.user_id || undefined}
                          size="sm"
                          showInitials={true}
                        />
                      )}
                      <div className="min-w-0"> {/* Added container for better control */}
                        <div className="text-sm font-medium text-white flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          {message.is_ai ? (
                            <>
                              <span>H2Hbot</span>
                              {message.isThinking && (
                                <span className="text-sm text-gray-300 italic">thinking...</span>
                              )}
                            </>
                          ) : message.sender_name || 'Unknown'}
                        </div>
                      </div>
                    </div>
                      <p className="text-sm">
                        {typingMessageId === message.id 
                          ? displayedContent[message.id] || ''
                          : message.content
                        }
                      </p>
                      {/* Time display with error handling */}
                      <span className="text-xs text-gray-300 mt-2 block">
                        {format(safeParseDate(message.created_at + 'Z'), 'h:mm:ss a')}
                      </span>
                      {message.id === optimisticMessageId && (
                        <span className="text-xs text-gray-300 italic ml-2">
                          {sendStatus === 'sending' ? 'Sending...' : 'Sent'}
                        </span>
                      )}
                      {/* HeartPointButton */}
                      {!message.is_ai && message.user_id !== Number(user?.id) && (
                        <HeartPointButton
                          messageId={message.id}
                          receiverId={message.user_id!}
                          isEligible={message.eligibility_status === 'eligible'}
                          reasons={message.eligibility_reasons || []}
                          type={(message as ExtendedMessage).heart_points_type}
                          awarded={message.heart_points_received > 0}
                          awardedBy={(message as ExtendedMessage).heart_points_awarded_by_name ? user?.name : null}
                          onAward={() => {
                            // Update local state when points are awarded
                            setMessages(prev => prev.map(msg => 
                              msg.id === message.id 
                                ? {
                                    ...msg,
                                    heart_points_received: 1,
                                    heart_points_awarded_by: Number(user?.id),
                                    heart_points_awarded_by_name: user?.name || 'Unknown',
                                    eligibility_status: 'points_awarded'
                                  } as ExtendedMessage
                                : msg
                            ));
                          }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </React.Fragment>
            ))}
            
            {/* Invisible div for auto-scrolling */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bot usage warning */}
        {botUsage && (
          <BotUsageWarning
            remainingUses={botUsage.remainingUses}
            isSubscribed={botUsage.isSubscribed}
            className="mb-2"
          />
        )}

        {botUsageError && (
          <div className="mb-2 px-4 py-2 bg-red-50 text-red-700 rounded-md text-sm">
            Warning: {botUsageError} - Bot responses may be unavailable.
          </div>
        )}

        {/* Message Input */}
        <div className="sticky bottom-0 w-full">
        <form onSubmit={handleSendMessage} className="bg-white rounded-xl shadow-md p-4 flex-shrink-0">
          <div className="flex gap-4 items-start pt-[4px] px-4">
            <AutoResizeTextarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={{
                mobile: "Type here (try @bot)",
                desktop: "Type your message... (Use @bot to get H2Hbot's assistance)"
              }}
              disabled={isLoading}
              maxHeight={200}
              maxLength={CHAT_CONSTANTS.MESSAGE_LENGTH.MAX}
              showCharacterCount={true}
              onSubmit={() => {
                if (newMessage.trim() && newMessage.length <= CHAT_CONSTANTS.MESSAGE_LENGTH.MAX) {
                  handleSendMessage();
                }
              }}
            />
            <button
              type="submit"
              className={`h-[42px] w-[42px] flex items-center justify-center rounded-md transition-colors ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              }`}
              disabled={isLoading}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
    </div>
  );
};

export default ChatInterface;