// src/types/env.ts
import { D1Database } from '@cloudflare/workers-types';

export interface Env {
  // D1 database binding
  DB: D1Database;
  
  // Environment variables
  NEXTAUTH_URL: string;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ANTHROPIC_API_KEY: string;
  NEXT_PUBLIC_APP_URL: string;
  ENVIRONMENT: string;

  NEXT_PUBLIC_WS_URL: string;

  // Turnstile protection
  TURNSTILE_SECRET_KEY: string;

  // Durable Object binding
  CHAT_CONNECTION: DurableObjectNamespace;

  // AWS SES configuration
  AWS_REGION: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_SES_FROM_ADDRESS: string;
}