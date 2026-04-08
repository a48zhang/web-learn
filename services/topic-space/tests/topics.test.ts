const mockConfig = {
  port: 3002,
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

jest.mock('../src/services/storageService', () => ({
  getStorageService: jest.fn(() => ({
    uploadBuffer: jest.fn().mockResolvedValue('https://cdn.example.com/test'),
    deleteDir: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    listFiles: jest.fn().mockResolvedValue([]),
    getSize: jest.fn().mockResolvedValue(0),
    getUrl: jest.fn((key: string) => `https://cdn.example.com/${key}`),
  })),
  initStorageService: jest.fn(),
}));

import app from '../src/app';

describe('GET /health', () => {
  it('returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('topic-space');
  });
});

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
          editors: ['2'],
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

    it('returns only published topics for non-editor users', async () => {
      mockTopicModel.findAll.mockResolvedValue([
        { id: 1, title: 'Published', status: 'published', editors: ['2'], created_by: 2, createdAt: new Date('2026-04-01'), updatedAt: new Date('2026-04-01') },
        { id: 2, title: 'Draft', status: 'draft', editors: ['3'], created_by: 3, createdAt: new Date('2026-04-02'), updatedAt: new Date('2026-04-02') },
        { id: 3, title: 'Closed', status: 'closed', editors: ['4'], created_by: 4, createdAt: new Date('2026-04-03'), updatedAt: new Date('2026-04-03') },
      ]);
      (jwt.verify as jest.Mock).mockReturnValue({ id: 5 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 5,
        username: 'viewer',
        email: 'viewer@example.com',
        role: 'user',
      });

      const response = await request(app)
        .get('/api/topics')
        .set('x-user-id', '5')
        .set('x-user-username', 'viewer')
        .set('x-user-email', 'viewer@example.com')
        .set('x-user-role', 'user');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Published');
    });

    it('includes draft topics for editors', async () => {
      mockTopicModel.findAll.mockResolvedValue([
        { id: 1, title: 'Published', status: 'published', editors: ['2'], created_by: 2, createdAt: new Date('2026-04-01'), updatedAt: new Date('2026-04-01') },
        { id: 2, title: 'My Draft', status: 'draft', editors: ['10'], created_by: 10, createdAt: new Date('2026-04-02'), updatedAt: new Date('2026-04-02') },
        { id: 3, title: 'Other Draft', status: 'draft', editors: ['3'], created_by: 3, createdAt: new Date('2026-04-03'), updatedAt: new Date('2026-04-03') },
      ]);
      (jwt.verify as jest.Mock).mockReturnValue({ id: 10 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 10,
        username: 'editor',
        email: 'editor@example.com',
        role: 'user',
      });

      const response = await request(app)
        .get('/api/topics')
        .set('x-user-id', '10')
        .set('x-user-username', 'editor')
        .set('x-user-email', 'editor@example.com')
        .set('x-user-role', 'user');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.map((t: any) => t.title)).toContain('My Draft');
    });

    it('returns all topics for admin users', async () => {
      mockTopicModel.findAll.mockResolvedValue([
        { id: 1, title: 'Published', status: 'published', editors: ['2'], created_by: 2, createdAt: new Date('2026-04-01'), updatedAt: new Date('2026-04-01') },
        { id: 2, title: 'Draft', status: 'draft', editors: ['3'], created_by: 3, createdAt: new Date('2026-04-02'), updatedAt: new Date('2026-04-02') },
        { id: 3, title: 'Closed', status: 'closed', editors: ['4'], created_by: 4, createdAt: new Date('2026-04-03'), updatedAt: new Date('2026-04-03') },
      ]);
      (jwt.verify as jest.Mock).mockReturnValue({ id: 99 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 99,
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
      });

      const response = await request(app)
        .get('/api/topics')
        .set('x-user-id', '99')
        .set('x-user-username', 'admin')
        .set('x-user-email', 'admin@example.com')
        .set('x-user-role', 'admin');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
    });
  });

  describe('POST /api/topics', () => {
    it('creates website topic with type field', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 10 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 10,
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'user',
      });
      mockTopicModel.create.mockResolvedValue({
        id: 7,
        title: 'Website Topic',
        description: 'Testing fundamentals',
        type: 'website',
        website_url: null,
        created_by: 10,
        editors: ['10'],
        status: 'draft',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .post('/api/topics')
        .set('x-user-id', '10')
        .set('x-user-username', 'teacher1')
        .set('x-user-email', 'teacher@example.com')
        .set('x-user-role', 'user')
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
    it('ignores unsupported type field updates', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 10 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 10,
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'user',
      });
      const save = jest.fn();
      mockTopicModel.findByPk.mockResolvedValue({
        id: 8,
        title: 'Website Topic',
        description: 'desc',
        type: 'website',
        website_url: '/test.zip',
        created_by: 10,
        editors: ['10'],
        status: 'draft',
        save,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .put('/api/topics/8')
        .set('x-user-id', '10')
        .set('x-user-username', 'teacher1')
        .set('x-user-email', 'teacher@example.com')
        .set('x-user-role', 'user')
        .send({ type: 'knowledge' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('website');
      expect(save).toHaveBeenCalled();
    });

    it('updates topic for owner teacher', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 10 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 10,
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'user',
      });
      const save = jest.fn();
      mockTopicModel.findByPk.mockResolvedValue({
        id: 7,
        title: 'Old',
        description: 'old',
        type: 'knowledge',
        website_url: null,
        created_by: 10,
        editors: ['10'],
        status: 'draft',
        save,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .put('/api/topics/7')
        .set('x-user-id', '10')
        .set('x-user-username', 'teacher1')
        .set('x-user-email', 'teacher@example.com')
        .set('x-user-role', 'user')
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
        role: 'user',
      });
      const save = jest.fn();
      mockTopicModel.findByPk.mockResolvedValue({
        id: 7,
        title: 'Topic',
        description: 'desc',
        type: 'knowledge',
        website_url: null,
        created_by: 10,
        editors: ['10'],
        status: 'draft',
        save,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .patch('/api/topics/7/status')
        .set('x-user-id', '10')
        .set('x-user-username', 'teacher1')
        .set('x-user-email', 'teacher@example.com')
        .set('x-user-role', 'user')
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
        role: 'user',
      });
      mockTopicModel.findByPk.mockResolvedValue({
        id: 7,
        title: 'Topic',
        description: 'desc',
        type: 'knowledge',
        website_url: null,
        created_by: 10,
        editors: ['10'],
        status: 'draft',
        save: jest.fn(),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .post('/api/topics/7/website/upload')
        .set('x-user-id', '10')
        .set('x-user-username', 'teacher1')
        .set('x-user-email', 'teacher@example.com')
        .set('x-user-role', 'user')
        .send({});

      expect(response.status).toBe(400);
    });

    it('returns website stats for owner teacher', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 10 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 10,
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'user',
      });
      mockTopicModel.findByPk.mockResolvedValue({
        id: 7,
        title: 'Topic',
        description: 'desc',
        type: 'website',
        website_url: null,
        created_by: 10,
        editors: ['10'],
        status: 'draft',
        save: jest.fn(),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .get('/api/topics/7/website/stats')
        .set('x-user-id', '10')
        .set('x-user-username', 'teacher1')
        .set('x-user-email', 'teacher@example.com')
        .set('x-user-role', 'user');

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
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
        role: 'user',
      });
      mockTopicModel.findByPk.mockResolvedValue({
        id: 7,
        title: 'Topic',
        description: 'Testing fundamentals',
        type: 'website',
        website_url: null,
        created_by: 10,
        editors: ['10'],
        status: 'draft',
        save: jest.fn(),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });
      mockTopicModel.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/api/topics/7')
        .set('x-user-id', '10')
        .set('x-user-username', 'teacher1')
        .set('x-user-email', 'teacher@example.com')
        .set('x-user-role', 'user');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
