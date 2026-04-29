# Agent / WebContainer Review Fixes — Remaining Work

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix remaining agent/WebContainer consistency issues found in review. Covers: failed reset must not trigger stale seed saves, package changes must restart dependency/runtime setup, malformed tool JSON is reported accurately, and concurrent saves must not race.

**Architecture:** Keep WebContainer as the canonical runtime filesystem and EditorStore as the synchronized projection. Make lifecycle calls return explicit success state, centralize save fallback behavior, and keep tool-call validation at the agent runtime boundary before tool execution.

**Tech Stack:** React 18, TypeScript, Zustand, WebContainer API, Vitest, Testing Library.

**Source:** Merged from `2026-04-27-agent-webcontainer-review-fixes.md` (Tasks 1, 4, 5, 7, 8, 9, 10) and `2026-04-28-agent-webcontainer-review-fixes.md` (Tasks 1, 2, 4). De-duplicated: Task 3 from 04-28 (malformed tool arguments) is already done; Task 4 from 04-27 (summaryVersion) kept here; both plans described dev-server restart differently — the 04-28 `restartDevServerForCurrentSession` approach supersedes the 04-27 `tryStartDevServer` approach.

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
3. `deleteFile` and `moveFile` do not trigger dev server startup on `package.json` changes (unlike `createFile`/`writeFile`).
4. `topicTitle` is dropped between UI → hook → agent boundary even though `BaseAgent` accepts it.
5. Rule-based compression can duplicate section headers when a previous summary exists.
6. `summaryVersion` is hardcoded to `1` instead of incrementing from previous value.
7. `restoreFromLocalBackup` uses raw `JSON.parse` instead of `parseLocalRecoverySnapshot`.
8. `filesEqual` is duplicated in `useEditorStore` and `projectFileService`.
9. `buildFileTree` does not sort entries, leading to non-deterministic file order.
10. `saveToOSS` has no concurrency guard — overlapping calls can corrupt revision bookkeeping.
11. `usePreviewSync` subscribes to the entire store, causing unnecessary re-renders on unrelated file changes.
12. `tools` in `useAgentRuntime` is typed as `any[]` instead of `ToolAction[]`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/hooks/useWebContainer.ts` | Modify | Make `initProject` return `Promise<boolean>`, add `restartDevServerForCurrentSession` |
| `frontend/src/hooks/useWebContainer.test.tsx` | Modify | Cover reset failure return, package restart behavior |
| `frontend/src/pages/WebsiteEditorPage.tsx` | Modify | Gate seed save on successful init, pass `title` to AgentChatContent |
| `frontend/src/pages/WebsiteEditorPage.test.tsx` | Modify | Cover failed init preventing seed save |
| `frontend/src/agent/tools/writeFile.ts` | Modify | Use `restartDevServerForCurrentSession` for package.json writes |
| `frontend/src/agent/tools/createFile.ts` | Modify | Use `restartDevServerForCurrentSession` for package.json creates |
| `frontend/src/agent/tools/deleteFile.ts` | Modify | Trigger dev server restart on package.json delete |
| `frontend/src/agent/tools/moveFile.ts` | Modify | Trigger dev server restart on package.json move |
| `frontend/src/agent/tools/runCommand.test.ts` | Modify | Add delete/move package.json trigger tests, update mock |
| `frontend/src/agent/useAgentRuntime.ts` | Modify | Add `topicTitle` option, type `tools` as `ToolAction[]` |
| `frontend/src/agent/useAgentRuntime.test.ts` | Modify | Cover topicTitle forwarding |
| `frontend/src/components/AgentChatContent.tsx` | Modify | Pass `topicTitle: title` to `useAgentRuntime` |
| `frontend/src/agent/contextCompression.ts` | Modify | Fix rule-based compression duplicate headers |
| `frontend/src/agent/contextCompression.test.ts` | Modify | Add test for duplicate header prevention |
| `frontend/src/agent/BaseAgent.ts` | Modify | Increment `summaryVersion` |
| `frontend/src/agent/BaseAgent.test.ts` | Modify | Update summary version expectation |
| `frontend/src/stores/useEditorStore.ts` | Modify | Use `parseLocalRecoverySnapshot`, export `filesEqual`, sort `buildFileTree`, add `isSaving` guard, short-circuit clean non-forced save |
| `frontend/src/stores/useEditorStore.test.ts` | Modify | Cover clean save without WC, concurrent save guard |
| `frontend/src/services/projectFileService.ts` | Modify | Import shared `filesEqual` instead of local copy |
| `frontend/src/hooks/usePreviewSync.ts` | Modify | Use zustand selector for active file content |

---

## Task 1: Make WebContainer Project Init Report Reset Failure

**Fixes finding #1**

**Files:**
- Modify: `frontend/src/hooks/useWebContainer.ts`
- Modify: `frontend/src/hooks/useWebContainer.test.tsx`
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`
- Modify: `frontend/src/pages/WebsiteEditorPage.test.tsx`

- [ ] **Step 1: Add failing hook test for reset failure**

Add test to `useWebContainer.test.tsx` inside `describe('useWebContainer topic sessions', ...)`:

```ts
it('returns false and does not mark ready when project reset fails', async () => {
  bootMock.mockResolvedValue({ spawn: vi.fn() });
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

- [ ] **Step 2: Change `initProject` to return `Promise<boolean>`**

In `useWebContainer.ts`, change `initProject` so it returns `true` only after successful reset, `false` on failure. The `runSession` inner function should `return true` after successful reset + dev server start, and `return false` in the catch block. The legacy `init` wrapper should also return `Promise<boolean>`.

- [ ] **Step 3: Gate seed save on successful initialization**

In `WebsiteEditorPage.tsx`, replace the init effect body with:

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

- [ ] **Step 4: Add page regression test for failed init blocking seed save**

Add test to `WebsiteEditorPage.test.tsx` verifying that `saveToOSS` is not called when `initProject` returns `false`.

- [ ] **Step 5: Run tests**

```bash
cd frontend && npm test -- --run src/hooks/useWebContainer.test.tsx src/pages/WebsiteEditorPage.test.tsx
```

---

## Task 2: Restart Dev Server When package.json Changes

**Fixes findings #2 and #3**

**Files:**
- Modify: `frontend/src/hooks/useWebContainer.ts`
- Modify: `frontend/src/hooks/useWebContainer.test.tsx`
- Modify: `frontend/src/agent/tools/writeFile.ts`
- Modify: `frontend/src/agent/tools/createFile.ts`
- Modify: `frontend/src/agent/tools/deleteFile.ts`
- Modify: `frontend/src/agent/tools/moveFile.ts`
- Modify: `frontend/src/agent/tools/runCommand.test.ts`

- [ ] **Step 1: Add failing restart test**

Add test to `useWebContainer.test.tsx`:

```ts
it('force restarts install and dev server for the current session after package changes', async () => {
  const firstInstall = createProcess();
  const firstDev = createProcess(new Promise<number>(() => undefined));
  const secondInstall = createProcess();
  const secondDev = createProcess(new Promise<number>(() => undefined));
  const spawn = vi.fn()
    .mockResolvedValueOnce(firstInstall)
    .mockResolvedValueOnce(firstDev)
    .mockResolvedValueOnce(secondInstall)
    .mockResolvedValueOnce(secondDev);

  bootMock.mockResolvedValue({ spawn, on: vi.fn(() => vi.fn()) });
  wcResetProjectMock.mockResolvedValue(undefined);

  const { result } = renderHook(() => useWebContainer());

  await act(async () => {
    await result.current.initProject('topic-a', { 'package.json': '{"scripts":{"dev":"vite"}}' });
  });
  await waitFor(() => { expect(spawn).toHaveBeenCalledTimes(2); });

  act(() => { restartDevServerForCurrentSession(); });

  await waitFor(() => { expect(spawn).toHaveBeenCalledTimes(4); });
  expect(firstDev.kill).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Add `restartDevServerForCurrentSession` export**

In `useWebContainer.ts`, add:

```ts
export function restartDevServerForCurrentSession(): void {
  const sessionId = currentSessionId;
  if (!webcontainerInstance || sessionId === 0) return;
  stopCurrentDevProcess();
  void startDevServerInternal(sessionId);
}
```

- [ ] **Step 3: Replace `tryStartDevServer` with `restartDevServerForCurrentSession` in write/create tools**

In `writeFile.ts` and `createFile.ts`, change the import and usage for package.json detection.

- [ ] **Step 4: Add dev server restart to deleteFile and moveFile**

In `deleteFile.ts`, add import of `restartDevServerForCurrentSession` and trigger it when `path === 'package.json'` or `path.endsWith('/package.json')`.

In `moveFile.ts`, same import, and check both `oldPath` and `newPath` for package.json.

- [ ] **Step 5: Update tool tests**

In `runCommand.test.ts`, add `restartDevServerForCurrentSession` mock, update `write_file`/`create_file` package tests to expect `restartDevServerForCurrentSession`, and add new `delete_file`/`move_file` package tests.

- [ ] **Step 6: Run tests**

```bash
cd frontend && npm test -- --run src/hooks/useWebContainer.test.tsx src/agent/tools/runCommand.test.ts
```

---

## Task 3: Wire `topicTitle` Through to AgentSessionContext

**Fixes finding #4**

**Files:**
- Modify: `frontend/src/agent/useAgentRuntime.ts`
- Modify: `frontend/src/components/AgentChatContent.tsx`
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`

- [ ] **Step 1: Add `topicTitle` to `useAgentRuntime` options**

Change signature to accept `topicTitle?: string`, forward it in the `useMemo` body, add to dependency array.

- [ ] **Step 2: Pass `topicTitle: title` in `AgentChatContent`**

`AgentChatContent` already accepts `title` prop — forward it to `useAgentRuntime({ topicId, agentType, topicTitle: title })`.

- [ ] **Step 3: Pass `title={topic?.title}` from `WebsiteEditorPage`**

Add `title` prop to the `<AgentChatContent>` element.

- [ ] **Step 4: Run tests**

```bash
cd frontend && npx vitest run src/agent/
```

---

## Task 4: Fix Rule-Based Compression Duplicate Section Headers

**Fixes finding #5**

**Files:**
- Modify: `frontend/src/agent/contextCompression.ts`
- Modify: `frontend/src/agent/contextCompression.test.ts`

- [ ] **Step 1: Add failing test**

```ts
describe('buildRuleBasedCompressionSummary', () => {
  it('does not duplicate section headers when a previous summary exists', () => {
    const previousSummary = '## 历史概览\n- Built React app\n## 关键记忆点\n- Uses Tailwind';
    const result = buildRuleBasedCompressionSummary({
      previousCompressedSummary: previousSummary,
      newlyCompressibleMessages: [
        { id: 'msg-1', role: 'assistant' as const, content: 'Added routing' },
      ],
    });

    expect((result.match(/## 历史概览/g) || []).length).toBeLessThanOrEqual(1);
    expect((result.match(/## 关键记忆点/g) || []).length).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Fix `buildRuleBasedCompressionSummary`**

When `previousCompressedSummary` exists, do not re-emit `## 历史概览` and `## 关键记忆点` headers — the previous summary already contains them.

- [ ] **Step 3: Run tests**

```bash
cd frontend && npx vitest run src/agent/contextCompression.test.ts
```

---

## Task 5: Increment `summaryVersion` in Compressed Context

**Fixes finding #6**

**Files:**
- Modify: `frontend/src/agent/BaseAgent.ts`
- Modify: `frontend/src/agent/BaseAgent.test.ts`

- [ ] **Step 1: Change `summaryVersion: 1` to `summaryVersion: compressedContext.summaryVersion + 1`**

- [ ] **Step 2: Update test expectation from `summaryVersion: 1` to `summaryVersion: 2`**

- [ ] **Step 3: Add explicit test for increment from arbitrary previous version**

```ts
it('increments summaryVersion from the previous compressed context', async () => {
  // ... setup with summaryVersion: 7
  // expect compressedContext.summaryVersion to be 8
});
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npx vitest run src/agent/
```

---

## Task 6: Fix `restoreFromLocalBackup` and Extract Shared `filesEqual`

**Fixes findings #7 and #8**

**Files:**
- Modify: `frontend/src/stores/useEditorStore.ts`
- Modify: `frontend/src/services/projectFileService.ts`

- [ ] **Step 1: Replace raw `JSON.parse` with `parseLocalRecoverySnapshot` in `restoreFromLocalBackup`**

- [ ] **Step 2: Export `filesEqual` from `useEditorStore`**

Change `function filesEqual(...)` to `export function filesEqual(...)`.

- [ ] **Step 3: Remove local `filesEqual` from `projectFileService.ts` and import from `useEditorStore`**

```ts
import { useEditorStore, filesEqual } from '../stores/useEditorStore';
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npx vitest run src/stores/useEditorStore.test.ts src/services/projectFileService.test.ts
```

---

## Task 7: Sort `buildFileTree` for Deterministic File Ordering

**Fixes finding #9**

**Files:**
- Modify: `frontend/src/stores/useEditorStore.ts`

- [ ] **Step 1: Sort `Object.entries` in `buildFileTree`**

Change:
```ts
for (const [path] of Object.entries(files)) {
```
to:
```ts
for (const [path] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
```

- [ ] **Step 2: Run tests**

```bash
cd frontend && npx vitest run src/stores/useEditorStore.test.ts
```

---

## Task 8: Add `isSaving` Guard to `saveToOSS`

**Fixes findings #10 and #12 (clean save short-circuit)**

**Files:**
- Modify: `frontend/src/stores/useEditorStore.ts`
- Modify: `frontend/src/stores/useEditorStore.test.ts`

- [ ] **Step 1: Add `isSaving: boolean` to `EditorState` interface and initial state**

- [ ] **Step 2: Add guard at top of `saveToOSS`**

```ts
if (get().isSaving) return false;
set({ isSaving: true });
```

Add `finally { set({ isSaving: false }); }` to ensure every return path clears the flag.

- [ ] **Step 3: Add early return for clean non-forced saves before WebContainer snapshot**

At the very top of `saveToOSS`, before the `isSaving` guard:

```ts
if (!get().hasUnsavedChanges && !options?.force) return true;
```

- [ ] **Step 4: Add regression tests**

- Clean non-forced save returns `true` without requiring WebContainer.
- Dirty save returns `false` when WebContainer snapshot is unavailable.
- Concurrent `saveToOSS` calls — second call returns `false`, only one upload occurs.

- [ ] **Step 5: Run tests**

```bash
cd frontend && npx vitest run src/stores/useEditorStore.test.ts
```

---

## Task 9: Optimize `usePreviewSync` with Zustand Selector

**Fixes finding #11**

**Files:**
- Modify: `frontend/src/hooks/usePreviewSync.ts`

- [ ] **Step 1: Replace full store subscription with targeted selectors**

```ts
const activeFile = useEditorStore((s) => s.activeFile);
const activeFileContent = useEditorStore((s) => s.activeFile ? s.files[s.activeFile] : undefined);
const setActivePreviewContent = useEditorStore((s) => s.setActivePreviewContent);
```

- [ ] **Step 2: Run tests**

```bash
cd frontend && npx vitest run src/hooks/usePreviewSync.test.ts
```

---

## Task 10: Type `tools` as `ToolAction[]` in `useAgentRuntime`

**Fixes finding #12**

**Files:**
- Modify: `frontend/src/agent/useAgentRuntime.ts`

- [ ] **Step 1: Import `ToolAction` type**

```ts
import type { AIChatMessage, PersistedAgentMessage, AgentMessage, ToolAction } from '@web-learn/shared';
```

- [ ] **Step 2: Change `let tools: any[] = []` to `let tools: ToolAction[] = []` and add type guard in the `.map().filter()` chain**

- [ ] **Step 3: Run tests and typecheck**

```bash
cd frontend && npx vitest run src/agent/useAgentRuntime.test.ts && npx tsc --noEmit
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run focused tests**

```bash
cd frontend && npm test -- --run src/agent/ src/services/projectFileService.test.ts src/hooks/useWebContainer.test.tsx src/hooks/usePreviewSync.test.ts src/stores/useEditorStore.test.ts src/pages/WebsiteEditorPage.test.tsx
```

- [ ] **Step 2: Run typecheck**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Manual smoke checklist**
- Creating a new empty topic seeds scaffold, saves seed only after reset succeeds.
- If WebContainer reset fails, page does not save stale seed files.
- Asking agent to edit `package.json` reruns install/dev startup.
- Deleting or moving `package.json` triggers the same restart.
- Malformed tool-call JSON appears as invalid-arguments error (already working).
- Pressing manual save with no changes does not fail when WebContainer is unavailable.
- Concurrent save attempts do not race.

---

## Scope Not Included (Deferred)

| Issue | Reason |
|-------|--------|
| Agent loop abort mechanism | Requires refactoring `runAgentLoop` signature and component lifecycle coordination |
| `rm` in SAFE_COMMANDS | Policy decision needing product input |
| `writeProjectFile`/`shouldCommit` desync | Needs audit of all callers; consider removing the option |
| `wcResetProject` partial deletion on interrupt | Requires transactional approach — significant refactor |
