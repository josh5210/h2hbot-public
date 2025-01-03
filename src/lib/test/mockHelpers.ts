// src/lib/test/mockHelpers.ts

import { ExtendedDBMessage } from "@/types/chat";

export function createMockMessage(overrides: Partial<ExtendedDBMessage> = {}): ExtendedDBMessage {
  const now = new Date().toISOString();
  
  return {
    id: Date.now(),
    conversation_id: 1,
    content: 'Test message',
    is_ai: false,
    created_at: now,
    user_id: 1,
    sender_name: 'Test User',
    eligibility_status: 'pending',
    eligibility_reasons: [],
    heart_points_received: 0,
    heart_points_awarded_at: null,
    heart_points_awarded_by: null,
    canAwardPoints: false,
    pointsAwarded: false,
    awardedBy: null,
    ...overrides
  };
}

export function createMockAIMessage(overrides: Partial<ExtendedDBMessage> = {}): ExtendedDBMessage {
  return createMockMessage({
    is_ai: true,
    user_id: null,
    sender_name: 'H2Hbot',
    eligibility_status: 'not_eligible',
    ...overrides
  });
}

export function createMockThinkingMessage(chatId: number): ExtendedDBMessage {
  return createMockMessage({
    id: Date.now(),
    conversation_id: chatId,
    content: '',
    is_ai: true,
    user_id: null,
    sender_name: 'H2Hbot',
    isThinking: true,
    eligibility_status: 'not_eligible',
    eligibility_reasons: [],
    heart_points_received: 0,
    heart_points_awarded_at: null,
    heart_points_awarded_by: null,
    canAwardPoints: false,
    pointsAwarded: false,
    awardedBy: null
  });
}