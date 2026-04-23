import { ServiceRegistry } from '../registry';
import app from '../app';
import request from 'supertest';

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  afterEach(() => {
    registry.stop();
  });

  describe('register', () => {
    it('registers a new service', () => {
      const entry = registry.register({
        name: 'test',
        url: 'http://test:3001',
        routes: [
          { path: '/api/test', methods: ['GET'], auth: 'optional' },
        ],
      });
      expect(entry.name).toBe('test');
      expect(entry.url).toBe('http://test:3001');
      expect(entry.routes).toEqual([
        { path: '/api/test', methods: ['GET'], auth: 'optional' },
      ]);
    });

    it('overwrites existing service with same name', () => {
      registry.register({
        name: 'test',
        url: 'http://test:3001',
        routes: [{ path: '/api/test', methods: ['GET'], auth: 'optional' }],
      });
      const entry = registry.register({
        name: 'test',
        url: 'http://test:3002',
        routes: [{ path: '/api/test', methods: ['GET'], auth: 'optional' }],
      });
      expect(entry.url).toBe('http://test:3002');
      expect(entry.registeredAt).toBeDefined();
    });

    it('stores structured route policies on registration', () => {
      const entry = registry.register({
        name: 'topic-space',
        url: 'http://topic:3002',
        routes: [
          {
            path: '/api/topics/:id',
            methods: ['GET'],
            auth: 'optional',
          },
        ],
      });

      expect(entry.routes).toEqual([
        {
          path: '/api/topics/:id',
          methods: ['GET'],
          auth: 'optional',
        },
      ]);
    });

    it('preserves queryRules in route policies', () => {
      const entry = registry.register({
        name: 'topic-space',
        url: 'http://topic:3002',
        routes: [
          {
            path: '/api/topics/:id/git/presign',
            methods: ['GET'],
            auth: 'required',
            queryRules: [
              { when: { op: 'download' }, auth: 'public' },
            ],
          },
        ],
      });

      expect(entry.routes[0].queryRules).toEqual([
        { when: { op: 'download' }, auth: 'public' },
      ]);
    });
  });

  describe('heartbeat', () => {
    it('returns false for unknown service', () => {
      expect(registry.heartbeat('unknown')).toBe(false);
    });

    it('updates lastHeartbeat for known service', () => {
      registry.register({
        name: 'test',
        url: 'http://test:3001',
        routes: [{ path: '/api/test', methods: ['GET'], auth: 'optional' }],
      });
      const before = registry.getAll()[0].lastHeartbeat;
      registry.heartbeat('test');
      const after = registry.getAll()[0].lastHeartbeat;
      expect(after.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('getAll', () => {
    it('returns all registered services', () => {
      registry.register({ name: 'a', url: 'http://a:1', routes: [{ path: '/a', methods: ['GET'], auth: 'optional' }] });
      registry.register({ name: 'b', url: 'http://b:2', routes: [{ path: '/b', methods: ['GET'], auth: 'optional' }] });
      expect(registry.getAll()).toHaveLength(2);
    });

    it('returns empty array when no services', () => {
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('removes expired services', (done) => {
      registry.register({
        name: 'test',
        url: 'http://test:1',
        routes: [{ path: '/test', methods: ['GET'], auth: 'optional' }],
      });
      registry.startCleanup(100, 200);
      setTimeout(() => {
        expect(registry.getAll().length).toBe(0);
        done();
      }, 400);
    });
  });
});

describe('POST /register validation', () => {
  it('rejects routes with invalid auth mode', async () => {
    const res = await request(app)
      .post('/register')
      .send({
        name: 'test',
        url: 'http://test:3001',
        routes: [{ path: '/api/test', methods: ['GET'], auth: 'invalid-mode' }],
      });
    expect(res.status).toBe(400);
  });

  it('rejects routes with missing path', async () => {
    const res = await request(app)
      .post('/register')
      .send({
        name: 'test',
        url: 'http://test:3001',
        routes: [{ methods: ['GET'], auth: 'public' }],
      });
    expect(res.status).toBe(400);
  });

  it('rejects routes with non-array methods', async () => {
    const res = await request(app)
      .post('/register')
      .send({
        name: 'test',
        url: 'http://test:3001',
        routes: [{ path: '/api/test', methods: 'GET', auth: 'public' }],
      });
    expect(res.status).toBe(400);
  });

  it('rejects routes with malformed queryRules', async () => {
    const res = await request(app)
      .post('/register')
      .send({
        name: 'test',
        url: 'http://test:3001',
        routes: [{
          path: '/api/test',
          methods: ['GET'],
          auth: 'required',
          queryRules: [{ when: 'not-an-object', auth: 'public' }],
        }],
      });
    expect(res.status).toBe(400);
  });

  it('accepts valid routes with queryRules', async () => {
    const res = await request(app)
      .post('/register')
      .send({
        name: 'test',
        url: 'http://test:3001',
        routes: [{
          path: '/api/test',
          methods: ['GET'],
          auth: 'required',
          queryRules: [{ when: { op: 'download' }, auth: 'public' }],
        }],
      });
    expect(res.status).toBe(200);
  });
});
