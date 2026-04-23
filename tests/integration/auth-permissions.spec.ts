import { api, headersWithAuth } from '../shared/testClient';
import { reset, seed, close } from '../shared/testDb';

beforeAll(async () => {
  await reset();
  await seed();
});

afterAll(async () => {
  await close();
});

describe('Auth & Permissions', () => {
  describe('Token validation', () => {
    it('returns 401 when no token provided for protected endpoint', async () => {
      const res = await api.post('/api/topics', {
        title: 'Unauthorized Topic',
      });
      expect(res.status).toBe(401);
      expect(res.data.success).toBe(false);
    });

    it('returns 401 for invalid token', async () => {
      const res = await api.post(
        '/api/topics',
        { title: 'Bad Token Topic' },
        { headers: { Authorization: 'Bearer invalidtoken123' } }
      );
      expect(res.status).toBe(401);
    });

    it('returns 401 for expired token', async () => {
      // Craft a token that will fail verification (use an obviously expired-like JWT structure)
      // The auth service will verify it and return expired
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxMDAwMDAwMDAwLCJleHAiOjEwMDAwMDAwMDF9.expired';
      const res = await api.post(
        '/api/topics',
        { title: 'Expired Token Topic' },
        { headers: { Authorization: `Bearer ${expiredToken}` } }
      );
      expect(res.status).toBe(401);
    });
  });

  describe('Public access', () => {
    it('allows GET /api/topics without authentication', async () => {
      const res = await api.get('/api/topics');
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    it('allows GET /api/topics/:id for published topics', async () => {
      // First create a published topic as admin
      const loginRes = await api.post('/api/auth/login', {
        email: 'admin@test.com',
        password: 'Admin123!',
      });
      const token = loginRes.data.data.token;

      const createRes = await api.post(
        '/api/topics',
        { title: 'Public Topic' },
        { headers: headersWithAuth(token) }
      );
      const topicId = createRes.data.data.id;

      // Publish it
      await api.patch(
        `/api/topics/${topicId}/status`,
        { status: 'published' },
        { headers: headersWithAuth(token) }
      );

      // Now read without auth
      const res = await api.get(`/api/topics/${topicId}`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.data.title).toBe('Public Topic');
    });

    it('treats invalid token as anonymous access on optional topic detail route', async () => {
      const loginRes = await api.post('/api/auth/login', {
        email: 'admin@test.com',
        password: 'Admin123!',
      });
      const token = loginRes.data.data.token;

      const createRes = await api.post(
        '/api/topics',
        { title: 'Public Topic With Invalid Token' },
        { headers: headersWithAuth(token) }
      );
      const topicId = createRes.data.data.id;

      await api.patch(
        `/api/topics/${topicId}/status`,
        { status: 'published' },
        { headers: headersWithAuth(token) }
      );

      const res = await api.get(`/api/topics/${topicId}`, {
        headers: { Authorization: 'Bearer invalidtoken123' },
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.data.title).toBe('Public Topic With Invalid Token');
    });

    it('allows POST /api/auth/register without authentication', async () => {
      const res = await api.post('/api/auth/register', {
        username: 'newpubuser',
        email: 'newpub@test.com',
        password: 'Newpub123!',
      });
      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);
    });

    it('allows POST /api/auth/login without authentication', async () => {
      const res = await api.post('/api/auth/login', {
        email: 'admin@test.com',
        password: 'Admin123!',
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });
  });

  describe('Protected access', () => {
    it('requires auth to create topics', async () => {
      const res = await api.post('/api/topics', { title: 'No Auth Topic' });
      expect(res.status).toBe(401);
    });

    it('allows topic creation with valid token', async () => {
      const loginRes = await api.post('/api/auth/login', {
        email: 'admin@test.com',
        password: 'Admin123!',
      });
      const token = loginRes.data.data.token;

      const res = await api.post(
        '/api/topics',
        { title: 'Auth Topic', description: 'Test' },
        { headers: headersWithAuth(token) }
      );
      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);
      expect(res.data.data.title).toBe('Auth Topic');
    });

    it('denies topic deletion without auth', async () => {
      const res = await api.delete('/api/topics/999');
      expect(res.status).toBe(401);
    });
  });

  describe('CORS', () => {
    it('allows localhost origins', async () => {
      const res = await api.get('/health', {
        headers: { Origin: 'http://localhost:5173' },
      });
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('rejects non-allowed origins', async () => {
      const res = await api.get('/health', {
        headers: { Origin: 'http://evil.com' },
      });
      // CORS middleware blocks the request or doesn't include the header
      expect(res.headers['access-control-allow-origin']).toBeFalsy();
    });
  });
});
