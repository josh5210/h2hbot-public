// types/chat.ts
export interface User {
    id: string;
    name: string;
    email: string;
  }
  
  export interface Chat {
    id: number;
    participant_names: string[];
    participant_ids: number[];
    updated_at: string;
    latest_message_time: string | null;
    unread_count: number;
  }
  
  export interface Message {
    id: string;
    chatId: string;
    content: string;
    sender: string;
    timestamp: string;
  }
  
  export interface AIMessage extends Message {
    sender: 'ai';
  }

// API request/response types
export interface CreateChatRequest {
    participants: string[]; // User IDs
  }
  
  export interface SendMessageRequest {
    content: string;
  }
  
  export interface GetAIInputRequest {
    messages: Message[];
  }
  
  export type EligibilityStatus = 'pending' | 'eligible' | 'not_eligible' | 'points_awarded' | 'expired';

  export interface DBMessage {
    id: number;
    conversation_id: number;
    user_id: number | null;
    content: string;
    is_ai: boolean;
    created_at: string;
    sender_name: string | null;
    eligibility_status: EligibilityStatus;
    eligibility_reasons: string[];
    heart_points_received: number;
    heart_points_awarded_at: string | null;
    heart_points_awarded_by: number | null;
  }
  
  export interface MessageDebug {
    broadcastTime: string;
    sender: string;
  }
  
  export interface ExtendedDBMessage extends DBMessage {
    _debug?: MessageDebug;
    isThinking?: boolean;
    canAwardPoints?: boolean;
    pointsAwarded?: boolean;
    awardedBy?: {
      id: number;
      at: string | null;
    } | null;
  }