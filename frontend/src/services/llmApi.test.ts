import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatWithTools, consumeChatCompletionStream } from './llmApi';

const createMock = vi.hoisted(() => vi.fn());

vi.mock('openai', () => ({
  default: class OpenAI {
    chat = {
      completions: {
        create: createMock,
      },
    };
  },
}));

async function* streamChunks(chunks: any[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe('llmApi', () => {
  beforeEach(() => {
    createMock.mockReset();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => (key === 'auth_token' ? 'token' : null)),
      },
      configurable: true,
    });
  });

  it('keeps non-streaming chatWithTools compatibility', async () => {
    createMock.mockResolvedValue({
      id: 'chatcmpl-1',
      object: 'chat.completion',
      created: 1,
      model: 'test-model',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'ok' },
          finish_reason: 'stop',
        },
      ],
    });

    const response = await chatWithTools([{ role: 'user', content: 'hello' }]);

    expect(response.choices[0].message.content).toBe('ok');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ stream: false, model: 'MiniMax-M2.7' }),
    );
  });

  it('streams text chunks and returns an assembled completion', async () => {
    const onStream = vi.fn();
    createMock.mockResolvedValue(
      streamChunks([
        {
          id: 'chunk-1',
          model: 'test-model',
          choices: [{ index: 0, delta: { content: '你' }, finish_reason: null }],
        },
        {
          id: 'chunk-1',
          model: 'test-model',
          choices: [{ index: 0, delta: { content: '好' }, finish_reason: 'stop' }],
        },
      ])
    );

    const response = await chatWithTools([{ role: 'user', content: 'hello' }], undefined, onStream);

    expect(onStream).toHaveBeenNthCalledWith(1, '你');
    expect(onStream).toHaveBeenNthCalledWith(2, '好');
    expect(response.choices[0].message.content).toBe('你好');
    expect(response.choices[0].finish_reason).toBe('stop');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true, model: 'MiniMax-M2.7' }),
    );
  });

  it('assembles streamed tool calls across multiple chunks', async () => {
    const response = await consumeChatCompletionStream(
      streamChunks([
        {
          id: 'chunk-tool',
          model: 'test-model',
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call-1',
                    type: 'function',
                    function: { name: 'write_file', arguments: '{"path":"' },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          id: 'chunk-tool',
          model: 'test-model',
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: 'src/app.ts","content":"hello"}' },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
      ]),
      vi.fn(),
      'MiniMax-M2.7'
    );

    expect(response.choices[0].message.tool_calls).toEqual([
      {
        id: 'call-1',
        type: 'function',
        function: {
          name: 'write_file',
          arguments: '{"path":"src/app.ts","content":"hello"}',
        },
      },
    ]);
    expect(response.choices[0].finish_reason).toBe('tool_calls');
  });

  it('rejects malformed streaming responses', async () => {
    createMock.mockResolvedValue({
      id: 'chatcmpl-1',
      object: 'chat.completion',
      created: 1,
      model: 'test-model',
      choices: [],
    });

    await expect(
      chatWithTools([{ role: 'user', content: 'hello' }], undefined, vi.fn())
    ).rejects.toThrow('Expected a streaming chat completion response');
  });
});
