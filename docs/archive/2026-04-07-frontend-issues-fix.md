# 前端代码审查修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 5 个经第一性原理验证的真实代码问题：AppShell UX Flash、actions 字段未实现、iframe 逻辑重复、面包屑模式重复、硬编码超时时间

**Architecture:** 通过重构路由嵌套顺序修复 UX Flash；在 AppShell 中实现 actions 渲染；提取 iframe 逻辑为共享 hook；将面包屑基础模式提取为常量

**Tech Stack:** React 18, TypeScript, React Router v6, TailwindCSS, Zustand

---

## 文件结构

### 新建文件
- `frontend/src/hooks/useIframeWithTimeout.ts` — 共享 iframe 加载/超时 hook

### 修改文件
- `frontend/src/App.tsx` — 调整路由嵌套顺序，ProtectedRoute 包裹 AppShell
- `frontend/src/components/layout/AppShell.tsx` — 渲染 meta.actions 按钮
- `frontend/src/pages/WebsiteEditorPage.tsx` — 使用 useIframeWithTimeout 替代内联逻辑
- `frontend/src/pages/WebsiteTopicPage.tsx` — 使用 useIframeWithTimeout 替代内联逻辑
- `frontend/src/utils/breadcrumbs.ts` — 提取 getBaseBreadcrumbs 常量函数

---

### Task 1: 提取 iframe 共享 Hook

**Files:**
- Create: `frontend/src/hooks/useIframeWithTimeout.ts`
- Test: `frontend/src/hooks/useIframeWithTimeout.test.ts`

- [ ] **Step 1: Write test file**

```typescript
// frontend/src/hooks/useIframeWithTimeout.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useIframeWithTimeout } from './useIframeWithTimeout';

describe('useIframeWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns loading=true, error=false initially', () => {
    const { result } = renderHook(() => useIframeWithTimeout());
    expect(result.current.iframeLoading).toBe(true);
    expect(result.current.iframeError).toBe(false);
  });

  it('sets error=true after timeout if not resolved', () => {
    const { result } = renderHook(() => useIframeWithTimeout(5000));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.iframeError).toBe(true);
    expect(result.current.iframeLoading).toBe(false);
  });

  it('resolves on onLoad without error', () => {
    const { result } = renderHook(() => useIframeWithTimeout());
    act(() => {
      result.current.handleLoad();
    });
    expect(result.current.iframeLoading).toBe(false);
    expect(result.current.iframeError).toBe(false);
  });

  it('sets error on onError', () => {
    const { result } = renderHook(() => useIframeWithTimeout());
    act(() => {
      result.current.handleError();
    });
    expect(result.current.iframeError).toBe(true);
    expect(result.current.iframeLoading).toBe(false);
  });

  it('reloadIframe resets state and increments key', () => {
    const { result } = renderHook(() => useIframeWithTimeout());
    act(() => {
      result.current.handleReload();
    });
    expect(result.current.iframeKey).toBe(1);
    expect(result.current.iframeLoading).toBe(true);
    expect(result.current.iframeError).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/ccnuacm/work/web-learn && pnpm -C frontend test -- useIframeWithTimeout
```

Expected: FAIL with "useIframeWithTimeout is not defined"

- [ ] **Step 3: Implement useIframeWithTimeout hook**

```typescript
// frontend/src/hooks/useIframeWithTimeout.ts
import { useEffect, useRef, useState } from 'react';

// 15 seconds — long enough for most sites to start loading within iframe
const IFRAME_TIMEOUT_MS = 15_000;

interface UseIframeWithTimeoutResult {
  iframeLoading: boolean;
  iframeError: boolean;
  iframeKey: number;
  handleLoad: () => void;
  handleError: () => void;
  handleReload: () => void;
}

export function useIframeWithTimeout(
  timeoutMs: number = IFRAME_TIMEOUT_MS,
  sourceUrl?: string,
): UseIframeWithTimeoutResult {
  const [iframeLoading, setIframeLoading] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeTimeoutRef = useRef<number | null>(null);

  // Start timeout when sourceUrl changes
  useEffect(() => {
    if (!sourceUrl) return;
    setIframeLoading(true);
    setIframeError(false);
    if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
    iframeTimeoutRef.current = window.setTimeout(() => {
      setIframeLoading(false);
      setIframeError(true);
    }, timeoutMs);
    return () => {
      if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
    };
  }, [sourceUrl, iframeKey, timeoutMs]);

  const handleLoad = () => {
    setIframeLoading(false);
    setIframeError(false);
    if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
  };

  const handleError = () => {
    setIframeLoading(false);
    setIframeError(true);
    if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
  };

  const handleReload = () => {
    setIframeLoading(true);
    setIframeError(false);
    setIframeKey((k) => k + 1);
  };

  return { iframeLoading, iframeError, iframeKey, handleLoad, handleError, handleReload };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/ccnuacm/work/web-learn && pnpm -C frontend test -- useIframeWithTimeout
```

Expected: All 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useIframeWithTimeout.ts frontend/src/hooks/useIframeWithTimeout.test.ts
git commit -m "feat: add useIframeWithTimeout hook for shared iframe loading logic

Extracts duplicated iframe timeout/error handling from WebsiteEditorPage
and WebsiteTopicPage into a reusable hook. Uses 15s timeout with proper
cleanup.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Refactor WebsiteEditorPage to use useIframeWithTimeout

**Files:**
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`

- [ ] **Step 1: Update WebsiteEditorPage to use the hook**

Replace the iframe-related state and useEffect (lines 23-48) with the hook usage.

**Before (remove lines 23-48):**
```typescript
// REMOVE:
// const [iframeLoading, setIframeLoading] = useState(false);
// const [iframeError, setIframeError] = useState(false);
// const [iframeKey, setIframeKey] = useState(0);
// const iframeTimeoutRef = useRef<number | null>(null);
//
// useEffect(() => {
//   if (!topic?.websiteUrl) return;
//   setIframeLoading(true);
//   setIframeError(false);
//   if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
//   iframeTimeoutRef.current = window.setTimeout(() => {
//     setIframeLoading(false);
//     setIframeError(true);
//   }, 15000);
//   return () => {
//     if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
//   };
// }, [topic?.websiteUrl, iframeKey]);
//
// const handleReloadIframe = () => {
//   setIframeLoading(true);
//   setIframeError(false);
//   setIframeKey((k) => k + 1);
// };
```

**After (add after line 22, before `const canEdit`):**
```typescript
const {
  iframeLoading,
  iframeError,
  iframeKey,
  handleLoad,
  handleError,
  handleReload,
} = useIframeWithTimeout(15_000, topic?.websiteUrl);

const handleReloadIframe = handleReload;
```

**Update import at top (line 1):**
```typescript
import { useIframeWithTimeout } from '../hooks/useIframeWithTimeout';
```

**Update iframe element (around lines 212-235), replace onLoad/onError:**

Change:
```tsx
onLoad={() => {
  setIframeLoading(false);
  setIframeError(false);
  if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
}}
onError={() => {
  setIframeLoading(false);
  setIframeError(true);
  if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
}}
```

To:
```tsx
onLoad={handleLoad}
onError={handleError}
```

- [ ] **Step 2: Verify build passes**

```bash
cd /home/ccnuacm/work/web-learn && pnpm -C frontend build
```

Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/WebsiteEditorPage.tsx
git commit -m "refactor: use useIframeWithTimeout hook in WebsiteEditorPage

Replaces inline iframe loading/timeout/error logic with shared hook.
Removes ~25 lines of duplicated code.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Refactor WebsiteTopicPage to use useIframeWithTimeout

**Files:**
- Modify: `frontend/src/pages/WebsiteTopicPage.tsx`

- [ ] **Step 1: Update WebsiteTopicPage to use the hook**

Same pattern as WebsiteEditorPage.

**Remove lines 17-40 (iframe state + useEffect + handleReloadIframe):**
```typescript
// REMOVE:
// const [iframeLoading, setIframeLoading] = useState(false);
// const [iframeError, setIframeError] = useState(false);
// const [iframeKey, setIframeKey] = useState(0);
// const iframeTimeoutRef = useRef<number | null>(null);
//
// useEffect(() => { ... });
//
// const handleReloadIframe = () => { ... };
```

**Add after line 16 (after `const iframeTimeoutRef` is removed, after `const [fullScreen]` line):**
```typescript
const {
  iframeLoading,
  iframeError,
  iframeKey,
  handleLoad,
  handleError,
  handleReload,
} = useIframeWithTimeout(15_000, topic?.websiteUrl);

const handleReloadIframe = handleReload;
```

**Add import:**
```typescript
import { useIframeWithTimeout } from '../hooks/useIframeWithTimeout';
```

**Update iframe element (around lines 126-135), replace onLoad/onError:**

Change:
```tsx
onLoad={() => {
  setIframeLoading(false);
  setIframeError(false);
  if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
}}
onError={() => {
  setIframeLoading(false);
  setIframeError(true);
  if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
}}
```

To:
```tsx
onLoad={handleLoad}
onError={handleError}
```

- [ ] **Step 2: Verify build passes**

```bash
cd /home/ccnuacm/work/web-learn && pnpm -C frontend build
```

Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/WebsiteTopicPage.tsx
git commit -m "refactor: use useIframeWithTimeout hook in WebsiteTopicPage

Replaces inline iframe loading/timeout/error logic with shared hook.
Both website pages now use the same iframe handling logic.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Fix AppShell > ProtectedRoute nesting order

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Swap nesting order for protected routes**

The issue: `AppShell > ProtectedRoute` causes the shell to render momentarily before auth redirects.
Fix: `ProtectedRoute > AppShell` — auth check first, then render shell.

**Modify `/dashboard` route (lines 52-61):**

Change:
```tsx
<Route
  path="/dashboard"
  element={
    <AppShell>
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    </AppShell>
  }
/>
```

To:
```tsx
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <AppShell>
        <DashboardPage />
      </AppShell>
    </ProtectedRoute>
  }
/>
```

**Modify `/topics/create` route (lines 70-79):**

Change:
```tsx
<Route
  path="/topics/create"
  element={
    <AppShell>
      <ProtectedRoute allowedRoles={['teacher']}>
        <TopicCreatePage />
      </ProtectedRoute>
    </AppShell>
  }
/>
```

To:
```tsx
<Route
  path="/topics/create"
  element={
    <ProtectedRoute allowedRoles={['teacher']}>
      <AppShell>
        <TopicCreatePage />
      </AppShell>
    </ProtectedRoute>
  }
/>
```

**Modify `/topics/:id/edit` route (lines 88-97):**

Change:
```tsx
<Route
  path="/topics/:id/edit"
  element={
    <AppShell>
      <ProtectedRoute allowedRoles={['teacher']}>
        <TopicEditorRouter />
      </ProtectedRoute>
    </AppShell>
  }
/>
```

To:
```tsx
<Route
  path="/topics/:id/edit"
  element={
    <ProtectedRoute allowedRoles={['teacher']}>
      <AppShell>
        <TopicEditorRouter />
      </AppShell>
    </ProtectedRoute>
  }
/>
```

**Note:** The 404 route (lines 106-121) should remain as-is — `AppShell` directly without `ProtectedRoute`, since 404 pages should be accessible regardless of auth state.

- [ ] **Step 2: Verify build passes**

```bash
cd /home/ccnuacm/work/web-learn && pnpm -C frontend build
```

Expected: Build succeeds

- [ ] **Step 3: Verify existing tests still pass**

```bash
cd /home/ccnuacm/work/web-learn && pnpm -C frontend test
```

Expected: All existing tests pass (tests should not depend on specific nesting order)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "fix: wrap AppShell inside ProtectedRoute to prevent auth redirect flash

ProtectedRoute now renders first, checking auth before AppShell loads.
This prevents the layout shell from flashing when unauthenticated users
access protected routes.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Implement actions rendering in AppShell

**Files:**
- Modify: `frontend/src/components/layout/AppShell.tsx`

- [ ] **Step 1: Add actions rendering to AppShell**

Update `frontend/src/components/layout/AppShell.tsx` to render `meta.actions` as quick action buttons in the top-right area.

**Replace the entire file content with:**

```tsx
import { useState } from 'react';
import { useLayoutMeta } from './LayoutMetaContext';
import TopNav from './TopNav';
import BreadcrumbBar from './BreadcrumbBar';
import LeftNav from './LeftNav';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { meta } = useLayoutMeta();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav onMenuClick={() => setDrawerOpen(true)} />
      <div className="px-4 py-2 flex items-center justify-between bg-white border-b border-gray-200">
        <BreadcrumbBar segments={meta.breadcrumbSegments} />
        {meta.actions.length > 0 && (
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {meta.actions.map((action, index) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300 rounded-md px-3 py-1.5 text-sm transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-1">
        <LeftNav isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
          {meta.sideNavSlot}
        </LeftNav>
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
```

Key changes:
- Wrapped BreadcrumbBar in a flex container with `justify-between`
- Added conditional rendering of `meta.actions` buttons on the right side
- Buttons use the same style as other secondary buttons in the app

- [ ] **Step 2: Make actions optional in LayoutMetaContext**

Update `frontend/src/components/layout/LayoutMetaContext.tsx` — make `actions` optional in the interface since pages may not need them.

Change lines 8-13:
```typescript
export interface LayoutMeta {
  pageTitle: string;
  breadcrumbSegments: BreadcrumbSegment[];
  sideNavSlot: React.ReactNode;
  actions?: Array<{ label: string; onClick: () => void }>;
}
```

Change lines 15-20 (defaultMeta):
```typescript
const defaultMeta: LayoutMeta = {
  pageTitle: '',
  breadcrumbSegments: [],
  sideNavSlot: null,
  actions: [],
};
```

No change needed here — keep empty array as default.

Update `AppShell.tsx` line where we check `meta.actions.length`:
```tsx
{(meta.actions ?? []).length > 0 && (
```

- [ ] **Step 3: Verify build passes**

```bash
cd /home/ccnuacm/work/web-learn && pnpm -C frontend build
```

Expected: Build succeeds

- [ ] **Step 4: Run tests**

```bash
cd /home/ccnuacm/work/web-learn && pnpm -C frontend test
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/AppShell.tsx frontend/src/components/layout/LayoutMetaContext.tsx
git commit -m "feat: render layout meta actions in AppShell

Implements the actions field from LayoutMetaContext design spec.
Pages can now set quick action buttons via setMeta({ actions: [...] }).
Actions render as secondary buttons in the breadcrumb bar area.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Extract base breadcrumb helper

**Files:**
- Create: `frontend/src/utils/breadcrumbs.ts`
- Modify: Pages that manually construct base breadcrumbs

- [ ] **Step 1: Create breadcrumbs utility**

```typescript
// frontend/src/utils/breadcrumbs.ts
import type { BreadcrumbSegment } from '../components/layout/LayoutMetaContext';

/**
 * Base breadcrumb segments for all pages under the /topics hierarchy.
 * Returns a new array each time to prevent accidental mutation.
 */
export function getBaseBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: '首页', to: '/dashboard' },
    { label: '专题列表', to: '/topics' },
  ];
}
```

- [ ] **Step 2: Update KnowledgeEditorPage to use the helper**

In `frontend/src/pages/KnowledgeEditorPage.tsx`, add import:
```typescript
import { getBaseBreadcrumbs } from '../utils/breadcrumbs';
```

Replace lines 249-259:
```typescript
// Before:
// useEffect(() => {
//   const segments: BreadcrumbSegment[] = [
//     { label: '首页', to: '/dashboard' },
//     { label: '专题列表', to: '/topics' },
//     ...(topic ? [{ label: topic.title, to: `/topics/${topic.id}` }] : [{ label: '编辑中...' }]),
//     { label: '编辑' },
//   ];
//   ...
// }, [topic, setMeta]);

// After:
useEffect(() => {
  const segments: BreadcrumbSegment[] = [
    ...getBaseBreadcrumbs(),
    ...(topic ? [{ label: topic.title, to: `/topics/${topic.id}` }] : [{ label: '编辑中...' }]),
    { label: '编辑' },
  ];
  setMeta({
    pageTitle: topic ? `编辑：${topic.title}` : '编辑中...',
    breadcrumbSegments: segments,
  });
}, [topic, setMeta]);
```

- [ ] **Step 3: Update WebsiteEditorPage to use the helper**

In `frontend/src/pages/WebsiteEditorPage.tsx`, add import:
```typescript
import { getBaseBreadcrumbs } from '../utils/breadcrumbs';
```

Replace the base breadcrumb construction (lines 65-75 area):
```typescript
// Before:
// const segments: BreadcrumbSegment[] = [
//   { label: '首页', to: '/dashboard' },
//   { label: '专题列表', to: '/topics' },
//   ...
// ];

// After:
const segments: BreadcrumbSegment[] = [
  ...getBaseBreadcrumbs(),
  ...(topic ? [{ label: topic.title, to: `/topics/${topic.id}` }] : [{ label: '编辑中...' }]),
  { label: '编辑' },
];
```

- [ ] **Step 4: Update WebsiteTopicPage to use the helper**

In `frontend/src/pages/WebsiteTopicPage.tsx`, add import:
```typescript
import { getBaseBreadcrumbs } from '../utils/breadcrumbs';
```

Replace lines 43-53:
```typescript
// Before:
// const segments: BreadcrumbSegment[] = [
//   { label: '首页', to: '/dashboard' },
//   { label: '专题列表', to: '/topics' },
//   { label: '网站专题' },
//   ...(topic ? [{ label: topic.title }] : [{ label: '专题详情...' }]),
// ];

// After:
const segments: BreadcrumbSegment[] = [
  ...getBaseBreadcrumbs(),
  { label: '网站专题' },
  ...(topic ? [{ label: topic.title }] : [{ label: '专题详情...' }]),
];
```

- [ ] **Step 5: Update KnowledgeTopicPage to use the helper**

In `frontend/src/pages/KnowledgeTopicPage.tsx`, add import:
```typescript
import { getBaseBreadcrumbs } from '../utils/breadcrumbs';
```

Replace lines 113-117 and lines 103-108 (both occurrences of base breadcrumbs):
```typescript
// Replace both occurrences:
// const staticSegments: BreadcrumbSegment[] = [
//   { label: '首页', to: '/dashboard' },
//   { label: '专题列表', to: '/topics' },
//   { label: '知识库专题' },
//   { label: topic.title, to: `/topics/${topic.id}` },
// ];

// With:
const staticSegments: BreadcrumbSegment[] = [
  ...getBaseBreadcrumbs(),
  { label: '知识库专题' },
  { label: topic.title, to: `/topics/${topic.id}` },
];
```

And the loading fallback (lines 103-109):
```typescript
// Replace:
setMeta({
  pageTitle: '专题详情...',
  breadcrumbSegments: [
    ...getBaseBreadcrumbs(),
    { label: '知识库专题' },
    { label: '专题详情...' },
  ],
});
```

- [ ] **Step 6: Verify build passes**

```bash
cd /home/ccnuacm/work/web-learn && pnpm -C frontend build
```

Expected: Build succeeds

- [ ] **Step 7: Run tests**

```bash
cd /home/ccnuacm/work/web-learn && pnpm -C frontend test
```

Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add frontend/src/utils/breadcrumbs.ts frontend/src/pages/KnowledgeEditorPage.tsx frontend/src/pages/WebsiteEditorPage.tsx frontend/src/pages/WebsiteTopicPage.tsx frontend/src/pages/KnowledgeTopicPage.tsx
git commit -m "refactor: extract base breadcrumbs into shared helper

Creates getBaseBreadcrumbs() utility and updates all pages to use it.
Eliminates duplication of [{label: '首页', to: '/dashboard'}, ...] pattern
across 4+ files.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd /home/ccnuacm/work/web-learn && pnpm -C frontend test
```

Expected: All tests pass

- [ ] **Step 2: Run lint**

```bash
cd /home/ccnuacm/work/web-learn && pnpm -C frontend lint
```

Expected: No errors

- [ ] **Step 3: Build**

```bash
cd /home/ccnuacm/work/web-learn && pnpm -C frontend build
```

Expected: Build succeeds

- [ ] **Step 4: Format**

```bash
cd /home/ccnuacm/work/web-learn && pnpm exec prettier --write "frontend/src/**/*.ts" "frontend/src/**/*.tsx"
```

Expected: All files formatted

- [ ] **Step 5: Review git log**

```bash
git log --oneline -10
```

Expected: 7 commits matching Task 1-6, all clean

---

## Self-Review

1. **Spec coverage:**
   - AppShell UX Flash → Task 4 ✅
   - actions 字段未实现 → Task 5 ✅
   - iframe 逻辑重复 → Tasks 1-3 ✅
   - 面包屑模式重复 → Task 6 ✅
   - 硬编码超时时间 → Task 1 (15s in hook with comment) ✅

2. **Placeholder scan:** No TBD, TODO, or incomplete sections found. All code is complete.

3. **Type consistency:**
   - `BreadcrumbSegment` type imported from `LayoutMetaContext` — consistent across all files
   - `useIframeWithTimeout` returns typed interface — consistent across both page usages
   - `getBaseBreadcrumbs()` returns `BreadcrumbSegment[]` — used consistently in all pages
