import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseAgent } from './BaseAgent';
import type {
  AgentCompressedContext,
  AgentType,
  PersistedAgentMessage,
} from '@web-learn/shared';

const replaceConversationMock = vi.hoisted(() => vi.fn());
const getConversationMock = vi.hoisted(() => vi.fn());

vi.mock('../services/api', () => ({
  agentConversationApi: {
    getConversation: getConversationMock,
    replaceConversation: replaceConversationMock,
  },
}));

class TestAgent extends BaseAgent {
  getAgentType(): AgentType {
    return 'building';
  }

  public isAfterCursor(message: PersistedAgentMessage, firstUncompressedMessageId: string | null): boolean {
    return this.isAfterCompressionCursor(message, firstUncompressedMessageId);
  }
}

function createCompressedContext(overrides: Partial<AgentCompressedContext> = {}): AgentCompressedContext {
  return {
    summary: '',
    summaryVersion: 1,
    firstUncompressedMessageId: null,
    updatedAt: '2026-04-18T00:00:00.000Z',
    hasCompressedContext: false,
    ...overrides,
  };
}

function createPersistedMessage(id: string, content: string): PersistedAgentMessage {
  return {
    id,
    role: 'user',
    content,
    createdAt: `2026-04-18T00:00:0${id.length}.000Z`,
  };
}

describe('BaseAgent', () => {
  beforeEach(() => {
    replaceConversationMock.mockReset();
    getConversationMock.mockReset();
  });

  it('persists the latest store snapshot instead of the constructor snapshot', async () => {
    let currentSelectedSkills = ['initial-skill'];
    let currentVisibleMessages = [createPersistedMessage('msg-1', 'old message')];
    let currentCompressedContext = createCompressedContext({
      summary: 'old summary',
      updatedAt: '2026-04-18T00:00:00.000Z',
    });

    const agent = new TestAgent({
      topicId: 'topic-1',
      topicTitle: undefined,
      getSelectedSkills: () => currentSelectedSkills,
      getVisibleMessages: () => currentVisibleMessages,
      getCompressedContext: () => currentCompressedContext,
      setSelectedSkills: (skills) => {
        currentSelectedSkills = skills;
      },
      setVisibleMessages: (messages) => {
        currentVisibleMessages = messages;
      },
      setCompressedContext: (context) => {
        currentCompressedContext = context;
      },
    });

    currentSelectedSkills = ['updated-skill'];
    currentVisibleMessages = [createPersistedMessage('msg-2', 'new message')];
    currentCompressedContext = createCompressedContext({
      summary: 'new summary',
      updatedAt: '2026-04-18T00:00:01.000Z',
    });

    await agent.persistConversationState();

    expect(replaceConversationMock).toHaveBeenCalledWith('topic-1', 'building', {
      selectedSkills: ['updated-skill'],
      compressedContext: expect.objectContaining({
        summary: 'new summary',
      }),
      messages: [expect.objectContaining({ id: 'msg-2', content: 'new message' })],
    });
  });

  it('treats messages before the first uncompressed cursor as already compressed', () => {
    const agent = new TestAgent({
      topicId: 'topic-1',
      topicTitle: undefined,
      getSelectedSkills: () => [],
      getVisibleMessages: () => [
        createPersistedMessage('msg-1', 'before cursor'),
        createPersistedMessage('msg-3', 'cursor'),
        createPersistedMessage('msg-4', 'after cursor'),
      ],
      getCompressedContext: () => createCompressedContext(),
      setSelectedSkills: vi.fn(),
      setVisibleMessages: vi.fn(),
      setCompressedContext: vi.fn(),
    });

    expect(agent.isAfterCursor(createPersistedMessage('msg-1', 'before cursor'), 'msg-3')).toBe(false);
    expect(agent.isAfterCursor(createPersistedMessage('msg-4', 'after cursor'), 'msg-3')).toBe(true);
    expect(agent.isAfterCursor(createPersistedMessage('msg-3', 'cursor'), 'msg-3')).toBe(true);
  });

  it('continues compressing when the previous first-uncompressed cursor has already been trimmed away', () => {
    const agent = new TestAgent({
      topicId: 'topic-1',
      topicTitle: undefined,
      getSelectedSkills: () => [],
      getVisibleMessages: () => [
        createPersistedMessage('msg-5', 'newly old 1'),
        createPersistedMessage('msg-6', 'newly old 2'),
        createPersistedMessage('msg-7', 'still recent'),
      ],
      getCompressedContext: () => createCompressedContext(),
      setSelectedSkills: vi.fn(),
      setVisibleMessages: vi.fn(),
      setCompressedContext: vi.fn(),
    });

    expect(agent.isAfterCursor(createPersistedMessage('msg-5', 'newly old 1'), 'msg-3')).toBe(true);
    expect(agent.isAfterCursor(createPersistedMessage('msg-6', 'newly old 2'), 'msg-3')).toBe(true);
  });
});
