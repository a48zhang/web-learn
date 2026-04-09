import { api, authHeader } from '../shared/testClient';
import { registerUser, loginUser, reset, seed, close } from '../shared/testDb';

beforeAll(async () => {
  await reset();
  await seed();
});

afterAll(async () => {
  await close();
});

describe('Gateway Routing', () => {
  describe('Proxy routing', () => {
    it('routes /api/auth/login to auth service', async () => {
      const res = await api.post('/api/auth/login', {
        email: 'admin@test.com',
        password: 'Admin123!',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('routes /api/auth/register to auth service', async () => {
      const res = await api.post('/api/auth/register', {
        username: 'routingtest',
        email: 'routing@test.com',
        password: 'Routing123!',
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('routes /api/topics to topic-space service', async () => {
      const res = await api.get('/api/topics');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 404 for unknown routes', async () => {
      const res = await api.get('/api/unknown/route');
      expect(res.status).toBe(404);
    });
  });

  describe('Response passthrough', () => {
    it('preserves status codes from downstream services', async () => {
      const res = await api.get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.service).toBe('gateway');
    });
  });
});
