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

jest.mock('../src/models', () => ({
  User: mockUserModel,
  Topic: { findByPk: jest.fn() },
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

describe('GET /health', () => {
  it('returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('ai');
  });
});

describe('AI API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated chat requests', async () => {
    const response = await request(app).post('/api/ai/chat').send({
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(response.status).toBe(401);
  });

  it('allows authenticated chat requests', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: 9 });
    mockUserModel.findByPk.mockResolvedValue({
      id: 9,
      username: 'student',
      email: 'student@example.com',
      role: 'student',
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
      });

    expect(response.status).toBe(200);
    expect(response.body.choices[0].message.content).toBe('ok');
  });

  it('rejects invalid messages payload', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: 9 });
    mockUserModel.findByPk.mockResolvedValue({
      id: 9,
      username: 'student',
      email: 'student@example.com',
      role: 'student',
    });

    const response = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer token')
      .send({
        messages: 'not-array',
      });

    expect(response.status).toBe(400);
  });

  it('rejects message list exceeding 100 messages', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: 9 });
    mockUserModel.findByPk.mockResolvedValue({
      id: 9,
      username: 'student',
      email: 'student@example.com',
      role: 'student',
    });

    const response = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer token')
      .send({
        messages: Array.from({ length: 101 }).map((_, i) => ({ role: 'user', content: `m-${i}` })),
      });

    expect(response.status).toBe(400);
  });

  it('rejects invalid message role', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: 9 });
    mockUserModel.findByPk.mockResolvedValue({
      id: 9,
      username: 'student',
      email: 'student@example.com',
      role: 'student',
    });

    const response = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer token')
      .send({
        messages: [{ role: 'hacker', content: 'hello' }],
      });

    expect(response.status).toBe(400);
  });

  it('rejects too long message content', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: 9 });
    mockUserModel.findByPk.mockResolvedValue({
      id: 9,
      username: 'student',
      email: 'student@example.com',
      role: 'student',
    });

    const response = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer token')
      .send({
        messages: [{ role: 'user', content: 'x'.repeat(10001) }],
      });

    expect(response.status).toBe(400);
  });

  it('rejects empty messages array', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: 9 });
    mockUserModel.findByPk.mockResolvedValue({
      id: 9,
      username: 'student',
      email: 'student@example.com',
      role: 'student',
    });

    const response = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer token')
      .send({
        messages: [],
      });

    expect(response.status).toBe(400);
  });

  it('forwards tools and tool_choice to LLM', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: 9 });
    mockUserModel.findByPk.mockResolvedValue({
      id: 9,
      username: 'teacher',
      email: 'teacher@example.com',
      role: 'teacher',
    });
    mockCreate.mockResolvedValue({
      id: 'chatcmpl-2',
      object: 'chat.completion',
      model: 'test-model',
      choices: [{ index: 0, message: { role: 'assistant', content: null, tool_calls: [] }, finish_reason: 'stop' }],
    });

    const tools = [
      {
        type: 'function',
        function: { name: 'list_files', description: 'List files', parameters: { type: 'object', properties: {} } },
      },
    ];

    const response = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer token')
      .send({
        messages: [{ role: 'user', content: 'list my files' }],
        tools,
        tool_choice: 'auto',
      });

    expect(response.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ tools, tool_choice: 'auto' })
    );
  });
});
