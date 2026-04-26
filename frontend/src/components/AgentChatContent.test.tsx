import { act, render, screen, waitFor } from '@testing-library/react';
import { useState, type FC } from 'react';
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

  it('hydrates once and auto-starts from an initial prompt once even if route state is cleared', async () => {
    const events: string[] = [];
    let resolveHydrate!: () => void;
    const hydrateConversation = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          events.push('hydrate');
          resolveHydrate = resolve;
        })
    );
    const runAgentLoop = vi.fn(async () => {
      events.push('run');
    });
    const consumeSpy = vi.fn(() => {
      events.push('consume');
    });
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

    const Harness: FC = () => {
      const [initialPrompt, setInitialPrompt] = useState<string | undefined>('做一个物理专题');

      return (
        <AgentChatContent
          topicId="topic-1"
          agentType="building"
          initialPrompt={initialPrompt}
          onInitialPromptConsumed={() => {
            consumeSpy();
            setInitialPrompt(undefined);
          }}
        />
      );
    };

    render(<Harness />);

    expect(hydrateConversation).toHaveBeenCalledTimes(1);
    expect(runAgentLoop).not.toHaveBeenCalled();

    await act(async () => {
      resolveHydrate();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(runAgentLoop).toHaveBeenCalledWith('做一个物理专题', 'MiniMax-M2.7');
    });

    expect(hydrateConversation).toHaveBeenCalledTimes(1);
    expect(runAgentLoop).toHaveBeenCalledTimes(1);
    expect(consumeSpy).toHaveBeenCalledTimes(1);
    expect(setSessionContext).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['hydrate', 'consume', 'run']);
  });

  it('does not re-hydrate when the runtime recreates the hydrate callback on rerender', async () => {
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

    await waitFor(() => {
      expect(hydrateCalls).toHaveLength(1);
    });

    expect(setSessionContext).toHaveBeenCalledTimes(1);
  });

  it('renders ANSI tool results through TerminalOutput while keeping args JSON visible', async () => {
    const setSessionContext = vi.fn();
    const visibleMessages = [
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Tool output follows.',
        tools: [
          {
            id: 'tool-ansi',
            name: 'run_command',
            args: { command: 'npm test' },
            result: '␛[1G␛[0K␛[1mnpm␛[22m ␛[31merror␛[39m code ENOENT',
            state: 'error',
          },
        ],
      },
    ];

    useAgentRuntimeMock.mockReturnValue({
      runAgentLoop: vi.fn(),
      visibleMessages,
      hydrateConversation: vi.fn(() => Promise.resolve()),
    });

    useAgentStoreMock.mockImplementation((selector: (state: MockAgentStoreState) => unknown) =>
      selector({
        runState: { isRunning: false, currentToolName: null, currentToolPath: null, error: null },
        model: 'MiniMax-M2.7',
        compressedContext: { hasCompressedContext: false },
        setSessionContext,
      })
    );

    let container: HTMLElement | undefined;

    await act(async () => {
      ({ container } = render(<AgentChatContent topicId="topic-1" agentType="building" />));
      await Promise.resolve();
    });
    expect(container).toBeDefined();
    const renderedContainer = container as HTMLElement;

    expect(screen.getByText('npm')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.queryByText(/␛\[1G/)).not.toBeInTheDocument();
    expect(renderedContainer.querySelectorAll('pre')[0]?.textContent).toContain('npm test');
  });
});
