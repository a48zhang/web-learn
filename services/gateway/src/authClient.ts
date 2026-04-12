import axios from 'axios';
import { getProxyTarget } from './proxyManager';

export interface VerifyRequest {
  token: string;
}

export interface VerifyResponse {
  success: boolean;
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
  error?: string;
}

export async function verifyToken(token: string): Promise<VerifyResponse> {
  const authUrl = getProxyTarget('/api/auth');
  if (!authUrl) {
    return { success: false, error: 'Auth service not available' };
  }

  try {
    const response = await axios.post<VerifyResponse>(
      `${authUrl}/internal/verify`,
      { token },
      { timeout: 5000, headers: { 'Content-Type': 'application/json' } }
    );
    return response.data;
  } catch (error: any) {
    if (error.response) {
      return error.response.data;
    }
    return { success: false, error: 'Auth service unavailable' };
  }
}
