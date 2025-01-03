// src/handlers/bot-usage.ts
import { Request as CloudflareRequest } from '@cloudflare/workers-types';
import { Env } from '@/types/env';
import { getServerSession } from '@/lib/session';
import { WorkerError } from '@/middleware/error';
import { getBotUsage, incrementBotUsage } from '@/lib/db/bot-usage';

export async function handleGetBotUsage(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  const session = await getServerSession(request, env.JWT_SECRET);
  if (!session?.user?.id) {
    throw WorkerError.Unauthorized();
  }

  const usage = await getBotUsage(env.DB, Number(session.user.id));
  
  return new Response(
    JSON.stringify(usage),
    { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

export async function handleIncrementBotUsage(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  const session = await getServerSession(request, env.JWT_SECRET);
  if (!session?.user?.id) {
    throw WorkerError.Unauthorized();
  }

  const usage = await incrementBotUsage(env.DB, Number(session.user.id));
  
  return new Response(
    JSON.stringify(usage),
    { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}