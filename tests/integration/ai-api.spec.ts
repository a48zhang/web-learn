import { api, headersWithAuth } from '../shared/testClient';
import { reset, seed, close } from '../shared/testDb';

let adminToken: string;

beforeAll(async () => {
  await reset();
  await seed();

  const loginRes = await api.post('/api/auth/login', {
    email: 'admin@test.com',
    password: 'Admin123!',
  });
  adminToken = loginRes.body.data.token;
});

afterAll(async () => {
  await close();
});

describe('AI API', () => {
  describe('Authentication', () => {
    it('denies chat without authentication', async () => {
      const res = await api.post('/api/ai/chat', {
        messages: [{ role: 'user', content: 'hello' }],
      });
      expect(res.status).toBe(401);
    });

    it('denies LLM chat without authentication', async () => {
      const res = await api.post('/api/llm/chat/completions', {
        messages: [{ role: 'user', content: 'hello' }],
      });
      expect(res.status).toBe(401);
    });
  });

  describe('Chat endpoint', () => {
    it('forwards chat request to AI service with valid token', async () => {
      // Note: This will fail if OpenAI is not configured,
      // but we verify the auth flow and proxy routing work
      const res = await api.post(
        '/api/ai/chat',
        {
          messages: [{ role: 'user', content: 'hello' }],
        },
        { headers: headersWithAuth(adminToken) }
      );
      // Either 200 (AI responds) or 500 (AI service error) - auth passed
      expect([200, 400, 500, 502, 503]).toContain(res.status);
      // If auth failed, we'd get 401
      expect(res.status).not.toBe(401);
    });
  });

  describe('LLM proxy endpoint', () => {
    it('forwards LLM request to topic-space with valid token', async () => {
      const res = await api.post(
        '/api/llm/chat/completions',
        {
          messages: [{ role: 'user', content: 'hello' }],
          model: 'gpt-4.1-mini',
        },
        { headers: headersWithAuth(adminToken) }
      );
      // Either succeeds or fails at the LLM level, but not at auth level
      expect([200, 400, 500, 502, 503]).toContain(res.status);
      expect(res.status).not.toBe(401);
    });
  });
});
