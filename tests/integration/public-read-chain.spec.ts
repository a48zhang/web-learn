import { api, headersWithAuth } from '../shared/testClient';
import { reset, seed, close } from '../shared/testDb';

let adminToken: string;
let publishedTopicId: string;
let publishedPageId: string;

beforeAll(async () => {
  await reset();
  await seed();

  const loginRes = await api.post('/api/auth/login', {
    email: 'admin@test.com',
    password: 'Admin123!',
  });
  adminToken = loginRes.data.data.token;

  const topicRes = await api.post(
    '/api/topics',
    { title: 'Public Read Topic', description: 'Cross-service public-read chain test' },
    { headers: headersWithAuth(adminToken) }
  );
  expect(topicRes.status).toBe(201);
  publishedTopicId = topicRes.data.data.id;

  const pageRes = await api.post(
    `/api/topics/${publishedTopicId}/pages`,
    { title: 'Public Read Page', content: '<p>public content</p>' },
    { headers: headersWithAuth(adminToken) }
  );
  expect(pageRes.status).toBe(201);
  publishedPageId = pageRes.data.data.id;

  const publishRes = await api.patch(
    `/api/topics/${publishedTopicId}/status`,
    { status: 'published' },
    { headers: headersWithAuth(adminToken) }
  );
  expect(publishRes.status).toBe(200);
  expect(publishRes.data.data.status).toBe('published');
});

afterAll(async () => {
  await close();
});

describe('Cross-service public-read chain via gateway', () => {
  it('allows unauthenticated read of published topic detail through gateway -> topic-space', async () => {
    const res = await api.get(`/api/topics/${publishedTopicId}`);

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.id).toBe(publishedTopicId);
  });

  it('allows unauthenticated read of published topic pages list through gateway -> topic-space', async () => {
    const res = await api.get(`/api/topics/${publishedTopicId}/pages`);

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(Array.isArray(res.data.data)).toBe(true);
  });

  it('allows unauthenticated read of published page detail through gateway -> topic-space', async () => {
    const res = await api.get(`/api/pages/${publishedPageId}`);

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.id).toBe(publishedPageId);
  });

  it('still blocks unauthenticated write through gateway auth verification', async () => {
    const res = await api.post('/api/topics', {
      title: 'should fail without auth',
    });

    expect(res.status).toBe(401);
    expect(res.data.success).toBe(false);
    expect(typeof res.data.error).toBe('string');
  });
});
