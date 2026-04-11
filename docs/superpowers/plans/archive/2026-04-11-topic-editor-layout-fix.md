# Topic Editor Layout Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the topic editor page integrate with the standard AppShell layout (TopNav, breadcrumbs, side nav) instead of covering the entire viewport with a `fixed inset-0` overlay.

**Architecture:** Remove the `fixed inset-0` wrapper from `WebsiteEditorPage` so it fills the AppShell `<main>` content area. Keep the dark IDE theme and TopBar, but make TopBar a sticky header inside the main area. Breadcrumbs and TopNav become visible above the editor.

**Tech Stack:** React + TypeScript, Tailwind CSS, react-resizable-panels

---

### File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/pages/WebsiteEditorPage.tsx` | Modify | Remove `fixed inset-0`, adjust container to fill AppShell main area |
| `frontend/src/components/editor/TopBar.tsx` | Modify | Keep as internal sticky toolbar, no structural change needed |
| `frontend/src/components/editor/ResizablePanel.tsx` | Modify | Ensure panel group fills remaining height after TopBar |

---

### Task 1: Fix WebsiteEditorPage layout wrapper

**Files:**
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`

The current wrapper is `<div className="fixed inset-0 flex flex-col bg-zinc-900">` which covers the entire viewport. Replace it with a flex column that fills the AppShell main content area.

- [ ] **Step 1: Change the wrapper className and structure**

Replace the outermost `<div>` in the return statement (line 158). Current code:

```tsx
return (
  <div className="fixed inset-0 flex flex-col bg-zinc-900">
    <TopBar onRefreshPreview={handleRefreshPreview} />
    <div className="flex-1 overflow-hidden">
      <EditorPanelGroup ... />
    </div>
  </div>
);
```

Change to:

```tsx
return (
  <div className="min-h-0 flex flex-col bg-zinc-900">
    <TopBar onRefreshPreview={handleRefreshPreview} />
    <div className="flex-1 overflow-hidden">
      <EditorPanelGroup ... />
    </div>
  </div>
);
```

**Why `min-h-0` instead of `h-[calc(...)]`:** AppShell's `<main>` has `flex-1 min-w-0` in a `flex-col` layout, so it already computes the correct remaining height. `min-h-0` allows the flex child to shrink below its content height, preventing overflow. No magic numbers needed.

- [ ] **Step 2: Verify the loading and error states also use proper layout**

The loading state (`<LoadingOverlay>`) and error states (lines 137-155) currently render outside the `fixed` wrapper, so they appear in the AppShell main area — this is correct and needs no change.

- [ ] **Step 3: Build and verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

---

### Task 2: Ensure TopBar works as sticky internal toolbar

**Files:**
- Modify: `frontend/src/components/editor/TopBar.tsx`

The TopBar is already a simple horizontal bar with `h-10`. It works fine as an internal toolbar. Add `sticky top-0 z-10` classes so it stays visible when scrolling.

- [ ] **Step 1: Add sticky positioning to TopBar**

Current TopBar wrapper (line 51):

```tsx
<div className="h-10 bg-zinc-900 border-b border-zinc-700 flex items-center justify-between px-3 text-sm">
```

Change to:

```tsx
<div className="h-10 bg-zinc-900 border-b border-zinc-700 flex items-center justify-between px-3 text-sm sticky top-0 z-10">
```

This ensures the TopBar stays at the top of the editor content area when the user scrolls.

- [ ] **Step 2: Verify touch target sizes for buttons**

Current buttons use `px-2 py-1` or `px-3 py-1` with `text-xs`. On desktop this is fine. Add a minimum height class to ensure touch-friendly sizing:

Change all TopBar buttons from:
```tsx
className="... px-2 py-1 rounded ..."
```
to:
```tsx
className="... px-2 py-1.5 rounded min-h-[2.5rem] ..."
```

This ensures buttons meet the 44px minimum touch target guideline on mobile/tablet.

---

### Task 3: Ensure EditorPanelGroup fills available height correctly

**Files:**
- Modify: `frontend/src/components/editor/ResizablePanel.tsx`

The `EditorPanelGroup` already has `className="h-full"` on the `PanelGroup`, and each panel has `flex flex-col h-full` — this is correct. No structural changes needed, but verify the outer container sizing works.

- [ ] **Step 1: Verify no height changes needed**

The `EditorPanelGroup` component receives its height from its parent (`flex-1 overflow-hidden` in WebsiteEditorPage). The `h-full` class on `PanelGroup` correctly fills this. No code changes needed.

- [ ] **Step 2: Run build to verify everything compiles**

Run: `cd frontend && pnpm build`
Expected: Build succeeds with no errors

---

### Task 4: Manual verification

- [ ] **Step 1: Start the dev server**

Run: `cd frontend && pnpm dev`

- [ ] **Step 2: Navigate to the topic editor page**

1. Log in to the app
2. Navigate to `/topics/:id/edit` for an existing topic
3. Verify:
   - TopNav is visible at the top with WebLearn branding
   - Breadcrumbs show: 首页 > [topic title] > 编辑
   - Hamburger menu opens LeftNav
   - Editor TopBar is sticky below the breadcrumbs
   - Editor panels (FileTree, AI Chat, Preview) fill the remaining area
   - Save/Refresh buttons in TopBar work correctly

- [ ] **Step 3: Test responsive behavior**

Resize the browser window to narrow widths (768px, 375px). Verify:
- Editor panels collapse/expand correctly
- Content remains usable
- No horizontal scroll

---
