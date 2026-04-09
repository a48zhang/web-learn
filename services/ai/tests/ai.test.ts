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

import app from '../src/app';

// Helper: headers that simulate gateway-injected user context
const userHeaders = (overrides: Record<string, string> = {}) => ({
  'x-user-id': '9',
  'x-user-username': 'student',
  'x-user-email': 'student@example.com',
  'x-user-role': 'student',
  ...overrides,
});

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
    mockCreate.mockResolvedValue({
      id: 'chatcmpl-1',
      object: 'chat.completion',
      model: 'test-model',
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
    });

    const response = await request(app)
      .post('/api/ai/chat')
      .set(userHeaders())
      .send({
        messages: [{ role: 'user', content: 'hello' }],
      });

    expect(response.status).toBe(200);
    expect(response.body.choices[0].message.content).toBe('ok');
  });

  it('rejects invalid messages payload', async () => {
    const response = await request(app)
      .post('/api/ai/chat')
      .set(userHeaders())
      .send({
        messages: 'not-array',
      });

    expect(response.status).toBe(400);
  });

  it('rejects message list exceeding 100 messages', async () => {
    const response = await request(app)
      .post('/api/ai/chat')
      .set(userHeaders())
      .send({
        messages: Array.from({ length: 101 }).map((_, i) => ({ role: 'user', content: `m-${i}` })),
      });

    expect(response.status).toBe(400);
  });

  it('rejects invalid message role', async () => {
    const response = await request(app)
      .post('/api/ai/chat')
      .set(userHeaders())
      .send({
        messages: [{ role: 'hacker', content: 'hello' }],
      });

    expect(response.status).toBe(400);
  });

  it('rejects too long message content', async () => {
    const response = await request(app)
      .post('/api/ai/chat')
      .set(userHeaders())
      .send({
        messages: [{ role: 'user', content: 'x'.repeat(10001) }],
      });

    expect(response.status).toBe(400);
  });

  it('rejects empty messages array', async () => {
    const response = await request(app)
      .post('/api/ai/chat')
      .set(userHeaders())
      .send({
        messages: [],
      });

    expect(response.status).toBe(400);
  });

  it('forwards tools and tool_choice to LLM', async () => {
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
      .set(userHeaders({ 'x-user-role': 'teacher', 'x-user-email': 'teacher@example.com' }))
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
