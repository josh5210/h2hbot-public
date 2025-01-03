// src/middleware/error.ts
import { Request as CloudflareRequest } from '@cloudflare/workers-types';
import { CloudflareError } from './types';

export class WorkerError extends Error implements CloudflareError {
  public readonly status: number;
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string, 
    status: number = 500, 
    code: string = 'INTERNAL_SERVER_ERROR',
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WorkerError';
    this.status = status;
    this.code = code;
    this.context = context;
  }

  static BadRequest(message: string, context?: Record<string, unknown>) {
    return new WorkerError(message, 400, 'BAD_REQUEST', context);
  }

  static Unauthorized(message: string = 'Unauthorized', context?: Record<string, unknown>) {
    return new WorkerError(message, 401, 'UNAUTHORIZED', context);
  }

  static Forbidden(message: string = 'Forbidden', context?: Record<string, unknown>) {
    return new WorkerError(message, 403, 'FORBIDDEN', context);
  }

  static NotFound(message: string = 'Not Found', context?: Record<string, unknown>) {
    return new WorkerError(message, 404, 'NOT_FOUND', context);
  }

  static RateLimit(message: string = 'Rate limit exceeded', context?: Record<string, unknown>) {
    return new WorkerError(message, 429, 'RATE_LIMIT_EXCEEDED', context);
  }

  static Database(message: string = 'Database error', context?: Record<string, unknown>) {
    return new WorkerError(message, 500, 'DATABASE_ERROR', context);
  }

  static MethodNotAllowed(message: string = 'Method not allowed', context?: Record<string, unknown>) {
    return new WorkerError(message, 405, 'METHOD_NOT_ALLOWED', context);
  }

  static Internal(message: string = 'Internal server error', context?: Record<string, unknown>) {
    return new WorkerError(message, 500, 'INTERNAL', context);
  }
}

// Error response formatter
function formatErrorResponse(error: Error | CloudflareError) {
  if (error instanceof WorkerError) {
    return {
      error: {
        message: error.message,
        code: error.code,
        ...(error.context && { context: error.context })
      },
      status: error.status
    };
  }

  // Handle unknown errors
  console.error('Unhandled error:', error);
  return {
    error: {
      message: 'An unexpected error occurred',
      code: 'INTERNAL_SERVER_ERROR'
    },
    status: 500
  };
}

// Error handler middleware
export async function errorHandler(
  _request: CloudflareRequest,
  handler: () => Promise<Response>
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    const { error: formattedError, status } = formatErrorResponse(error as Error);
    
    return new Response(
      JSON.stringify(formattedError),
      {
        status,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}