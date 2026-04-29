# Agent / Tools / WebContainer Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 10 small, verified issues from the deep code review of agent, tools, and webcontainer components. Larger lifecycle/security issues are explicitly deferred below.

**Architecture:** Fixes are grouped into 10 tasks by component proximity. Each task produces a self-contained commit. Task 6 depends on Task 5 because it imports the newly exported `filesEqual`. Tasks 5, 7, and 8 all touch `useEditorStore`, so apply them in the listed order.

**Tech Stack:** React 18, TypeScript, Zustand, Vitest, WebContainer API

---

## First-Principles Review

These fixes are scoped to violations of simple system invariants:

1. **The editor projection and WebContainer filesystem must converge after every successful file mutation.** Tool actions that mutate project files must update the editor projection after WebContainer succeeds, and save/publish flows must snapshot WebContainer as the source of truth.
2. **Agent memory must preserve monotonic state.** Context compression should not duplicate structural headers, and `summaryVersion` must increase when a new compressed summary replaces the old one.
3. **Prompt context must contain the domain identity already available in UI state.** `topic.title` exists in `WebsiteEditorPage`, and `BaseAgent` already accepts `topicTitle`; the runtime currently drops it.
4. **Async boundaries need idempotence and race protection.** `saveToOSS` can be reached by manual save, autosave, seed persistence, and agent save. Concurrent uploads should not race and then mark stale revisions as saved.
5. **Type annotations must express actual runtime shape.** Replacing `any[]` with `ToolAction[]` is only valid if the map/filter code narrows away `null` and preserves literal tool states.
6. **Performance optimizations must narrow subscriptions without changing behavior.** `usePreviewSync` only needs the active file and that file's content, not every file record change.

Out of scope for this plan:

- A true dev-server restart/reinstall lifecycle when `package.json` changes after the server is already running. `tryStartDevServer()` currently returns early for an already-started session, so Tasks 1 only make delete/move consistent with create/write by triggering the same startup attempt.
- Agent-loop abort, `rm` command policy, `writeProjectFile` stale-write semantics, and transactional `wcResetProject`; these require architectural changes and remain deferred.

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/agent/tools/deleteFile.ts` | Modify | Trigger `tryStartDevServer` on package.json delete |
| `frontend/src/agent/tools/moveFile.ts` | Modify | Trigger `tryStartDevServer` on package.json move |
| `frontend/src/agent/tools/runCommand.test.ts` | Modify | Add delete/move package.json trigger tests |
| `frontend/src/agent/useAgentRuntime.ts` | Modify | Add `topicTitle` option, type `tools` |
| `frontend/src/components/AgentChatContent.tsx` | Modify | Pass `topicTitle` to `useAgentRuntime` |
| `frontend/src/pages/WebsiteEditorPage.tsx` | Modify | Pass `topic.title` to `AgentChatContent` |
| `frontend/src/agent/contextCompression.ts` | Modify | Fix rule-based compression duplicate headers |
| `frontend/src/agent/contextCompression.test.ts` | Modify | Add test for rule-based compression fix |
| `frontend/src/agent/BaseAgent.ts` | Modify | Increment `summaryVersion` |
| `frontend/src/agent/BaseAgent.test.ts` | Modify | Update summary version expectation |
| `frontend/src/stores/useEditorStore.ts` | Modify | Use `parseLocalRecoverySnapshot` in `restoreFromLocalBackup`, extract `filesEqual`, sort `buildFileTree`, add `isSaving` guard |
| `frontend/src/services/projectFileService.ts` | Modify | Import shared `filesEqual` instead of local copy |
| `frontend/src/hooks/usePreviewSync.ts` | Modify | Use zustand selector for active file content |

---

### Task 1: Trigger dev-server startup attempt from deleteFile and moveFile

**Files:**
- Modify: `frontend/src/agent/tools/deleteFile.ts`
- Modify: `frontend/src/agent/tools/moveFile.ts`
- Modify: `frontend/src/agent/tools/runCommand.test.ts`

**First-principles check:** `create_file` and `write_file` already treat `package.json` as a lifecycle-sensitive file. `delete_file` and `move_file` are equally capable of changing whether a dev server can be installed or started, so they should trigger the same hook. This is not a complete restart solution because `tryStartDevServer()` is currently idempotent per session.

- [ ] **Step 1: Update `deleteFile.ts`**

Add the import and package.json detection logic matching `createFile.ts:28-30`:

```ts
import { registerTool } from '../toolRegistry';
import { deleteProjectPath } from '../../services/projectFileService';
import { tryStartDevServer } from '../../hooks/useWebContainer';
import { parseProjectToolPath } from './projectToolPath';

registerTool('delete_file', {
  name: 'delete_file',
  description: 'Delete a project file or directory. The path must be project-root-relative, for example src/App.tsx. Absolute paths are invalid.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Project-root-relative path to the file or directory. Absolute paths are invalid.' },
    },
    required: ['path'],
  },
}, async (args) => {
  const path = parseProjectToolPath(args.path);
  if (typeof path !== 'string') {
    return path;
  }
  try {
    await deleteProjectPath(path);
    if (path === 'package.json' || path.endsWith('/package.json')) {
      tryStartDevServer();
    }
    return { content: `Successfully deleted ${path}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete project path';
    return { content: `Failed to delete ${path}: ${message}`, isError: true };
  }
});
```

- [ ] **Step 2: Update `moveFile.ts`**

Add the import and check both `oldPath` and `newPath` for package.json:

```ts
import { registerTool } from '../toolRegistry';
import { moveProjectPath } from '../../services/projectFileService';
import { tryStartDevServer } from '../../hooks/useWebContainer';
import { parseProjectToolPath } from './projectToolPath';

registerTool('move_file', {
  name: 'move_file',
  description: 'Move or rename a project file. Creates parent directories of the destination if needed. Paths must be project-root-relative. Absolute paths are invalid.',
  parameters: {
    type: 'object',
    properties: {
      oldPath: { type: 'string', description: 'Current project-root-relative path of the file. Absolute paths are invalid.' },
      newPath: { type: 'string', description: 'New project-root-relative path for the file. Absolute paths are invalid.' },
    },
    required: ['oldPath', 'newPath'],
  },
}, async (args) => {
  const oldPath = parseProjectToolPath(args.oldPath, 'oldPath');
  if (typeof oldPath !== 'string') {
    return oldPath;
  }
  const newPath = parseProjectToolPath(args.newPath, 'newPath');
  if (typeof newPath !== 'string') {
    return newPath;
  }
  try {
    await moveProjectPath(oldPath, newPath);
    const isPkgJson = (p: string) => p === 'package.json' || p.endsWith('/package.json');
    if (isPkgJson(oldPath) || isPkgJson(newPath)) {
      tryStartDevServer();
    }
    return { content: `Successfully moved ${oldPath} to ${newPath}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to move project path';
    return { content: `Failed to move ${oldPath} to ${newPath}: ${message}`, isError: true };
  }
});
```

- [ ] **Step 3: Add tool tests for package.json delete/move triggers**

In `frontend/src/agent/tools/runCommand.test.ts`, import the tools so they register:

```ts
import './deleteFile';
import './moveFile';
```

Extend the `projectFileServiceMock` with `deleteProjectPath` and `moveProjectPath`, then add tests:

```ts
describe('delete_file', () => {
  beforeEach(() => {
    tryStartDevServerMock.mockClear();
    projectFileServiceMock.deleteProjectPath.mockClear();
  });

  it('triggers dev server startup after deleting package.json', async () => {
    const execute = executeState.executes.get('delete_file');
    if (!execute) throw new Error('delete_file tool was not registered');

    await expect(execute({ path: 'package.json' })).resolves.toEqual({
      content: 'Successfully deleted package.json',
    });
    expect(projectFileServiceMock.deleteProjectPath).toHaveBeenCalledWith('package.json');
    expect(tryStartDevServerMock).toHaveBeenCalledTimes(1);
  });
});

describe('move_file', () => {
  beforeEach(() => {
    tryStartDevServerMock.mockClear();
    projectFileServiceMock.moveProjectPath.mockClear();
  });

  it('triggers dev server startup after moving package.json', async () => {
    const execute = executeState.executes.get('move_file');
    if (!execute) throw new Error('move_file tool was not registered');

    await expect(execute({ oldPath: 'package.json', newPath: 'package.old.json' })).resolves.toEqual({
      content: 'Successfully moved package.json to package.old.json',
    });
    expect(projectFileServiceMock.moveProjectPath).toHaveBeenCalledWith('package.json', 'package.old.json');
    expect(tryStartDevServerMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `cd frontend && npx vitest run src/agent/tools/`
Expected: All existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/agent/tools/deleteFile.ts frontend/src/agent/tools/moveFile.ts frontend/src/agent/tools/runCommand.test.ts
git commit -m "fix: trigger dev server startup when package.json is deleted or moved"
```

---

### Task 2: Wire `topicTitle` through to AgentSessionContext

**Files:**
- Modify: `frontend/src/agent/useAgentRuntime.ts`
- Modify: `frontend/src/components/AgentChatContent.tsx`
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`

**First-principles check:** `BaseAgent` already accepts `topicTitle` and the system/compression prompts already use it. The bug is a dropped value along the UI -> hook -> agent boundary.

- [ ] **Step 1: Add `topicTitle` to `useAgentRuntime` options**

In `frontend/src/agent/useAgentRuntime.ts`, change the function signature and context:

```ts
export function useAgentRuntime(options: { topicId: string; agentType: 'building' | 'learning'; topicTitle?: string }) {
```

And in the `useMemo` body, change line 55:

```ts
      topicTitle: options.topicTitle,
```

Add `options.topicTitle` to the `useMemo` dependency array:

```ts
  }, [options.topicId, options.agentType, options.topicTitle, setCompressedContext, setSelectedSkills, setVisibleMessages]);
```

- [ ] **Step 2: Destructure `title` and pass `topicTitle` in `AgentChatContent`**

In `frontend/src/components/AgentChatContent.tsx`, include `title` in the component props destructuring:

```ts
export default function AgentChatContent({
  topicId,
  agentType,
  title,
  initialPrompt,
  onInitialPromptConsumed,
  isWebContainerReady = true,
}: AgentChatContentProps) {
```

In `frontend/src/components/AgentChatContent.tsx`, change line 26:

```ts
  const { runAgentLoop, visibleMessages, hydrateConversation } = useAgentRuntime({ topicId, agentType, topicTitle: title });
```

- [ ] **Step 3: Pass `topic.title` from `WebsiteEditorPage`**

In `frontend/src/pages/WebsiteEditorPage.tsx`, add `title` prop to `AgentChatContent` at line ~273:

```tsx
                  <AgentChatContent
                    topicId={id ?? ''}
                    agentType="building"
                    initialPrompt={initialBuildPrompt}
                    onInitialPromptConsumed={handleInitialPromptConsumed}
                    isWebContainerReady={isReady}
                    title={topic?.title}
                  />
```

- [ ] **Step 4: Run existing tests**

Run: `cd frontend && npx vitest run src/agent/`
Expected: All existing tests pass (the `topicTitle` is optional, so no breakage).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/agent/useAgentRuntime.ts frontend/src/components/AgentChatContent.tsx frontend/src/pages/WebsiteEditorPage.tsx
git commit -m "fix: wire topicTitle to agent context for better system prompts and compression"
```

---

### Task 3: Fix rule-based compression duplicate section headers

**Files:**
- Modify: `frontend/src/agent/contextCompression.ts`
- Modify: `frontend/src/agent/contextCompression.test.ts`

**First-principles check:** A compressed summary is a single structured memory artifact. The fallback builder should append incremental facts without re-emitting top-level headers that may already exist in the previous artifact.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/agent/contextCompression.test.ts`:

```ts
import { buildRuleBasedCompressionSummary } from './contextCompression';

describe('buildRuleBasedCompressionSummary', () => {
  it('does not duplicate section headers when a previous summary exists', () => {
    const previousSummary = '## 历史概览\n- Built React app\n## 关键记忆点\n- Uses Tailwind';
    const result = buildRuleBasedCompressionSummary({
      previousCompressedSummary: previousSummary,
      newlyCompressibleMessages: [
        { id: 'msg-1', role: 'assistant' as const, content: 'Added routing' },
      ],
    });

    // The previous summary already contains these headers; they should not appear twice
    const headerCount = (result.match(/## 历史概览/g) || []).length;
    expect(headerCount).toBeLessThanOrEqual(1);

    const keyMemoryCount = (result.match(/## 关键记忆点/g) || []).length;
    expect(keyMemoryCount).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/agent/contextCompression.test.ts`
Expected: FAIL — duplicate headers are present in the current output.

- [ ] **Step 3: Fix `buildRuleBasedCompressionSummary`**

In `frontend/src/agent/contextCompression.ts`, replace `buildRuleBasedCompressionSummary`:

```ts
export function buildRuleBasedCompressionSummary(input: {
  previousCompressedSummary: string;
  newlyCompressibleMessages: RuntimeMessage[];
}): string {
  if (!input.previousCompressedSummary && input.newlyCompressibleMessages.length === 0) {
    return '';
  }

  if (input.newlyCompressibleMessages.length === 0) {
    return input.previousCompressedSummary;
  }

  const parts: string[] = [];

  if (input.previousCompressedSummary) {
    parts.push(input.previousCompressedSummary);
  } else {
    parts.push('## 历史概览', '## 关键记忆点');
  }

  parts.push('', '## 最近压缩消息');
  parts.push(`- 共 ${input.newlyCompressibleMessages.length} 条消息被压缩`);

  return parts.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/agent/contextCompression.test.ts`
Expected: PASS

- [ ] **Step 5: Run all agent tests for regression check**

Run: `cd frontend && npx vitest run src/agent/`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/agent/contextCompression.ts frontend/src/agent/contextCompression.test.ts
git commit -m "fix: avoid duplicate section headers in rule-based compression fallback"
```

---

### Task 4: Increment `summaryVersion` in compressed context

**Files:**
- Modify: `frontend/src/agent/BaseAgent.ts`
- Modify: `frontend/src/agent/BaseAgent.test.ts`

**First-principles check:** `summaryVersion` is a version counter for replacement summaries. A replacement that preserves the same version is indistinguishable from stale state to any future consumer.

- [ ] **Step 1: Fix `summaryVersion`**

In `frontend/src/agent/BaseAgent.ts`, change line 155 from:

```ts
      summaryVersion: 1,
```

to:

```ts
      summaryVersion: compressedContext.summaryVersion + 1,
```

- [ ] **Step 2: Update the compression test expectation**

In `frontend/src/agent/BaseAgent.test.ts`, update the normal compression assertion from:

```ts
summaryVersion: 1,
```

to:

```ts
summaryVersion: 2,
```

Add a focused test if desired to make the invariant explicit:

```ts
it('increments summaryVersion from the previous compressed context', async () => {
  let currentVisibleMessages = [
    createPersistedMessage('msg-1', 'x'.repeat(520_000)),
    createPersistedMessage('msg-2', 'recent'),
  ];
  let currentCompressedContext = createCompressedContext({
    summary: 'previous',
    summaryVersion: 7,
    hasCompressedContext: true,
  });
  const setCompressedContext = vi.fn((context: AgentCompressedContext) => {
    currentCompressedContext = context;
  });

  const agent = new TestAgent({
    topicId: 'topic-1',
    topicTitle: undefined,
    getSelectedSkills: () => [],
    getVisibleMessages: () => currentVisibleMessages,
    getCompressedContext: () => currentCompressedContext,
    setSelectedSkills: vi.fn(),
    setVisibleMessages: (messages) => {
      currentVisibleMessages = messages;
    },
    setCompressedContext,
  });

  await agent.compressBeforeRequest('continue');

  expect(currentCompressedContext.summaryVersion).toBe(8);
});
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/agent/`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/agent/BaseAgent.ts frontend/src/agent/BaseAgent.test.ts
git commit -m "fix: increment summaryVersion on each compression cycle"
```

---

### Task 5: Fix `restoreFromLocalBackup` and extract shared `filesEqual`

**Files:**
- Modify: `frontend/src/stores/useEditorStore.ts`

**First-principles check:** Local recovery data is untrusted serialized state. Every restore path should pass through the same parser that validates shape and preserves legacy snapshot compatibility.

- [ ] **Step 1: Replace raw `JSON.parse` with `parseLocalRecoverySnapshot` in `restoreFromLocalBackup`**

In `frontend/src/stores/useEditorStore.ts`, replace the `restoreFromLocalBackup` method (lines 388-400):

```ts
  restoreFromLocalBackup: (topicId: string): boolean => {
    try {
      const snapshot = parseLocalRecoverySnapshot(localStorage.getItem(`local-backup-${topicId}`));
      if (!snapshot) return false;
      get().loadSnapshot(snapshot.files);
      toast.success('已从本地备份恢复数据');
      return true;
    } catch (e) {
      console.error('Restore local backup failed:', e);
      return false;
    }
  },
```

- [ ] **Step 2: Export `filesEqual` from `useEditorStore` so `projectFileService` can import it**

Change the `filesEqual` function at line 152 from a plain function to an export:

```ts
export function filesEqual(left: Record<string, string>, right: Record<string, string>): boolean {
```

- [ ] **Step 3: Run editor store tests**

Run: `cd frontend && npx vitest run src/stores/useEditorStore.test.ts`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/stores/useEditorStore.ts
git commit -m "fix: use validated snapshot parser in restoreFromLocalBackup, export filesEqual"
```

---

### Task 6: Remove duplicated `filesEqual` from `projectFileService`

**Depends on:** Task 5 (which exports `filesEqual` from `useEditorStore`)

**Files:**
- Modify: `frontend/src/services/projectFileService.ts`

**First-principles check:** Equality of file snapshots is a shared domain predicate. Keeping two copies invites inconsistent dirty-state decisions between save and rescan paths.

- [ ] **Step 1: Replace local `filesEqual` with import**

In `frontend/src/services/projectFileService.ts`, remove lines 13-19 (the local `filesEqual` function) and add the import:

```ts
import { useEditorStore, filesEqual } from '../stores/useEditorStore';
```

Remove the existing `import { useEditorStore } from '../stores/useEditorStore';` on line 10 since it's now covered.

- [ ] **Step 2: Run projectFileService tests**

Run: `cd frontend && npx vitest run src/services/projectFileService.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/projectFileService.ts
git commit -m "refactor: use shared filesEqual from useEditorStore instead of local duplicate"
```

---

### Task 7: Sort `buildFileTree` for deterministic file ordering

**Files:**
- Modify: `frontend/src/stores/useEditorStore.ts`

**First-principles check:** File tree order should be a pure function of paths, not insertion order from whichever source produced the file record. Deterministic ordering makes UI output and tests stable.

- [ ] **Step 1: Sort `Object.entries` in `buildFileTree`**

In `frontend/src/stores/useEditorStore.ts`, change line 123:

```ts
  for (const [path] of Object.entries(files)) {
```

to:

```ts
  for (const [path] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
```

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx vitest run src/stores/useEditorStore.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/useEditorStore.ts
git commit -m "fix: sort file tree entries for deterministic ordering"
```

---

### Task 8: Add `isSaving` guard to `saveToOSS`

**Files:**
- Modify: `frontend/src/stores/useEditorStore.ts`
- Modify: `frontend/src/stores/useEditorStore.test.ts`

**First-principles check:** `saveToOSS` publishes a snapshot and then marks a revision as saved. Two concurrent calls can upload different snapshots and finish in either order. A single in-flight guard prevents overlapping writes from corrupting revision bookkeeping.

- [ ] **Step 1: Add `isSaving` state field**

Add `isSaving: boolean` to the `EditorState` interface (after `hasUnsavedChanges`):

```ts
  isSaving: boolean;
```

Add initial value in the store creation (after `hasUnsavedChanges: false,`):

```ts
  isSaving: false,
```

- [ ] **Step 2: Add guard and reset the flag with `finally`**

In the `saveToOSS` method, add the guard before entering the `try` block:

```ts
    if (get().isSaving) return false;
    set({ isSaving: true });
```

Use `finally` so every return path and thrown error clears the flag. The full method should preserve the existing revision-snapshot logic:

```ts
  saveToOSS: async (topicId: string, commitMessage?: string, options?: SaveToOSSOptions): Promise<boolean> => {
    if (get().isSaving) return false;
    set({ isSaving: true });

    try {
      const files = await wcGetProjectSnapshot();
      if (!filesEqual(get().files, files)) {
        get().replaceProjectFiles(files, { markUnsaved: true });
      }
      const { fileRevision: snapshotRevision, hasUnsavedChanges, markSaved } = get();
      if (Object.keys(files).length === 0) return false;
      if (!hasUnsavedChanges && !options?.force) return true;

      backupSnapshotToLocal(topicId, files);
      set({ lastLocalBackupAt: new Date() });

      const changedFiles = Object.keys(files);
      const defaultCommitMessage = `AI修改: 修改了${changedFiles.join('、')}`;
      const finalCommitMessage = commitMessage || defaultCommitMessage;

      const tarball = createTarball(files);
      const { url } = await topicGitApi.getPresign(topicId, 'upload', finalCommitMessage);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/gzip',
          'x-ms-blob-type': 'BlockBlob',
        },
        body: new Blob([tarball], { type: 'application/gzip' }),
      });
      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

      markSaved(snapshotRevision);
      return true;
    } catch (e) {
      console.error('Save to OSS failed:', e);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },
```

- [ ] **Step 3: Add a concurrent-save regression test**

Add to `frontend/src/stores/useEditorStore.test.ts`:

```ts
it('prevents overlapping saveToOSS calls', async () => {
  let resolveFetch: ((value: { ok: boolean; status: number }) => void) | undefined;
  fetchMock.mockReturnValueOnce(new Promise((resolve) => {
    resolveFetch = resolve;
  }));

  useEditorStore.getState().replaceProjectFiles({
    'src/index.ts': 'console.log("before upload");',
  }, { markUnsaved: true });

  const firstSave = useEditorStore.getState().saveToOSS('topic-1');
  await flushPromises();

  const secondSave = await useEditorStore.getState().saveToOSS('topic-1');
  expect(secondSave).toBe(false);
  expect(getPresignMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(useEditorStore.getState().isSaving).toBe(true);

  resolveFetch?.({ ok: true, status: 200 });
  await expect(firstSave).resolves.toBe(true);
  expect(useEditorStore.getState().isSaving).toBe(false);
});
```

Update `resetEditorStore` helpers in tests to reset `isSaving: false`.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/stores/useEditorStore.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/useEditorStore.ts frontend/src/stores/useEditorStore.test.ts
git commit -m "fix: add isSaving guard to prevent concurrent saveToOSS calls"
```

---

### Task 9: Optimize `usePreviewSync` with zustand selector

**Files:**
- Modify: `frontend/src/hooks/usePreviewSync.ts`

**First-principles check:** Preview sync is derived state for one active file. Subscribing to the whole `files` object couples it to unrelated file edits and causes unnecessary render/effect work.

- [ ] **Step 1: Replace full `files` subscription with targeted selector**

Replace the entire `frontend/src/hooks/usePreviewSync.ts`:

```ts
import { useEffect } from 'react';
import { useEditorStore } from '../stores/useEditorStore';

export function usePreviewSync() {
  const activeFile = useEditorStore((s) => s.activeFile);
  const activeFileContent = useEditorStore((s) => s.activeFile ? s.files[s.activeFile] : undefined);
  const setActivePreviewContent = useEditorStore((s) => s.setActivePreviewContent);

  useEffect(() => {
    if (!activeFile) {
      setActivePreviewContent(null);
      return;
    }

    if (activeFileContent !== undefined) {
      setActivePreviewContent(activeFileContent);
    } else {
      setActivePreviewContent(null);
    }
  }, [activeFile, activeFileContent, setActivePreviewContent]);

  return null;
}
```

- [ ] **Step 2: Run existing tests**

Run: `cd frontend && npx vitest run src/hooks/usePreviewSync.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/usePreviewSync.ts
git commit -m "perf: use zustand selector in usePreviewSync to avoid re-renders on unrelated file changes"
```

---

### Task 10: Type `tools` as `ToolAction[]` in `useAgentRuntime`

**Files:**
- Modify: `frontend/src/agent/useAgentRuntime.ts`

**First-principles check:** The UI consumes `message.tools` as `ToolAction[]`. The runtime should construct that exact shape without `any`, but the type proof must remove non-function/null branches explicitly.

- [ ] **Step 1: Import `ToolAction` type**

In `frontend/src/agent/useAgentRuntime.ts`, add the import:

```ts
import type { AIChatMessage, PersistedAgentMessage, AgentMessage, ToolAction } from '@web-learn/shared';
```

- [ ] **Step 2: Type `tools` and use a real type guard**

Change the tool construction from:

```ts
        let tools: any[] = [];
```

to:

```ts
        let tools: ToolAction[] = [];
        if (hasToolCalls) {
          tools = message.tool_calls!
            .map((tc): ToolAction | null => {
              let args = {};
              if ('function' in tc) {
                try {
                  args = parseToolArguments(tc.function.arguments);
                } catch {
                  // Ignore malformed tool arguments in the transient UI payload.
                }
                return {
                  id: tc.id,
                  name: tc.function.name,
                  args,
                  state: 'running' as const,
                };
              }
              return null;
            })
            .filter((tool): tool is ToolAction => tool !== null);
        }
```

- [ ] **Step 3: Run tests and typecheck**

Run: `cd frontend && npx vitest run src/agent/useAgentRuntime.test.ts`
Expected: All tests pass (ToolAction is compatible with the objects being created).

Run: `cd frontend && npx tsc --noEmit`
Expected: TypeScript passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/agent/useAgentRuntime.ts
git commit -m "fix: type tools as ToolAction[] instead of any[] in agent runtime"
```

---

## Scope Not Included (Deferred)

These verified issues are deferred because they require larger architectural changes:

| Issue | Reason for Deferral |
|-------|-------------------|
| Agent loop abort mechanism | Requires refactoring `runAgentLoop` signature, `chatWithTools` integration, and component lifecycle coordination — separate plan needed |
| `rm` in SAFE_COMMANDS | Policy decision: restrict args or remove command — needs product input |
| `writeProjectFile`/`shouldCommit` desync | Needs audit of all `shouldCommit` callers; if none exist outside tests, consider removing the option |
| `wcResetProject` partial deletion on shouldContinue interrupt | Requires two-phase commit or transactional approach in WebContainer — significant refactor |
