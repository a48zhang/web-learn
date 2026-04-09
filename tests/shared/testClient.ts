import axios from 'axios';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: GATEWAY_URL,
  validateStatus: () => true, // Don't throw on any status code
});

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function headersWithAuth(token: string, extra?: Record<string, string>) {
  return {
    ...authHeader(token),
    'Content-Type': 'application/json',
    ...extra,
  };
}
