// /next.config.js
/** @type {import('next').NextConfig} */

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'production'
          ? 'https://h2h.josh5210.workers.dev/api/:path*'
          : 'http://localhost:8787/api/:path*'
      },
      {
        source: '/api/auth/google/callback',
        destination: process.env.NODE_ENV === 'production'
          ? 'https://h2h.josh5210.workers.dev/api/auth/google/callback'
          : 'http://localhost:8787/api/auth/google/callback'  
      }
    ];
  }
};

module.exports = nextConfig;