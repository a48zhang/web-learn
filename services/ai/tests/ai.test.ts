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

const authenticateUser = () => {
  (jwt.verify as jest.Mock).mockReturnValue({ id: 9 });
  mockUserModel.findByPk.mockResolvedValue({
    id: 9,
    username: 'student',
    email: 'student@example.com',
    role: 'user',
  });
};

async function* streamChunks(chunks: any[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

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
    const response = await request(app).post('/api/ai/chat/completions').send({
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(response.status).toBe(401);
  });

  it('allows authenticated chat requests', async () => {
    authenticateUser();
    mockCreate.mockResolvedValue({
      id: 'chatcmpl-1',
      object: 'chat.completion',
      model: 'test-model',
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
    });

    const response = await request(app)
      .post('/api/ai/chat/completions')
      .set('Authorization', 'Bearer token')
      .send({
        messages: [{ role: 'user', content: 'hello' }],
      });

    expect(response.status).toBe(200);
    expect(response.body.choices[0].message.content).toBe('ok');
  });

  it('rejects invalid messages payload', async () => {
    authenticateUser();

    const response = await request(app)
      .post('/api/ai/chat/completions')
      .set('Authorization', 'Bearer token')
      .send({
        messages: 'not-array',
      });

    expect(response.status).toBe(400);
  });

  it('rejects message list exceeding 100 messages', async () => {
    authenticateUser();

    const response = await request(app)
      .post('/api/ai/chat/completions')
      .set('Authorization', 'Bearer token')
      .send({
        messages: Array.from({ length: 101 }).map((_, i) => ({ role: 'user', content: `m-${i}` })),
      });

    expect(response.status).toBe(400);
  });

  it('rejects invalid message role', async () => {
    authenticateUser();

    const response = await request(app)
      .post('/api/ai/chat/completions')
      .set('Authorization', 'Bearer token')
      .send({
        messages: [{ role: 'hacker', content: 'hello' }],
      });

    expect(response.status).toBe(400);
  });

  it('rejects too long message content', async () => {
    authenticateUser();

    const response = await request(app)
      .post('/api/ai/chat/completions')
      .set('Authorization', 'Bearer token')
      .send({
        messages: [{ role: 'user', content: 'x'.repeat(10001) }],
      });

    expect(response.status).toBe(400);
  });

  it('rejects empty messages array', async () => {
    authenticateUser();

    const response = await request(app)
      .post('/api/ai/chat/completions')
      .set('Authorization', 'Bearer token')
      .send({
        messages: [],
      });

    expect(response.status).toBe(400);
  });

  it('forwards tools and tool_choice to LLM', async () => {
    authenticateUser();
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
      .post('/api/ai/chat/completions')
      .set('Authorization', 'Bearer token')
      .send({
        messages: [{ role: 'user', content: 'list my files' }],
        tools,
        tool_choice: 'auto',
      });

    expect(response.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ tools, tool_choice: 'auto' }),
      undefined
    );
  });

  it('streams chat completion chunks as SSE when stream=true', async () => {
    authenticateUser();
    mockCreate.mockResolvedValue(
      streamChunks([
        { id: 'chunk-1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: '你' } }] },
        { id: 'chunk-1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: '好' }, finish_reason: 'stop' }] },
      ])
    );

    const response = await request(app)
      .post('/api/ai/chat/completions')
      .set('Authorization', 'Bearer token')
      .send({
        stream: true,
        messages: [{ role: 'user', content: 'hello' }],
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.text).toContain('data: {"id":"chunk-1"');
    expect(response.text).toContain('data: [DONE]');
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ stream: true }), expect.any(Object));
  });

  it('rejects non-boolean stream values', async () => {
    authenticateUser();

    const response = await request(app)
      .post('/api/ai/chat/completions')
      .set('Authorization', 'Bearer token')
      .send({
        stream: 'yes',
        messages: [{ role: 'user', content: 'hello' }],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('stream must be a boolean when provided');
  });

  it('keeps non-streaming chat completion responses as JSON', async () => {
    authenticateUser();
    mockCreate.mockResolvedValue({
      id: 'chatcmpl-json',
      object: 'chat.completion',
      model: 'test-model',
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
    });

    const response = await request(app)
      .post('/api/ai/chat/completions')
      .set('Authorization', 'Bearer token')
      .send({
        stream: false,
        messages: [{ role: 'user', content: 'hello' }],
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body.choices[0].message.content).toBe('ok');
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ stream: false }), undefined);
  });
});
