// src/middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Allow Next.js static files and images
  if (request.nextUrl.pathname.startsWith('/_next/') || 
      request.nextUrl.pathname.startsWith('/static/') ||
      request.nextUrl.pathname.match(/\.(jpg|jpeg|png|gif|ico|svg)$/)) {
    return NextResponse.next();
  }
  const authToken = request.cookies.get('auth-token');

  const isAuthPath = request.nextUrl.pathname.startsWith('/api/auth');
  const isPublicPath = request.nextUrl.pathname.match(/^\/(login|signup|forgot-password|reset-password|invite)/);

  // Allow auth-related and public paths
  if (isAuthPath || isPublicPath) {
    return NextResponse.next();
  }

  // Redirect to login if no auth token
  if (!authToken) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protected routes
    '/chat/:path*',
    '/api/chat/messages/:path*',
    '/api/chat/[chatId]/:path*',
    // Exclude these routes from protection
    '/((?!_next|static|api/socket|api/chat/invite|login|signup|forgot-password|reset-password|invite|about|$).*)',
  ],
};