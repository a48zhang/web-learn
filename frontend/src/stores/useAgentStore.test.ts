import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

const storageMock = vi.hoisted(() => ({
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
}));

vi.stubGlobal('localStorage', storageMock);

import { useAgentStore } from './useAgentStore';

describe('useAgentStore', () => {
  beforeEach(() => {
    useAgentStore.setState({
      topicId: null,
      agentType: 'building',
      selectedSkills: [],
      compressedContext: {
        summary: '',
        summaryVersion: 1,
        firstUncompressedMessageId: null,
        updatedAt: '2026-04-18T00:00:00.000Z',
        hasCompressedContext: false,
      },
      visibleMessages: [],
      runState: {
        isRunning: false,
        currentToolName: null,
        currentToolPath: null,
        error: null,
      },
      model: 'MiniMax-M2.7',
    });
  });

  it('adds persisted message metadata for newly appended chat turns', () => {
    useAgentStore.getState().addVisibleMessage({
      role: 'assistant',
      content: 'reply',
    });

    const [message] = useAgentStore.getState().visibleMessages;

    expect(message).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        role: 'assistant',
        content: 'reply',
        createdAt: expect.any(String),
      })
    );
  });
});
