import request from 'supertest';
import type { Express } from 'express';

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

/**
 * Register a new user through the gateway and return the token
 */
export async function registerUser(app: Express, data: RegisterData): Promise<AuthResult> {
  const res = await request(app)
    .post('/api/auth/register')
    .send(data)
    .expect((r) => {
      if (r.status !== 201) {
        throw new Error(`Registration failed: ${JSON.stringify(r.body)}`);
      }
    });

  return res.body.data;
}

/**
 * Login through the gateway and return the token
 */
export async function loginUser(app: Express, email: string, password: string): Promise<AuthResult> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
    .expect((r) => {
      if (r.status !== 200) {
        throw new Error(`Login failed: ${JSON.stringify(r.body)}`);
      }
    });

  return res.body.data;
}

/**
 * Register a new user and return auth headers object for use in subsequent requests
 */
export async function getAuthHeaders(
  app: Express,
  data: RegisterData
): Promise<Record<string, string>> {
  const { token } = await registerUser(app, data);
  return { Authorization: `Bearer ${token}` };
}

/**
 * Login and return auth headers object
 */
export async function getLoginHeaders(
  app: Express,
  email: string,
  password: string
): Promise<Record<string, string>> {
  const { token } = await loginUser(app, email, password);
  return { Authorization: `Bearer ${token}` };
}
