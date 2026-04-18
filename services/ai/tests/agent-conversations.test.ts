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

const mockAgentConversationModel = {
  findOne: jest.fn(),
  create: jest.fn(),
};

const mockAgentMessageModel = {
  destroy: jest.fn(),
  bulkCreate: jest.fn(),
};

const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn(),
};

const mockSequelize = {
  transaction: jest.fn((callback) => callback(mockTransaction)),
};

jest.mock('../src/models', () => ({
  User: { findByPk: jest.fn() },
  Topic: { findByPk: jest.fn() },
  AgentConversation: mockAgentConversationModel,
  AgentMessage: mockAgentMessageModel,
}));

jest.mock('../src/utils/database', () => ({
  sequelize: mockSequelize,
}));

import app from '../src/app';

describe('Agent Conversation API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/ai/conversations/:topicId/:agentType', () => {
    it('loads conversation messages for topic and agentType', async () => {
      mockAgentConversationModel.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/ai/conversations/topic-1/building')
        .set('x-user-id', 'test-user-1')
        .set('x-user-username', 'testuser')
        .set('x-user-email', 'test@example.com')
        .set('x-user-role', 'user');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messages).toEqual([]);
      expect(response.body.data.selectedSkills).toEqual([]);
      expect(response.body.data.compressedContext.hasCompressedContext).toBe(false);
    });

    it('loads existing conversation with messages', async () => {
      const mockConversation = {
        id: 'conv-1',
        selected_skills: ['topic-planner'],
        compressed_summary: '## 历史概览\n- 已完成结构规划',
        compressed_summary_version: 1,
        first_uncompressed_message_id: 'm-2',
        has_compressed_context: true,
        updatedAt: new Date('2026-04-17T00:00:00Z'),
        get: jest.fn((key: string) => {
          if (key === 'messages') {
            return [
              {
                id: 'm-3',
                role: 'user',
                content: '先帮我规划结构',
                createdAt: new Date('2026-04-17T00:01:00Z'),
              },
              {
                id: 'm-4',
                role: 'assistant',
                content: '我先给出模块方案。',
                createdAt: new Date('2026-04-17T00:02:00Z'),
              },
            ];
          }
          return undefined;
        }),
      };

      mockAgentConversationModel.findOne.mockResolvedValue(mockConversation);

      const response = await request(app)
        .get('/api/ai/conversations/topic-1/building')
        .set('x-user-id', 'test-user-1')
        .set('x-user-username', 'testuser')
        .set('x-user-email', 'test@example.com')
        .set('x-user-role', 'user');

      expect(response.status).toBe(200);
      expect(response.body.data.selectedSkills).toEqual(['topic-planner']);
      expect(response.body.data.compressedContext.firstUncompressedMessageId).toBe('m-2');
      expect(response.body.data.messages).toHaveLength(2);
    });

    it('rejects invalid agentType', async () => {
      const response = await request(app)
        .get('/api/ai/conversations/topic-1/invalid')
        .set('x-user-id', 'test-user-1')
        .set('x-user-username', 'testuser')
        .set('x-user-email', 'test@example.com')
        .set('x-user-role', 'user');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/ai/conversations/:topicId/:agentType', () => {
    it('replaces persisted visible messages selected skills and compressed context', async () => {
      const mockConversation = {
        id: 'conv-1',
        topic_id: 'topic-1',
        user_id: 'test-user-1',
        agent_type: 'building',
        selected_skills: ['topic-planner'],
        compressed_summary: '## 历史概览\n- 已完成结构规划',
        compressed_summary_version: 1,
        first_uncompressed_message_id: 'm-2',
        has_compressed_context: true,
        updatedAt: new Date('2026-04-17T00:00:00Z'),
        update: jest.fn().mockResolvedValue(undefined),
        reload: jest.fn().mockResolvedValue(undefined),
        get: jest.fn((key: string) => {
          if (key === 'messages') {
            return [
              {
                id: 'm-3',
                role: 'user',
                content: '先帮我规划结构',
                createdAt: new Date('2026-04-17T00:01:00Z'),
              },
              {
                id: 'm-4',
                role: 'assistant',
                content: '我先给出模块方案。',
                createdAt: new Date('2026-04-17T00:02:00Z'),
              },
            ];
          }
          return undefined;
        }),
      };

      mockAgentConversationModel.findOne.mockResolvedValue(mockConversation);
      mockAgentMessageModel.destroy.mockResolvedValue(2);
      mockAgentMessageModel.bulkCreate.mockResolvedValue([]);

      const response = await request(app)
        .put('/api/ai/conversations/topic-1/building')
        .set('x-user-id', 'test-user-1')
        .set('x-user-username', 'testuser')
        .set('x-user-email', 'test@example.com')
        .set('x-user-role', 'user')
        .send({
          selectedSkills: ['topic-planner'],
          compressedContext: {
            summary: '## 历史概览\n- 已完成结构规划',
            summaryVersion: 1,
            firstUncompressedMessageId: 'm-2',
            hasCompressedContext: true,
          },
          messages: [
            { id: 'm-3', role: 'user', content: '先帮我规划结构' },
            { id: 'm-4', role: 'assistant', content: '我先给出模块方案。' },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.selectedSkills).toEqual(['topic-planner']);
      expect(response.body.data.compressedContext.firstUncompressedMessageId).toBe('m-2');
      expect(response.body.data.messages).toHaveLength(2);
    });

    it('creates new conversation if not exists', async () => {
      const mockConversation = {
        id: 'conv-new',
        topic_id: 'topic-1',
        user_id: 'test-user-1',
        agent_type: 'learning',
        selected_skills: [],
        compressed_summary: '',
        compressed_summary_version: 1,
        first_uncompressed_message_id: null,
        has_compressed_context: false,
        updatedAt: new Date('2026-04-17T00:00:00Z'),
        update: jest.fn().mockResolvedValue(undefined),
        reload: jest.fn().mockResolvedValue(undefined),
        get: jest.fn(() => []),
      };

      mockAgentConversationModel.findOne.mockResolvedValue(null);
      mockAgentConversationModel.create.mockResolvedValue(mockConversation);
      mockAgentMessageModel.destroy.mockResolvedValue(0);
      mockAgentMessageModel.bulkCreate.mockResolvedValue([]);

      const response = await request(app)
        .put('/api/ai/conversations/topic-1/learning')
        .set('x-user-id', 'test-user-1')
        .set('x-user-username', 'testuser')
        .set('x-user-email', 'test@example.com')
        .set('x-user-role', 'user')
        .send({
          selectedSkills: [],
          compressedContext: {
            summary: '',
            summaryVersion: 1,
            firstUncompressedMessageId: null,
            hasCompressedContext: false,
          },
          messages: [],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAgentConversationModel.create).toHaveBeenCalled();
    });

    it('rejects invalid payload', async () => {
      const response = await request(app)
        .put('/api/ai/conversations/topic-1/building')
        .set('x-user-id', 'test-user-1')
        .set('x-user-username', 'testuser')
        .set('x-user-email', 'test@example.com')
        .set('x-user-role', 'user')
        .send({
          selectedSkills: 'not-an-array',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
