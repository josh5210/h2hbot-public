// src/middleware/types.ts
import { Request as CloudflareRequest } from '@cloudflare/workers-types';

export interface CloudflareError extends Error {
  status: number;
  code: string;
  context?: Record<string, unknown>;
}

// Request context with error handling
export interface RequestContext {
  request: CloudflareRequest;
  error?: CloudflareError;
}

// Handler type for middleware
export type RequestHandler = (context: RequestContext) => Promise<Response>;

// Middleware type
export type Middleware = (
  handler: RequestHandler
) => RequestHandler;