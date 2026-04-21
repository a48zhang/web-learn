# Dashboard AI Create Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the logged-in dashboard cards with a minimal glass AI search input that creates a topic and automatically starts the building agent.

**Architecture:** Keep the flow frontend-only. `DashboardPage` creates the topic and navigates to the editor with route state; `WebsiteEditorPage` bridges that state to `AgentChatContent`; `AgentChatContent` hydrates conversation history and auto-sends the initial prompt once.

**Tech Stack:** React 18, React Router 6, TypeScript, Tailwind CSS, Vitest, Testing Library, existing `topicApi`, existing building agent runtime.

---

## File Structure

- Modify `frontend/src/pages/DashboardPage.tsx`: replace card dashboard with AI search form, prompt-to-title helper, create-topic submit flow, inline errors.
- Modify `frontend/src/pages/DashboardPage.test.tsx`: cover removed cards, new form, title generation, create success navigation, create failure, empty submission guard.
- Modify `frontend/src/components/AgentChatContent.tsx`: add optional `initialPrompt` and `onInitialPromptConsumed` props; auto-run the initial prompt after hydration exactly once.
- Modify `frontend/src/components/AgentChatContent.test.tsx`: cover one-shot initial prompt hydration and existing no-rehydrate behavior.
- Modify `frontend/src/pages/WebsiteEditorPage.tsx`: read `location.state.initialBuildPrompt`, pass it to `AgentChatContent`, and clear route state after consumption.
- Modify `frontend/src/pages/WebsiteEditorPage.test.tsx`: assert route state is passed to `AgentChatContent` and cleared when consumed.

## Task 1: Dashboard Tests And Title Helper

**Files:**
- Modify: `frontend/src/pages/DashboardPage.test.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Replace the dashboard test setup with API mocks**

Update the top of `frontend/src/pages/DashboardPage.test.tsx` so it can assert topic creation:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage, { buildTopicTitleFromPrompt } from './DashboardPage';

const navigateMock = vi.hoisted(() => vi.fn());
const setMetaMock = vi.hoisted(() => vi.fn());
const createTopicMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  user: { username: 'alice', role: 'user' as const },
}));

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: () => authState,
}));

vi.mock('../services/api', () => ({
  topicApi: {
    create: createTopicMock,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../components/layout/LayoutMetaContext', () => ({
  useLayoutMeta: () => ({ meta: {}, setMeta: setMetaMock }),
}));
```

- [ ] **Step 2: Add failing dashboard tests**

Replace the existing tests in `frontend/src/pages/DashboardPage.test.tsx` with:

```tsx
describe('DashboardPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setMetaMock.mockReset();
    createTopicMock.mockReset();
    authState.user = { username: 'alice', role: 'user' };
  });

  it('renders the AI create search form instead of old dashboard blocks', () => {
    render(<DashboardPage />);

    expect(screen.getByRole('heading', { name: '想做什么学习专题？' })).toBeInTheDocument();
    expect(screen.getByLabelText('描述专题需求')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始制作' })).toBeDisabled();

    expect(screen.queryByText('创建专题')).not.toBeInTheDocument();
    expect(screen.queryByText('我的专题')).not.toBeInTheDocument();
    expect(screen.queryByText('账户设置')).not.toBeInTheDocument();
    expect(screen.queryByText('最近活动')).not.toBeInTheDocument();
  });

  it('builds list-friendly titles from normalized prompts', () => {
    expect(buildTopicTitleFromPrompt('  做一个 高中物理专题  ')).toBe('做一个 高中物理专题');
    expect(buildTopicTitleFromPrompt('123456789012345678901234567890')).toBe('123456789012345678901234567890');
    expect(buildTopicTitleFromPrompt('1234567890123456789012345678901')).toBe('123456789012345678901234567890...');
  });

  it('creates a website topic and opens the editor with the initial prompt', async () => {
    createTopicMock.mockResolvedValueOnce({ id: 'topic-1' });
    render(<DashboardPage />);

    fireEvent.change(screen.getByLabelText('描述专题需求'), {
      target: { value: '  做一个 高中物理电磁感应互动专题  ' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'AI 创建专题' }));

    await waitFor(() => {
      expect(createTopicMock).toHaveBeenCalledWith({
        title: '做一个 高中物理电磁感应互动专题',
        description: '做一个 高中物理电磁感应互动专题',
        type: 'website',
      });
    });
    expect(navigateMock).toHaveBeenCalledWith('/topics/topic-1/edit', {
      state: { initialBuildPrompt: '做一个 高中物理电磁感应互动专题' },
    });
  });

  it('does not create a topic for blank prompts', () => {
    render(<DashboardPage />);

    fireEvent.change(screen.getByLabelText('描述专题需求'), {
      target: { value: '   ' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'AI 创建专题' }));

    expect(createTopicMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('keeps the prompt visible and shows an inline error when creation fails', async () => {
    createTopicMock.mockRejectedValueOnce(new Error('服务暂不可用'));
    render(<DashboardPage />);

    fireEvent.change(screen.getByLabelText('描述专题需求'), {
      target: { value: '做一个英语语法闯关专题' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'AI 创建专题' }));

    expect(await screen.findByText('服务暂不可用')).toBeInTheDocument();
    expect(screen.getByLabelText('描述专题需求')).toHaveValue('做一个英语语法闯关专题');
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the failing dashboard test**

Run:

```bash
pnpm --filter @web-learn/frontend test -- DashboardPage.test.tsx
```

Expected: FAIL because `buildTopicTitleFromPrompt` is not exported and the old dashboard cards still render.

- [ ] **Step 4: Add the title helper and submit logic**

In `frontend/src/pages/DashboardPage.tsx`, replace the imports with:

```tsx
import { FormEvent, useEffect, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';
import { topicApi } from '../services/api';
import { getApiErrorMessage } from '../utils/errors';
```

Add the helper above `DashboardPage`:

```tsx
const TOPIC_TITLE_LENGTH = 30;

export function normalizePrompt(prompt: string) {
  return prompt.trim().replace(/\s+/g, ' ');
}

export function buildTopicTitleFromPrompt(prompt: string) {
  const normalized = normalizePrompt(prompt);
  if (normalized.length <= TOPIC_TITLE_LENGTH) return normalized;
  return `${normalized.slice(0, TOPIC_TITLE_LENGTH)}...`;
}
```

Inside `DashboardPage`, remove settings modal state and add:

```tsx
const [prompt, setPrompt] = useState('');
const [creating, setCreating] = useState(false);
const [error, setError] = useState<string | null>(null);

const normalizedPrompt = normalizePrompt(prompt);
const canSubmit = normalizedPrompt.length > 0 && !creating;

const handleCreateTopic = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  if (!normalizedPrompt || creating) return;

  setCreating(true);
  setError(null);

  try {
    const topic = await topicApi.create({
      title: buildTopicTitleFromPrompt(normalizedPrompt),
      description: normalizedPrompt,
      type: 'website',
    });
    navigate(`/topics/${topic.id}/edit`, {
      state: { initialBuildPrompt: normalizedPrompt },
    });
  } catch (err: unknown) {
    setError(getApiErrorMessage(err, '创建专题失败'));
  } finally {
    setCreating(false);
  }
};
```

- [ ] **Step 5: Replace the dashboard markup with the glass search form**

In `frontend/src/pages/DashboardPage.tsx`, replace the current `return` content with:

```tsx
return (
  <div className="relative min-h-full overflow-hidden bg-gradient-to-b from-slate-50 via-blue-50 to-white">
    <div className="pointer-events-none absolute -right-28 bottom-[-8rem] h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />
    <div className="pointer-events-none absolute -left-28 top-16 h-80 w-80 rounded-full bg-teal-300/10 blur-3xl" />

    <section className="relative mx-auto flex min-h-[calc(100vh-7rem)] max-w-4xl flex-col items-center justify-center px-5 py-16 text-center">
      <p className="mb-3 text-sm text-slate-500">欢迎，{user?.username}</p>
      <h1 className="text-3xl font-bold text-slate-950 sm:text-4xl">
        想做什么学习专题？
      </h1>

      <form
        aria-label="AI 创建专题"
        onSubmit={handleCreateTopic}
        className="mt-8 w-full max-w-2xl"
      >
        <label htmlFor="dashboard-ai-prompt" className="sr-only">
          描述专题需求
        </label>
        <div className="flex h-16 items-center gap-3 rounded-full border border-white/70 bg-white/70 px-5 py-2 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100">
          <svg
            className="h-5 w-5 shrink-0 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
          </svg>
          <input
            id="dashboard-ai-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            disabled={creating}
            className="min-w-0 flex-1 bg-transparent text-base text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
            placeholder="描述你想制作的专题..."
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label="开始制作"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {creating ? (
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19V5m0 0-6 6m6-6 6 6" />
              </svg>
            )}
          </button>
        </div>
        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  </div>
);
```

- [ ] **Step 6: Run the dashboard test until it passes**

Run:

```bash
pnpm --filter @web-learn/frontend test -- DashboardPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit dashboard changes**

Run:

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/pages/DashboardPage.test.tsx
git commit -m "feat: add dashboard ai create entry"
```

## Task 2: AgentChatContent Initial Prompt Auto-Run

**Files:**
- Modify: `frontend/src/components/AgentChatContent.test.tsx`
- Modify: `frontend/src/components/AgentChatContent.tsx`

- [ ] **Step 1: Add an auto-run test**

In `frontend/src/components/AgentChatContent.test.tsx`, add `waitFor` to the imports:

```tsx
import { render, waitFor } from '@testing-library/react';
```

Add this test inside `describe('AgentChatContent hydration', () => { ... })`:

```tsx
it('hydrates then runs the initial prompt once and consumes it', async () => {
  const hydrateConversation = vi.fn().mockResolvedValue(undefined);
  const runAgentLoop = vi.fn().mockResolvedValue(undefined);
  const setSessionContext = vi.fn();
  const onInitialPromptConsumed = vi.fn();

  useAgentRuntimeMock.mockReturnValue({
    runAgentLoop,
    visibleMessages: [],
    hydrateConversation,
  });

  useAgentStoreMock.mockImplementation((selector: (state: MockAgentStoreState) => unknown) =>
    selector({
      runState: { isRunning: false, currentToolName: null, error: null },
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
});
```

- [ ] **Step 2: Run the failing AgentChatContent test**

Run:

```bash
pnpm --filter @web-learn/frontend test -- AgentChatContent.test.tsx
```

Expected: FAIL because `AgentChatContent` does not accept or run `initialPrompt`.

- [ ] **Step 3: Extend props and refs**

In `frontend/src/components/AgentChatContent.tsx`, update the prop interface:

```tsx
interface AgentChatContentProps {
  topicId: string;
  agentType: 'building' | 'learning';
  title?: string;
  initialPrompt?: string;
  onInitialPromptConsumed?: () => void;
}
```

Update the function signature and add refs near the existing refs:

```tsx
export default function AgentChatContent({
  topicId,
  agentType,
  initialPrompt,
  onInitialPromptConsumed,
}: AgentChatContentProps) {
  const [input, setInput] = useState('');
  const { runAgentLoop, visibleMessages, hydrateConversation } = useAgentRuntime({ topicId, agentType });
  const runState = useAgentStore((s) => s.runState);
  const model = useAgentStore((s) => s.model);
  const compressedContext = useAgentStore((s) => s.compressedContext);
  const setSessionContext = useAgentStore((s) => s.setSessionContext);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hydrateConversationRef = useRef(hydrateConversation);
  const runAgentLoopRef = useRef(runAgentLoop);
  const modelRef = useRef(model);
  const runStateRef = useRef(runState);
  const onInitialPromptConsumedRef = useRef(onInitialPromptConsumed);
  const consumedInitialPromptKeyRef = useRef<string | null>(null);
```

- [ ] **Step 4: Keep refs fresh**

Below the existing hydrate ref effect, add:

```tsx
useEffect(() => {
  runAgentLoopRef.current = runAgentLoop;
}, [runAgentLoop]);

useEffect(() => {
  modelRef.current = model;
}, [model]);

useEffect(() => {
  runStateRef.current = runState;
}, [runState]);

useEffect(() => {
  onInitialPromptConsumedRef.current = onInitialPromptConsumed;
}, [onInitialPromptConsumed]);
```

- [ ] **Step 5: Replace hydration effect with hydrate-and-run effect**

Replace the current `// Load conversation from backend on mount` effect with:

```tsx
useEffect(() => {
  let cancelled = false;
  const prompt = initialPrompt?.trim();
  const initialPromptKey = prompt ? `${topicId}:${agentType}:${prompt}` : null;

  setSessionContext(topicId, agentType);

  const hydrateAndStart = async () => {
    await hydrateConversationRef.current();
    if (
      cancelled ||
      !prompt ||
      !initialPromptKey ||
      consumedInitialPromptKeyRef.current === initialPromptKey ||
      runStateRef.current.isRunning
    ) {
      return;
    }

    consumedInitialPromptKeyRef.current = initialPromptKey;
    onInitialPromptConsumedRef.current?.();
    await runAgentLoopRef.current(prompt, modelRef.current);
  };

  void hydrateAndStart();

  return () => {
    cancelled = true;
  };
}, [topicId, agentType, initialPrompt, setSessionContext]);
```

- [ ] **Step 6: Run the AgentChatContent tests**

Run:

```bash
pnpm --filter @web-learn/frontend test -- AgentChatContent.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit AgentChatContent changes**

Run:

```bash
git add frontend/src/components/AgentChatContent.tsx frontend/src/components/AgentChatContent.test.tsx
git commit -m "feat: auto-start building agent from initial prompt"
```

## Task 3: WebsiteEditorPage Route-State Bridge

**Files:**
- Modify: `frontend/src/pages/WebsiteEditorPage.test.tsx`
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`

- [ ] **Step 1: Capture AgentChatContent props in the editor test**

In `frontend/src/pages/WebsiteEditorPage.test.tsx`, add these hoisted helpers near the other mocks:

```tsx
const agentChatPropsMock = vi.hoisted(() => vi.fn());
let latestLocationState: unknown = null;
```

Add `useLocation` to the React Router import:

```tsx
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
```

Replace the existing `AgentChatContent` mock with:

```tsx
vi.mock('../components/AgentChatContent', () => ({
  default: (props: {
    topicId: string;
    agentType: 'building' | 'learning';
    initialPrompt?: string;
    onInitialPromptConsumed?: () => void;
  }) => {
    agentChatPropsMock(props);
    return <div data-testid="agent-chat" />;
  },
}));
```

Add this helper component below the mocks:

```tsx
function LocationStateProbe() {
  const location = useLocation();
  latestLocationState = location.state;
  return null;
}
```

Reset these in `beforeEach`:

```tsx
agentChatPropsMock.mockReset();
latestLocationState = null;
```

- [ ] **Step 2: Add a failing route-state bridge test**

Add this test inside `describe('WebsiteEditorPage', () => { ... })`:

```tsx
it('passes the initial build prompt to AgentChatContent and clears it after consumption', async () => {
  getByIdMock.mockResolvedValueOnce({
    id: 'topic-1',
    title: '专题',
    createdBy: '1',
    editors: [],
  });
  getPresignMock.mockRejectedValueOnce(new Error('no oss snapshot'));

  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/topics/topic-1/edit',
          state: { initialBuildPrompt: '做一个物理专题' },
        },
      ]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route
          path="/topics/:id/edit"
          element={
            <>
              <LocationStateProbe />
              <WebsiteEditorPage />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(agentChatPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        topicId: 'topic-1',
        agentType: 'building',
        initialPrompt: '做一个物理专题',
      })
    );
  });

  const latestProps = agentChatPropsMock.mock.calls.at(-1)?.[0];
  latestProps.onInitialPromptConsumed();

  await waitFor(() => {
    expect(latestLocationState).toBeNull();
  });
});
```

- [ ] **Step 3: Run the failing WebsiteEditorPage test**

Run:

```bash
pnpm --filter @web-learn/frontend test -- WebsiteEditorPage.test.tsx
```

Expected: FAIL because route state is not read, passed, or cleared.

- [ ] **Step 4: Read and clear editor route state**

In `frontend/src/pages/WebsiteEditorPage.tsx`, update the router import:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
```

Add a local type near the imports:

```tsx
type EditorLocationState = {
  initialBuildPrompt?: unknown;
} | null;
```

Inside `WebsiteEditorPage`, after `const { id } = useParams<{ id: string }>();`, add:

```tsx
const location = useLocation();
const navigate = useNavigate();
const locationState = location.state as EditorLocationState;
const initialBuildPrompt =
  typeof locationState?.initialBuildPrompt === 'string'
    ? locationState.initialBuildPrompt
    : undefined;
```

Add this callback near the other callbacks:

```tsx
const handleInitialPromptConsumed = useCallback(() => {
  navigate(location.pathname, { replace: true, state: null });
}, [location.pathname, navigate]);
```

Update the agent panel content:

```tsx
content: (
  <AgentChatContent
    topicId={id ?? ''}
    agentType="building"
    initialPrompt={initialBuildPrompt}
    onInitialPromptConsumed={handleInitialPromptConsumed}
  />
),
```

- [ ] **Step 5: Run the WebsiteEditorPage tests**

Run:

```bash
pnpm --filter @web-learn/frontend test -- WebsiteEditorPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit WebsiteEditorPage changes**

Run:

```bash
git add frontend/src/pages/WebsiteEditorPage.tsx frontend/src/pages/WebsiteEditorPage.test.tsx
git commit -m "feat: pass dashboard prompt into editor agent"
```

## Task 4: Full Frontend Verification

**Files:**
- Verify: `frontend/src/pages/DashboardPage.tsx`
- Verify: `frontend/src/components/AgentChatContent.tsx`
- Verify: `frontend/src/pages/WebsiteEditorPage.tsx`

- [ ] **Step 1: Run focused tests together**

Run:

```bash
pnpm --filter @web-learn/frontend test -- DashboardPage.test.tsx AgentChatContent.test.tsx WebsiteEditorPage.test.tsx
```

Expected: PASS for all three files.

- [ ] **Step 2: Run the full frontend test suite**

Run:

```bash
pnpm --filter @web-learn/frontend test
```

Expected: PASS.

- [ ] **Step 3: Run the frontend build**

Run:

```bash
pnpm --filter @web-learn/frontend build
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected: Only intentional commits are present; no `.superpowers/brainstorm` files are tracked.

## Self-Review

- Spec coverage: dashboard visual replacement, prompt title generation, create-topic request, editor route state, auto-start agent, error handling, and tests are all covered.
- No incomplete sections remain.
- Type names are consistent: `initialBuildPrompt`, `initialPrompt`, `onInitialPromptConsumed`, `buildTopicTitleFromPrompt`.
- The plan does not require backend changes and leaves `/topics/create` untouched.
