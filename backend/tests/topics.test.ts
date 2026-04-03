const mockConfig = {
  port: 3001,
  jwt: {
    secret: 'test-secret',
    expiresIn: '7d',
  },
  cors: {
    origins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  },
  database: {
    host: 'localhost',
    port: 3306,
    name: 'web_learn',
    user: 'root',
    password: '',
  },
  ai: {
    apiKey: 'test-key',
    baseUrl: '',
    model: 'test-model',
  },
  uploadsDir: '/tmp/web-learn-test-uploads',
};

jest.mock('../src/utils/config', () => ({
  config: mockConfig,
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockUserModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  findByPk: jest.fn(),
};

const mockTopicModel = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
};

const mockPageModel = {
  findByPk: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  destroy: jest.fn(),
};

jest.mock('../src/models', () => ({
  User: mockUserModel,
  Topic: mockTopicModel,
  TopicPage: mockPageModel,
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
  TokenExpiredError: class TokenExpiredError extends Error {},
  JsonWebTokenError: class JsonWebTokenError extends Error {},
}));

import app from '../src/app';

describe('Topics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/topics', () => {
    it('allows public access and returns published topics', async () => {
      mockTopicModel.findAll.mockResolvedValue([
        {
          id: 1,
          title: 'Public Topic',
          description: 'desc',
          type: 'knowledge',
          website_url: null,
          created_by: 2,
          status: 'published',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-01T00:00:00.000Z'),
          creator: { id: 2, username: 'teacher', email: 'teacher@example.com' },
        },
      ]);

      const response = await request(app).get('/api/topics');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[0]).toMatchObject({
        id: '1',
        type: 'knowledge',
      });
    });
  });

  describe('POST /api/topics', () => {
    it('creates website topic with type field', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 10 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 10,
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'teacher',
      });
      mockTopicModel.create.mockResolvedValue({
        id: 7,
        title: 'Website Topic',
        description: 'Testing fundamentals',
        type: 'website',
        website_url: 'https://example.com',
        created_by: 10,
        status: 'draft',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .post('/api/topics')
        .set('Authorization', 'Bearer teacher-token')
        .send({
          title: 'Website Topic',
          description: 'Testing fundamentals',
          type: 'website',
          website_url: 'https://example.com',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: '7',
        type: 'website',
        websiteUrl: 'https://example.com',
      });
    });
  });
});
