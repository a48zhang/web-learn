# Agent WebContainer Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the remaining agent/WebContainer consistency issues found in review: failed resets must not trigger stale seed saves, package changes must restart dependency/runtime setup, malformed tool JSON must be reported accurately, and clean saves must not fail just because WebContainer is unavailable.

**Architecture:** Keep WebContainer as the canonical runtime filesystem and EditorStore as the synchronized projection. Make lifecycle calls return explicit success state instead of swallowing failures, centralize save fallback behavior, and keep tool-call validation at the agent runtime boundary before tool execution.

**Tech Stack:** React 18, TypeScript, Zustand, WebContainer API, Vitest, Testing Library.

---

## Scope And Constraints

- Do not reintroduce `/home/project` into agent-visible prompts or tool schemas.
- Do not change existing tool names.
- Do not reduce `MAX_TOOL_LOOPS`.
- Do not bypass `projectFileService` for file mutations.
- Do not redesign UI.
- Preserve local recovery formats: `snapshot-<topicId>` and `local-backup-<topicId>`.

## Current Review Findings To Fix

1. `WebsiteEditorPage` can persist stale seed files if `initWCProject()` resolves after a failed `wcResetProject()`.
2. Editing `package.json` does not reinstall/restart when the current session dev server is already running.
3. Malformed tool-call JSON is hidden and becomes misleading missing-parameter errors.
4. Clean no-op `saveToOSS()` now requires WebContainer and can return `false` when WebContainer is unavailable.

## File Structure

- Modify `frontend/src/hooks/useWebContainer.ts`: make project init return success/failure and add forced dev-server restart API.
- Modify `frontend/src/hooks/useWebContainer.test.tsx`: cover reset failure return value and package restart behavior.
- Modify `frontend/src/pages/WebsiteEditorPage.tsx`: only perform pending seed save after successful WebContainer initialization.
- Modify `frontend/src/pages/WebsiteEditorPage.test.tsx`: cover failed init preventing seed save.
- Modify `frontend/src/agent/tools/writeFile.ts`: use restart API for `package.json` writes.
- Modify `frontend/src/agent/tools/createFile.ts`: use restart API for `package.json` creates.
- Modify `frontend/src/agent/tools/runCommand.test.ts`: update expectations for package change restart.
- Modify `frontend/src/agent/useAgentRuntime.ts`: report malformed tool arguments without executing the tool.
- Modify `frontend/src/agent/useAgentRuntime.test.ts`: cover malformed JSON tool call result.
- Modify `frontend/src/stores/useEditorStore.ts`: short-circuit clean non-forced saves before WebContainer snapshot, while preserving forced save rescan.
- Modify `frontend/src/stores/useEditorStore.test.ts`: cover clean save with unavailable WebContainer and dirty save failure behavior.

---

## Task 1: Make WebContainer Project Init Report Reset Failure

**Files:**
- Modify: `frontend/src/hooks/useWebContainer.ts`
- Modify: `frontend/src/hooks/useWebContainer.test.tsx`
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`
- Modify: `frontend/src/pages/WebsiteEditorPage.test.tsx`

- [ ] **Step 1: Add failing hook test for reset failure**

Add this test to `frontend/src/hooks/useWebContainer.test.tsx` inside `describe('useWebContainer topic sessions', ...)`:

```ts
it('returns false and does not mark ready when project reset fails', async () => {
  bootMock.mockResolvedValue({
    spawn: vi.fn(),
  });
  wcResetProjectMock.mockRejectedValueOnce(new Error('reset failed'));

  const { result } = renderHook(() => useWebContainer());

  let initResult: boolean | undefined;
  await act(async () => {
    initResult = await result.current.initProject('topic-a', { 'src/App.tsx': 'app' });
  });

  expect(initResult).toBe(false);
  expect(result.current.currentTopicId).toBe('topic-a');
  expect(result.current.isReady).toBe(false);
  expect(result.current.error).toBe('reset failed');
});
```

- [ ] **Step 2: Run hook test to verify failure**

Run:

```bash
cd frontend && npm test -- --run src/hooks/useWebContainer.test.tsx
```

Expected: FAIL because `initProject()` currently resolves `undefined` and swallows reset failure.

- [ ] **Step 3: Change `initProject` to return `Promise<boolean>`**

In `frontend/src/hooks/useWebContainer.ts`, change the `initProject` callback so it returns `true` only after the active session successfully resets the project:

```ts
const initProject = useCallback(async (topicId: string, initialFiles?: Record<string, string>): Promise<boolean> => {
  const files = initialFiles ?? {};
  const snapshotSignature = createProjectSnapshotSignature(files);
  if (
    currentTopicId === topicId &&
    currentProjectSnapshotSignature === snapshotSignature &&
    wcStatus.isReady &&
    !wcStatus.error
  ) {
    return true;
  }
  if (
    isInitializing.current &&
    currentTopicId === topicId &&
    pendingProjectSnapshotSignature === snapshotSignature
  ) {
    await projectInitChain;
    return (
      currentTopicId === topicId &&
      currentProjectSnapshotSignature === snapshotSignature &&
      wcStatus.isReady &&
      !wcStatus.error
    );
  }

  const snapshotChanged = currentProjectSnapshotSignature !== snapshotSignature;
  const topicChanged = currentTopicId !== topicId;
  const sessionId = currentSessionId + 1;
  currentSessionId = sessionId;
  currentTopicId = topicId;
  pendingProjectSnapshotSignature = snapshotSignature;

  if (topicChanged || snapshotChanged) {
    stopCurrentDevProcess();
  }

  isInitializing.current = true;
  setWcStatus({
    currentTopicId: topicId,
    sessionId,
    isReady: false,
    previewUrl: null,
    error: null,
  });

  const runSession = async (): Promise<boolean> => {
    try {
      await ensureWebContainerInstance();
      if (sessionId !== currentSessionId) return false;

      await wcResetProject(files, () => sessionId === currentSessionId);
      if (sessionId !== currentSessionId) return false;

      currentProjectSnapshotSignature = snapshotSignature;
      setWcStatus({ isReady: true });

      if (files['package.json']) {
        void startDevServerInternal(sessionId);
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'WebContainer initialization failed';
      if (sessionId === currentSessionId) {
        setWcStatus({ isReady: false, previewUrl: null, error: message });
      }
      console.error('WebContainer error:', err);
      return false;
    } finally {
      if (sessionId === currentSessionId) {
        pendingProjectSnapshotSignature = null;
        isInitializing.current = false;
      }
    }
  };

  const previousInit = projectInitChain;
  const nextInit = previousInit.then(runSession, runSession);
  projectInitChain = nextInit.then(() => undefined, () => undefined);
  return await nextInit;
}, []);
```

Also update the legacy wrapper:

```ts
const init = useCallback(async (initialFiles?: Record<string, string>): Promise<boolean> => {
  return await initProject(currentTopicId ?? 'default', initialFiles);
}, [initProject]);
```

- [ ] **Step 4: Gate seed save on successful initialization**

In `frontend/src/pages/WebsiteEditorPage.tsx`, replace the init effect body with:

```ts
const currentFiles = getAllFiles();
void Promise.resolve(initWCProject(id, currentFiles)).then((initialized) => {
  if (!initialized) return;
  if (cancelled || pendingSeedSaveTopicIdRef.current !== id) return;
  pendingSeedSaveTopicIdRef.current = null;
  saveToOSS(id, 'Initial project scaffold', { force: true }).catch((e) => {
    console.warn('[seed] Failed to persist seed to OSS (will retry on next save):', e);
  });
});
```

- [ ] **Step 5: Add page regression test for failed init blocking seed save**

Add this test to `frontend/src/pages/WebsiteEditorPage.test.tsx`:

```tsx
it('does not persist seeded files when WebContainer initialization fails', async () => {
  let editorFiles: Record<string, string> = {};
  getByIdMock.mockResolvedValueOnce({
    id: 'topic-seed-reset-fails',
    title: 'New Topic',
    createdBy: '1',
    editors: [],
  });
  getPresignMock.mockRejectedValueOnce(new Error('presign failed'));
  getLocalRecoverySnapshotMock.mockReturnValueOnce(undefined);
  loadSnapshotMock.mockImplementation((files: Record<string, string>) => {
    editorFiles = files;
  });
  getAllFilesMock.mockImplementation(() => editorFiles);
  initProjectWebContainerMock.mockResolvedValueOnce(false);

  render(
    <MemoryRouter
      initialEntries={['/topics/topic-seed-reset-fails/edit']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/topics/:id/edit" element={<WebsiteEditorPage />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(loadSnapshotMock).toHaveBeenCalledWith(mockReactSeed);
  });
  await waitFor(() => {
    expect(initProjectWebContainerMock).toHaveBeenCalledWith('topic-seed-reset-fails', mockReactSeed);
  });

  expect(saveToOSSMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: Run tests**

Run:

```bash
cd frontend && npm test -- --run src/hooks/useWebContainer.test.tsx src/pages/WebsiteEditorPage.test.tsx
```

Expected: PASS.

---

## Task 2: Restart Dev Server When `package.json` Changes

**Files:**
- Modify: `frontend/src/hooks/useWebContainer.ts`
- Modify: `frontend/src/hooks/useWebContainer.test.tsx`
- Modify: `frontend/src/agent/tools/writeFile.ts`
- Modify: `frontend/src/agent/tools/createFile.ts`
- Modify: `frontend/src/agent/tools/runCommand.test.ts`

- [ ] **Step 1: Add failing restart test**

Add this test to `frontend/src/hooks/useWebContainer.test.tsx`:

```ts
it('force restarts install and dev server for the current session after package changes', async () => {
  const firstInstall = createProcess();
  const firstDev = createProcess(new Promise<number>(() => undefined));
  const secondInstall = createProcess();
  const secondDev = createProcess(new Promise<number>(() => undefined));
  const spawn = vi
    .fn()
    .mockResolvedValueOnce(firstInstall)
    .mockResolvedValueOnce(firstDev)
    .mockResolvedValueOnce(secondInstall)
    .mockResolvedValueOnce(secondDev);

  bootMock.mockResolvedValue({
    spawn,
    on: vi.fn(() => vi.fn()),
  });
  wcResetProjectMock.mockResolvedValue(undefined);

  const { result } = renderHook(() => useWebContainer());

  await act(async () => {
    await result.current.initProject('topic-a', { 'package.json': '{"scripts":{"dev":"vite"}}' });
  });
  await waitFor(() => {
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  act(() => {
    restartDevServerForCurrentSession();
  });

  await waitFor(() => {
    expect(spawn).toHaveBeenCalledTimes(4);
  });
  expect(firstDev.kill).toHaveBeenCalledTimes(1);
});
```

Add `restartDevServerForCurrentSession` to the imports at the top of that test file:

```ts
import {
  __resetUseWebContainerForTests,
  bootWebContainer,
  restartDevServerForCurrentSession,
  tryStartDevServer,
  useWebContainer,
} from './useWebContainer';
```

- [ ] **Step 2: Run hook test to verify failure**

Run:

```bash
cd frontend && npm test -- --run src/hooks/useWebContainer.test.tsx
```

Expected: FAIL because `restartDevServerForCurrentSession` does not exist.

- [ ] **Step 3: Add restart API**

In `frontend/src/hooks/useWebContainer.ts`, add this exported function near `tryStartDevServer()`:

```ts
export function restartDevServerForCurrentSession(): void {
  const sessionId = currentSessionId;
  if (!webcontainerInstance || sessionId === 0) return;
  stopCurrentDevProcess();
  void startDevServerInternal(sessionId);
}
```

- [ ] **Step 4: Use restart API from package file tools**

In `frontend/src/agent/tools/writeFile.ts`, replace `tryStartDevServer` import and usage:

```ts
import { restartDevServerForCurrentSession } from '../../hooks/useWebContainer';
```

```ts
if (path === 'package.json' || path.endsWith('/package.json')) {
  restartDevServerForCurrentSession();
}
```

In `frontend/src/agent/tools/createFile.ts`, make the same import and replacement.

- [ ] **Step 5: Update tool tests**

In `frontend/src/agent/tools/runCommand.test.ts`, update the mock:

```ts
const restartDevServerForCurrentSessionMock = vi.hoisted(() => vi.fn());
```

```ts
vi.mock('../../hooks/useWebContainer', () => ({
  restartDevServerForCurrentSession: restartDevServerForCurrentSessionMock,
  tryStartDevServer: tryStartDevServerMock,
}));
```

Update the `write_file` package test expectation:

```ts
expect(restartDevServerForCurrentSessionMock).toHaveBeenCalledTimes(1);
```

Add the same expectation to the `create_file` package test if it exists; otherwise add:

```ts
it('restarts the dev server when creating package.json', async () => {
  const execute = executeState.executes.get('create_file');
  if (!execute) {
    throw new Error('create_file tool was not registered');
  }

  const result = await execute({ path: 'package.json', content: '{"scripts":{}}\n' });

  expect(result).toEqual({ content: 'Successfully created file package.json' });
  expect(projectFileServiceMock.createProjectFile).toHaveBeenCalledWith('package.json', '{"scripts":{}}\n');
  expect(restartDevServerForCurrentSessionMock).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 6: Run tests**

Run:

```bash
cd frontend && npm test -- --run src/hooks/useWebContainer.test.tsx src/agent/tools/runCommand.test.ts
```

Expected: PASS.

---

## Task 3: Report Malformed Tool Arguments Before Tool Execution

**Files:**
- Modify: `frontend/src/agent/useAgentRuntime.ts`
- Modify: `frontend/src/agent/useAgentRuntime.test.ts`

- [ ] **Step 1: Add failing runtime test**

Add this test to `frontend/src/agent/useAgentRuntime.test.ts`:

```ts
it('returns an invalid arguments tool result without executing the tool when JSON is malformed', async () => {
  chatWithToolsMock
    .mockResolvedValueOnce({
      choices: [{
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'tool-bad-json',
            type: 'function',
            function: {
              name: 'write_file',
              arguments: '{"path":"src/App.tsx","content":',
            },
          }],
        },
      }],
    })
    .mockResolvedValueOnce({
      choices: [{
        message: {
          role: 'assistant',
          content: '参数格式错误，无法执行工具。',
        },
      }],
    });

  const { result } = renderHook(() => useAgentRuntime({ topicId: 'topic-1', agentType: 'building' }));

  await act(async () => {
    await result.current.runAgentLoop('update app');
  });

  expect(executeToolMock).not.toHaveBeenCalled();
  expect(chatWithToolsMock.mock.calls[1][0]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        role: 'tool',
        tool_call_id: 'tool-bad-json',
        content: expect.stringContaining('Invalid tool arguments JSON'),
      }),
    ])
  );
});
```

- [ ] **Step 2: Run runtime test to verify failure**

Run:

```bash
cd frontend && npm test -- --run src/agent/useAgentRuntime.test.ts
```

Expected: FAIL because the runtime currently executes `write_file` with `{}`.

- [ ] **Step 3: Preserve parse error and skip tool execution**

In `frontend/src/agent/useAgentRuntime.ts`, replace the argument parse block in the tool execution loop with:

```ts
let args: Record<string, unknown> = {};
let toolPath: string | null = null;
let argumentParseError: string | null = null;
try {
  args = parseToolArguments(toolCall.function.arguments);
  const candidatePath = args.path ?? args.oldPath ?? args.newPath;
  toolPath = typeof candidatePath === 'string' ? candidatePath : null;
} catch (error) {
  argumentParseError = error instanceof Error ? error.message : 'Invalid tool arguments JSON';
}
```

Then replace the execution block with:

```ts
let resultContent: string;
let toolErrored = false;
if (argumentParseError) {
  resultContent = `Invalid tool arguments JSON for ${toolName}: ${argumentParseError}`;
  toolErrored = true;
} else {
  try {
    const result = await executeTool(toolName, args);
    resultContent = result.content;
    toolErrored = Boolean(result.isError);
  } catch (e: any) {
    resultContent = `Error: ${e.message}`;
    toolErrored = true;
  }
}
```

- [ ] **Step 4: Keep UI payload resilient**

In the earlier `tools = message.tool_calls!.map(...)` block, keep the existing catch behavior for transient UI args, but ensure it does not affect execution. No code change is required if Step 3 uses a separate parse in the execution loop.

- [ ] **Step 5: Run tests**

Run:

```bash
cd frontend && npm test -- --run src/agent/useAgentRuntime.test.ts
```

Expected: PASS.

---

## Task 4: Preserve Clean No-Op Save Behavior When WebContainer Is Unavailable

**Files:**
- Modify: `frontend/src/stores/useEditorStore.ts`
- Modify: `frontend/src/stores/useEditorStore.test.ts`

- [ ] **Step 1: Add failing tests**

Add these tests to `frontend/src/stores/useEditorStore.test.ts` inside `describe('useEditorStore.saveToOSS', ...)`:

```ts
it('returns true for a clean non-forced save without requiring WebContainer', async () => {
  wcGetProjectSnapshotMock.mockRejectedValueOnce(new Error('WebContainer is not initialized'));

  const result = await useEditorStore.getState().saveToOSS('topic-1', '手动保存');

  expect(result).toBe(true);
  expect(createTarballMock).not.toHaveBeenCalled();
  expect(getPresignMock).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('returns false for a dirty save when WebContainer snapshot is unavailable', async () => {
  useEditorStore.getState().setFileContent('src/index.ts', 'console.log("dirty");');
  wcGetProjectSnapshotMock.mockRejectedValueOnce(new Error('WebContainer is not initialized'));

  const result = await useEditorStore.getState().saveToOSS('topic-1', '手动保存');

  expect(result).toBe(false);
  expect(createTarballMock).not.toHaveBeenCalled();
  expect(getPresignMock).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run store test to verify failure**

Run:

```bash
cd frontend && npm test -- --run src/stores/useEditorStore.test.ts
```

Expected: the clean non-forced save test FAILS because `saveToOSS()` currently snapshots WebContainer before checking dirty state.

- [ ] **Step 3: Short-circuit clean non-forced saves before WebContainer snapshot**

In `frontend/src/stores/useEditorStore.ts`, add this at the top of `saveToOSS` before the `try` block:

```ts
if (!get().hasUnsavedChanges && !options?.force) {
  return true;
}
```

Keep the existing WebContainer snapshot logic for forced saves and dirty saves:

```ts
const files = await wcGetProjectSnapshot();
if (!filesEqual(get().files, files)) {
  get().replaceProjectFiles(files, { markUnsaved: true });
}
const { fileRevision: snapshotRevision, hasUnsavedChanges, markSaved } = get();
if (Object.keys(files).length === 0) return false;
if (!hasUnsavedChanges && !options?.force) return true;
```

- [ ] **Step 4: Run tests**

Run:

```bash
cd frontend && npm test -- --run src/stores/useEditorStore.test.ts
```

Expected: PASS.

---

## Task 5: Final Focused Verification

**Files:**
- No new files.

- [ ] **Step 1: Run agent/WebContainer focused tests**

Run:

```bash
cd frontend && npm test -- --run src/agent/webcontainer.test.ts src/agent/tools/runCommand.test.ts src/agent/useAgentRuntime.test.ts src/services/projectFileService.test.ts src/hooks/useWebContainer.test.tsx src/stores/useEditorStore.test.ts src/pages/WebsiteEditorPage.test.tsx
```

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Manual smoke checklist**

Run the app and verify these flows:

```bash
cd frontend && npm run dev
```

Expected manual results:

- Creating a new empty topic seeds React scaffold, resets WebContainer, then saves seed only after reset succeeds.
- If WebContainer reset fails, the page does not save stale seed files.
- Asking build agent to edit `package.json` reruns install/dev startup for the current session.
- A malformed tool-call JSON string appears as an invalid-arguments tool error, not a misleading missing `path` error.
- Pressing manual save with no changes does not fail solely because WebContainer is unavailable.

## Self-Review

**Spec coverage:** All four review findings map to Tasks 1-4. Task 5 verifies the integrated agent/WebContainer path.

**Placeholder scan:** No task contains “TBD”, “TODO”, “implement later”, or unspecified “add tests” instructions.

**Type consistency:** `initProject` and `init` consistently return `Promise<boolean>`. `restartDevServerForCurrentSession` is exported from `useWebContainer.ts` and imported by package file tools.
