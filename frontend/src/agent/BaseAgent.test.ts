import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseAgent } from './BaseAgent';
import type { AgentSessionContext } from './BaseAgent';
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
  constructor(
    context: AgentSessionContext,
    private readonly compressionSummary?: string | Error
  ) {
    super(context);
  }

  getAgentType(): AgentType {
    return 'building';
  }

  public isAfterCursor(message: PersistedAgentMessage, firstUncompressedMessageId: string | null): boolean {
    return this.isAfterCompressionCursor(message, firstUncompressedMessageId);
  }

  public compressBeforeRequest(nextUserInput: string): Promise<void> {
    return this.maybeCompressContextBeforeLlmRequest(nextUserInput);
  }

  protected async requestCompressionSummary(_compressionPrompt: string): Promise<string> {
    if (this.compressionSummary instanceof Error) {
      throw this.compressionSummary;
    }
    return this.compressionSummary ?? '## 历史概览\n- compressed';
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

  it('uses fallback compression without writing empty visible messages when the compression request fails', async () => {
    let currentVisibleMessages = [
      createPersistedMessage('msg-1', 'x'.repeat(520_000)),
      createPersistedMessage('msg-2', 'small recent message'),
    ];
    let currentCompressedContext = createCompressedContext({
      summary: '',
      hasCompressedContext: false,
    });
    const setVisibleMessages = vi.fn((messages: PersistedAgentMessage[]) => {
      currentVisibleMessages = messages;
    });
    const setCompressedContext = vi.fn((context: AgentCompressedContext) => {
      currentCompressedContext = context;
    });

    const agent = new TestAgent(
      {
        topicId: 'topic-1',
        topicTitle: undefined,
        getSelectedSkills: () => [],
        getVisibleMessages: () => currentVisibleMessages,
        getCompressedContext: () => currentCompressedContext,
        setSelectedSkills: vi.fn(),
        setVisibleMessages,
        setCompressedContext,
      },
      new Error('compression failed')
    );

    await agent.compressBeforeRequest('continue');

    expect(setVisibleMessages).toHaveBeenCalledTimes(1);
    expect(currentVisibleMessages.map((m) => m.id)).toEqual(['msg-2']);
    expect(currentCompressedContext.hasCompressedContext).toBe(true);
    expect(currentCompressedContext.summary).toContain('共 1 条消息被压缩');
  });

  it('does not write a compressed context with an empty summary', async () => {
    let currentVisibleMessages = [
      createPersistedMessage('msg-1', 'x'.repeat(520_000)),
      createPersistedMessage('msg-2', 'small recent message'),
    ];
    let currentCompressedContext = createCompressedContext();
    const setVisibleMessages = vi.fn((messages: PersistedAgentMessage[]) => {
      currentVisibleMessages = messages;
    });
    const setCompressedContext = vi.fn((context: AgentCompressedContext) => {
      currentCompressedContext = context;
    });

    const agent = new TestAgent(
      {
        topicId: 'topic-1',
        topicTitle: undefined,
        getSelectedSkills: () => [],
        getVisibleMessages: () => currentVisibleMessages,
        getCompressedContext: () => currentCompressedContext,
        setSelectedSkills: vi.fn(),
        setVisibleMessages,
        setCompressedContext,
      },
      '   '
    );

    await agent.compressBeforeRequest('continue');

    expect(setVisibleMessages).toHaveBeenCalledTimes(1);
    expect(currentVisibleMessages.map((m) => m.id)).toEqual(['msg-2']);
    expect(currentCompressedContext.hasCompressedContext).toBe(true);
    expect(currentCompressedContext.summary.trim()).not.toBe('');
  });

  it('compresses normal long context into summary plus recent visible window', async () => {
    let currentVisibleMessages = [
      createPersistedMessage('msg-1', 'Project goal: build a React learning page. ' + 'a'.repeat(420_000)),
      createPersistedMessage('msg-2', 'Constraint: keep the UI in Chinese. ' + 'b'.repeat(140_000)),
      createPersistedMessage('msg-3', 'Recent user request: continue polishing the hero section. ' + 'c'.repeat(10_000)),
    ];
    let currentCompressedContext = createCompressedContext();
    const setVisibleMessages = vi.fn((messages: PersistedAgentMessage[]) => {
      currentVisibleMessages = messages;
    });
    const setCompressedContext = vi.fn((context: AgentCompressedContext) => {
      currentCompressedContext = context;
    });

    const agent = new TestAgent(
      {
        topicId: 'topic-1',
        topicTitle: 'React learning page',
        getSelectedSkills: () => ['ui-planner'],
        getVisibleMessages: () => currentVisibleMessages,
        getCompressedContext: () => currentCompressedContext,
        setSelectedSkills: vi.fn(),
        setVisibleMessages,
        setCompressedContext,
      },
      [
        '## 历史概览',
        '- 用户正在构建 React 学习页面。',
        '## 关键记忆点',
        '- UI 必须保持中文。',
        '## 下一步计划',
        '- 继续优化 hero section。',
      ].join('\n')
    );

    await agent.compressBeforeRequest('继续');

    expect(setCompressedContext).toHaveBeenCalledTimes(1);
    expect(setVisibleMessages).toHaveBeenCalledTimes(1);
    expect(currentCompressedContext).toMatchObject({
      hasCompressedContext: true,
      summaryVersion: 1,
      firstUncompressedMessageId: 'msg-3',
    });
    expect(currentCompressedContext.summary).toContain('用户正在构建 React 学习页面');
    expect(currentCompressedContext.summary).toContain('UI 必须保持中文');
    expect(currentVisibleMessages.map((m) => m.id)).toEqual(['msg-3']);
  });

  it('builds llm messages with compressed memory followed by recent messages', async () => {
    let currentVisibleMessages = [
      createPersistedMessage('msg-1', 'Old context ' + 'a'.repeat(520_000)),
      createPersistedMessage('msg-2', 'Recent request: adjust layout. ' + 'b'.repeat(10_000)),
    ];
    let currentCompressedContext = createCompressedContext();

    const agent = new TestAgent(
      {
        topicId: 'topic-1',
        topicTitle: 'Layout topic',
        getSelectedSkills: () => [],
        getVisibleMessages: () => currentVisibleMessages,
        getCompressedContext: () => currentCompressedContext,
        setSelectedSkills: vi.fn(),
        setVisibleMessages: (messages) => {
          currentVisibleMessages = messages;
        },
        setCompressedContext: (context) => {
          currentCompressedContext = context;
        },
      },
      '## 历史概览\n- Old context has been compressed.\n## 下一步计划\n- Adjust layout.'
    );

    await agent.compressBeforeRequest('continue');

    const llmMessages = agent.buildLlmMessages();

    expect(llmMessages[0]).toMatchObject({ role: 'system' });
    expect(llmMessages[1]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('以下是此前较早历史的压缩记忆'),
    });
    expect(llmMessages[2]).toMatchObject({
      role: 'user',
      content: expect.stringContaining('Recent request: adjust layout.'),
    });
    expect(llmMessages.map((m) => m.content).join('\n')).not.toContain('Old context aaaaa');
  });
});
