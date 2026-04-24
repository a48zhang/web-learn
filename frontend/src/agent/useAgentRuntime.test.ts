import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentRuntime } from './useAgentRuntime';
import { useAgentStore } from '../stores/useAgentStore';

const chatWithToolsMock = vi.hoisted(() => vi.fn());
const getOpenAIToolsMock = vi.hoisted(() => vi.fn());
const executeToolMock = vi.hoisted(() => vi.fn());
const saveToOSSMock = vi.hoisted(() => vi.fn());
const replaceConversationMock = vi.hoisted(() => vi.fn());

vi.mock('../services/llmApi', () => ({
  chatWithTools: chatWithToolsMock,
}));

vi.mock('../services/api', () => ({
  agentConversationApi: {
    replaceConversation: replaceConversationMock,
    getConversation: vi.fn(),
  },
}));

vi.mock('./toolRegistry', () => ({
  getOpenAITools: getOpenAIToolsMock,
  executeTool: executeToolMock,
}));

vi.mock('../stores/useEditorStore', () => ({
  useEditorStore: {
    getState: () => ({
      hasUnsavedChanges: false,
      saveToOSS: saveToOSSMock,
    }),
  },
}));

describe('useAgentRuntime', () => {
  beforeEach(() => {
    chatWithToolsMock.mockReset();
    getOpenAIToolsMock.mockReset();
    executeToolMock.mockReset();
    saveToOSSMock.mockReset();
    replaceConversationMock.mockReset();

    getOpenAIToolsMock.mockReturnValue([]);
    executeToolMock.mockResolvedValue({ content: 'ok', isError: false });
    saveToOSSMock.mockResolvedValue(true);
    replaceConversationMock.mockResolvedValue(undefined);

    useAgentStore.setState({
      topicId: 'topic-1',
      agentType: 'building',
      selectedSkills: [],
      compressedContext: {
        summary: '',
        summaryVersion: 1,
        firstUncompressedMessageId: null,
        updatedAt: '2026-04-19T00:00:00.000Z',
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

  it('uploads build-agent file edits even if the dirty flag was already cleared', async () => {
    chatWithToolsMock
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'tool-1',
              type: 'function',
              function: {
                name: 'write_file',
                arguments: JSON.stringify({ path: 'src/app.ts', content: 'hello' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: 'assistant',
            content: 'done',
          },
        }],
      });

    const { result } = renderHook(() => useAgentRuntime({ topicId: 'topic-1', agentType: 'building' }));

    await act(async () => {
      await result.current.runAgentLoop('update the file');
    });

    expect(saveToOSSMock).toHaveBeenCalledTimes(1);
    expect(saveToOSSMock).toHaveBeenCalledWith('topic-1', undefined, { force: true });
    expect(useAgentStore.getState().runState).toEqual({
      isRunning: false,
      currentToolName: null,
      currentToolPath: null,
      error: null,
    });
  });

  it('surfaces a run error when the forced save fails after a build mutation', async () => {
    chatWithToolsMock
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'tool-1',
              type: 'function',
              function: {
                name: 'write_file',
                arguments: JSON.stringify({ path: 'src/app.ts', content: 'hello' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: 'assistant',
            content: 'done',
          },
        }],
      });
    saveToOSSMock.mockResolvedValue(false);

    const { result } = renderHook(() => useAgentRuntime({ topicId: 'topic-1', agentType: 'building' }));

    await act(async () => {
      await result.current.runAgentLoop('update the file');
    });

    expect(saveToOSSMock).toHaveBeenCalledTimes(1);
    expect(useAgentStore.getState().runState).toEqual({
      isRunning: false,
      currentToolName: null,
      currentToolPath: null,
      error: 'Failed to save build changes to OSS',
    });
  });

  it('streams assistant text into a single visible message before completion resolves', async () => {
    chatWithToolsMock.mockImplementationOnce(async (_messages, _tools, onStream) => {
      onStream?.('你');
      onStream?.('好');

      return {
        choices: [{
          message: {
            role: 'assistant',
            content: '你好',
          },
        }],
      };
    });

    const { result } = renderHook(() => useAgentRuntime({ topicId: 'topic-1', agentType: 'building' }));

    await act(async () => {
      await result.current.runAgentLoop('say hello');
    });

    expect(chatWithToolsMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      expect.any(Function),
      undefined
    );
    expect(useAgentStore.getState().visibleMessages).toHaveLength(2);
    expect(useAgentStore.getState().visibleMessages[1]).toMatchObject({
      role: 'assistant',
      content: '你好',
    });
  });

  it('executes tool calls after streaming content has been assembled', async () => {
    chatWithToolsMock
      .mockImplementationOnce(async (_messages, _tools, onStream) => {
        onStream?.('planning');

        return {
          choices: [{
            message: {
              role: 'assistant',
              content: 'planning',
              tool_calls: [{
                id: 'tool-1',
                type: 'function',
                function: {
                  name: 'write_file',
                  arguments: JSON.stringify({ path: 'src/app.ts', content: 'hello' }),
                },
              }],
            },
          }],
        };
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: 'assistant',
            content: 'done',
          },
        }],
      });

    const { result } = renderHook(() => useAgentRuntime({ topicId: 'topic-1', agentType: 'building' }));

    await act(async () => {
      await result.current.runAgentLoop('update the file');
    });

    expect(executeToolMock).toHaveBeenCalledTimes(1);
    expect(useAgentStore.getState().visibleMessages[1]).toMatchObject({
      role: 'assistant',
      content: 'planning',
      tools: [
        expect.objectContaining({
          id: 'tool-1',
          name: 'write_file',
          state: 'success',
        }),
      ],
    });
  });

  it('preserves partial streamed content when the streaming request fails', async () => {
    chatWithToolsMock.mockImplementationOnce(async (_messages, _tools, onStream) => {
      onStream?.('partial');
      throw new Error('stream broke');
    });

    const { result } = renderHook(() => useAgentRuntime({ topicId: 'topic-1', agentType: 'building' }));

    await act(async () => {
      await result.current.runAgentLoop('say hello');
    });

    expect(useAgentStore.getState().visibleMessages).toHaveLength(2);
    expect(useAgentStore.getState().visibleMessages[1]).toMatchObject({
      role: 'assistant',
      content: 'partial',
    });
    expect(useAgentStore.getState().runState).toEqual({
      isRunning: false,
      currentToolName: null,
      currentToolPath: null,
      error: 'stream broke',
    });
  });
});
