# Save Flow Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the editor save flow so explicit Save/Publish always uploads current content, reload recovery reads the newest local backup, and toast messages come from one UI layer.

**Architecture:** Keep the patch narrow. Treat `hasUnsavedChanges` as a local editor dirty indicator only, make explicit user saves force an OSS upload, and centralize local backup/snapshot parsing in small helpers so reload recovery can compare timestamps. Keep user-facing save notifications in `EditorActions`; the store should return success/failure without emitting toasts.

**Tech Stack:** React 18, Zustand, Vitest, Testing Library, TypeScript, localStorage, existing `topicGitApi` and tar utilities.

---

## File Structure

- Modify: `frontend/src/stores/useEditorStore.ts`
  - Remove toast side effects from `saveToOSS`.
  - Keep `saveToOSS(..., { force: true })` bypassing the dirty-flag early return.
  - Make local backups structured and recoverable.
  - Add exported helpers for parsing and choosing the newest local recovery source.
- Modify: `frontend/src/hooks/useAutoSave.ts`
  - Make `manualSave()` call `saveToOSS(topicId, '手动保存', { force: true })`.
- Modify: `frontend/src/components/editor/EditorActions.tsx`
  - Show save/publish toasts only here.
  - Treat `false` from `onSave()` as save failure or no files depending on call path, without duplicate store toasts.
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`
  - During load, compare local `snapshot-${id}` and `local-backup-${id}` and restore the newest non-empty local recovery source.
  - Prefer newer local recovery data over OSS-loaded data to protect edits that never reached OSS.
- Create: `frontend/src/stores/useEditorStore.test.ts`
  - Unit tests for forced upload behavior, no store toasts, and local backup parsing/selection.
- Create: `frontend/src/hooks/useAutoSave.test.ts`
  - Unit test that explicit manual save forces cloud upload even after the local dirty flag has been cleared.
- Create or modify: `frontend/src/pages/WebsiteEditorPage.test.tsx`
  - Load test proving `local-backup-${id}` can restore edits when it is newer than `snapshot-${id}` and OSS content.

---

### Task 1: Store Save Semantics

**Files:**
- Modify: `frontend/src/stores/useEditorStore.ts`
- Create: `frontend/src/stores/useEditorStore.test.ts`

- [ ] **Step 1: Write failing tests for forced upload and store toast removal**

Create `frontend/src/stores/useEditorStore.test.ts` with this content:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from './useEditorStore';
import { toast } from './useToastStore';
import { topicGitApi } from '../services/api';

const fetchMock = vi.fn();

vi.mock('../services/api', () => ({
  topicGitApi: {
    getPresign: vi.fn(),
  },
}));

vi.mock('../utils/tarUtils', () => ({
  createTarball: vi.fn(() => new Uint8Array([1, 2, 3])),
}));

vi.mock('./useToastStore', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

describe('useEditorStore save flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(topicGitApi.getPresign).mockResolvedValue({ url: 'https://upload.example.test/blob' });
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    useEditorStore.setState({
      files: { 'src/app.ts': 'console.log("hello");' },
      fileTree: [],
      openFiles: [],
      activeFile: null,
      previewUrl: null,
      isWebContainerReady: false,
      hasUnsavedChanges: false,
      lastSavedAt: null,
      lastLocalBackupAt: null,
      previewMode: 'page',
      activePreviewContent: null,
    });
  });

  it('forces an OSS upload when requested even if local autosave cleared the dirty flag', async () => {
    const ok = await useEditorStore.getState().saveToOSS('topic-1', '手动保存', { force: true });

    expect(ok).toBe(true);
    expect(topicGitApi.getPresign).toHaveBeenCalledWith('topic-1', 'upload', '手动保存');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
  });

  it('skips non-forced uploads when there are no unsaved changes', async () => {
    const ok = await useEditorStore.getState().saveToOSS('topic-1', '自动保存');

    expect(ok).toBe(true);
    expect(topicGitApi.getPresign).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not emit save toasts from the store helper', async () => {
    await useEditorStore.getState().saveToOSS('topic-1', '手动保存', { force: true });

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the failing store test**

Run:

```bash
pnpm --filter @web-learn/frontend test -- src/stores/useEditorStore.test.ts
```

Expected: at least `does not emit save toasts from the store helper` fails because `saveToOSS` currently calls `toast.success('保存成功')`.

- [ ] **Step 3: Remove store toast side effects**

In `frontend/src/stores/useEditorStore.ts`, remove this import:

```ts
import { toast } from './useToastStore';
```

Then replace the success/failure tail of `saveToOSS` with:

```ts
      markSaved();
      return true;
    } catch (e) {
      console.error('Save to OSS failed:', e);
      return false;
    }
```

- [ ] **Step 4: Run the store test again**

Run:

```bash
pnpm --filter @web-learn/frontend test -- src/stores/useEditorStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add frontend/src/stores/useEditorStore.ts frontend/src/stores/useEditorStore.test.ts
git commit -m "fix: keep editor store save side-effect free"
```

---

### Task 2: Manual Save Forces OSS Upload

**Files:**
- Modify: `frontend/src/hooks/useAutoSave.ts`
- Create: `frontend/src/hooks/useAutoSave.test.ts`

- [ ] **Step 1: Write failing test for manual save forcing upload**

Create `frontend/src/hooks/useAutoSave.test.ts` with this content:

```ts
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoSave } from './useAutoSave';

const saveToOSSMock = vi.hoisted(() => vi.fn());
const backupToLocalMock = vi.hoisted(() => vi.fn());

vi.mock('../stores/useEditorStore', () => ({
  useEditorStore: () => ({
    hasUnsavedChanges: false,
    backupToLocal: backupToLocalMock,
    saveToOSS: saveToOSSMock,
  }),
}));

vi.mock('../stores/useAgentStore', () => ({
  useAgentStore: () => [],
}));

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveToOSSMock.mockResolvedValue(true);
  });

  it('forces manual saves to upload even after local autosave cleared dirty state', async () => {
    const { result } = renderHook(() => useAutoSave('topic-1'));

    let ok = false;
    await act(async () => {
      ok = await result.current.save();
    });

    expect(ok).toBe(true);
    expect(saveToOSSMock).toHaveBeenCalledWith('topic-1', '手动保存', { force: true });
  });
});
```

- [ ] **Step 2: Run the failing hook test**

Run:

```bash
pnpm --filter @web-learn/frontend test -- src/hooks/useAutoSave.test.ts
```

Expected: FAIL because `manualSave()` currently calls `saveToOSSRef.current(topicId, '手动保存')` without `{ force: true }`.

- [ ] **Step 3: Force explicit manual saves**

In `frontend/src/hooks/useAutoSave.ts`, replace `manualSave` with:

```ts
  const manualSave = useCallback(async (): Promise<boolean> => {
    return saveToOSSRef.current(topicId, '手动保存', { force: true });
  }, [topicId]);
```

- [ ] **Step 4: Run the hook test again**

Run:

```bash
pnpm --filter @web-learn/frontend test -- src/hooks/useAutoSave.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add frontend/src/hooks/useAutoSave.ts frontend/src/hooks/useAutoSave.test.ts
git commit -m "fix: force cloud upload on manual editor save"
```

---

### Task 3: Local Recovery Reads New Backup Key

**Files:**
- Modify: `frontend/src/stores/useEditorStore.ts`
- Modify: `frontend/src/stores/useEditorStore.test.ts`
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`
- Create or modify: `frontend/src/pages/WebsiteEditorPage.test.tsx`

- [ ] **Step 1: Add recovery helper tests**

Append these tests to `frontend/src/stores/useEditorStore.test.ts`:

```ts
import {
  getLocalRecoverySnapshot,
  parseLocalRecoverySnapshot,
} from './useEditorStore';

describe('local editor recovery', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('parses legacy snapshot payloads and structured backup payloads', () => {
    expect(parseLocalRecoverySnapshot('{"src/app.ts":"legacy"}')).toEqual({
      files: { 'src/app.ts': 'legacy' },
      timestamp: 0,
    });

    expect(parseLocalRecoverySnapshot('{"files":{"src/app.ts":"backup"},"timestamp":123}')).toEqual({
      files: { 'src/app.ts': 'backup' },
      timestamp: 123,
    });
  });

  it('chooses local-backup when it is newer than snapshot', () => {
    localStorage.setItem('snapshot-topic-1', JSON.stringify({
      files: { 'src/app.ts': 'old snapshot' },
      timestamp: 100,
    }));
    localStorage.setItem('local-backup-topic-1', JSON.stringify({
      files: { 'src/app.ts': 'fresh backup' },
      timestamp: 200,
    }));

    expect(getLocalRecoverySnapshot('topic-1')).toEqual({
      files: { 'src/app.ts': 'fresh backup' },
      timestamp: 200,
      source: 'local-backup',
    });
  });
});
```

- [ ] **Step 2: Run the failing recovery helper tests**

Run:

```bash
pnpm --filter @web-learn/frontend test -- src/stores/useEditorStore.test.ts
```

Expected: FAIL because `parseLocalRecoverySnapshot` and `getLocalRecoverySnapshot` do not exist yet.

- [ ] **Step 3: Add local recovery helpers**

In `frontend/src/stores/useEditorStore.ts`, add these exports above `export const useEditorStore`:

```ts
interface LocalRecoverySnapshot {
  files: Record<string, string>;
  timestamp: number;
}

export interface LocalRecoverySnapshotWithSource extends LocalRecoverySnapshot {
  source: 'snapshot' | 'local-backup';
}

const isFilesRecord = (value: unknown): value is Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => typeof entry === 'string');
};

export function parseLocalRecoverySnapshot(raw: string | null): LocalRecoverySnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (isFilesRecord(parsed)) {
      return { files: parsed, timestamp: 0 };
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      isFilesRecord((parsed as { files?: unknown }).files)
    ) {
      return {
        files: (parsed as { files: Record<string, string> }).files,
        timestamp: typeof (parsed as { timestamp?: unknown }).timestamp === 'number'
          ? (parsed as { timestamp: number }).timestamp
          : 0,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function getLocalRecoverySnapshot(topicId: string): LocalRecoverySnapshotWithSource | null {
  const snapshot = parseLocalRecoverySnapshot(localStorage.getItem(`snapshot-${topicId}`));
  const backup = parseLocalRecoverySnapshot(localStorage.getItem(`local-backup-${topicId}`));
  const candidates: LocalRecoverySnapshotWithSource[] = [];

  if (snapshot && Object.keys(snapshot.files).length > 0) {
    candidates.push({ ...snapshot, source: 'snapshot' });
  }
  if (backup && Object.keys(backup.files).length > 0) {
    candidates.push({ ...backup, source: 'local-backup' });
  }

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.timestamp - a.timestamp)[0];
}
```

- [ ] **Step 4: Store `snapshot-${topicId}` as a structured payload**

In `frontend/src/components/editor/SaveIndicator.tsx`, replace:

```ts
        localStorage.setItem(`snapshot-${topicId}`, JSON.stringify(files));
```

with:

```ts
        localStorage.setItem(`snapshot-${topicId}`, JSON.stringify({
          files,
          timestamp: Date.now(),
        }));
```

- [ ] **Step 5: Load newest local recovery source in editor page**

In `frontend/src/pages/WebsiteEditorPage.tsx`, import the helper:

```ts
import { getLocalRecoverySnapshot, useEditorStore } from '../stores/useEditorStore';
```

Then replace the current localStorage fallback block with:

```ts
        const localRecovery = getLocalRecoverySnapshot(id);
        if (localRecovery) {
          loadSnapshot(localRecovery.files);
          loaded = true;
          console.log(`[localStorage] Loaded ${localRecovery.source} from cache`);
        } else if (!loaded) {
          console.warn('[localStorage] No cached snapshot found — editor will start with no files');
        }
```

This intentionally lets a newer local backup override OSS-loaded files. The old code could load stale OSS content and ignore the only copy of recent edits.

- [ ] **Step 6: Run recovery tests**

Run:

```bash
pnpm --filter @web-learn/frontend test -- src/stores/useEditorStore.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add frontend/src/stores/useEditorStore.ts frontend/src/stores/useEditorStore.test.ts frontend/src/components/editor/SaveIndicator.tsx frontend/src/pages/WebsiteEditorPage.tsx
git commit -m "fix: restore latest local editor recovery data"
```

---

### Task 4: User-Facing Save Toasts

**Files:**
- Modify: `frontend/src/components/editor/EditorActions.tsx`
- Test: `frontend/src/stores/useEditorStore.test.ts`

- [ ] **Step 1: Update save and publish messages**

In `frontend/src/components/editor/EditorActions.tsx`, replace `handleSave` and `handlePublish` with:

```tsx
  const handleSave = async () => {
    setSaving(true);
    try {
      const ok = await onSave();
      if (ok) {
        toast.success('保存成功');
      } else {
        toast.error('保存失败，文件未同步到云端');
      }
    } catch {
      toast.error('保存失败，文件未同步到云端');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setSaving(true);
    try {
      const ok = await onSave();
      if (!ok) {
        toast.error('保存失败，请先解决网络问题');
        return;
      }
      setShowPublishDialog(true);
    } catch {
      toast.error('保存失败，请先解决网络问题');
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm --filter @web-learn/frontend test -- src/stores/useEditorStore.test.ts src/hooks/useAutoSave.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run existing frontend regression tests**

Run:

```bash
pnpm --filter @web-learn/frontend test -- src/hooks/usePreviewSync.test.ts src/agent/useAgentRuntime.test.ts src/components/preview/PagePreview.test.tsx src/stores/useEditorStore.test.ts src/hooks/useAutoSave.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit Task 4**

Run:

```bash
git add frontend/src/components/editor/EditorActions.tsx
git commit -m "fix: centralize editor save notifications"
```

---

### Task 5: Final Verification

**Files:**
- No new source files.

- [ ] **Step 1: Run frontend test suite**

Run:

```bash
pnpm --filter @web-learn/frontend test
```

Expected: all frontend tests pass. Existing React Router future-flag warnings are acceptable if tests pass.

- [ ] **Step 2: Check worktree**

Run:

```bash
git status --short
```

Expected: clean worktree after the task commits.

- [ ] **Step 3: Optional squash decision**

If the user wants a clean branch history, squash the four fix commits into one commit named:

```bash
fix: repair editor save and recovery flow
```

Do not squash or amend without explicit user approval.

---

## Self-Review

Spec coverage:
- P1 is covered by Task 2 forcing explicit manual saves and Task 1 preserving forced uploads in the store.
- P2 is covered by Task 3 parsing both `snapshot-${id}` and `local-backup-${id}` and choosing the newest local recovery source.
- P3 is covered by Task 1 removing store toasts and Task 4 keeping notifications in `EditorActions`.

Placeholder scan:
- The plan contains no deferred implementation placeholders.
- Every code-changing task includes exact file paths, code snippets, commands, and expected results.

Type consistency:
- `SaveToOSSOptions` already supports `force?: boolean`.
- New helper names are `parseLocalRecoverySnapshot` and `getLocalRecoverySnapshot`, and later tasks use those exact names.
- `LocalRecoverySnapshotWithSource.source` values match the test expectations: `'snapshot'` and `'local-backup'`.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-20-save-flow-review-fixes.md`. Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
