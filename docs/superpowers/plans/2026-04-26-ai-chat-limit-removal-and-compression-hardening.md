# AI Chat Limit Removal And Compression Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the AI chat endpoint's hard message-count and per-message-content limits, delete the tests that encode those limits, and harden agent context compression so failed or empty compression cannot erase conversation state.

**Architecture:** Keep `services/ai` responsible for request shape validation only: `messages` must be a non-empty array with valid OpenAI-compatible roles and content types, but the service should not impose arbitrary count or character caps. Keep resource protection at the transport and runtime levels (`express.json({ limit: '10mb' })`, auth, rate limits, frontend token budgeting). Make frontend compression atomic: only replace visible messages and compressed context after a non-empty summary and non-empty recent window are available.

**Tech Stack:** Express, OpenAI-compatible Chat Completions, Jest, Vitest, React/Zustand agent runtime, TypeScript.

---

## File Structure

- Modify `services/ai/src/controllers/aiController.ts`: remove `MAX_MESSAGES`, `MAX_MESSAGE_CONTENT_LENGTH`, and all content/count rejection logic while keeping structural validation.
- Modify `services/ai/tests/ai.test.ts`: delete the two tests named `rejects message list exceeding 100 messages` and `rejects too long message content`; do not replace them with new allow-list tests.
- Modify `frontend/src/agent/contextCompression.ts`: make compression summary generation reject blank LLM summaries before returning to the caller.
- Modify `frontend/src/agent/BaseAgent.ts`: make compression state updates atomic and abort compression when the generated summary is blank.
- Modify `frontend/src/agent/BaseAgent.test.ts`: add normal compression coverage plus regression coverage that compression failure or blank summary never writes an empty compressed summary or empty recent message window.
- Modify `frontend/src/agent/contextCompression.test.ts`: fix the current regular-sized conversation assertion so it matches the greedy recent-window contract.

## Task 1: Remove AI Chat Hard Limits

**Files:**
- Modify: `services/ai/src/controllers/aiController.ts`
- Modify: `services/ai/tests/ai.test.ts`

- [ ] **Step 1: Delete the obsolete limit tests**

In `services/ai/tests/ai.test.ts`, remove these two complete test blocks:

```ts
it('rejects message list exceeding 100 messages', async () => {
  authenticateUser();

  const response = await request(app)
    .post('/api/ai/chat/completions')
    .set('Authorization', 'Bearer token')
    .send({
      messages: Array.from({ length: 101 }).map((_, i) => ({ role: 'user', content: `m-${i}` })),
    });

  expect(response.status).toBe(400);
});
```

```ts
it('rejects too long message content', async () => {
  authenticateUser();

  const response = await request(app)
    .post('/api/ai/chat/completions')
    .set('Authorization', 'Bearer token')
    .send({
      messages: [{ role: 'user', content: 'x'.repeat(10001) }],
    });

  expect(response.status).toBe(400);
});
```

- [ ] **Step 2: Run the AI service test to verify the old code still passes without obsolete tests**

Run:

```bash
npm test -- --config services/ai/jest.config.js services/ai/tests/ai.test.ts --runInBand
```

Expected: PASS. This confirms the test suite no longer requires those arbitrary limits before implementation changes.

- [ ] **Step 3: Remove the constants and rejection branches**

In `services/ai/src/controllers/aiController.ts`, delete:

```ts
const MAX_MESSAGES = 100;
const MAX_MESSAGE_CONTENT_LENGTH = 10000;
```

Replace `validateMessages` with:

```ts
const validateMessages = (messages: unknown): string | null => {
  if (!Array.isArray(messages)) {
    return 'messages must be an array';
  }
  if (messages.length === 0) {
    return 'messages must be a non-empty array';
  }
  for (const message of messages) {
    if (!message || typeof message !== 'object') {
      return 'each message must be an object';
    }
    const role = (message as { role?: unknown }).role;
    const content = (message as { content?: unknown }).content;
    if (typeof role !== 'string' || !ALLOWED_MESSAGE_ROLES.has(role)) {
      return 'message role is invalid';
    }
    // Tool messages can have null content; assistant messages with tool_calls can also have null content.
    if (role === 'tool' || role === 'assistant') {
      if (content !== null && content !== undefined && typeof content !== 'string') {
        return 'message content must be a string or null';
      }
    } else {
      // User/system messages must have non-empty string content.
      if (typeof content !== 'string' || !content.trim()) {
        return 'message content must be a non-empty string';
      }
    }
  }
  return null;
};
```

- [ ] **Step 4: Run the AI service tests**

Run:

```bash
npm test -- --config services/ai/jest.config.js services/ai/tests/ai.test.ts --runInBand
```

Expected: PASS. Existing validation tests for invalid payload, invalid role, empty messages, tools forwarding, and streaming behavior should still pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add services/ai/src/controllers/aiController.ts services/ai/tests/ai.test.ts
git commit -m "fix: remove ai chat hard message limits"
```

## Task 2: Reject Blank Compression Summaries

**Files:**
- Modify: `frontend/src/agent/contextCompression.ts`
- Test: `frontend/src/agent/contextCompression.test.ts`

- [ ] **Step 1: Add compression summary tests**

In `frontend/src/agent/contextCompression.test.ts`, update the import from:

```ts
import { selectRecentWindowGreedy } from './contextCompression';
```

to:

```ts
import { selectRecentWindowGreedy, compressWithLlmOrFallback } from './contextCompression';
```

Then append these tests after the `selectRecentWindowGreedy` describe block:

```ts
describe('compressWithLlmOrFallback', () => {
  it('falls back when the llm compression request throws', async () => {
    const summary = await compressWithLlmOrFallback(
      'compress this',
      {
        previousCompressedSummary: '',
        newlyCompressibleMessages: [
          createMessage('msg-1', 'user', 'Please remember this requirement') as RuntimeMessage,
        ],
      },
      async () => {
        throw new Error('request failed');
      }
    );

    expect(summary).toContain('## 历史概览');
    expect(summary).toContain('共 1 条消息被压缩');
  });

  it('falls back when the llm compression request returns blank content', async () => {
    const summary = await compressWithLlmOrFallback(
      'compress this',
      {
        previousCompressedSummary: '',
        newlyCompressibleMessages: [
          createMessage('msg-1', 'assistant', 'Important implementation detail') as RuntimeMessage,
        ],
      },
      async () => '   '
    );

    expect(summary).toContain('## 历史概览');
    expect(summary).toContain('共 1 条消息被压缩');
  });
});
```

Also fix the existing regular-sized conversation test by changing the generated message content from 500 characters to 10,000 characters:

```ts
const messages = Array.from({ length: 20 }, (_, i) =>
  createMessage(`msg-${i}`, i % 2 === 0 ? 'user' as const : 'assistant' as const, `Message ${i}: ${'x'.repeat(10_000)}`)
);
```

- [ ] **Step 2: Run the focused compression tests and verify the blank-summary test fails**

Run:

```bash
npm test -- src/agent/contextCompression.test.ts
```

Expected: FAIL on `falls back when the llm compression request returns blank content`, because blank LLM output is currently accepted as a successful summary.

- [ ] **Step 3: Make blank LLM summaries fall back**

In `frontend/src/agent/contextCompression.ts`, replace `compressWithLlmOrFallback` with:

```ts
export async function compressWithLlmOrFallback(
  compressionPrompt: string,
  input: {
    previousCompressedSummary: string;
    newlyCompressibleMessages: RuntimeMessage[];
  },
  requestCompressionSummary: (prompt: string) => Promise<string>
): Promise<string> {
  try {
    const summary = await requestCompressionSummary(compressionPrompt);
    if (!summary.trim()) {
      throw new Error('Compression summary is empty');
    }
    return summary;
  } catch {
    return buildRuleBasedCompressionSummary(input);
  }
}
```

- [ ] **Step 4: Run the focused compression tests**

Run:

```bash
npm test -- src/agent/contextCompression.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add frontend/src/agent/contextCompression.ts frontend/src/agent/contextCompression.test.ts
git commit -m "fix: reject blank compression summaries"
```

## Task 3: Make Compression State Updates Atomic

**Files:**
- Modify: `frontend/src/agent/BaseAgent.ts`
- Test: `frontend/src/agent/BaseAgent.test.ts`

- [ ] **Step 1: Add a test agent hook for compression**

In `frontend/src/agent/BaseAgent.test.ts`, update the type imports from:

```ts
import type {
  AgentCompressedContext,
  AgentType,
  PersistedAgentMessage,
} from '@web-learn/shared';
```

to:

```ts
import type {
  AgentCompressedContext,
  AgentType,
  PersistedAgentMessage,
} from '@web-learn/shared';
import type { AgentSessionContext } from './BaseAgent';
```

Then update `TestAgent` to expose `maybeCompressContextBeforeLlmRequest` and allow a mocked compression response:

```ts
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
```

- [ ] **Step 2: Add regression tests for failed and blank compression**

Append these tests inside `describe('BaseAgent', () => { ... })`:

```ts
it('uses fallback compression without writing empty visible messages when the compression request fails', async () => {
  let currentVisibleMessages = [
    createPersistedMessage('msg-1', 'x'.repeat(260_000)),
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
    createPersistedMessage('msg-1', 'x'.repeat(260_000)),
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
```

These tests intentionally expect fallback compression to keep the newest message while storing a non-empty fallback summary. The goal is not to keep every old message forever; the goal is to prevent `hasCompressedContext: true` with `summary: ''` or `messages: []`.

- [ ] **Step 3: Add normal successful compression behavior tests**

Append these tests inside `describe('BaseAgent', () => { ... })`:

```ts
it('compresses normal long context into summary plus recent visible window', async () => {
  let currentVisibleMessages = [
    createPersistedMessage('msg-1', 'Project goal: build a React learning page. ' + 'a'.repeat(120_000)),
    createPersistedMessage('msg-2', 'Constraint: keep the UI in Chinese. ' + 'b'.repeat(80_000)),
    createPersistedMessage('msg-3', 'Recent user request: continue polishing the hero section.'),
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
    createPersistedMessage('msg-1', 'Old context ' + 'a'.repeat(120_000)),
    createPersistedMessage('msg-2', 'Recent request: adjust layout.'),
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

  expect(llmMessages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('以下是此前较早历史的压缩记忆'),
      }),
      expect.objectContaining({
        role: 'user',
        content: 'Recent request: adjust layout.',
      }),
    ])
  );
  expect(llmMessages.map((m) => m.content).join('\n')).not.toContain('Old context aaaaa');
});
```

- [ ] **Step 4: Run BaseAgent tests**

Run:

```bash
npm test -- src/agent/BaseAgent.test.ts
```

Expected: PASS after Task 2, because blank summaries now fall back before `BaseAgent` receives them.

- [ ] **Step 5: Add a defensive guard in BaseAgent**

In `frontend/src/agent/BaseAgent.ts`, add this guard immediately after `nextSummary` is computed and before `nextCompressedContext` is created:

```ts
    if (!nextSummary.trim()) {
      return;
    }
```

The surrounding block should be:

```ts
    const nextSummary = await compressWithLlmOrFallback(
      compressionPrompt,
      {
        previousCompressedSummary: compressedContext.summary,
        newlyCompressibleMessages,
      },
      this.requestCompressionSummary.bind(this)
    );

    if (!nextSummary.trim()) {
      return;
    }

    const nextCompressedContext: AgentCompressedContext = {
      summary: nextSummary,
      summaryVersion: 1,
      firstUncompressedMessageId: recentMessages[0]?.id ?? null,
      updatedAt: new Date().toISOString(),
      hasCompressedContext: true,
    };
```

- [ ] **Step 6: Run BaseAgent tests again**

Run:

```bash
npm test -- src/agent/BaseAgent.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add frontend/src/agent/BaseAgent.ts frontend/src/agent/BaseAgent.test.ts
git commit -m "fix: harden compression state updates"
```

## Task 4: Verify The Agent Runtime With Removed Limits

**Files:**
- Test only: `services/ai/tests/ai.test.ts`
- Test only: `frontend/src/agent/contextCompression.test.ts`
- Test only: `frontend/src/agent/BaseAgent.test.ts`
- Test only: `frontend/src/agent/useAgentRuntime.test.ts`

- [ ] **Step 1: Run AI service tests**

Run:

```bash
npm test -- --config services/ai/jest.config.js services/ai/tests/ai.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run frontend agent tests**

Run:

```bash
npm test -- src/agent/contextCompression.test.ts src/agent/BaseAgent.test.ts src/agent/useAgentRuntime.test.ts
```

Expected: PASS.

- [ ] **Step 3: Verify the normal compression scenario is covered**

Before type-checking, inspect `frontend/src/agent/BaseAgent.test.ts` and confirm it contains both normal-path tests:

```bash
rg -n "compresses normal long context into summary plus recent visible window|builds llm messages with compressed memory followed by recent messages" frontend/src/agent/BaseAgent.test.ts
```

Expected: both test names are printed. These tests are required because the feature must prove a realistic long context can compress successfully, not only that failure cases are guarded.

- [ ] **Step 4: Run TypeScript checks**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Run a manual normal compression smoke test when a dev LLM is available**

Use a local/dev environment with a working AI provider. Temporarily lower the compression trigger in `shared/src/agent/contextCompression.ts` only in the local working copy if needed, then start the app and run one agent conversation with enough history to trigger compression.

Expected:
- the new message sends successfully through `/api/ai/chat/completions`;
- the UI shows `较早历史已压缩，当前对话基于摘要继续。`;
- the visible chat still contains the recent message window instead of an empty state;
- `GET /api/ai/conversations/:topicId/:agentType` returns `compressedContext.hasCompressedContext === true`;
- `compressedContext.summary.trim()` is non-empty;
- `messages.length > 0`;
- the next agent reply can refer to facts from the compressed summary.

Do not commit the temporary trigger change.

- [ ] **Step 6: Commit verification-only fixes if needed**

Only if verification reveals small type or test issues, commit them:

```bash
git add frontend/src/agent services/ai/src/controllers/aiController.ts services/ai/tests/ai.test.ts
git commit -m "test: verify ai chat limit removal"
```

If no files changed during verification, skip this commit.

## Non-Goals

- Do not reduce `MAX_TOOL_LOOPS = 1000`.
- Do not change `express.json({ limit: '10mb' })` in `services/ai/src/app.ts`.
- Do not change AI chat route rate limits in this plan.
- Do not add replacement tests that assert 101 messages or 10,001 characters are accepted; the user explicitly requested deleting the obsolete limit tests rather than modifying them.
- Do not redesign the compression budget values in `shared/src/agent/contextCompression.ts`.

## Verification Checklist

- [ ] `services/ai/src/controllers/aiController.ts` no longer contains `MAX_MESSAGES`.
- [ ] `services/ai/src/controllers/aiController.ts` no longer contains `MAX_MESSAGE_CONTENT_LENGTH`.
- [ ] `services/ai/tests/ai.test.ts` no longer contains `rejects message list exceeding 100 messages`.
- [ ] `services/ai/tests/ai.test.ts` no longer contains `rejects too long message content`.
- [ ] `frontend/src/agent/contextCompression.ts` never returns a blank LLM summary as a successful compression result.
- [ ] `frontend/src/agent/BaseAgent.ts` never writes a compressed context with a blank summary.
- [ ] Focused AI service and frontend agent tests pass.

## Risks

- Removing the AI chat hard limits means malformed-but-large requests rely on the 10MB JSON body limit, auth, and rate limits. This is intentional for agent workloads, but production monitoring should watch request size and latency.
- The current fallback summary is still sparse. It prevents total context loss, but it does not preserve rich historical detail. A later plan should improve fallback summaries if LLM compression is unavailable.
- The fixed 800-character historical-message normalization remains a quality risk for code and long logs. This plan does not change it because the user asked specifically to remove the AI chat limits and delete the corresponding tests.
