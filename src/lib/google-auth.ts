// src/lib/google-auth.ts
import { Env } from '@/types/env';

interface GoogleUserInfo {
    // Required fields
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    // Optional fields
    given_name?: string;
    family_name?: string;
    picture?: string;
    locale?: string;
  }
  
interface GoogleTokens {
    access_token: string;
    id_token: string;
    expires_in: number;
  }

interface GoogleTokenResponse {
    access_token?: string;
    id_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  }

interface GoogleUserResponse {
    id?: string;
    email?: string;
    verified_email?: boolean;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    locale?: string;
    error?: string;
  }
  
export async function getGoogleOAuthURL(env: Env) {
    const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";

    // Always use the main site URL for the redirect
    const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

    const options = {
      redirect_uri: redirectUri,
      client_id: env.GOOGLE_CLIENT_ID || '',
      access_type: "offline",
      response_type: "code",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" "),
    } satisfies Record<string, string>;

    console.log('getGoogleOAuthURL final options:', {
      ...options,
      client_id: options.client_id.substring(0, 10) + '...'
    });

    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
  }
  
export async function getGoogleTokens(code: string, env: Env): Promise<GoogleTokens> {
    const url = "https://oauth2.googleapis.com/token";
    const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

    console.log('getGoogleTokens calculated redirect URI:', redirectUri);
    console.log('env.NEXT_PUBLIC_APP_URL:', env.NEXT_PUBLIC_APP_URL);
    console.log('env.ENVIRONMENT:', env.ENVIRONMENT);

    const values = {
      code,
      client_id: env.GOOGLE_CLIENT_ID || '',
      client_secret: env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    } satisfies Record<string, string>;

    console.log('getGoogleTokens final values:', {
      ...values,
      code: code.substring(0, 10) + '...',
      client_id: values.client_id.substring(0, 10) + '...',
      client_secret: '***'
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(values),
    });
  
    const data = await response.json() as GoogleTokenResponse;

    if (!response.ok) {
        throw new Error(`Google OAuth error: ${response.status} - ${JSON.stringify(data)}`);
    }

    if (
        !data.access_token ||
        !data.id_token ||
        typeof data.access_token !== 'string' ||
        typeof data.id_token !== 'string' ||
        typeof data.expires_in !== 'number'
    ) {
        console.error('Invalid token response format:', data);
        throw new Error('Invalid token response from Google');
    }

    return {
        access_token: data.access_token,
        id_token: data.id_token,
        expires_in: data.expires_in
      };
    }
  
export async function getGoogleUser(
    access_token: string,
    id_token: string
  ): Promise<GoogleUserInfo> {

    const response = await fetch(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`,
      {
        headers: {
          Authorization: `Bearer ${id_token}`,
        },
      }
    );
  
   const data = await response.json() as GoogleUserResponse;

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status} - ${JSON.stringify(data)}`);
  }

  // More detailed type checking
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response format: not an object');
  }

  // Split into required and optional fields
  const requiredFields = [
    'id', 'email', 'verified_email', 'name'
  ] as const;

  const missingFields = requiredFields.filter(field => !(field in data));
  if (missingFields.length > 0) {
    console.error('Missing fields in Google response:', missingFields);
    console.error('Received data:', data);
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  // Type guard for required fields with explicit logging
  const typeChecks = {
    id: typeof data.id === 'string',
    email: typeof data.email === 'string',
    verified_email: typeof data.verified_email === 'boolean',
    name: typeof data.name === 'string',
  };

  const invalidTypes = Object.entries(typeChecks)
    .filter(([_, isValid]) => !isValid)
    .map(([field]) => field);

  if (invalidTypes.length > 0) {
    console.error('Invalid field types:', invalidTypes);
    console.error('Field types:', Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, typeof v])
    ));
    throw new Error(`Invalid field types: ${invalidTypes.join(', ')}`);
  }

  // Construct return object with required fields
  const userInfo: GoogleUserInfo = {
    id: data.id!,
    email: data.email!,
    verified_email: data.verified_email!,
    name: data.name!,
  };

  // Add optional fields if present
  if (typeof data.given_name === 'string') {
    userInfo.given_name = data.given_name;
  }
  if (typeof data.family_name === 'string') {
    userInfo.family_name = data.family_name;
  }
  if (typeof data.locale === 'string') {
    userInfo.locale = data.locale;
  }
  if (typeof data.picture === 'string') {
    userInfo.picture = data.picture;
  }

  return userInfo;
}
