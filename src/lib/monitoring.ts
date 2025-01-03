// // src/lib/monitoring.ts
// import { D1Database } from '@cloudflare/workers-types';
// import { query } from './db/d1-utils';

// export interface AIInsight {
//   timestamp: Date;
//   conversationId: string;
//   triggerMessage: string;
//   analysis: string;
//   reasoning: string;
//   response: string;
//   metadata?: Record<string, unknown>;
// }

// export interface AIPerformanceMetrics {
//   responseTimeMs: number;
//   tokensUsed?: number;
//   promptLength: number;
//   responseLength: number;
// }

// export class AIMonitoring {
//   private static instance: AIMonitoring;
//   private debugMode: boolean;

//   private constructor() {
//     this.debugMode = process.env.NODE_ENV === 'development';
//   }

//   public static getInstance(): AIMonitoring {
//     if (!AIMonitoring.instance) {
//       AIMonitoring.instance = new AIMonitoring();
//     }
//     return AIMonitoring.instance;
//   }

//   public async logInsight(
//     db: D1Database,
//     insight: AIInsight
//   ) {
//     try {
//       // Store in database
//       await query(
//         db,
//         `
//         INSERT INTO ai_insights (
//           conversation_id,
//           trigger_message,
//           analysis,
//           reasoning,
//           response,
//           metadata,
//           created_at
//         ) VALUES (?, ?, ?, ?, ?, ?, ?)
//         `,
//         [
//           insight.conversationId,
//           insight.triggerMessage,
//           insight.analysis,
//           insight.reasoning,
//           insight.response,
//           JSON.stringify(insight.metadata || {}),
//           insight.timestamp.toISOString()
//         ]
//       );

//       // Development logging
//       if (this.debugMode) {
//         console.log('AI Insight:', {
//           timestamp: insight.timestamp,
//           conversationId: insight.conversationId,
//           analysis: insight.analysis,
//           reasoning: insight.reasoning,
//           response: insight.response.substring(0, 100) + '...' // Truncate for readability
//         });
//       }

//     } catch (error) {
//       console.error('Failed to log AI insight:', error);
//       // Don't throw - monitoring shouldn't break the main flow
//     }
//   }

//   public async logPerformance(
//     db: D1Database,
//     metrics: AIPerformanceMetrics
//   ) {
//     try {
//       await query(
//         db,
//         `
//         INSERT INTO ai_performance_metrics (
//           response_time_ms,
//           tokens_used,
//           prompt_length,
//           response_length,
//           created_at
//         ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
//         `,
//         [
//           metrics.responseTimeMs,
//           metrics.tokensUsed || null,
//           metrics.promptLength,
//           metrics.responseLength
//         ]
//       );

//       if (this.debugMode) {
//         console.log('AI Performance:', metrics);
//       }

//     } catch (error) {
//       console.error('Failed to log AI performance metrics:', error);
//     }
//   }

//   public async getInsightsForConversation(
//     db: D1Database,
//     conversationId: string,
//     limit: number = 10
//   ) {
//     try {
//       const result = await query(
//         db,
//         `
//         SELECT * FROM ai_insights
//         WHERE conversation_id = ?
//         ORDER BY created_at DESC
//         LIMIT ?
//         `,
//         [conversationId, limit]
//       );
//       return result.results;
//     } catch (error) {
//       console.error('Failed to fetch AI insights:', error);
//       return [];
//     }
//   }

//   public async getPerformanceMetrics(
//     db: D1Database,
//     timeframe: 'hour' | 'day' | 'week' = 'day'
//   ) {
//     try {
//       const timeframeMap = {
//         hour: "-1 hours",
//         day: "-1 days",
//         week: "-7 days"
//       };

//       const result = await query(
//         db,
//         `
//         SELECT 
//           AVG(response_time_ms) as avg_response_time,
//           AVG(tokens_used) as avg_tokens,
//           COUNT(*) as total_requests,
//           MAX(response_time_ms) as max_response_time
//         FROM ai_performance_metrics
//         WHERE created_at > datetime('now', ?)
//         `,
//         [timeframeMap[timeframe]]
//       );
      
//       return result.results[0];
//     } catch (error) {
//       console.error('Failed to fetch performance metrics:', error);
//       return null;
//     }
//   }
// }

// // Schema creation function
// export async function createMonitoringTables(db: D1Database) {
//   try {
//     // Create AI insights table
//     await query(
//       db,
//       `
//       CREATE TABLE IF NOT EXISTS ai_insights (
//         id INTEGER PRIMARY KEY AUTOINCREMENT,
//         conversation_id TEXT NOT NULL,
//         trigger_message TEXT NOT NULL,
//         analysis TEXT NOT NULL,
//         reasoning TEXT NOT NULL,
//         response TEXT NOT NULL,
//         metadata TEXT DEFAULT '{}',
//         created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//       )
//       `
//     );

//     // Create AI performance metrics table
//     await query(
//       db,
//       `
//       CREATE TABLE IF NOT EXISTS ai_performance_metrics (
//         id INTEGER PRIMARY KEY AUTOINCREMENT,
//         response_time_ms INTEGER NOT NULL,
//         tokens_used INTEGER,
//         prompt_length INTEGER NOT NULL,
//         response_length INTEGER NOT NULL,
//         created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//       )
//       `
//     );

//     // Create indexes for better query performance
//     await query(
//       db,
//       'CREATE INDEX IF NOT EXISTS idx_ai_insights_conversation_id ON ai_insights(conversation_id)'
//     );
    
//     await query(
//       db,
//       'CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at ON ai_insights(created_at)'
//     );
    
//     await query(
//       db,
//       'CREATE INDEX IF NOT EXISTS idx_ai_performance_created_at ON ai_performance_metrics(created_at)'
//     );

//     console.log('AI monitoring tables created successfully');
//   } catch (error) {
//     console.error('Error creating AI monitoring tables:', error);
//     throw error;
//   }
// }

// // Helper function for simple insight logging
// export async function logAIInsight(db: D1Database, insight: AIInsight) {
//   return AIMonitoring.getInstance().logInsight(db, insight);
// }

// // Helper function for simple performance logging
// export async function logAIPerformance(db: D1Database, metrics: AIPerformanceMetrics) {
//   return AIMonitoring.getInstance().logPerformance(db, metrics);
// }