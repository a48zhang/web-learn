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

type MockTransaction = {
  LOCK: {
    UPDATE: 'UPDATE';
  };
};

const mockSequelize = {
  transaction: jest.fn(async (handler: (tx: MockTransaction) => Promise<unknown>) =>
    handler({
      LOCK: {
        UPDATE: 'UPDATE',
      },
    })
  ),
};

jest.mock('../src/utils/database', () => ({
  sequelize: mockSequelize,
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockUserModel = {
  findByPk: jest.fn(),
};
const mockTopicModel = {
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

describe('Pages API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockSequelize.transaction.mockImplementation(async (handler: (tx: MockTransaction) => Promise<unknown>) =>
      handler({
        LOCK: {
          UPDATE: 'UPDATE',
        },
      })
    );
  });

  it('allows public read of topic pages', async () => {
    mockTopicModel.findByPk.mockResolvedValue({
      id: 1,
      type: 'knowledge',
      status: 'published',
    });
    mockPageModel.findAll.mockResolvedValue([
      {
        id: 11,
        topic_id: 1,
        title: 'Root',
        content: '# Root',
        parent_page_id: null,
        order: 0,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);

    const response = await request(app).get('/api/topics/1/pages');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      id: '11',
      title: 'Root',
    });
  });

  it('allows authenticated owner to create page', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: 5 });
    mockUserModel.findByPk.mockResolvedValue({
      id: 5,
      username: 'teacher',
      email: 'teacher@example.com',
      role: 'teacher',
    });
    mockTopicModel.findByPk.mockResolvedValue({
      id: 1,
      type: 'knowledge',
      created_by: 5,
    });
    mockPageModel.findOne.mockResolvedValue(null);
    mockPageModel.create.mockResolvedValue({
      id: 100,
      topic_id: 1,
      title: 'Page 1',
      content: '',
      parent_page_id: null,
      order: 0,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    });

    const response = await request(app)
      .post('/api/topics/1/pages')
      .set('Authorization', 'Bearer teacher-token')
      .send({
        title: 'Page 1',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: '100',
      title: 'Page 1',
    });
  });

  it('returns single page by id for published topic', async () => {
    mockPageModel.findByPk.mockResolvedValue({
      id: 11,
      topic_id: 1,
      title: 'Root',
      content: '# Root',
      parent_page_id: null,
      order: 0,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    });
    mockTopicModel.findByPk.mockResolvedValue({
      id: 1,
      type: 'knowledge',
      status: 'published',
      created_by: 5,
    });

    const response = await request(app).get('/api/pages/11');
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('11');
  });

  it('updates page for owner teacher', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: 5 });
    mockUserModel.findByPk.mockResolvedValue({
      id: 5,
      username: 'teacher',
      email: 'teacher@example.com',
      role: 'teacher',
    });
    const save = jest.fn();
    mockPageModel.findByPk
      .mockResolvedValueOnce({
        id: 100,
        topic_id: 1,
        title: 'Old',
        content: '',
        parent_page_id: null,
        order: 0,
        save,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      })
      .mockResolvedValueOnce(null);
    mockTopicModel.findByPk.mockResolvedValue({
      id: 1,
      type: 'knowledge',
      created_by: 5,
    });

    const response = await request(app)
      .put('/api/pages/100')
      .set('Authorization', 'Bearer teacher-token')
      .send({ title: 'Updated', content: 'Body' });

    expect(response.status).toBe(200);
    expect(save).toHaveBeenCalled();
    expect(response.body.data.title).toBe('Updated');
  });

  it('deletes page subtree for owner teacher', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: 5 });
    mockUserModel.findByPk.mockResolvedValue({
      id: 5,
      username: 'teacher',
      email: 'teacher@example.com',
      role: 'teacher',
    });
    mockPageModel.findByPk.mockResolvedValue({
      id: 100,
      topic_id: 1,
      title: 'Root',
      content: '',
      parent_page_id: null,
      order: 0,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    });
    mockTopicModel.findByPk.mockResolvedValue({
      id: 1,
      type: 'knowledge',
      created_by: 5,
    });
    mockPageModel.findAll
      .mockResolvedValueOnce([{ id: 101 }])
      .mockResolvedValueOnce([]);
    mockPageModel.destroy.mockResolvedValue(2);

    const response = await request(app)
      .delete('/api/pages/100')
      .set('Authorization', 'Bearer teacher-token');

    expect(response.status).toBe(200);
    expect(response.body.data.deleted).toEqual(expect.arrayContaining(['100', '101']));
  });

  it('rejects duplicate reorder ids within same request', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: 5 });
    mockUserModel.findByPk.mockResolvedValue({
      id: 5,
      username: 'teacher',
      email: 'teacher@example.com',
      role: 'teacher',
    });
    mockTopicModel.findByPk.mockResolvedValue({
      id: 1,
      type: 'knowledge',
      created_by: 5,
    });

    const response = await request(app)
      .patch('/api/topics/1/pages/reorder')
      .set('Authorization', 'Bearer teacher-token')
      .send({
        pages: [
          { id: 100, order: 0, parent_page_id: null },
          { id: 100, order: 1, parent_page_id: null },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Duplicate page ids');
  });
});
