import { api, headersWithAuth } from '../shared/testClient';
import { reset, seed, close } from '../shared/testDb';

let adminToken: string;
let userToken: string;

beforeAll(async () => {
  await reset();
  await seed();

  const adminLogin = await api.post('/api/auth/login', {
    email: 'admin@test.com',
    password: 'Admin123!',
  });
  adminToken = adminLogin.body.data.token;

  const userLogin = await api.post('/api/auth/login', {
    email: 'user@test.com',
    password: 'User123!',
  });
  userToken = userLogin.body.data.token;
});

afterAll(async () => {
  await close();
});

describe('Topic Space API', () => {
  describe('Topic CRUD', () => {
    it('creates a topic and returns 201', async () => {
      const res = await api.post(
        '/api/topics',
        { title: 'Test Topic', description: 'Test Description' },
        { headers: headersWithAuth(adminToken) }
      );
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Test Topic');
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.editors).toContain('1');
    });

    it('lists topics', async () => {
      const res = await api.get('/api/topics', {
        headers: headersWithAuth(adminToken),
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('gets a single topic by ID', async () => {
      const createRes = await api.post(
        '/api/topics',
        { title: 'Single Topic' },
        { headers: headersWithAuth(adminToken) }
      );
      const topicId = createRes.body.data.id;

      const res = await api.get(`/api/topics/${topicId}`, {
        headers: headersWithAuth(adminToken),
      });
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Single Topic');
    });

    it('updates a topic', async () => {
      const createRes = await api.post(
        '/api/topics',
        { title: 'Update Me' },
        { headers: headersWithAuth(adminToken) }
      );
      const topicId = createRes.body.data.id;

      const res = await api.put(
        `/api/topics/${topicId}`,
        { title: 'Updated Title', description: 'Updated Desc' },
        { headers: headersWithAuth(adminToken) }
      );
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Title');
      expect(res.body.data.description).toBe('Updated Desc');
    });

    it('updates topic status (publish)', async () => {
      const createRes = await api.post(
        '/api/topics',
        { title: 'Publish Me' },
        { headers: headersWithAuth(adminToken) }
      );
      const topicId = createRes.body.data.id;

      const res = await api.patch(
        `/api/topics/${topicId}/status`,
        { status: 'published' },
        { headers: headersWithAuth(adminToken) }
      );
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('published');
    });

    it('deletes a topic', async () => {
      const createRes = await api.post(
        '/api/topics',
        { title: 'Delete Me' },
        { headers: headersWithAuth(adminToken) }
      );
      const topicId = createRes.body.data.id;

      const res = await api.delete(`/api/topics/${topicId}`, {
        headers: headersWithAuth(adminToken),
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Access control', () => {
    it('denies non-owner from editing a topic', async () => {
      const createRes = await api.post(
        '/api/topics',
        { title: 'User Topic' },
        { headers: headersWithAuth(userToken) }
      );
      const topicId = createRes.body.data.id;

      const res = await api.put(
        `/api/topics/${topicId}`,
        { title: 'Hacked' },
        { headers: headersWithAuth(adminToken) }
      );
      expect(res.status).toBe(403);
    });
  });
});
