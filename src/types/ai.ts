// src/types/ai.ts
export interface AIResponse {
    messageContent: string;
    devInsights: {
      conversationAnalysis: string;
      userBehavior: string;
      suggestedImprovements: string;
      technicalNotes: string;
    };
  }
  
  export interface AIPerformanceMetrics {
    responseTimeMs: number;
    tokensUsed?: number;
    promptLength: number;
    responseLength: number;
}