import { ServiceRegistry } from '../registry';

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
        routes: ['/api/test'],
      });
      expect(entry.name).toBe('test');
      expect(entry.url).toBe('http://test:3001');
      expect(entry.routes).toEqual(['/api/test']);
    });

    it('overwrites existing service with same name', () => {
      registry.register({ name: 'test', url: 'http://test:3001', routes: ['/api/test'] });
      const entry = registry.register({ name: 'test', url: 'http://test:3002', routes: ['/api/test'] });
      expect(entry.url).toBe('http://test:3002');
      expect(entry.registeredAt).toBeDefined();
    });
  });

  describe('heartbeat', () => {
    it('returns false for unknown service', () => {
      expect(registry.heartbeat('unknown')).toBe(false);
    });

    it('updates lastHeartbeat for known service', () => {
      registry.register({ name: 'test', url: 'http://test:3001', routes: ['/api/test'] });
      const before = registry.getAll()[0].lastHeartbeat;
      registry.heartbeat('test');
      const after = registry.getAll()[0].lastHeartbeat;
      expect(after.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('getAll', () => {
    it('returns all registered services', () => {
      registry.register({ name: 'a', url: 'http://a:1', routes: ['/a'] });
      registry.register({ name: 'b', url: 'http://b:2', routes: ['/b'] });
      expect(registry.getAll()).toHaveLength(2);
    });

    it('returns empty array when no services', () => {
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('removes expired services', (done) => {
      registry.register({ name: 'test', url: 'http://test:1', routes: ['/test'] });
      registry.startCleanup(100, 200);
      setTimeout(() => {
        expect(registry.getAll().length).toBe(0);
        done();
      }, 400);
    });
  });
});
