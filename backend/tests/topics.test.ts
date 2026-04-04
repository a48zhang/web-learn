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

const mockSequelize = {
  transaction: jest.fn(async (handler: (tx: unknown) => Promise<unknown>) => handler({})),
};

jest.mock('../src/utils/database', () => ({
  sequelize: mockSequelize,
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
  destroy: jest.fn(),
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
        website_url: null,
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
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: '7',
        type: 'website',
        websiteUrl: null,
      });
    });
  });

  describe('PUT /api/topics/:id', () => {
    it('rejects type switch from website to knowledge when website_url is set', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 10 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 10,
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'teacher',
      });
      mockTopicModel.findByPk.mockResolvedValue({
        id: 8,
        title: 'Website Topic',
        description: 'desc',
        type: 'website',
        website_url: '/test.zip',
        created_by: 10,
        status: 'draft',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .put('/api/topics/8')
        .set('Authorization', 'Bearer teacher-token')
        .send({ type: 'knowledge' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('已有网站内容的专题不能切换为其他类型');
    });

    it('updates topic for owner teacher', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 10 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 10,
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'teacher',
      });
      const save = jest.fn();
      mockTopicModel.findByPk.mockResolvedValue({
        id: 7,
        title: 'Old',
        description: 'old',
        type: 'knowledge',
        website_url: null,
        created_by: 10,
        status: 'draft',
        save,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .put('/api/topics/7')
        .set('Authorization', 'Bearer teacher-token')
        .send({
          title: 'New',
          description: 'new-desc',
        });

      expect(response.status).toBe(200);
      expect(save).toHaveBeenCalled();
      expect(response.body.data.title).toBe('New');
    });
  });

  describe('PATCH /api/topics/:id/status', () => {
    it('updates topic status for owner teacher', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 10 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 10,
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'teacher',
      });
      const save = jest.fn();
      mockTopicModel.findByPk.mockResolvedValue({
        id: 7,
        title: 'Topic',
        description: 'desc',
        type: 'knowledge',
        website_url: null,
        created_by: 10,
        status: 'draft',
        save,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .patch('/api/topics/7/status')
        .set('Authorization', 'Bearer teacher-token')
        .send({ status: 'published' });

      expect(response.status).toBe(200);
      expect(save).toHaveBeenCalled();
      expect(response.body.data.status).toBe('published');
    });
  });

  describe('Website endpoints', () => {
    it('rejects upload for non-website topic', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 10 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 10,
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'teacher',
      });
      mockTopicModel.findByPk.mockResolvedValue({
        id: 7,
        title: 'Topic',
        description: 'desc',
        type: 'knowledge',
        website_url: null,
        created_by: 10,
        status: 'draft',
        save: jest.fn(),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .post('/api/topics/7/website/upload')
        .set('Authorization', 'Bearer teacher-token')
        .send({});

      expect(response.status).toBe(400);
    });

    it('returns website stats for owner teacher', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 10 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 10,
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'teacher',
      });
      mockTopicModel.findByPk.mockResolvedValue({
        id: 7,
        title: 'Topic',
        description: 'desc',
        type: 'website',
        website_url: null,
        created_by: 10,
        status: 'draft',
        save: jest.fn(),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .get('/api/topics/7/website/stats')
        .set('Authorization', 'Bearer teacher-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        topicId: '7',
        fileCount: 0,
        totalSize: 0,
      });
    });
  });

  describe('DELETE /api/topics/:id', () => {
    it('deletes topic for owner teacher', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 10 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 10,
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'teacher',
      });
      mockTopicModel.findByPk.mockResolvedValue({
        id: 7,
        title: 'Topic',
        description: 'Testing fundamentals',
        type: 'website',
        website_url: null,
        created_by: 10,
        status: 'draft',
        save: jest.fn(),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });
      mockTopicModel.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/api/topics/7')
        .set('Authorization', 'Bearer teacher-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
