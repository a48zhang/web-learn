jest.mock('../src/serviceDiscovery', () => ({
  initServiceDiscovery: jest.fn(),
}));

import request from 'supertest';
import createApp from '../src/app';

const app = createApp();

describe('Gateway', () => {
  describe('GET /health', () => {
    it('returns healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.service).toBe('gateway');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('CORS', () => {
    it('allows localhost origins', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });
});
