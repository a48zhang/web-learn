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
};

jest.mock('../src/models', () => ({
  User: mockUserModel,
  Topic: mockTopicModel,
  TopicPage: mockPageModel,
}));

const mockCreate = jest.fn();
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: class OpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
  TokenExpiredError: class TokenExpiredError extends Error {},
  JsonWebTokenError: class JsonWebTokenError extends Error {},
}));

import app from '../src/app';

describe('AI API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated chat requests', async () => {
    const response = await request(app).post('/api/ai/chat').send({
      messages: [{ role: 'user', content: 'hi' }],
      topic_id: 1,
      agent_type: 'learning',
    });

    expect(response.status).toBe(401);
  });

  it('allows learning chat for published topic', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: 9 });
    mockUserModel.findByPk.mockResolvedValue({
      id: 9,
      username: 'student',
      email: 'student@example.com',
      role: 'student',
    });
    mockTopicModel.findByPk.mockResolvedValue({
      id: 1,
      title: 'Topic',
      type: 'knowledge',
      status: 'published',
      created_by: 5,
    });
    mockCreate.mockResolvedValue({
      id: 'chatcmpl-1',
      object: 'chat.completion',
      model: 'test-model',
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
    });

    const response = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer token')
      .send({
        messages: [{ role: 'user', content: 'hello' }],
        topic_id: 1,
        agent_type: 'learning',
      });

    expect(response.status).toBe(200);
    expect(response.body.choices[0].message.content).toBe('ok');
  });

  it('blocks building chat for non-teacher user', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: 9 });
    mockUserModel.findByPk.mockResolvedValue({
      id: 9,
      username: 'student',
      email: 'student@example.com',
      role: 'student',
    });
    mockTopicModel.findByPk.mockResolvedValue({
      id: 1,
      title: 'Topic',
      type: 'knowledge',
      status: 'published',
      created_by: 5,
    });

    const response = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer token')
      .send({
        messages: [{ role: 'user', content: 'hello' }],
        topic_id: 1,
        agent_type: 'building',
      });

    expect(response.status).toBe(403);
  });
});
