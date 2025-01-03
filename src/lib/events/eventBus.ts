// src/lib/events/eventBus.ts
type EventCallback<T> = (data: T) => void;

interface EventBusEvents {
    'notification:new': {
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
    'notification:deleted': {
      notificationId: number;
      chatId?: number;
    };
    'notification:cleared': {
      chatIds: number[];
    };
    'chat:message': {
      chatId: string;
      message: {
        id: number;
        conversation_id: number;
        user_id: number | null;
        content: string;
        is_ai: boolean;
        sender_name: string | null;
        created_at: string;
        eligibility_status: 'pending' | 'eligible' | 'not_eligible' | 'points_awarded' | 'expired';
        eligibility_reasons: string[];
        heart_points_received: number;
        heart_points_awarded_at: string | null;
        heart_points_awarded_by: number | null;
      };
      };
    'chat:typing': {
      chatId: string;
      userId: string;
      isTyping: boolean;
    };
    'notifications:read': {
      chatId: number;
    };
    'chat:ai_response': {
      chatId: string;
      message: Message;
    };
    'points:awarded': {
      messageId: number;
      points: number;
      type: 'HP' | 'H2HP';
      awardedBy: string | null;
      awardedAt: string;
    };
  }

class EventBus {
  private listeners: Map<keyof EventBusEvents, Set<EventCallback<EventBusEvents[keyof EventBusEvents]>>> = new Map();

  public on<K extends keyof EventBusEvents>(
    event: K,
    callback: EventCallback<EventBusEvents[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    const callbacks = this.listeners.get(event);
    if (!callbacks) {
      throw new Error(`Failed to get/create listener set for event: ${String(event)}`);
    }
    
    callbacks.add(callback as EventCallback<EventBusEvents[keyof EventBusEvents]>);

    console.log(`🎧 EventBus.on: ${String(event)}`, {
      listenersCount: callbacks.size,
      allEvents: Array.from(this.listeners.keys()),
      callbackFunction: callback.toString().slice(0, 100) // First 100 chars of the function
    });

    // Return unsubscribe function
    return () => {
      const currentCallbacks = this.listeners.get(event);
      if (currentCallbacks) {
        currentCallbacks.delete(callback as EventCallback<EventBusEvents[keyof EventBusEvents]>);
        console.log(`🗑️ EventBus cleanup: ${String(event)}`, {
          remainingListeners: currentCallbacks.size
        });
      }
    };
  }
  

  public emit<K extends keyof EventBusEvents>(event: K, data: EventBusEvents[K]): void {
    console.log(`📣 EventBus.emit: ${String(event)}`, {
      hasListeners: this.listeners.has(event),
      listenersCount: this.listeners.get(event)?.size || 0,
      allEvents: Array.from(this.listeners.keys()),
      data
    });

    const callbacks = this.listeners.get(event);
    if (!callbacks) {
      console.log(`⚠️ No listeners found for event: ${String(event)}`);
      return;
    }
    
    callbacks.forEach(callback => {
      try {
        console.log('📞 Calling listener for:', event);
        callback(data);
        console.log('✅ Listener completed for:', event);
      } catch (error) {
        console.error(`❌ Error in event listener for ${String(event)}:`, error);
      }
    });
  }

  public clear(): void {
    this.listeners.clear();
  }

  public getListenerCount(event: keyof EventBusEvents): number {
    return this.listeners.get(event)?.size || 0;
  }

}
// Create singleton instance
let globalEventBus: EventBus | null = null;

export const getEventBus = () => {
  if (!globalEventBus) {
    console.log('🚌 Creating new EventBus instance');
    globalEventBus = new EventBus();
  }
  return globalEventBus;
};

export type { EventBusEvents };