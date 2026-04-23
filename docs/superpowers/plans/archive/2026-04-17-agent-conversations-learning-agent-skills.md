# Agent Conversations, Learning Agent, and Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist visible agent conversations on the backend, add detailed context compression for long-running sessions, add a browsing-side learning agent, and introduce a first-version agent skill system shared by building and learning agents.

**Architecture:** Keep the current frontend-owned tool loop for building-agent file operations, while extending the AI service to own conversation persistence, compressed context storage, and skill metadata contracts. Refactor the frontend runtime around a higher-level `BaseAgent` abstraction that owns the shared flow: hydration, compression preflight, LLM call loop, and persistence. `BuildAgent` and `AskAgent` become concrete subclasses that override prompt behavior and UI entrypoints while sharing the same tool-registration strategy, compression strategy, and persistence flow. Context compression is a frontend preflight step that runs before every new LLM request, uses token pressure rather than message counts, preserves the newest `32k` recent window, and persists only visible messages plus the resulting summary and compression cursor to the backend. Compression must not depend on persisted tool-call history.

**Tech Stack:** React 18, TypeScript, Zustand, Axios, Express, Sequelize, MySQL, OpenAI-compatible chat completions, Playwright, Jest

---

## File Structure

### Backend

- Create: `services/ai/src/models/AgentConversation.ts`
- Create: `services/ai/src/models/AgentMessage.ts`
- Modify: `services/ai/src/models/index.ts`
- Create: `services/ai/src/controllers/agentConversationController.ts`
- Create: `services/ai/src/routes/agentConversationRoutes.ts`
- Modify: `services/ai/src/app.ts`
- Modify: `services/ai/src/index.ts`
- Modify: `services/ai/src/utils/database.ts`
- Create: `services/ai/tests/agent-conversations.test.ts`
- Modify: `services/ai/tests/ai.test.ts`

### Shared Contracts

- Modify: `shared/src/agent/types.ts`
- Modify: `shared/src/types/index.ts`
- Create: `shared/src/agent/skills.ts`
- Create: `shared/src/agent/contextCompression.ts`
- Modify: `shared/src/index.ts`

### Frontend Runtime and API

- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/services/llmApi.ts`
- Modify: `frontend/src/stores/useAgentStore.ts`
- Create: `frontend/src/agent/BaseAgent.ts`
- Create: `frontend/src/agent/BuildAgent.ts`
- Create: `frontend/src/agent/AskAgent.ts`
- Modify: `frontend/src/agent/useAgentRuntime.ts`
- Modify: `frontend/src/components/AgentChatContent.tsx`
- Modify: `frontend/src/components/AIChatSidebar.tsx`
- Modify: `frontend/src/components/editor/AgentPanelHeaderRight.tsx`
- Create: `frontend/src/agent/contextCompression.ts`
- Create: `frontend/src/agent/runtimeMessage.ts`

### Frontend Learning Agent

- Modify: `frontend/src/pages/WebsiteTopicPage.tsx`
- Modify: `frontend/src/pages/PublishedTopicPage.tsx`
- Create: `frontend/src/pages/WebsiteTopicPage.test.tsx`
- Modify: `frontend/src/pages/PublishedTopicPage.test.tsx`

### Frontend Skills

- Create: `frontend/src/agent/skills.ts`
- Create: `frontend/src/agent/systemPrompts.ts`
- Modify: `frontend/src/components/editor/AgentPanelHeaderRight.tsx`
- Modify: `frontend/src/components/AgentChatContent.tsx`

### Docs

- Modify: `docs/spec/data-models.md`
- Modify: `docs/spec/ai-service.md`
- Modify: `docs/spec/frontend-architecture.md`

---

### Task 1: Add Shared Agent Conversation and Skill Contracts

**Files:**
- Create: `shared/src/agent/skills.ts`
- Create: `shared/src/agent/contextCompression.ts`
- Modify: `shared/src/agent/types.ts`
- Modify: `shared/src/types/index.ts`
- Modify: `shared/src/index.ts`
- Test: `pnpm --filter @web-learn/shared build`

- [x] **Step 1: Define shared conversation and skill types**

```ts
// shared/src/agent/skills.ts
export type AgentType = 'building' | 'learning';

export interface AgentSkillDefinition {
  id: string;
  name: string;
  description: string;
  appliesTo: AgentType | 'both';
  systemPromptFragment: string;
  toolNames?: string[];
}

export const AGENT_SKILLS: AgentSkillDefinition[] = [
  {
    id: 'topic-planner',
    name: '专题规划',
    description: '先规划教学结构，再进入实现',
    appliesTo: 'building',
    systemPromptFragment: '优先输出专题结构方案，得到确认后再生成代码。',
  },
  {
    id: 'topic-navigator',
    name: '内容导览',
    description: '优先定位结构和导航路径',
    appliesTo: 'learning',
    systemPromptFragment: '优先帮助用户定位模块、结构和阅读路径。',
  },
];
```

```ts
// shared/src/agent/types.ts
export interface AgentConversationSummary {
  id: string;
  topicId: string;
  userId: string;
  agentType: AgentType;
  selectedSkills: string[];
  updatedAt: string;
}

export interface PersistedAgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface PersistedConversationState {
  selectedSkills: string[];
  compressedContext: AgentCompressedContext;
  messages: PersistedAgentMessage[];
}

export interface AgentCompressedContext {
  summary: string;
  summaryVersion: number;
  lastCompressedMessageId: string | null;
  updatedAt: string;
  hasCompressedContext: boolean;
}
```

```ts
// shared/src/agent/contextCompression.ts
export interface AgentContextBudget {
  totalContextTokens: number;
  compressionTriggerTokens: number;
  recentWindowTokens: number;
  summaryTargetTokens: number;
}

export interface CompressionDecision {
  shouldCompress: boolean;
  estimatedPromptTokens: number;
}

export function defaultAgentContextBudget(): AgentContextBudget {
  return {
    totalContextTokens: 200_000,
    compressionTriggerTokens: 128_000,
    recentWindowTokens: 32_000,
    summaryTargetTokens: 12_000,
  };
}

export function shouldCompressConversation(
  estimatedPromptTokens: number,
  budget: AgentContextBudget
): CompressionDecision {
  return {
    shouldCompress: estimatedPromptTokens >= budget.compressionTriggerTokens,
    estimatedPromptTokens,
  };
}
```

- [x] **Step 2: Export the new types from shared entrypoints**

```ts
// shared/src/index.ts
export * from './agent/skills';
export * from './agent/contextCompression';
export * from './agent/types';
```

```ts
// shared/src/types/index.ts
export type {
  AgentConversationSummary,
  PersistedConversationState,
  PersistedAgentMessage,
} from '../agent/types';
```

- [x] **Step 3: Run shared package build**

Run: `pnpm --filter @web-learn/shared build`
Expected: `tsc` completes without type errors

- [x] **Step 4: Commit**

```bash
git add shared/src/agent/skills.ts shared/src/agent/contextCompression.ts shared/src/agent/types.ts shared/src/types/index.ts shared/src/index.ts
git commit -m "feat: add shared agent conversation and compression contracts"
```

---

### Task 2: Add AI Service Conversation Persistence APIs

**Files:**
- Create: `services/ai/src/models/AgentConversation.ts`
- Create: `services/ai/src/models/AgentMessage.ts`
- Modify: `services/ai/src/models/index.ts`
- Create: `services/ai/src/controllers/agentConversationController.ts`
- Create: `services/ai/src/routes/agentConversationRoutes.ts`
- Modify: `services/ai/src/app.ts`
- Modify: `services/ai/src/index.ts`
- Test: `services/ai/tests/agent-conversations.test.ts`
- Test: `services/ai/tests/ai.test.ts`

- [x] **Step 1: Write failing backend API tests for loading and saving visible messages**

```ts
// services/ai/tests/agent-conversations.test.ts
it('loads conversation messages for topic and agentType', async () => {
  const response = await request(app)
    .get('/api/ai/conversations/topic-1/building')
    .set('Authorization', 'Bearer token');

  expect(response.status).toBe(200);
  expect(response.body.data.messages).toEqual([]);
});

it('replaces persisted visible messages selected skills and compressed context', async () => {
  const response = await request(app)
    .put('/api/ai/conversations/topic-1/building')
    .set('Authorization', 'Bearer token')
    .send({
      selectedSkills: ['topic-planner'],
      compressedContext: {
        summary: '## 历史概览\n- 已完成结构规划',
        summaryVersion: 1,
        lastCompressedMessageId: 'm-2',
        hasCompressedContext: true,
      },
      messages: [
        { id: 'm-3', role: 'user', content: '先帮我规划结构' },
        { id: 'm-4', role: 'assistant', content: '我先给出模块方案。' },
      ],
    });

  expect(response.status).toBe(200);
  expect(response.body.data.selectedSkills).toEqual(['topic-planner']);
  expect(response.body.data.compressedContext.lastCompressedMessageId).toBe('m-2');
  expect(response.body.data.messages).toHaveLength(2);
});
```

- [x] **Step 2: Run backend tests to verify the new endpoints fail**

Run: `pnpm --filter @web-learn/ai-service test -- agent-conversations.test.ts`
Expected: FAIL with missing route, model, or controller errors

- [x] **Step 3: Add Sequelize models for conversations and visible messages**

```ts
// services/ai/src/models/AgentConversation.ts
class AgentConversation extends Model {
  declare id: string;
  declare topicId: string;
  declare userId: string;
  declare agentType: 'building' | 'learning';
  declare selectedSkills: string[];
  declare compressedSummary: string;
  declare compressedSummaryVersion: number;
  declare lastCompressedMessageId: string | null;
  declare hasCompressedContext: boolean;
}

AgentConversation.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    topicId: { type: DataTypes.STRING(64), allowNull: false },
    userId: { type: DataTypes.STRING(64), allowNull: false },
    agentType: { type: DataTypes.ENUM('building', 'learning'), allowNull: false },
    selectedSkills: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    compressedSummary: { type: DataTypes.TEXT('long'), allowNull: false, defaultValue: '' },
    compressedSummaryVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    lastCompressedMessageId: { type: DataTypes.STRING(64), allowNull: true },
    hasCompressedContext: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { sequelize, tableName: 'ai_agent_conversations' }
);
```

```ts
// services/ai/src/models/AgentMessage.ts
class AgentMessage extends Model {
  declare id: string;
  declare conversationId: string;
  declare role: 'user' | 'assistant';
  declare content: string;
  declare seq: number;
}
```

- [x] **Step 4: Implement load/save controller endpoints**

```ts
// services/ai/src/controllers/agentConversationController.ts
export const getConversation = async (req: AuthRequest, res: Response) => {
  const { topicId, agentType } = req.params;
  const conversation = await AgentConversation.findOne({
    where: { topicId, userId: String(req.user!.id), agentType },
    include: [{ model: AgentMessage, as: 'messages' }],
    order: [[{ model: AgentMessage, as: 'messages' }, 'seq', 'ASC']],
  });

  return res.json({
    success: true,
    data: {
      selectedSkills: conversation?.selectedSkills ?? [],
      compressedContext: {
        summary: conversation?.compressedSummary ?? '',
        summaryVersion: conversation?.compressedSummaryVersion ?? 1,
        lastCompressedMessageId: conversation?.lastCompressedMessageId ?? null,
        hasCompressedContext: conversation?.hasCompressedContext ?? false,
        updatedAt: conversation?.updatedAt ?? new Date().toISOString(),
      },
      messages: (conversation?.messages ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    },
  });
};

export const replaceConversation = async (req: AuthRequest, res: Response) => {
  const { topicId, agentType } = req.params;
  const { messages, selectedSkills, compressedContext } = req.body;
  // validate role/content shape, validate compressedContext shape,
  // upsert conversation, replace visible messages transactionally
};
```

- [x] **Step 5: Register the routes in the AI service**

```ts
// services/ai/src/routes/agentConversationRoutes.ts
router.get('/conversations/:topicId/:agentType', internalAuthMiddleware, getConversation);
router.put('/conversations/:topicId/:agentType', internalAuthMiddleware, replaceConversation);
```

```ts
// services/ai/src/app.ts
app.use('/api/ai', aiRouter);
app.use('/api/ai', agentConversationRouter);
```

- [x] **Step 6: Run AI service tests**

Run: `pnpm --filter @web-learn/ai-service test`
Expected: existing proxy tests still pass and new conversation tests pass

- [x] **Step 7: Commit**

```bash
git add services/ai/src/models services/ai/src/controllers/agentConversationController.ts services/ai/src/routes/agentConversationRoutes.ts services/ai/src/app.ts services/ai/src/index.ts services/ai/tests/agent-conversations.test.ts services/ai/tests/ai.test.ts
git commit -m "feat: persist visible agent conversation state in ai service"
```

---

### Task 3: Add Detailed Context Compression for Long-Running Agent Sessions

**Files:**
- Create: `frontend/src/agent/contextCompression.ts`
- Create: `frontend/src/agent/runtimeMessage.ts`
- Create: `frontend/src/agent/BaseAgent.ts`
- Modify: `frontend/src/stores/useAgentStore.ts`
- Modify: `frontend/src/components/AgentChatContent.tsx`
- Modify: `frontend/src/services/api.ts`
- Test: `frontend/src/agent/useAgentRuntime.test.ts`
- Test: `services/ai/tests/agent-conversations.test.ts`

- [x] **Step 1: Write failing tests for frontend-triggered compression and backend cursor persistence**

```ts
it('compresses before a new llm request and persists recent visible messages plus cursor', async () => {
  mockCompressionRequest.mockResolvedValue('## 历史概览\n- 已完成结构规划\n\n## 关键记忆点\n- 用户要求中文界面');

  await runtime.runAgentLoop('继续实现首页');

  expect(mockReplaceConversation).toHaveBeenCalledWith(
    'topic-1',
    'building',
    expect.objectContaining({
      compressedContext: expect.objectContaining({
        hasCompressedContext: true,
        lastCompressedMessageId: expect.any(String),
      }),
      messages: expect.any(Array),
    })
  );
});
```

- [x] **Step 2: Run tests to verify compression persistence is not implemented yet**

Run: `pnpm --filter @web-learn/frontend test -- useAgentRuntime`
Expected: FAIL because the runtime has no preflight compression hook yet

- [x] **Step 3: Implement frontend token estimation and greedy recent-window selection**

```ts
// frontend/src/agent/runtimeMessage.ts
export interface RuntimeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}
```

```ts
// frontend/src/agent/contextCompression.ts
export function estimateMessageTokens(message: RuntimeMessage) {
  return Math.ceil(message.content.length / 4) + 12;
}

export function estimatePromptTokens(input: {
  systemPrompt: string;
  skillPrompt: string;
  compressedSummary: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  nextUserInput: string;
}) {
  return (
    Math.ceil(input.systemPrompt.length / 4) +
    Math.ceil(input.skillPrompt.length / 4) +
    Math.ceil(input.compressedSummary.length / 4) +
    Math.ceil(input.nextUserInput.length / 4) +
    input.messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0)
  );
}

export function selectRecentWindowGreedy(
  messages: RuntimeMessage[]
) {
  const selected: typeof messages = [];
  let used = 0;
  const maxRecentWindowTokens = defaultAgentContextBudget().recentWindowTokens;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const cost = estimateMessageTokens(messages[i]);
    if (used + cost > maxRecentWindowTokens) break;
    selected.unshift(messages[i]);
    used += cost;
  }

  return { recentMessages: selected, recentTokenEstimate: used };
}
```

- [x] **Step 4: Define message normalization for history before the greedy pointer**

```ts
// frontend/src/agent/contextCompression.ts
export function normalizeHistoricalMessage(message: RuntimeMessage): RuntimeMessage {
  return {
    ...message,
    content: message.content.length > 800 ? `${message.content.slice(0, 800)}...` : message.content,
  };
}
```

- [x] **Step 5: Design the compression prompt so it carries forward old compressed memory plus new old-history**

```ts
// frontend/src/agent/contextCompression.ts
export function buildCompressionPrompt(input: {
  agentType: 'building' | 'learning';
  topicTitle?: string;
  selectedSkills: string[];
  previousCompressedSummary: string;
  newlyCompressibleMessages: RuntimeMessage[];
}) {
  return [
    '你要把一段较早的 agent 对话压缩成“可继续推理的工作记忆”。',
    '输入包括两部分：旧的压缩摘要，以及本次新增进入压缩区的历史消息。',
    '要求：',
    '1. 先总结过去对话大致内容和整体推进过程。',
    '2. 再明确指出其中必须详细记住的重点。',
    '3. 只保留后续推理需要的信息。',
    '4. 不保留寒暄、重复表达、无结果讨论。',
    '5. 只写已经确认的内容；未确认内容必须标注“待确认”。',
    '6. 如果旧摘要与新增历史有冲突，以新增历史为准修正摘要。',
    '7. 不要重复 recent window 中仍保留原文的内容。',
    '输出必须严格使用以下结构：',
    '## 历史概览',
    '- ...',
    '## 关键记忆点',
    '- ...',
    '## 长期目标',
    '- ...',
    '## 已确认事实',
    '- ...',
    '## 已确认约束',
    '- ...',
    '## 已完成事项',
    '- ...',
    '## 当前未完成问题',
    '- ...',
    '## 下一步计划',
    '- ...',
    '',
    `当前 agentType: ${input.agentType}`,
    `当前专题: ${input.topicTitle ?? '未知专题'}`,
    `当前 skills: ${input.selectedSkills.join(', ') || '无'}`,
    '',
    '## 旧压缩摘要',
    input.previousCompressedSummary || '(无)',
    '',
    '## 本次新增进入压缩区的历史消息',
    input.newlyCompressibleMessages.map((m, i) => `${i + 1}. [${m.role}] ${m.content}`).join('\n'),
  ].join('\n');
}
```

- [x] **Step 6: Implement frontend preflight compression before every new LLM request**

```ts
// frontend/src/agent/BaseAgent.ts
async function maybeCompressContextBeforeLlmRequest(nextUserInput: string) {
  const { compressedContext, visibleMessages, selectedSkills, topicTitle } = this.context;
  const systemPrompt = this.buildSystemPrompt().content;
  const skillPrompt = buildSkillPrompt(selectedSkills);
  const estimatedPromptTokens = estimatePromptTokens({
    systemPrompt,
    skillPrompt,
    compressedSummary: compressedContext.summary,
    messages: visibleMessages,
    nextUserInput,
  });

  if (estimatedPromptTokens < defaultAgentContextBudget().compressionTriggerTokens) {
    return;
  }

  const { recentMessages } = selectRecentWindowGreedy(visibleMessages);
  const newlyCompressibleMessages = visibleMessages
    .slice(0, visibleMessages.length - recentMessages.length)
    .filter((message) => isAfterCompressionCursor(message, compressedContext.lastCompressedMessageId))
    .map(normalizeHistoricalMessage);

  if (newlyCompressibleMessages.length === 0) {
    return;
  }

  const compressionPrompt = buildCompressionPrompt({
    agentType: this.getAgentType(),
    topicTitle,
    selectedSkills,
    previousCompressedSummary: compressedContext.summary,
    newlyCompressibleMessages,
  });

  const nextSummary = await compressWithLlmOrFallback(compressionPrompt, {
    previousCompressedSummary: compressedContext.summary,
    newlyCompressibleMessages,
  });

  const nextCompressedContext = {
    summary: nextSummary,
    summaryVersion: 1,
    lastCompressedMessageId: newlyCompressibleMessages.at(-1)?.id ?? compressedContext.lastCompressedMessageId,
    updatedAt: new Date().toISOString(),
    hasCompressedContext: true,
  };

  this.context.setCompressedContext(nextCompressedContext);
  this.context.setVisibleMessages(recentMessages);
}
```

- [x] **Step 7: Add a single persistence entrypoint so compression does not race with normal saves**

```ts
// frontend/src/agent/BaseAgent.ts
async function persistConversationState() {
  await this.persistConversation({
    selectedSkills: this.context.selectedSkills,
    compressedContext: this.context.compressedContext,
    messages: this.context.visibleMessages,
  });
}

// rules:
// 1. maybeCompressContextBeforeLlmRequest updates in-memory state only
// 2. the run loop calls persistConversationState once after state changes settle
// 3. no second replaceConversation call should overwrite freshly compressed state with stale messages
```

- [x] **Step 8: Inject compressed summary into the next real LLM request**

```ts
// frontend/src/agent/BaseAgent.ts
if (compressedContext.hasCompressedContext && compressedContext.summary) {
  internalMessages.push({
    role: 'system',
    content: [
      '以下是此前较早历史的压缩记忆，请将其视为已确认的长期上下文。',
      '如果它与 recent window 冲突，以 recent window 为准。',
      compressedContext.summary,
    ].join('\n\n'),
  });
}
```

- [x] **Step 9: Keep the UI hint minimal**

```tsx
// frontend/src/components/AgentChatContent.tsx
{compressedContext.hasCompressedContext && (
  <div className="text-[11px] text-zinc-500 px-4 pt-2">
    较早历史已压缩，当前对话基于摘要继续。
  </div>
)}
```

- [x] **Step 10: Add fallback behavior for failed compression**

```ts
// frontend/src/agent/contextCompression.ts
export async function compressWithLlmOrFallback(
  compressionPrompt: string,
  input: {
    previousCompressedSummary: string;
    newlyCompressibleMessages: RuntimeMessage[];
  }
) {
  try {
    return await requestCompressionSummary(compressionPrompt);
  } catch {
    return buildRuleBasedCompressionSummary(input);
  }
}

// fallback rules:
// 1. preserve previous compressed summary header if it exists
// 2. keep "历史概览" and "关键记忆点" sections
// 3. if nothing useful can be extracted, keep the old summary unchanged
```

- [x] **Step 11: Run verification tests**

Run: `pnpm --filter @web-learn/frontend test -- useAgentRuntime`
Expected: runtime tests pass with preflight compression, greedy recent window selection, summary injection, and single persistence flow

- [x] **Step 12: Commit**

```bash
git add frontend/src/agent/contextCompression.ts frontend/src/agent/runtimeMessage.ts frontend/src/agent/BaseAgent.ts frontend/src/stores/useAgentStore.ts frontend/src/components/AgentChatContent.tsx frontend/src/services/api.ts
git commit -m "feat: add detailed agent context compression"
```

---

### Task 4: Refactor Frontend Runtime to Use Backend-Persisted Sessions

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/stores/useAgentStore.ts`
- Create: `frontend/src/agent/BuildAgent.ts`
- Create: `frontend/src/agent/AskAgent.ts`
- Modify: `frontend/src/agent/useAgentRuntime.ts`
- Modify: `frontend/src/components/AgentChatContent.tsx`
- Modify: `frontend/src/components/editor/AgentPanelHeaderRight.tsx`
- Test: `frontend/src/components/AgentChatContent.test.tsx`

- [x] **Step 1: Write failing frontend tests for loading and saving conversation state**

```tsx
it('loads persisted messages and selected skills on mount', async () => {
  mockAgentApi.getConversation.mockResolvedValue({
    messages: [{ id: 'm1', role: 'assistant', content: '欢迎使用学习助手', createdAt: '2026-04-17T00:00:00Z' }],
    selectedSkills: ['topic-navigator'],
  });

  render(<AgentChatContent topicId="42" agentType="learning" />);

  expect(await screen.findByText('欢迎使用学习助手')).toBeInTheDocument();
});
```

- [x] **Step 2: Run frontend test to verify it fails**

Run: `pnpm --filter @web-learn/frontend test -- AgentChatContent`
Expected: FAIL because `agentType` props and backend persistence API do not exist yet

- [x] **Step 3: Add agent conversation API methods**

```ts
// frontend/src/services/api.ts
export const agentConversationApi = {
  getConversation: async (topicId: string, agentType: 'building' | 'learning') => {
    const response = await api.get(`/ai/conversations/${topicId}/${agentType}`);
    return response.data.data;
  },
  replaceConversation: async (
    topicId: string,
    agentType: 'building' | 'learning',
    payload: PersistedConversationState
  ) => {
    const response = await api.put(`/ai/conversations/${topicId}/${agentType}`, payload);
    return response.data.data;
  },
};
```

- [x] **Step 4: Namespace the agent store by topic and agent type**

```ts
// frontend/src/stores/useAgentStore.ts
interface AgentStoreState {
  topicId: string | null;
  agentType: 'building' | 'learning';
  selectedSkills: string[];
  compressedContext: AgentCompressedContext;
  visibleMessages: AgentMessage[];
  setSessionContext: (topicId: string, agentType: 'building' | 'learning') => void;
  setSelectedSkills: (skills: string[]) => void;
  setCompressedContext: (context: AgentCompressedContext) => void;
}
```

- [x] **Step 5: Refactor runtime to construct concrete agent classes and persist full conversation state**

```ts
// frontend/src/agent/BaseAgent.ts
export interface AgentSessionContext {
  topicId: string;
  topicTitle?: string;
  selectedSkills: string[];
  visibleMessages: PersistedAgentMessage[];
  compressedContext: AgentCompressedContext;
  setSelectedSkills(skills: string[]): void;
  setVisibleMessages(messages: PersistedAgentMessage[]): void;
  setCompressedContext(context: AgentCompressedContext): void;
}

export abstract class BaseAgent {
  constructor(protected readonly context: AgentSessionContext) {}

  abstract getAgentType(): 'building' | 'learning';
  abstract buildSystemPrompt(): AIChatMessage;

  async hydrateConversation() {
    const data = await agentConversationApi.getConversation(this.context.topicId, this.getAgentType());
    this.context.setVisibleMessages(data.messages);
    this.context.setCompressedContext(data.compressedContext);
    this.context.setSelectedSkills(data.selectedSkills);
  }

  async persistConversation(state: PersistedConversationState) {
    await agentConversationApi.replaceConversation(this.context.topicId, this.getAgentType(), state);
  }

  async runAgentLoop(input: string) {
    await this.maybeCompressContextBeforeLlmRequest(input);
    // shared LLM loop continues here and subclasses only customize prompt-level behavior
  }
}
```

```ts
// frontend/src/agent/BuildAgent.ts
export class BuildAgent extends BaseAgent {
  getAgentType() { return 'building' as const; }
  buildSystemPrompt() { return buildSystemPrompt({ agentType: 'building', selectedSkills: this.context.selectedSkills, topicTitle: this.context.topicTitle }); }
}
```

```ts
// frontend/src/agent/AskAgent.ts
export class AskAgent extends BaseAgent {
  getAgentType() { return 'learning' as const; }
  buildSystemPrompt() { return buildSystemPrompt({ agentType: 'learning', selectedSkills: this.context.selectedSkills, topicTitle: this.context.topicTitle }); }
}
```

```ts
// frontend/src/agent/useAgentRuntime.ts
export function useAgentRuntime(options: { topicId: string; agentType: 'building' | 'learning' }) {
  const agent = options.agentType === 'building'
    ? new BuildAgent(createAgentSessionContext(options))
    : new AskAgent(createAgentSessionContext(options));

  return {
    agent,
    hydrateConversation: () => agent.hydrateConversation(),
    runAgentLoop: (input: string) => agent.runAgentLoop(input),
  };
}
```

- [x] **Step 6: Update chat UI and header components to use backend persistence instead of localStorage**

```tsx
// frontend/src/components/AgentChatContent.tsx
interface AgentChatContentProps {
  topicId: string;
  agentType: 'building' | 'learning';
  title?: string;
}

useEffect(() => {
  setSessionContext(topicId, agentType);
  void hydrateConversation();
}, [topicId, agentType, hydrateConversation, setSessionContext]);
```

- [x] **Step 7: Run frontend tests**

Run: `pnpm --filter @web-learn/frontend test -- AgentChatContent AgentPanelHeaderRight`
Expected: component tests pass and no code still depends on `chat-history-${topicId}` localStorage writes

- [x] **Step 8: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/stores/useAgentStore.ts frontend/src/agent/BaseAgent.ts frontend/src/agent/BuildAgent.ts frontend/src/agent/AskAgent.ts frontend/src/agent/useAgentRuntime.ts frontend/src/components/AgentChatContent.tsx frontend/src/components/editor/AgentPanelHeaderRight.tsx
git commit -m "refactor: move agent sessions to backend persistence"
```

---

### Task 5: Add Browsing-Side Learning Agent Entry Using the Shared Agent Runtime

**Files:**
- Modify: `frontend/src/components/AIChatSidebar.tsx`
- Modify: `frontend/src/pages/WebsiteTopicPage.tsx`
- Modify: `frontend/src/pages/PublishedTopicPage.tsx`
- Modify: `frontend/src/agent/AskAgent.ts`
- Test: `frontend/src/pages/WebsiteTopicPage.test.tsx`
- Test: `frontend/src/pages/PublishedTopicPage.test.tsx`

- [x] **Step 1: Write failing page tests for the browsing assistant entrypoint**

```tsx
it('shows the learning agent trigger on topic pages for authenticated users', async () => {
  render(<WebsiteTopicPage />);
  expect(await screen.findByRole('button', { name: '学习助手' })).toBeInTheDocument();
});
```

- [x] **Step 2: Run the page tests to verify they fail**

Run: `pnpm --filter @web-learn/frontend test -- WebsiteTopicPage PublishedTopicPage`
Expected: FAIL because no learning sidebar is rendered

- [x] **Step 3: Make browsing pages instantiate `AskAgent` through the shared runtime hook**

```ts
// frontend/src/agent/AskAgent.ts
export class AskAgent extends BaseAgent {
  getAgentType() { return 'learning' as const; }
  buildSystemPrompt() { return buildSystemPrompt({ agentType: 'learning', selectedSkills: this.context.selectedSkills, topicTitle: this.context.topicTitle }); }
}
```

- [x] **Step 4: Mount the learning sidebar on browsing pages**

```tsx
// frontend/src/pages/WebsiteTopicPage.tsx
{topic && (
  <AIChatSidebar
    topicId={topic.id}
    agentType="learning"
    title="学习助手"
  />
)}
```

```tsx
// frontend/src/pages/PublishedTopicPage.tsx
<AIChatSidebar topicId={id!} agentType="learning" title="学习助手" />
```

- [x] **Step 5: Run browsing page tests**

Run: `pnpm --filter @web-learn/frontend test -- WebsiteTopicPage PublishedTopicPage`
Expected: browsing pages render the assistant trigger without breaking existing page layout

- [x] **Step 6: Commit**

```bash
git add frontend/src/components/AIChatSidebar.tsx frontend/src/pages/WebsiteTopicPage.tsx frontend/src/pages/PublishedTopicPage.tsx frontend/src/agent/AskAgent.ts frontend/src/pages/WebsiteTopicPage.test.tsx frontend/src/pages/PublishedTopicPage.test.tsx
git commit -m "feat: add browsing-side learning agent"
```

---

### Task 6: Add First-Version Agent Skill Selection and Prompt Injection

**Files:**
- Create: `frontend/src/agent/skills.ts`
- Create: `frontend/src/agent/systemPrompts.ts`
- Modify: `frontend/src/agent/BaseAgent.ts`
- Modify: `frontend/src/agent/BuildAgent.ts`
- Modify: `frontend/src/agent/AskAgent.ts`
- Modify: `frontend/src/components/editor/AgentPanelHeaderRight.tsx`
- Modify: `frontend/src/components/AgentChatContent.tsx`
- Test: `frontend/src/agent/useAgentRuntime.test.ts`

- [x] **Step 1: Write failing runtime test for skill prompt injection**

```ts
it('injects selected skill prompt fragments into the system prompt', async () => {
  const prompt = buildSystemPrompt({
    agentType: 'building',
    selectedSkills: ['topic-planner'],
    topicTitle: '太阳系',
  });

  expect(prompt.content).toContain('优先输出专题结构方案');
});
```

- [x] **Step 2: Run the runtime test to verify it fails**

Run: `pnpm --filter @web-learn/frontend test -- useAgentRuntime`
Expected: FAIL because no skill registry or prompt composer exists

- [x] **Step 3: Create frontend skill lookup helpers**

```ts
// frontend/src/agent/skills.ts
import { AGENT_SKILLS, type AgentSkillDefinition, type AgentType } from '@web-learn/shared';

export function getAvailableSkills(agentType: AgentType): AgentSkillDefinition[] {
  return AGENT_SKILLS.filter((skill) => skill.appliesTo === 'both' || skill.appliesTo === agentType);
}
```

- [x] **Step 4: Build system prompts from base prompt plus selected skills**

```ts
// frontend/src/agent/systemPrompts.ts
export function buildSystemPrompt(input: {
  agentType: AgentType;
  selectedSkills: string[];
  topicTitle?: string;
}): AIChatMessage {
  const fragments = getAvailableSkills(input.agentType)
    .filter((skill) => input.selectedSkills.includes(skill.id))
    .map((skill) => `- ${skill.systemPromptFragment}`);

  return {
    role: 'system',
    content: [
      input.agentType === 'building' ? BUILDING_BASE_PROMPT : LEARNING_BASE_PROMPT,
      fragments.length > 0 ? `当前启用 skills:\n${fragments.join('\n')}` : '',
    ].filter(Boolean).join('\n\n'),
  };
}
```

- [x] **Step 5: Add skill selection UI in the agent panel header**

```tsx
// frontend/src/components/editor/AgentPanelHeaderRight.tsx
<select
  value={selectedSkills[0] ?? ''}
  onChange={(e) => setSelectedSkills(e.target.value ? [e.target.value] : [])}
>
  <option value="">默认模式</option>
  {availableSkills.map((skill) => (
    <option key={skill.id} value={skill.id}>{skill.name}</option>
  ))}
</select>
```

- [x] **Step 6: Persist selected skills together with full conversation state**

```ts
// frontend/src/agent/useAgentRuntime.ts
await agent.persistConversation({
  selectedSkills,
  compressedContext,
  messages,
});
```

- [x] **Step 7: Run frontend tests**

Run: `pnpm --filter @web-learn/frontend test -- useAgentRuntime AgentPanelHeaderRight`
Expected: runtime and header tests pass, selected skill survives hydration from backend

- [x] **Step 8: Commit**

```bash
git add frontend/src/agent/skills.ts frontend/src/agent/systemPrompts.ts frontend/src/agent/BaseAgent.ts frontend/src/agent/BuildAgent.ts frontend/src/agent/AskAgent.ts frontend/src/components/editor/AgentPanelHeaderRight.tsx frontend/src/components/AgentChatContent.tsx
git commit -m "feat: add first-version agent skills"
```

---

### Task 7: Update Documentation and End-to-End Verification

**Files:**
- Modify: `docs/spec/data-models.md`
- Modify: `docs/spec/ai-service.md`
- Modify: `docs/spec/frontend-architecture.md`
- Modify: `tests/e2e/ai-chat.spec.ts`
- Test: `services/ai/tests/agent-conversations.test.ts`
- Test: `tests/e2e/ai-chat.spec.ts`

- [x] **Step 1: Update product and architecture docs to reflect the new agent model**

```md
<!-- docs/spec/data-models.md -->
- ✅ `ai_agent_conversations` — 存储 `topic_id + user_id + agent_type` 维度的会话摘要
- ✅ `ai_agent_messages` — 仅存储用户可见消息（`user` / `assistant`）
- ❌ 不存储 tool call 细节和运行时临时状态
```

```md
<!-- docs/spec/ai-service.md -->
- 新增 `GET /api/ai/conversations/:topicId/:agentType`
- 新增 `PUT /api/ai/conversations/:topicId/:agentType`
- learning agent 通过浏览页侧边栏接入
- skill 为声明式 prompt/tool profile，不执行远程插件代码
```

- [x] **Step 2: Extend e2e coverage to assert browsing assistant visibility and persistence API reachability**

```ts
// tests/e2e/ai-chat.spec.ts
test('topic browsing page exposes learning agent entry', async ({ page }) => {
  await page.goto(`/topics/${topicId}`);
  await expect(page.getByRole('button', { name: '学习助手' })).toBeVisible();
});
```

- [x] **Step 3: Run verification suite**

Run: `pnpm --filter @web-learn/ai-service test`
Expected: AI service tests pass

Run: `pnpm --filter @web-learn/frontend test`
Expected: frontend unit tests pass

Run: `pnpm test:e2e -- ai-chat.spec.ts`
Expected: AI chat smoke tests pass with updated UI assertions

- [x] **Step 4: Commit**

```bash
git add docs/spec/data-models.md docs/spec/ai-service.md docs/spec/frontend-architecture.md tests/e2e/ai-chat.spec.ts
git commit -m "docs: update specs for agent persistence learning agent and skills"
```

---

## Self-Review

### Spec Coverage

- Backend-visible message persistence is covered in Tasks 1-3.
- Detailed context compression is covered in Task 3.
- Browsing-side learning agent is covered in Task 5.
- First-version agent skill support is covered in Task 6.
- Docs and verification updates are covered in Task 7.

### Placeholder Scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Each task references exact files and at least one verification command.

### Type Consistency

- `agentType` is consistently `building | learning`.
- Persisted messages remain `user | assistant` only.
- Skills are referenced by `selectedSkills: string[]` across shared, backend, and frontend layers.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-17-agent-conversations-learning-agent-skills.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
