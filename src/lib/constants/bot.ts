// src/lib/constants/bot.ts
export const BOT_USAGE_CONFIG = {
    // Weekly limits
    WEEKLY_LIMIT_FREE: 20,
    WEEKLY_LIMIT_SUBSCRIBED: 200,
    
    // Messages
    LIMIT_WARNING_MESSAGE: "You've reached your weekly limit for @bot usage. Subscribe to get more!",
    LIMIT_REACHED_RESPONSE: `I see you're trying to use @bot, but you've reached your weekly limit.
  
  Want to upgrade? Visit /subscribe to learn more.`,
    
    // Reset timing (UTC)
    RESET_DAY: 0, // Sunday
    RESET_HOUR: 0 // Midnight
  } as const;
  
  // Helper to check if user is within limits
  export function isWithinBotLimit(
    weeklyUses: number,
    isSubscribed: boolean
  ): boolean {
    const limit = isSubscribed ? 
      BOT_USAGE_CONFIG.WEEKLY_LIMIT_SUBSCRIBED : 
      BOT_USAGE_CONFIG.WEEKLY_LIMIT_FREE;
    return weeklyUses < limit;
  }
  
  // Helper to get remaining uses
  export function getRemainingBotUses(
    weeklyUses: number,
    isSubscribed: boolean
  ): number {
    const limit = isSubscribed ? 
      BOT_USAGE_CONFIG.WEEKLY_LIMIT_SUBSCRIBED : 
      BOT_USAGE_CONFIG.WEEKLY_LIMIT_FREE;
    return Math.max(0, limit - weeklyUses);
  }