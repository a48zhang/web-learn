# Website Editor Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix layout and drag-to-resize, remove CodeEditor from left panel, integrate code editing as tabs inside the Preview Panel, and add activity bar for a collapsible file tree.

**Architecture:** 
1. Fix `react-resizable-panels` integration by removing `Fragment` mappings so `PanelResizeHandle` is a direct child of `PanelGroup`.
2. Clean `WebsiteEditorPage.tsx`: remove `showEditor` logic. `file-tree` panel just shows `<FileTree />`. Add a ref to use imperative collapse/expand.
3. Enhance `PreviewPanel.tsx` to manage tabs for both PagePreview and open files (CodeEditor), sharing focus state via `useEditorStore`. Remove `#1e1e1e` `CodeEditor`'s internal tab bar. Remove `CodePreview.tsx`.
4. Add a minimal vertical left bar (Activity Bar) with a files icon that expands/collapses the left panel, defaulting to collapsed.

**Tech Stack:** React, Tailwind CSS, react-resizable-panels, Zustand

---

### Task 1: Fix drag-to-resize handles

**Files:**
- Modify: `frontend/src/components/editor/ResizablePanel.tsx`

- [ ] **Step 1: Fix Fragment wrapper**

```tsx
// Inside ResizablePanel.tsx, rewrite the EditorPanelGroup component to not use .map() returning Fragments.
export function EditorPanelGroup({ panels, direction = 'horizontal' }: EditorPanelGroupProps) {
  const children = [];
  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    if (i > 0) {
      children.push(
        <PanelResizeHandle
          key={`handle-${panel.id}`}
          className="w-1 flex items-center justify-center shrink-0 cursor-col-resize hover:bg-[#007acc] transition-colors h-full bg-[#1e1e1e] border-r border-[#2b2b2b] hover:w-2 -ml-1 z-50 relative group"
        />
      );
    }
    children.push(
      <Panel
        key={panel.id}
        id={panel.id}
        minSize={panel.minSize}
        maxSize={panel.maxSize}
        defaultSize={panel.defaultSize}
        collapsible={panel.collapsible}
        onCollapse={panel.onCollapse}
        onExpand={panel.onExpand}
        ref={panel.panelRef}
      >
        <div className="flex flex-col h-full bg-[#1e1e1e]">
          {panel.header && (
            <div className="h-[35px] bg-[#252526] flex items-center justify-between shrink-0 select-none relative z-10 w-full">
              <div className="flex h-full min-w-0 max-w-full">
                <div className="h-full px-4 flex items-center bg-[#1e1e1e] border-t border-t-[#007acc] text-[12px] text-white tracking-wide truncate whitespace-nowrap overflow-hidden">
                  {panel.header}
                </div>
                <div className="h-full w-4 bg-[#2d2d2d] border-b border-[#1e1e1e] shrink-0" />
              </div>
              <div className="h-full bg-[#2d2d2d] border-b border-[#1e1e1e] flex-1 flex justify-end tracking-wider">
                {panel.headerRight}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-hidden relative z-0">
            {panel.content}
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <PanelGroup orientation={direction} className="h-full min-h-0">
      {children}
    </PanelGroup>
  );
}
```

- [ ] **Step 2: Update PanelConfig Interface**

```tsx
import { ImperativePanelHandle } from 'react-resizable-panels';

export interface PanelConfig {
  // ... existing props
  onCollapse?: () => void;
  onExpand?: () => void;
  panelRef?: React.RefObject<ImperativePanelHandle>;
}
```

### Task 2: Simplify CodeEditor and useEditorStore

**Files:**
- Modify: `frontend/src/components/editor/CodeEditor.tsx`
- Modify: `frontend/src/stores/useEditorStore.ts`

- [ ] **Step 1: Remove tabs from CodeEditor**

Modify `CodeEditor.tsx` to just return the `Editor` component wrapper without the tab bar (the tab bar will move to PreviewPanel).

```tsx
// CodeEditor.tsx
  if (!activeFile) {
    return null; // Don't show anything if no active file
  }
  const content = files[activeFile] || '';
  return (
    <div className="h-full flex flex-col bg-zinc-900 border-t border-zinc-800">
      {/* No tab bar here anymore */}
      <div className="flex-1 min-h-0">
        <Editor ... />
      </div>
    </div>
  );
```

- [ ] **Step 2: Update useEditorStore openFile**

Modify `openFile` to automatically set preview mode to 'code'. And initial state:

```ts
// useEditorStore.ts
  openFile: (path) => {
    set((state) => {
      const updates: any = { activeFile: path, previewMode: 'code' };
      if (!state.openFiles.includes(path)) {
        updates.openFiles = [...state.openFiles, path];
      }
      return updates;
    });
  },
  
  closeFile: (path) => {
    set((state) => {
      const newOpenFiles = state.openFiles.filter((f) => f !== path);
      const newActiveFile = state.activeFile === path
        ? (newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null)
        : state.activeFile;
      
      const newMode = newActiveFile ? 'code' : 'page';
      return { openFiles: newOpenFiles, activeFile: newActiveFile, previewMode: newMode };
    });
  },
```

### Task 3: Overhaul PreviewPanel

**Files:**
- Modify: `frontend/src/components/preview/PreviewPanel.tsx`
- Delete: `frontend/src/components/preview/CodePreview.tsx`

- [ ] **Step 1: Replace PreviewPanel with Tabs layout**

```tsx
// PreviewPanel.tsx
import { PagePreview } from './PagePreview';
import CodeEditor from '../editor/CodeEditor';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePreviewSync } from '@/hooks/usePreviewSync';

export function PreviewPanel({ previewUrl, isReady, error, onRefresh, reloadKey }: PreviewPanelProps) {
  const { previewMode, setPreviewMode, openFiles, activeFile, setActiveFile, closeFile } = useEditorStore();
  usePreviewSync();

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Unified Tab bar */}
      <div className="flex items-center bg-[#252526] overflow-x-auto shrink-0 select-none">
        <div
          className={`flex items-center gap-1 px-4 py-2 text-[13px] cursor-pointer border-r border-[#1e1e1e] border-b-2 shrink-0 transition-colors ${
            previewMode === 'page'
              ? 'bg-[#1e1e1e] text-white border-b-[#007acc]'
              : 'text-zinc-400 hover:bg-[#2a2d2e] border-b-transparent'
          }`}
          onClick={() => setPreviewMode('page')}
        >
          <span>应用预览</span>
        </div>
        {openFiles.map((path) => {
          const name = path.split('/').pop() || path;
          const isActive = previewMode === 'code' && path === activeFile;
          return (
            <div
              key={path}
              className={`flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer border-r border-[#1e1e1e] border-b-2 shrink-0 transition-colors group ${
                isActive
                  ? 'bg-[#1e1e1e] text-white border-b-[#007acc]'
                  : 'text-zinc-400 hover:bg-[#2a2d2e] border-b-transparent'
              }`}
              onClick={() => {
                setActiveFile(path);
                setPreviewMode('code');
              }}
            >
              <span>{name}</span>
              <button
                className={`text-zinc-500 hover:text-white rounded w-5 h-5 flex items-center justify-center hover:bg-zinc-700 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                onClick={(e) => { e.stopPropagation(); closeFile(path); }}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden bg-[#1e1e1e]">
        {previewMode === 'page' ? (
          <PagePreview previewUrl={previewUrl} isReady={isReady} error={error} onRefresh={onRefresh} reloadKey={reloadKey} />
        ) : (
          <CodeEditor />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete CodePreview**
Run: `rm frontend/src/components/preview/CodePreview.tsx`

### Task 4: Setup UI in WebsiteEditorPage

**Files:**
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`

- [ ] **Step 1: Simplify File Tree Panel and Add Activity Bar**

Modify `WebsiteEditorPage.tsx`:

```tsx
import { useRef, useState } from 'react';
import { ImperativePanelHandle } from 'react-resizable-panels';
// Added icon for file manager
import { FileIcon } from 'lucide-react'; 

function WebsiteEditorPage() {
  // ... existing code
  const fileTreePanelRef = useRef<ImperativePanelHandle>(null);
  const [isFileTreeCollapsed, setIsFileTreeCollapsed] = useState(true);

  const toggleFileTree = () => {
    const panel = fileTreePanelRef.current;
    if (panel) {
      if (isFileTreeCollapsed) {
        panel.expand();
      } else {
        panel.collapse();
      }
    }
  };

  const handleOpenFile = useCallback((path: string) => {
    openFile(path);
    // Remove setShowEditor(true) entirely!
  }, [openFile]);

  return (
    <div className="min-h-0 h-full flex bg-[#1e1e1e]">
      {/* NEW: Left Activity Bar */}
      <div className="w-12 shrink-0 bg-[#333333] flex flex-col items-center py-2 z-10 border-r border-zinc-800">
        <button
          onClick={toggleFileTree}
          className={`p-2 rounded-md ${isFileTreeCollapsed ? 'text-zinc-500 hover:text-white' : 'text-white'}`}
          title="文件资源管理器"
        >
          <FileIcon size={24} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden">
          <EditorPanelGroup
            panels={[
              {
                id: 'file-tree',
                minSize: 15,
                maxSize: 40,
                defaultSize: 0, // Starts collapsed
                collapsible: true,
                onCollapse: () => setIsFileTreeCollapsed(true),
                onExpand: () => setIsFileTreeCollapsed(false),
                panelRef: fileTreePanelRef,
                header: (
                  <div className="flex items-center justify-between w-full">
                    <span>文件资源管理器</span>
                  </div>
                ),
                content: <FileTree onOpenFile={handleOpenFile} onDeleteFile={handleDeleteFile} />,
              },
```

- [ ] **Step 2: Clean up state variables**
Remove `showEditor` and `setShowEditor` from `WebsiteEditorPage.tsx` state and logic. Remove "返回文件树" button. Remove `handleCloseEditor` if it was used there.
