# LLM Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LLM chat requests stream end-to-end from the external provider through `ai-service`, gateway, browser API client, and Agent UI while preserving the current non-streaming JSON path.

**Architecture:** Add an opt-in OpenAI-compatible SSE path on `/api/ai/chat/completions` for `stream: true`; route AI proxy traffic with streaming-friendly timeout settings; make `frontend/src/services/llmApi.ts` consume streamed chunks and assemble a final completion; make `useAgentRuntime` pass an `onStream` callback so assistant text appears incrementally while tool calls still execute only after the full message is assembled.

**Tech Stack:** Express, http-proxy-middleware, OpenAI-compatible Chat Completions, Server-Sent Events, React/Zustand Agent runtime, Jest, Vitest, TypeScript.

---

## File Structure

- Modify `services/ai/src/services/aiService.ts`: add dual non-stream/stream LLM request support.
- Modify `services/ai/src/controllers/aiController.ts`: validate `stream`, branch to SSE response handling, keep JSON behavior for non-streaming.
- Modify `services/ai/tests/ai.test.ts`: cover streaming SSE, `[DONE]`, invalid `stream`, and non-stream compatibility.
- Modify `services/gateway/src/proxyManager.ts`: add route-aware proxy options so `/api/ai` uses streaming-friendly timeout while other routes keep default behavior.
- Create `services/gateway/tests/proxyManager.test.ts`: verify AI/default proxy timeout options and user context forwarding remains wired.
- Modify `frontend/src/services/llmApi.ts`: add stream assembler and make `chatWithTools(..., onStream)` consume streams instead of casting them to full completions.
- Create `frontend/src/services/llmApi.test.ts`: cover stream text assembly, tool-call assembly, and non-stream compatibility.
- Modify `frontend/src/agent/useAgentRuntime.ts`: pass `onStream`, update one assistant visible message incrementally, and keep existing tool loop semantics.
- Modify `frontend/src/agent/useAgentRuntime.test.ts`: cover incremental assistant updates and tool execution after streamed tool-call assembly.

## Task 1: `ai-service` OpenAI-Compatible SSE

**Files:**
- Modify: `services/ai/src/services/aiService.ts`
- Modify: `services/ai/src/controllers/aiController.ts`
- Test: `services/ai/tests/ai.test.ts`

- [ ] **Step 1: Add failing streaming controller tests**

Append tests to `services/ai/tests/ai.test.ts` inside `describe('AI API', () => { ... })`. Use the existing mocked `OpenAI` and auth setup. Add a helper inside the file:

```ts
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
```

Add tests:

```ts
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
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ stream: false }));
});
```

- [ ] **Step 2: Run the failing ai-service tests**

Run:

```bash
./node_modules/.bin/jest --config services/ai/jest.config.js services/ai/tests/ai.test.ts --runInBand
```

Expected: FAIL because `stream` is not validated and `ai-service` always returns JSON with `stream: false`.

- [ ] **Step 3: Implement dual-mode LLM service**

Update `services/ai/src/services/aiService.ts`:

```ts
type ChatWithLLMOptions = {
  stream?: boolean;
  signal?: AbortSignal;
};

export const chatWithLLM = async (
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[],
  toolChoice?: string,
  model?: string,
  options: ChatWithLLMOptions = {}
) => {
  if (!client || !config.ai.apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const selectedModel = model ?? config.ai.model ?? 'MiniMax-M2.7';
  const baseParams = {
    model: selectedModel,
    messages,
    ...(tools && tools.length > 0 ? { tools } : {}),
    ...(tools && tools.length > 0 && toolChoice ? { tool_choice: toolChoice as any } : {}),
  };

  if (options.stream) {
    return await client.chat.completions.create(
      { ...baseParams, stream: true } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
      options.signal ? { signal: options.signal } : undefined
    );
  }

  return await client.chat.completions.create({
    ...baseParams,
    stream: false,
  } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
};
```

- [ ] **Step 4: Implement SSE controller branch**

Update `services/ai/src/controllers/aiController.ts`:

```ts
const validateStreamFlag = (stream: unknown): string | null => {
  if (stream === undefined || typeof stream === 'boolean') return null;
  return 'stream must be a boolean when provided';
};

const writeSseData = (res: Response, payload: unknown) => {
  res.write(`data: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}\n\n`);
};
```

Inside `chat`, parse `stream`:

```ts
const { messages, tools, tool_choice, model, stream } = req.body as {
  messages: any[];
  tools?: any[];
  tool_choice?: string;
  model?: string;
  stream?: unknown;
};
```

After message validation:

```ts
const streamError = validateStreamFlag(stream);
if (streamError) {
  return res.status(400).json({ success: false, error: streamError });
}

if (stream === true) {
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  try {
    const streamResponse = await chatWithLLM(messages, tools, tool_choice, model, {
      stream: true,
      signal: abortController.signal,
    });

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    for await (const chunk of streamResponse as AsyncIterable<unknown>) {
      writeSseData(res, chunk);
    }
    writeSseData(res, '[DONE]');
    return res.end();
  } catch (streamError: any) {
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: streamError?.message || 'Internal server error' });
    }
    writeSseData(res, { error: { message: streamError?.message || 'Internal server error' } });
    writeSseData(res, '[DONE]');
    return res.end();
  }
}
```

Keep the existing non-streaming call after that branch:

```ts
const completion = await chatWithLLM(messages, tools, tool_choice, model, { stream: false });
return res.json(completion);
```

- [ ] **Step 5: Run ai-service tests**

Run:

```bash
./node_modules/.bin/jest --config services/ai/jest.config.js services/ai/tests/ai.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit ai-service streaming**

Run:

```bash
git add services/ai/src/services/aiService.ts services/ai/src/controllers/aiController.ts services/ai/tests/ai.test.ts
git commit -m "feat: stream ai chat completions"
```

## Task 2: Gateway Streaming-Friendly AI Proxy

**Files:**
- Modify: `services/gateway/src/proxyManager.ts`
- Create: `services/gateway/tests/proxyManager.test.ts`

- [ ] **Step 1: Add failing proxy option tests**

Create `services/gateway/tests/proxyManager.test.ts`:

```ts
const createProxyMiddlewareMock = jest.fn((options) => {
  const middleware = jest.fn((_req, _res, next) => next?.());
  (middleware as any).__proxyOptions = options;
  return middleware;
});

jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: createProxyMiddlewareMock,
}));

import { __private__ } from '../src/proxyManager';

describe('proxyManager proxy options', () => {
  beforeEach(() => {
    createProxyMiddlewareMock.mockClear();
  });

  it('uses streaming-friendly timeout for AI routes', () => {
    const proxy = __private__.createProxy('http://ai:3001', '/api/ai') as any;
    expect(proxy.__proxyOptions.proxyTimeout).toBe(0);
    expect(proxy.__proxyOptions.timeout).toBe(0);
  });

  it('keeps default timeout for non-AI routes', () => {
    const proxy = __private__.createProxy('http://auth:3002', '/api/auth') as any;
    expect(proxy.__proxyOptions.proxyTimeout).toBe(30000);
    expect(proxy.__proxyOptions.timeout).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the failing gateway proxy test**

Run:

```bash
./node_modules/.bin/jest --config services/gateway/jest.config.js services/gateway/tests/proxyManager.test.ts --runInBand
```

Expected: FAIL because `createProxy` is not exposed and all proxies use `proxyTimeout: 30000`.

- [ ] **Step 3: Implement route-aware proxy options**

In `services/gateway/src/proxyManager.ts`, change `createProxy` to accept `route`:

```ts
const isAiRoute = (route: string) => route === '/api/ai' || route.startsWith('/api/ai/');

const createProxy = (targetUrl: string, route: string) => {
  const streamingFriendlyTimeout = isAiRoute(route);
  return createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    proxyTimeout: streamingFriendlyTimeout ? 0 : 30000,
    ...(streamingFriendlyTimeout ? { timeout: 0 } : {}),
    on: {
      proxyReq: (proxyReq, req) => forwardUserContextHeaders(proxyReq, req as Request),
    },
    pathRewrite: (path, req) => {
      const fullPath = ((req as Request).baseUrl || '') + path;
      return fullPath;
    },
  } as Options);
};
```

Update proxy creation:

```ts
const proxies = urls.map((url) => createProxy(url, route));
```

Add a test-only export at the bottom:

```ts
export const __private__ = {
  createProxy,
  isAiRoute,
};
```

- [ ] **Step 4: Run gateway focused tests**

Run:

```bash
./node_modules/.bin/jest --config services/gateway/jest.config.js services/gateway/tests/proxyManager.test.ts services/gateway/tests/health.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit gateway proxy change**

Run:

```bash
git add services/gateway/src/proxyManager.ts services/gateway/tests/proxyManager.test.ts
git commit -m "feat: allow ai streaming through gateway"
```

## Task 3: Frontend Stream Assembly

**Files:**
- Modify: `frontend/src/services/llmApi.ts`
- Create: `frontend/src/services/llmApi.test.ts`

- [ ] **Step 1: Add failing stream assembler tests**

Create `frontend/src/services/llmApi.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { assembleStreamingChatCompletion } from './llmApi';

async function* chunks(values: any[]) {
  for (const value of values) {
    yield value;
  }
}

describe('assembleStreamingChatCompletion', () => {
  it('streams text deltas and returns an assembled completion', async () => {
    const onStream = vi.fn();

    const completion = await assembleStreamingChatCompletion(
      chunks([
        { id: 'chunk-1', model: 'm', choices: [{ index: 0, delta: { role: 'assistant', content: '你' } }] },
        { id: 'chunk-1', model: 'm', choices: [{ index: 0, delta: { content: '好' }, finish_reason: 'stop' }] },
      ]) as any,
      onStream,
      'MiniMax-M2.7'
    );

    expect(onStream).toHaveBeenNthCalledWith(1, '你');
    expect(onStream).toHaveBeenNthCalledWith(2, '好');
    expect(completion.choices[0].message.content).toBe('你好');
    expect(completion.choices[0].finish_reason).toBe('stop');
  });

  it('assembles streamed tool calls with split arguments', async () => {
    const completion = await assembleStreamingChatCompletion(
      chunks([
        {
          id: 'chunk-tools',
          choices: [{
            index: 0,
            delta: {
              tool_calls: [{
                index: 0,
                id: 'call-1',
                type: 'function',
                function: { name: 'write_file', arguments: '{\"path\"' },
              }],
            },
          }],
        },
        {
          id: 'chunk-tools',
          choices: [{
            index: 0,
            delta: {
              tool_calls: [{
                index: 0,
                function: { arguments: ':\"src/app.ts\"}' },
              }],
            },
            finish_reason: 'tool_calls',
          }],
        },
      ]) as any,
      undefined,
      'MiniMax-M2.7'
    );

    expect(completion.choices[0].message.tool_calls).toEqual([
      {
        id: 'call-1',
        type: 'function',
        function: { name: 'write_file', arguments: '{\"path\":\"src/app.ts\"}' },
      },
    ]);
    expect(completion.choices[0].finish_reason).toBe('tool_calls');
  });
});
```

- [ ] **Step 2: Run the failing llmApi tests**

Run:

```bash
./node_modules/.bin/vitest run src/services/llmApi.test.ts
```

from `frontend`.

Expected: FAIL because `assembleStreamingChatCompletion` does not exist.

- [ ] **Step 3: Implement stream assembler and dual-mode `chatWithTools`**

In `frontend/src/services/llmApi.ts`, export:

```ts
type ChatCompletionChunkStream = AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

export async function assembleStreamingChatCompletion(
  stream: ChatCompletionChunkStream,
  onStream: ((chunk: string) => void) | undefined,
  model: string
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  let content = '';
  let finishReason: OpenAI.Chat.Completions.ChatCompletion.Choice['finish_reason'] = 'stop';
  let completionId = `chatcmpl-${Date.now()}`;
  const toolCalls = new Map<number, {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>();

  for await (const chunk of stream) {
    if (chunk.id) completionId = chunk.id;
    const choice = chunk.choices?.[0];
    if (!choice) continue;
    if (choice.finish_reason) finishReason = choice.finish_reason as any;
    const delta = choice.delta;
    if (delta?.content) {
      content += delta.content;
      onStream?.(delta.content);
    }
    for (const part of delta?.tool_calls ?? []) {
      const index = part.index ?? 0;
      const existing = toolCalls.get(index) ?? {
        id: part.id ?? `call-${index}`,
        type: 'function' as const,
        function: { name: '', arguments: '' },
      };
      if (part.id) existing.id = part.id;
      if (part.type === 'function') existing.type = 'function';
      if (part.function?.name) existing.function.name += part.function.name;
      if (part.function?.arguments) existing.function.arguments += part.function.arguments;
      toolCalls.set(index, existing);
    }
  }

  const assembledToolCalls = [...toolCalls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, call]) => call);

  return {
    id: completionId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: content || null,
        ...(assembledToolCalls.length > 0 ? { tool_calls: assembledToolCalls } : {}),
      },
      finish_reason: finishReason,
      logprobs: null,
    }],
  } as OpenAI.Chat.Completions.ChatCompletion;
}
```

Update `chatWithTools`:

```ts
const selectedModel = model || 'MiniMax-M2.7';
const response = await llmClient.chat.completions.create({
  model: selectedModel,
  messages: messages as any,
  tools,
  tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
  stream: !!onStream,
});

if (onStream) {
  return assembleStreamingChatCompletion(response as ChatCompletionChunkStream, onStream, selectedModel);
}

return response as OpenAI.Chat.Completions.ChatCompletion;
```

- [ ] **Step 4: Run llmApi tests**

Run:

```bash
./node_modules/.bin/vitest run src/services/llmApi.test.ts
```

from `frontend`.

Expected: PASS.

- [ ] **Step 5: Commit frontend stream assembly**

Run:

```bash
git add frontend/src/services/llmApi.ts frontend/src/services/llmApi.test.ts
git commit -m "feat: assemble streamed chat completions"
```

## Task 4: Agent Runtime Incremental Streaming UI

**Files:**
- Modify: `frontend/src/agent/useAgentRuntime.ts`
- Modify: `frontend/src/agent/useAgentRuntime.test.ts`

- [ ] **Step 1: Add failing runtime streaming tests**

Append tests in `frontend/src/agent/useAgentRuntime.test.ts`:

```ts
it('updates assistant content while chat completion streams', async () => {
  chatWithToolsMock.mockImplementationOnce(async (_messages, _tools, onStream) => {
    onStream?.('你');
    onStream?.('好');
    return {
      choices: [{
        message: { role: 'assistant', content: '你好' },
      }],
    };
  });

  const { result } = renderHook(() => useAgentRuntime({ topicId: 'topic-1', agentType: 'building' }));

  await act(async () => {
    await result.current.runAgentLoop('say hi');
  });

  expect(chatWithToolsMock).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), expect.any(Function), 'MiniMax-M2.7');
  expect(useAgentStore.getState().visibleMessages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ role: 'assistant', content: '你好' }),
    ])
  );
});

it('executes streamed tool calls only after the full assistant message is assembled', async () => {
  chatWithToolsMock
    .mockImplementationOnce(async (_messages, _tools, onStream) => {
      onStream?.('');
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
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
      choices: [{ message: { role: 'assistant', content: 'done' } }],
    });

  const { result } = renderHook(() => useAgentRuntime({ topicId: 'topic-1', agentType: 'building' }));

  await act(async () => {
    await result.current.runAgentLoop('write file');
  });

  expect(executeToolMock).toHaveBeenCalledWith('write_file', { path: 'src/app.ts', content: 'hello' });
  expect(saveToOSSMock).toHaveBeenCalledWith('topic-1', undefined, { force: true });
});
```

- [ ] **Step 2: Run the failing runtime tests**

Run:

```bash
./node_modules/.bin/vitest run src/agent/useAgentRuntime.test.ts
```

from `frontend`.

Expected: FAIL because `runAgentLoop` calls `chatWithTools` with `undefined` stream callback and does not update assistant content during streaming.

- [ ] **Step 3: Implement streaming callback in runtime**

In `frontend/src/agent/useAgentRuntime.ts`, inside each LLM loop iteration before `chatWithTools`:

```ts
let didCreateStreamingAssistantMessage = false;
let streamedAssistantContent = '';

const handleStreamChunk = (chunk: string) => {
  if (!chunk) return;
  streamedAssistantContent += chunk;
  if (!didCreateStreamingAssistantMessage) {
    didCreateStreamingAssistantMessage = true;
    addVisibleMessage({ role: 'assistant', content: streamedAssistantContent } as AgentMessage);
    return;
  }
  updateLastMessage((msg) => (
    msg.role === 'assistant'
      ? { ...msg, content: `${msg.content || ''}${chunk}` }
      : msg
  ));
};
```

Call:

```ts
const completion = await chatWithTools(internalMessages, openAITools, handleStreamChunk, model);
```

Replace assistant visible-message add logic with:

```ts
if (assistantContent || tools.length > 0) {
  if (didCreateStreamingAssistantMessage) {
    updateLastMessage((msg) => {
      if (msg.role !== 'assistant') return msg;
      return {
        ...msg,
        content: assistantContent || streamedAssistantContent,
        ...(tools.length > 0 ? { tools } : {}),
      } as AgentMessage;
    });
  } else {
    addVisibleMessage({
      role: 'assistant',
      content: assistantContent,
      ...(tools.length > 0 ? { tools } : {}),
    } as AgentMessage);
  }
}
```

- [ ] **Step 4: Run runtime tests**

Run:

```bash
./node_modules/.bin/vitest run src/agent/useAgentRuntime.test.ts
```

from `frontend`.

Expected: PASS.

- [ ] **Step 5: Run all focused streaming tests**

Run:

```bash
./node_modules/.bin/vitest run src/services/llmApi.test.ts src/agent/useAgentRuntime.test.ts
./node_modules/.bin/jest --config services/ai/jest.config.js services/ai/tests/ai.test.ts --runInBand
./node_modules/.bin/jest --config services/gateway/jest.config.js services/gateway/tests/proxyManager.test.ts services/gateway/tests/health.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit runtime streaming**

Run:

```bash
git add frontend/src/agent/useAgentRuntime.ts frontend/src/agent/useAgentRuntime.test.ts
git commit -m "feat: stream agent assistant output"
```

## Task 5: Type Checking And Final Verification

**Files:**
- Verify backend/frontend TypeScript for touched packages.

- [ ] **Step 1: Run TypeScript checks for touched packages**

Run:

```bash
./node_modules/.bin/tsc -p services/ai/tsconfig.json --noEmit --pretty false
./node_modules/.bin/tsc -p services/gateway/tsconfig.json --noEmit --pretty false
./node_modules/.bin/tsc -p frontend/tsconfig.json --noEmit --pretty false
```

Expected: all exit 0.

- [ ] **Step 2: Inspect final diff and status**

Run:

```bash
git status --short
git log --oneline -8
```

Expected: worktree is clean after commits; recent commits include plan plus four implementation commits.

## Self-Review

- Spec coverage: ai-service streaming, gateway timeout, frontend stream assembly, Agent runtime streaming UI, compatibility, and tests all have tasks.
- Placeholder scan: no placeholder-only implementation steps remain.
- Type consistency: `stream`, `assembleStreamingChatCompletion`, `onStream`, and `initial tool call assembly` names match across tasks.
- Scope is focused on the full LLM streaming chain; no database, provider config, WebSocket, or conversation schema changes are included.
