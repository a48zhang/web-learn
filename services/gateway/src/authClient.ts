import axios from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

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
  try {
    const response = await axios.post<VerifyResponse>(
      `${AUTH_SERVICE_URL}/internal/verify`,
      { token },
      {
        timeout: 5000, // 5 second timeout
        headers: { 'Content-Type': 'application/json' }
      }
    );
    return response.data;
  } catch (error: any) {
    if (error.response) {
      return error.response.data;
    }
    // Network error or timeout
    return {
      success: false,
      error: 'Auth service unavailable'
    };
  }
}