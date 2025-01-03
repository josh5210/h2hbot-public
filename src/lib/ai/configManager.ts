// src/lib/ai/configManager.ts
import { AIConfig, CHAT_AI_CONFIG, DEBUGGING_AI_CONFIG, QUICK_AI_CONFIG } from './config';

export type ConfigType = 'default' | 'debug' | 'quick';

export class AIConfigManager {
  private static instance: AIConfigManager;
  private currentConfig: AIConfig;

  private constructor() {
    this.currentConfig = CHAT_AI_CONFIG;
  }

  public static getInstance(): AIConfigManager {
    if (!AIConfigManager.instance) {
      AIConfigManager.instance = new AIConfigManager();
    }
    return AIConfigManager.instance;
  }

  public getConfig(): AIConfig {
    return this.currentConfig;
  }

  public setConfig(type: ConfigType): void {
    switch (type) {
      case 'debug':
        this.currentConfig = DEBUGGING_AI_CONFIG;
        break;
      case 'quick':
        this.currentConfig = QUICK_AI_CONFIG;
        break;
      default:
        this.currentConfig = CHAT_AI_CONFIG;
    }
  }

  public updateSystemPrompt(newPrompt: string): void {
    this.currentConfig = {
      ...this.currentConfig,
      systemPrompt: newPrompt
    };
  }
}