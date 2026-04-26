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
  storage: {
    provider: 'null',
    azure: {
      connectionString: '',
      containerName: 'web-learn-files',
      sasExpiryHours: 1,
    },
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

const getPresignedUrlMock = jest.fn().mockResolvedValue({
  url: 'http://localhost:3002/storage/dev/test',
  method: 'GET',
});

const mockStorageService = {
  uploadBuffer: jest.fn().mockResolvedValue('https://cdn.example.com/test'),
  deleteDir: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  listFiles: jest.fn().mockResolvedValue([]),
  getSize: jest.fn().mockResolvedValue(0),
  getUrl: jest.fn((key: string) => `https://cdn.example.com/${key}`),
  getPresignedUrl: getPresignedUrlMock,
};

jest.mock('../src/models', () => ({
  User: mockUserModel,
  Topic: mockTopicModel,
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
  TokenExpiredError: class TokenExpiredError extends Error {},
  JsonWebTokenError: class JsonWebTokenError extends Error {},
}));

jest.mock('../src/services/storageService', () => ({
  getStorageService: jest.fn(() => mockStorageService),
  initStorageService: jest.fn(),
}));

import app from '../src/app';

const UUID_1 = '550e8400-e29b-41d4-a716-446655440001';
const UUID_2 = '550e8400-e29b-41d4-a716-446655440002';
const UUID_3 = '550e8400-e29b-41d4-a716-446655440003';

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
    getPresignedUrlMock.mockResolvedValue({
      url: 'http://localhost:3002/storage/dev/test',
      method: 'GET',
    });
  });

  describe('GET /api/topics', () => {
    it('allows public access and returns published topics', async () => {
      mockTopicModel.findAll.mockResolvedValue([
        {
          id: UUID_1,
          title: 'Public Topic',
          description: 'desc',
          type: 'website',
          created_by: UUID_2,
          editors: [UUID_2],
          status: 'published',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-01T00:00:00.000Z'),
          creator: { id: UUID_2, username: 'teacher', email: 'teacher@example.com' },
        },
      ]);

      const response = await request(app).get('/api/topics');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[0]).toMatchObject({
        id: UUID_1,
        type: 'website',
      });
    });

    it('returns only published topics for non-editor users', async () => {
      mockTopicModel.findAll.mockResolvedValue([
        { id: UUID_1, title: 'Published', status: 'published', editors: [UUID_2], created_by: UUID_2, createdAt: new Date('2026-04-01'), updatedAt: new Date('2026-04-01') },
        { id: UUID_2, title: 'Draft', status: 'draft', editors: [UUID_3], created_by: UUID_3, createdAt: new Date('2026-04-02'), updatedAt: new Date('2026-04-02') },
      ]);
      (jwt.verify as jest.Mock).mockReturnValue({ id: '99999999-9999-9999-9999-999999999999' });
      mockUserModel.findByPk.mockResolvedValue({
        id: '99999999-9999-9999-9999-999999999999',
        username: 'viewer',
        email: 'viewer@example.com',
        role: 'user',
      });

      const response = await request(app)
        .get('/api/topics')
        .set('x-user-id', '99999999-9999-9999-9999-999999999999')
        .set('x-user-username', 'viewer')
        .set('x-user-email', 'viewer@example.com')
        .set('x-user-role', 'user');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Published');
    });

    it('includes draft topics for editors', async () => {
      mockTopicModel.findAll.mockResolvedValue([
        { id: UUID_1, title: 'Published', status: 'published', editors: [UUID_2], created_by: UUID_2, createdAt: new Date('2026-04-01'), updatedAt: new Date('2026-04-01') },
        { id: UUID_2, title: 'My Draft', status: 'draft', editors: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'], created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', createdAt: new Date('2026-04-02'), updatedAt: new Date('2026-04-02') },
      ]);
      (jwt.verify as jest.Mock).mockReturnValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
      mockUserModel.findByPk.mockResolvedValue({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        username: 'editor',
        email: 'editor@example.com',
        role: 'user',
      });

      const response = await request(app)
        .get('/api/topics')
        .set('x-user-id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .set('x-user-username', 'editor')
        .set('x-user-email', 'editor@example.com')
        .set('x-user-role', 'user');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.map((t: any) => t.title)).toContain('My Draft');
    });

    it('returns all topics for admin users', async () => {
      mockTopicModel.findAll.mockResolvedValue([
        { id: UUID_1, title: 'Published', status: 'published', editors: [UUID_2], created_by: UUID_2, createdAt: new Date('2026-04-01'), updatedAt: new Date('2026-04-01') },
        { id: UUID_2, title: 'Draft', status: 'draft', editors: [UUID_3], created_by: UUID_3, createdAt: new Date('2026-04-02'), updatedAt: new Date('2026-04-02') },
      ]);
      (jwt.verify as jest.Mock).mockReturnValue({ id: '99999999-9999-9999-9999-999999999999' });
      mockUserModel.findByPk.mockResolvedValue({
        id: '99999999-9999-9999-9999-999999999999',
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
      });

      const response = await request(app)
        .get('/api/topics')
        .set('x-user-id', '99999999-9999-9999-9999-999999999999')
        .set('x-user-username', 'admin')
        .set('x-user-email', 'admin@example.com')
        .set('x-user-role', 'admin');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/topics', () => {
    it('creates website topic with type field', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
      mockUserModel.findByPk.mockResolvedValue({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'user',
      });
      const newTopic = {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        title: 'Website Topic',
        description: 'Testing fundamentals',
        type: 'website',
        created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        editors: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
        status: 'draft',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      };
      mockTopicModel.create.mockResolvedValue(newTopic);

      const response = await request(app)
        .post('/api/topics')
        .set('x-user-id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
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
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        type: 'website',
      });
    });
  });

  describe('PUT /api/topics/:id', () => {
    it('updates topic for owner', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
      mockUserModel.findByPk.mockResolvedValue({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'user',
      });
      const save = jest.fn();
      mockTopicModel.findByPk.mockResolvedValue({
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        title: 'Old',
        description: 'old',
        type: 'website',
        created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        editors: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
        status: 'draft',
        save,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .put('/api/topics/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
        .set('x-user-id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
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
    it('updates topic status for owner', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
      mockUserModel.findByPk.mockResolvedValue({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'user',
      });
      const save = jest.fn();
      mockTopicModel.findByPk.mockResolvedValue({
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        title: 'Topic',
        description: 'desc',
        type: 'website',
        created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        editors: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
        status: 'draft',
        save,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .patch('/api/topics/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/status')
        .set('x-user-id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .set('x-user-username', 'teacher1')
        .set('x-user-email', 'teacher@example.com')
        .set('x-user-role', 'user')
        .send({ status: 'published' });

      expect(response.status).toBe(200);
      expect(save).toHaveBeenCalled();
      expect(response.body.data.status).toBe('published');
    });
  });

  describe('DELETE /api/topics/:id', () => {
    it('deletes exact OSS keys and legacy prefix cleanup for owner', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
      mockUserModel.findByPk.mockResolvedValue({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'user',
      });
      mockTopicModel.findByPk.mockResolvedValue({
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        title: 'Topic',
        description: 'Testing fundamentals',
        type: 'website',
        created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        editors: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
        status: 'draft',
        save: jest.fn(),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });
      mockTopicModel.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/api/topics/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
        .set('x-user-id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .set('x-user-username', 'teacher1')
        .set('x-user-email', 'teacher@example.com')
        .set('x-user-role', 'user');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockStorageService.delete).toHaveBeenCalledTimes(2);
      expect(mockStorageService.delete).toHaveBeenNthCalledWith(
        1,
        'topics/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.tar.gz'
      );
      expect(mockStorageService.delete).toHaveBeenNthCalledWith(
        2,
        'topics/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb-published.tar.gz'
      );
      expect(mockStorageService.deleteDir).toHaveBeenCalledWith(
        'topics/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/'
      );
    });

    it('continues deletion when legacy cleanup is missing', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
      mockUserModel.findByPk.mockResolvedValue({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'user',
      });
      mockStorageService.delete.mockResolvedValue(undefined);
      mockStorageService.deleteDir.mockRejectedValueOnce(new Error('missing prefix'));
      mockTopicModel.findByPk.mockResolvedValue({
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        title: 'Topic',
        description: 'Testing fundamentals',
        type: 'website',
        created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        editors: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
        status: 'draft',
        save: jest.fn(),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });
      mockTopicModel.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/api/topics/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
        .set('x-user-id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .set('x-user-username', 'teacher1')
        .set('x-user-email', 'teacher@example.com')
        .set('x-user-role', 'user');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTopicModel.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/topics/:id/git/presign', () => {
    it('returns PUT presign for publish op when requester is editor', async () => {
      mockTopicModel.findByPk.mockResolvedValue({
        id: UUID_1,
        title: 'Publishable Topic',
        status: 'draft',
        editors: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
        created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      });

      const response = await request(app)
        .get(`/api/topics/${UUID_1}/git/presign?op=publish`)
        .set('x-user-id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .set('x-user-username', 'editor')
        .set('x-user-email', 'editor@example.com')
        .set('x-user-role', 'user');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(getPresignedUrlMock).toHaveBeenCalledWith(
        `topics/${UUID_1}-published.tar.gz`,
        'PUT',
        'application/gzip',
        1
      );
    });

    it('returns GET presign for publish op when topic is already published and requester is anonymous', async () => {
      mockTopicModel.findByPk.mockResolvedValue({
        id: UUID_2,
        title: 'Published Topic',
        status: 'published',
        editors: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
        created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      });

      const response = await request(app).get(`/api/topics/${UUID_2}/git/presign?op=publish`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(getPresignedUrlMock).toHaveBeenCalledWith(
        `topics/${UUID_2}-published.tar.gz`,
        'GET',
        undefined,
        1
      );
    });

    it('blocks publish op for anonymous users when topic is not published', async () => {
      mockTopicModel.findByPk.mockResolvedValue({
        id: UUID_3,
        title: 'Draft Topic',
        status: 'draft',
        editors: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
        created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      });

      const response = await request(app).get(`/api/topics/${UUID_3}/git/presign?op=publish`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(getPresignedUrlMock).not.toHaveBeenCalled();
    });
  });
});
