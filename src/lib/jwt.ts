// src/lib/jwt.ts
import { z } from 'zod';
import { Buffer } from 'node:buffer';

export interface JWTPayload {
  sub: string;
  name?: string;
  email?: string;
  iat?: number;
  exp?: number;
  jti?: string;
}

const payloadSchema = z.object({
  sub: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
  jti: z.string().optional()
});

// Validate JWT secret
function validateSecret(secret: string): string {
  if (!secret || typeof secret !== 'string' || secret.length === 0) {
    throw new Error('Invalid JWT secret');
  }
  return secret;
}

// Base64Url encode with UTF-8 support
function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Base64Url decode with UTF-8 support
function base64UrlDecode(str: string): string {
  if (!str || typeof str !== 'string') {
    throw new Error('Invalid base64url string');
  }

  try {
    // Add padding if needed
    const pad = str.length % 4;
    let padded = str;
    if (pad) {
      padded += '='.repeat(4 - pad);
    }
    
    // Replace URL-safe chars and decode
    const normalized = padded.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(normalized, 'base64').toString('utf8');
    
    if (!decoded) {
      throw new Error('Failed to decode base64url string');
    }
    
    return decoded;
  } catch (error) {
    throw new Error(`Base64url decode failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Sign JWT
export async function sign(payload: JWTPayload, secret: string): Promise<string> {
  try {

    // console.log('Signing JWT - Secret:', secret);

    // Validate payload
    payloadSchema.parse(payload);

    // Create header
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    // Create segments
    const headerSegment = base64UrlEncode(JSON.stringify(header));
    const payloadSegment = base64UrlEncode(JSON.stringify(payload));

    // Convert secret to bytes for signing
    const keyData = new TextEncoder().encode(secret);
    
    // Import key
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Sign the data
    const dataToSign = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`);
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      dataToSign
    );

    // Convert signature to base64url
    const signatureSegment = base64UrlEncode(
      String.fromCharCode(...new Uint8Array(signature))
    );

    // Combine segments
    return `${headerSegment}.${payloadSegment}.${signatureSegment}`;
  } catch (error) {
    console.error('JWT signing error details:', {
      error,
      secretLength: secret.length,
      payloadKeys: Object.keys(payload)
    });
    throw error;
  }
}

// Verify and decode JWT
export async function decode(token: string | undefined | null, secret: string): Promise<JWTPayload> {
  // Validate inputs
  if (!token) {
    throw new Error('No token provided');
  }
  
  const validSecret = validateSecret(secret);

  try {
    const segments = token.split('.');
    if (segments.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerSegment, payloadSegment, signatureSegment] = segments;

    // Decode and parse header
    const headerStr = base64UrlDecode(headerSegment);
    const header = JSON.parse(headerStr);
    if (header.alg !== 'HS256') {
      throw new Error('Invalid token algorithm');
    }

    // Decode and validate payload
    const payloadStr = base64UrlDecode(payloadSegment);
    const payload = JSON.parse(payloadStr);
    const validatedPayload = payloadSchema.parse(payload);

    // Import key for verification
    const keyData = new TextEncoder().encode(validSecret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Verify signature
    const dataToVerify = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`);
    const signatureData = Uint8Array.from(
      Buffer.from(base64UrlDecode(signatureSegment), 'binary')
    );

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureData,
      dataToVerify
    );

    if (!isValid) {
      throw new Error('Invalid signature');
    }

    // Check expiration
    if (validatedPayload.exp && validatedPayload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token has expired');
    }

    return validatedPayload;

  } catch (error) {
    // Add context to error message
    const baseError = error instanceof Error ? error.message : 'Token verification failed';
    throw new Error(`JWT verification failed: ${baseError}`);
  }
}

export async function createSessionToken(
  userId: string,
  secret: string,
  name?: string,
  email?: string,
  expiresIn: number = 30 * 24 * 60 * 60 // 30 days in seconds
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const payload: JWTPayload = {
    sub: userId,
    name,
    email,
    iat: now,
    exp: now + expiresIn,
    jti: crypto.randomUUID()
  };

  return sign(payload, secret);
}