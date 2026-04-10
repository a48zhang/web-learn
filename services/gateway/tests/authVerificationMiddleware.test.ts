// Mock proxy first so createApp doesn't try to connect to real services
jest.mock('../src/proxy', () => ({
  createProxies: () => ({
    auth: (_req: any, _res: any, next: any) => next(),
    topicSpace: (_req: any, _res: any, next: any) => next(),
    ai: (_req: any, _res: any, next: any) => next(),
  }),
}));

// Mock authClient so verifyToken is fully under test control
const mockVerifyToken = jest.fn();
jest.mock('../src/authClient', () => ({
  verifyToken: (...args: any[]) => mockVerifyToken(...args),
}));

import request from 'supertest';
import createApp from '../src/app';

const app = createApp();

const VALID_USER = {
  id: 1,
  username: 'alice',
  email: 'alice@example.com',
  role: 'user',
};

describe('authVerificationMiddleware', () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── Fully-public paths (no auth needed at all) ───────────────────────────

  describe('fully-public paths', () => {
    it('allows GET /health without a token', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it('allows POST /api/auth/login without a token', async () => {
      // The proxy mock calls next(), which hits the 404 handler – that is fine;
      // what matters is that the middleware did NOT return 401.
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).not.toBe(401);
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it('allows POST /api/auth/register without a token', async () => {
      const res = await request(app).post('/api/auth/register').send({});
      expect(res.status).not.toBe(401);
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });
  });

  // ─── Public-read GET paths (no token required) ────────────────────────────

  describe('public read paths', () => {
    it('allows GET /api/topics (list) without a token', async () => {
      const res = await request(app).get('/api/topics');
      expect(res.status).not.toBe(401);
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it('allows GET /api/topics/:id without a token', async () => {
      const res = await request(app).get('/api/topics/42');
      expect(res.status).not.toBe(401);
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it('allows GET /api/topics/:id/pages without a token', async () => {
      const res = await request(app).get('/api/topics/42/pages');
      expect(res.status).not.toBe(401);
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it('allows GET /api/pages/:id without a token', async () => {
      const res = await request(app).get('/api/pages/7');
      expect(res.status).not.toBe(401);
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it('blocks POST /api/topics without a token (write is protected)', async () => {
      const res = await request(app).post('/api/topics').send({ title: 'x' });
      expect(res.status).toBe(401);
    });
  });

  // ─── Protected paths without token ───────────────────────────────────────

  describe('protected paths – no token', () => {
    it('returns 401 for POST /api/topics without a token', async () => {
      const res = await request(app).post('/api/topics').send({});
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 for DELETE /api/topics/:id without a token', async () => {
      const res = await request(app).delete('/api/topics/1');
      expect(res.status).toBe(401);
    });

    it('returns 401 for GET /api/users/me without a token', async () => {
      const res = await request(app).get('/api/users/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 for POST /api/ai/chat without a token', async () => {
      const res = await request(app).post('/api/ai/chat').send({});
      expect(res.status).toBe(401);
    });
  });

  // ─── Valid token ──────────────────────────────────────────────────────────

  describe('valid token', () => {
    it('injects user headers and passes request through', async () => {
      mockVerifyToken.mockResolvedValue({ success: true, user: VALID_USER });

      const res = await request(app)
        .post('/api/topics')
        .set('Authorization', 'Bearer valid-token')
        .send({ title: 'New Topic' });

      expect(mockVerifyToken).toHaveBeenCalledWith('valid-token');
      // Proxy mock calls next(); in test env the 404 handler returns 404, not 401
      expect(res.status).not.toBe(401);
    });
  });

  // ─── Invalid / expired token ──────────────────────────────────────────────

  describe('invalid token', () => {
    it('returns 401 when the auth service reports an invalid token', async () => {
      mockVerifyToken.mockResolvedValue({ success: false, error: 'Invalid token' });

      const res = await request(app)
        .post('/api/topics')
        .set('Authorization', 'Bearer bad-token')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid token');
    });

    it('returns 401 when the auth service reports token expired', async () => {
      mockVerifyToken.mockResolvedValue({ success: false, error: 'Token expired' });

      const res = await request(app)
        .delete('/api/topics/99')
        .set('Authorization', 'Bearer expired-token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Token expired');
    });

    it('allows invalid token on public-read path (passes through without user headers)', async () => {
      mockVerifyToken.mockResolvedValue({ success: false, error: 'Invalid token' });

      // An invalid token on a public GET should still be allowed through
      // (the downstream service sees no user context headers)
      const res = await request(app)
        .get('/api/topics')
        .set('Authorization', 'Bearer stale-token');

      expect(res.status).not.toBe(401);
    });
  });

  // ─── Auth service unavailable ─────────────────────────────────────────────

  describe('auth service unavailable', () => {
    it('returns 503 for protected route when auth service throws', async () => {
      mockVerifyToken.mockRejectedValue(new Error('connection refused'));

      const res = await request(app)
        .post('/api/topics')
        .set('Authorization', 'Bearer some-token')
        .send({});

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('Auth service unavailable');
    });

    it('passes through on public-read path even when auth service throws', async () => {
      mockVerifyToken.mockRejectedValue(new Error('connection refused'));

      const res = await request(app)
        .get('/api/topics/5')
        .set('Authorization', 'Bearer some-token');

      expect(res.status).not.toBe(503);
      expect(res.status).not.toBe(401);
    });
  });
});
