// src/lib/config.ts
export const getApiUrl = () => {
  if (typeof window === 'undefined') {
    return process.env.WORKER_URL || 'http://127.0.0.1:8787';
  }
  // Now we can just use relative URLs since Next.js will handle the proxy
  return '';  // Empty string means use current origin
};