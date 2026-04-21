import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AgentChatContent from './AgentChatContent';
import type { AgentCompressedContext, AgentRunState } from '@web-learn/shared';

const useAgentRuntimeMock = vi.hoisted(() => vi.fn());
const useAgentStoreMock = vi.hoisted(() => vi.fn());

vi.mock('../agent/useAgentRuntime', () => ({
  useAgentRuntime: useAgentRuntimeMock,
}));

vi.mock('../stores/useAgentStore', () => ({
  useAgentStore: useAgentStoreMock,
}));

interface MockAgentStoreState {
  runState: AgentRunState;
  model: string;
  compressedContext: Pick<AgentCompressedContext, 'hasCompressedContext'>;
  setSessionContext: ReturnType<typeof vi.fn>;
}

describe('AgentChatContent hydration', () => {
  beforeEach(() => {
    useAgentRuntimeMock.mockReset();
    useAgentStoreMock.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('hydrates once and auto-starts from an initial prompt once for the mounted session', async () => {
    const hydrateConversation = vi.fn().mockResolvedValue(undefined);
    const runAgentLoop = vi.fn().mockResolvedValue(undefined);
    const onInitialPromptConsumed = vi.fn();
    const setSessionContext = vi.fn();

    useAgentRuntimeMock.mockReturnValue({
      runAgentLoop,
      visibleMessages: [],
      hydrateConversation,
    });

    useAgentStoreMock.mockImplementation((selector: (state: MockAgentStoreState) => unknown) =>
      selector({
        runState: { isRunning: false, currentToolName: null, currentToolPath: null, error: null },
        model: 'MiniMax-M2.7',
        compressedContext: { hasCompressedContext: false },
        setSessionContext,
      })
    );

    const { rerender } = render(
      <AgentChatContent
        topicId="topic-1"
        agentType="building"
        initialPrompt="做一个物理专题"
        onInitialPromptConsumed={onInitialPromptConsumed}
      />
    );
    rerender(
      <AgentChatContent
        topicId="topic-1"
        agentType="building"
        initialPrompt="做一个物理专题"
        onInitialPromptConsumed={onInitialPromptConsumed}
      />
    );

    await waitFor(() => {
      expect(runAgentLoop).toHaveBeenCalledWith('做一个物理专题', 'MiniMax-M2.7');
    });

    expect(hydrateConversation).toHaveBeenCalledTimes(1);
    expect(runAgentLoop).toHaveBeenCalledTimes(1);
    expect(onInitialPromptConsumed).toHaveBeenCalledTimes(1);
    expect(setSessionContext).toHaveBeenCalledTimes(1);
  });

  it('does not re-hydrate when the runtime recreates the hydrate callback on rerender', () => {
    const hydrateCalls: string[] = [];
    const setSessionContext = vi.fn();
    let renderCount = 0;

    useAgentRuntimeMock.mockImplementation(() => {
      renderCount += 1;
      return {
        runAgentLoop: vi.fn(),
        visibleMessages: [],
        hydrateConversation: vi.fn(() => {
          hydrateCalls.push(`hydrate-${renderCount}`);
          return Promise.resolve();
        }),
      };
    });

    useAgentStoreMock.mockImplementation((selector: (state: MockAgentStoreState) => unknown) =>
      selector({
        runState: { isRunning: false, currentToolName: null, error: null },
        model: 'MiniMax-M2.7',
        compressedContext: { hasCompressedContext: false },
        setSessionContext,
      })
    );

    const { rerender } = render(<AgentChatContent topicId="topic-1" agentType="building" />);
    rerender(<AgentChatContent topicId="topic-1" agentType="building" />);

    expect(setSessionContext).toHaveBeenCalledTimes(1);
    expect(hydrateCalls).toHaveLength(1);
  });
});
