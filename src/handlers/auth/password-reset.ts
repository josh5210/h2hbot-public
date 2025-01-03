// src/handlers/auth/password-reset.ts
import { Request as CloudflareRequest } from '@cloudflare/workers-types';
import { Env } from '@/types/env';
import { z } from 'zod';
import { query } from '@/lib/db/d1-utils';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { WorkerError } from '@/middleware/error';
import { EmailService } from '@/lib/aws-ses-util';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function handleForgotPassword(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  if (request.method !== 'POST') {
    throw WorkerError.MethodNotAllowed();
  }

  try {
    const body = await request.json();
    const result = forgotPasswordSchema.safeParse(body);

    if (!result.success) {
      throw WorkerError.BadRequest(result.error.errors[0].message);
    }

    const { email } = result.data;

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Update user with reset token
    const updateResult = await query(
      env.DB,
      `
      UPDATE users 
      SET reset_token = ?, reset_token_expires = ?
      WHERE email = ?
      RETURNING id
      `,
      [resetToken, resetTokenExpiry.toISOString(), email]
    );

    if (updateResult.results.length === 0) {
      // Don't reveal if email exists
      return new Response(
        JSON.stringify({ message: 'If an account exists with this email, you will receive password reset instructions.' }),
        { status: 200 }
      );
    }

    // Send reset email
    const emailService = new EmailService(env);
    await emailService.sendPasswordResetEmail(
      email,
      resetToken,
      env.NEXT_PUBLIC_APP_URL
    );

    return new Response(
      JSON.stringify({ 
        message: 'If an account exists with this email, you will receive password reset instructions.',
        resetUrl: process.env.NODE_ENV === 'development' ? `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}` : undefined
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error('Forgot password error:', error);
    if (error instanceof WorkerError) throw error;
    throw WorkerError.Internal('Failed to process forgot password request');
  }
}

export async function handleResetPassword(
  request: CloudflareRequest,
  env: Env
): Promise<Response> {
  if (request.method !== 'POST') {
    throw WorkerError.MethodNotAllowed();
  }

  try {
    const body = await request.json();
    const result = resetPasswordSchema.safeParse(body);

    if (!result.success) {
      throw WorkerError.BadRequest(result.error.errors[0].message);
    }

    const { token, password } = result.data;

    // Find user with valid reset token
    const userResult = await query(
      env.DB,
      `
      SELECT id 
      FROM users 
      WHERE reset_token = ?
        AND reset_token_expires > datetime('now')
      `,
      [token]
    );

    if (userResult.results.length === 0) {
      throw WorkerError.BadRequest('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password and clear reset token
    await query(
      env.DB,
      `
      UPDATE users 
      SET password_hash = ?,
          reset_token = NULL,
          reset_token_expires = NULL
      WHERE reset_token = ?
      `,
      [passwordHash, token]
    );

    return new Response(
      JSON.stringify({ message: 'Password reset successful' }),
      { status: 200 }
    );

  } catch (error) {
    if (error instanceof WorkerError) throw error;
    throw WorkerError.Internal('Failed to reset password');
  }
}