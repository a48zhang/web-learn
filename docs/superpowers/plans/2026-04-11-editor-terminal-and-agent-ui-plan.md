# Topic Editor Layout Fix, Terminal & Agent UI Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix editor layout to integrate with AppShell, fix Agent panel empty box, add VSCode-style bottom terminal, and add `run_command` agent tool.

**Architecture:** (1) Remove `fixed inset-0` wrapper from WebsiteEditorPage so it fills AppShell main area with sticky TopBar. (2) Extract Agent chat into layout-agnostic component. (3) Add xterm.js terminal as fixed-bottom overlay. (4) Add run_command tool via WebContainer spawn.

**Tech Stack:** xterm, xterm-addon-fit, xterm-addon-web-links, React, Tailwind CSS, WebContainer API, react-resizable-panels

---

### Task 1: Fix WebsiteEditorPage layout — integrate with AppShell

**Files:**
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx:158`
- Modify: `frontend/src/components/editor/TopBar.tsx:51`

**Rationale:** The current wrapper `<div className="fixed inset-0 ...">` covers the entire viewport, hiding the AppShell's TopNav, breadcrumbs, and side nav. Replace with `min-h-0` flex column so it fills the AppShell `<main>` content area. Make TopBar sticky so it stays visible when scrolling.

- [ ] **Step 1: Fix wrapper layout**

In `frontend/src/pages/WebsiteEditorPage.tsx`, the return statement (line 158) currently is:

```tsx
return (
  <div className="fixed inset-0 flex flex-col bg-zinc-900">
    <TopBar onRefreshPreview={handleRefreshPreview} />

    <div className="flex-1 overflow-hidden">
      <EditorPanelGroup
        panels={[
          {
            id: 'file-tree',
            minSize: 15,
            defaultSize: 20,
            collapsible: true,
            header: (
              <div className="flex items-center justify-between w-full">
                <span>{showEditor ? '代码编辑器' : '文件树'}</span>
                {showEditor && (
                  <button
                    onClick={handleCloseEditor}
                    className="text-zinc-400 hover:text-white text-xs"
                  >
                    返回文件树
                  </button>
                )}
              </div>
            ),
            content: showEditor ? <CodeEditor /> : <FileTree onOpenFile={handleOpenFile} onDeleteFile={handleDeleteFile} />,
          },
          {
            id: 'agent-chat',
            minSize: 20,
            defaultSize: 25,
            collapsible: true,
            header: 'Agent 对话',
            content: <AIChatSidebar topicId={id ?? ''} />,
          },
          {
            id: 'preview',
            minSize: 30,
            defaultSize: 55,
            collapsible: false,
            header: '应用预览',
            content: (
              <PreviewPanel
                previewUrl={previewUrl}
                isReady={isReady}
                error={wcError}
                onRefresh={handleRefreshPreview}
                externalReloadKey={previewReloadKey}
              />
            ),
          },
        ]}
      />
    </div>
  </div>
);
```

Change the outermost div from `fixed inset-0` to `min-h-0`:

```tsx
return (
  <div className="min-h-0 flex flex-col bg-zinc-900">
    <TopBar onRefreshPreview={handleRefreshPreview} />

    <div className="flex-1 overflow-hidden">
      <EditorPanelGroup
        panels={[
          {
            id: 'file-tree',
            minSize: 15,
            defaultSize: 20,
            collapsible: true,
            header: (
              <div className="flex items-center justify-between w-full">
                <span>{showEditor ? '代码编辑器' : '文件树'}</span>
                {showEditor && (
                  <button
                    onClick={handleCloseEditor}
                    className="text-zinc-400 hover:text-white text-xs"
                  >
                    返回文件树
                  </button>
                )}
              </div>
            ),
            content: showEditor ? <CodeEditor /> : <FileTree onOpenFile={handleOpenFile} onDeleteFile={handleDeleteFile} />,
          },
          {
            id: 'agent-chat',
            minSize: 20,
            defaultSize: 25,
            collapsible: true,
            header: 'Agent 对话',
            content: <AIChatSidebar topicId={id ?? ''} />,
          },
          {
            id: 'preview',
            minSize: 30,
            defaultSize: 55,
            collapsible: false,
            header: '应用预览',
            content: (
              <PreviewPanel
                previewUrl={previewUrl}
                isReady={isReady}
                error={wcError}
                onRefresh={handleRefreshPreview}
                externalReloadKey={previewReloadKey}
              />
            ),
          },
        ]}
      />
    </div>
  </div>
);
```

**Why `min-h-0`:** AppShell's `<main>` has `flex-1 min-w-0` in a `flex-col` layout, so it already computes the correct remaining height. `min-h-0` allows the flex child to shrink below its content height, preventing overflow. No magic numbers needed.

- [ ] **Step 2: Add sticky positioning to TopBar**

In `frontend/src/components/editor/TopBar.tsx`, line 51, change:

```tsx
<div className="h-10 bg-zinc-900 border-b border-zinc-700 flex items-center justify-between px-3 text-sm">
```

To:

```tsx
<div className="h-10 bg-zinc-900 border-b border-zinc-700 flex items-center justify-between px-3 text-sm sticky top-0 z-10">
```

- [ ] **Step 3: Build and verify no TypeScript errors**

Run:
```bash
cd /home/ccnuacm/work/web-learn/frontend && pnpm tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd /home/ccnuacm/work/web-learn && git add frontend/src/pages/WebsiteEditorPage.tsx frontend/src/components/editor/TopBar.tsx
git commit -m "fix(frontend): integrate editor layout with AppShell, make TopBar sticky"
```

---

### Task 2: Install xterm dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install xterm packages**

Run:
```bash
cd /home/ccnuacm/work/web-learn/frontend && pnpm add xterm xterm-addon-fit xterm-addon-web-links
```

- [ ] **Step 2: Verify installation**

Run:
```bash
cd /home/ccnuacm/work/web-learn/frontend && grep xterm package.json
```

Expected output contains:
```
"xterm": "^5.3.0",
"xterm-addon-fit": "^0.8.0",
"xterm-addon-web-links": "^0.9.0",
```

- [ ] **Step 3: Commit**

```bash
cd /home/ccnuacm/work/web-learn && git add frontend/package.json frontend/pnpm-lock.yaml
git commit -m "chore(frontend): add xterm.js dependencies for terminal panel"
```

---

### Task 3: Extract AgentChatContent, fix empty Agent panel

**Files:**
- Create: `frontend/src/components/AgentChatContent.tsx`
- Modify: `frontend/src/components/AIChatSidebar.tsx`
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`

**Rationale:** `AIChatSidebar` uses `fixed` positioning and renders as a floating overlay. When embedded in `EditorPanelGroup`, the panel body is empty. Extract the chat UI into a layout-agnostic `AgentChatContent` component for the panel, while keeping `AIChatSidebar` as a floating overlay for non-editor pages.

- [ ] **Step 1: Create AgentChatContent component**

Create `frontend/src/components/AgentChatContent.tsx`:

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgentRuntime } from '../agent/useAgentRuntime';
import { useAgentStore } from '../stores/useAgentStore';
import type { AgentMessage } from '@web-learn/shared';

interface AgentChatContentProps {
  topicId: string;
  title?: string;
}

export default function AgentChatContent({ topicId, title = 'AI 助手' }: AgentChatContentProps) {
  const [input, setInput] = useState('');
  const { runAgentLoop, visibleMessages } = useAgentRuntime();
  const runState = useAgentStore((s) => s.runState);
  const setVisibleMessages = useAgentStore((s) => s.setVisibleMessages);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load chat history on mount
  useEffect(() => {
    const raw = localStorage.getItem(`chat-history-${topicId}`);
    if (raw) {
      try {
        const msgs: AgentMessage[] = JSON.parse(raw);
        if (Array.isArray(msgs)) {
          setVisibleMessages(msgs);
        }
      } catch {
        // corrupted — start fresh
      }
    }
  }, [topicId, setVisibleMessages]);

  // Debounced save to localStorage
  const debouncedSave = useCallback(
    (msgs: AgentMessage[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(`chat-history-${topicId}`, JSON.stringify(msgs));
        } catch {
          // Silently fail
        }
      }, 2000);
    },
    [topicId]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (visibleMessages.length > 0) {
      debouncedSave(visibleMessages);
    }
  }, [visibleMessages, debouncedSave]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || runState.isRunning) return;
    setInput('');
    await runAgentLoop(content);
  };

  const handleClearChat = () => {
    setVisibleMessages([]);
    try {
      localStorage.setItem(`chat-history-${topicId}`, JSON.stringify([]));
    } catch {
      // Silently fail
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getToolActionText = (toolName: string): string => {
    const map: Record<string, string> = {
      read_file: '读取文件',
      write_file: '写入文件',
      create_file: '创建文件',
      delete_file: '删除文件',
      move_file: '移动文件',
      list_files: '列出文件',
    };
    return map[toolName] || '执行工具';
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-700 flex items-center justify-between shrink-0">
        <h3 className="text-xs font-medium text-zinc-300">{title}</h3>
        {visibleMessages.length > 0 && (
          <button
            type="button"
            onClick={handleClearChat}
            className="text-xs text-zinc-500 hover:text-red-400"
          >
            清空对话
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {visibleMessages.length === 0 && (
          <p className="text-xs text-zinc-500">让助手读取或修改项目文件。</p>
        )}
        {visibleMessages.map((message, idx) => (
          <div
            key={`${message.role}-${idx}`}
            className={`rounded-lg p-3 text-sm ${
              message.role === 'user'
                ? 'bg-blue-600 text-white ml-8'
                : 'bg-zinc-800 border border-zinc-700 mr-8'
            }`}
          >
            {message.role === 'assistant' ? (
              <div className="prose prose-sm max-w-none prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content || ''}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{message.content}</p>
            )}
          </div>
        ))}

        {/* Tool activity indicator */}
        {runState.isRunning && runState.currentToolName && (
          <div className="rounded-lg p-3 text-sm bg-blue-900/30 border border-blue-800 mr-8 text-blue-300">
            {runState.currentToolPath
              ? `正在${getToolActionText(runState.currentToolName)}：${runState.currentToolPath}`
              : `正在调用工具：${runState.currentToolName}`}
          </div>
        )}
        {runState.isRunning && !runState.currentToolName && (
          <p className="text-xs text-zinc-500">助手思考中...</p>
        )}
        {runState.error && (
          <div className="rounded-lg p-3 text-sm bg-red-900/30 border border-red-800 mr-8 text-red-300">
            工具执行失败：{runState.error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-700 space-y-2 shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full border border-zinc-600 rounded-md px-3 py-2 text-sm bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
          placeholder="描述你想要的更改..."
          disabled={runState.isRunning}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={runState.isRunning || !input.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-md py-2 text-sm disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Refactor AIChatSidebar to delegate to AgentChatContent**

Replace the entire content of `frontend/src/components/AIChatSidebar.tsx`:

```tsx
import { useState } from 'react';
import AgentChatContent from './AgentChatContent';

interface AIChatSidebarProps {
  topicId: string;
  title?: string;
}

function AIChatSidebar({ topicId, title = 'AI 助手' }: AIChatSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full px-4 py-3 shadow-lg"
      >
        {open ? '关闭助手' : title}
      </button>
      {open && (
        <aside className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-zinc-900 border-l border-zinc-700 shadow-2xl z-50 flex flex-col">
          <AgentChatContent topicId={topicId} title={title} />
        </aside>
      )}
    </>
  );
}

export default AIChatSidebar;
```

- [ ] **Step 3: Update WebsiteEditorPage to use AgentChatContent**

In `frontend/src/pages/WebsiteEditorPage.tsx`:

1. Add import:
```tsx
import AgentChatContent from '../components/AgentChatContent';
```

2. Replace the agent-chat panel content from:
```tsx
content: <AIChatSidebar topicId={id ?? ''} />,
```
To:
```tsx
content: <AgentChatContent topicId={id ?? ''} />,
```

- [ ] **Step 4: Run lint**

Run:
```bash
cd /home/ccnuacm/work/web-learn/frontend && pnpm lint 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
cd /home/ccnuacm/work/web-learn && git add frontend/src/components/AgentChatContent.tsx frontend/src/components/AIChatSidebar.tsx frontend/src/pages/WebsiteEditorPage.tsx
git commit -m "feat(frontend): extract AgentChatContent to fix empty Agent panel in editor"
```

---

### Task 4: Create useTerminal hook

**Files:**
- Create: `frontend/src/hooks/useTerminal.ts`
- Modify: `frontend/src/hooks/useWebContainer.ts`

**Rationale:** Encapsulate Terminal lifecycle (xterm init, WebContainer spawn, resize, cleanup) in a reusable hook. First expose the WebContainer instance from `useWebContainer`, then build the hook on top.

- [ ] **Step 1: Expose WebContainer instance from useWebContainer**

In `frontend/src/hooks/useWebContainer.ts`, change the return statement from:
```typescript
  return {
    isReady,
    previewUrl,
    error,
    init,
    writeFile,
    deleteFile: deleteFileWC,
    syncFile,
  };
```

To:
```typescript
  return {
    isReady,
    previewUrl,
    error,
    init,
    writeFile,
    deleteFile: deleteFileWC,
    syncFile,
    getInstance: () => webcontainerInstance,
  };
```

- [ ] **Step 2: Create useTerminal hook**

Create `frontend/src/hooks/useTerminal.ts`:

```tsx
import { useRef, useState, useCallback, useEffect } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { useWebContainer } from './useWebContainer';

import 'xterm/css/xterm.css';

interface UseTerminalOptions {
  visible: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useTerminal({ visible, containerRef }: UseTerminalOptions) {
  const { isReady, getInstance } = useWebContainer();

  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const processRef = useRef<{ kill: () => void; exit: Promise<unknown> } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isInitializing = useRef(false);

  const open = useCallback(() => {
    if (!isReady || !containerRef.current) return;
    if (isInitializing.current) return;
    isInitializing.current = true;

    const container = containerRef.current;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#18181b',
        foreground: '#d4d4d8',
        cursor: '#d4d4d8',
        selectionBackground: '#3b3b4f',
        black: '#18181b',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#d4d4d8',
        brightBlack: '#3f3f46',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#fafafa',
      },
    });
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(container);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const wc = getInstance();
    if (wc) {
      wc.spawn('bash').then(async (process) => {
        processRef.current = process;

        process.output.pipeTo(
          new WritableStream({
            write: (data) => terminal.write(data),
          })
        );

        terminal.onData((data) => {
          process.input.write(data);
        });
      }).catch((err) => {
        terminal.writeln(`\x1b[31mFailed to start shell: ${err.message}\x1b[0m\r\n`);
      });
    } else {
      terminal.writeln('\x1b[33mWebContainer not available.\x1b[0m\r\n');
    }

    setIsOpen(true);
    isInitializing.current = false;
  }, [isReady, containerRef, getInstance]);

  const close = useCallback(() => {
    if (processRef.current) {
      processRef.current.kill();
      processRef.current = null;
    }
    if (terminalRef.current) {
      terminalRef.current.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    }
    setIsOpen(false);
  }, []);

  const resize = useCallback(() => {
    if (fitAddonRef.current && terminalRef.current) {
      fitAddonRef.current.fit();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (terminalRef.current) {
        terminalRef.current.dispose();
      }
    };
  }, []);

  return { open, close, resize, isOpen, isReady };
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/ccnuacm/work/web-learn && git add frontend/src/hooks/useTerminal.ts frontend/src/hooks/useWebContainer.ts
git commit -m "feat(frontend): add useTerminal hook with WebContainer shell integration"
```

---

### Task 5: Create TerminalPanel, TerminalToggle, and store

**Files:**
- Create: `frontend/src/components/TerminalPanel.tsx`
- Create: `frontend/src/components/TerminalToggle.tsx`
- Create: `frontend/src/stores/useTerminalStore.ts`
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`

- [ ] **Step 1: Create terminal store**

Create `frontend/src/stores/useTerminalStore.ts`:

```tsx
import { create } from 'zustand';

interface TerminalState {
  isOpen: boolean;
  height: number;
  setOpen: (open: boolean) => void;
  setHeight: (height: number) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  isOpen: false,
  height: 250,
  setOpen: (open) => set({ isOpen: open }),
  setHeight: (height) => set({ height }),
}));
```

- [ ] **Step 2: Create TerminalToggle**

Create `frontend/src/components/TerminalToggle.tsx`:

```tsx
import { useTerminalStore } from '../stores/useTerminalStore';

export default function TerminalToggle() {
  const { isOpen, setOpen } = useTerminalStore();

  return (
    <button
      type="button"
      onClick={() => setOpen(!isOpen)}
      className={`fixed bottom-1 right-4 z-30 flex items-center gap-2 px-3 py-1 text-xs rounded-t border-t border-l border-r ${
        isOpen
          ? 'bg-zinc-800 border-zinc-600 text-blue-400'
          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-400' : 'bg-zinc-600'}`} />
      >_ Terminal
    </button>
  );
}
```

- [ ] **Step 3: Create TerminalPanel**

Create `frontend/src/components/TerminalPanel.tsx`:

```tsx
import { useRef, useEffect, useCallback } from 'react';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useTerminal } from '../hooks/useTerminal';

export default function TerminalPanel() {
  const { isOpen, setOpen, height, setHeight } = useTerminalStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const { open: openTerminal, close, resize } = useTerminal({
    visible: isOpen,
    containerRef,
  });

  useEffect(() => {
    if (isOpen) {
      openTerminal();
    } else {
      close();
    }
  }, [isOpen, openTerminal, close]);

  useEffect(() => {
    if (isOpen) {
      resize();
    }
  }, [isOpen, height, resize]);

  // Drag resize logic
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragStartY.current = e.clientY;
    dragStartHeight.current = height;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = dragStartY.current - moveEvent.clientY;
      const newHeight = Math.max(150, Math.min(window.innerHeight * 0.5, dragStartHeight.current + delta));
      setHeight(newHeight);
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [height, setHeight]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-20 bg-zinc-900 border-t border-zinc-700"
      style={{ height: `${height}px` }}
    >
      {/* Resize handle / header */}
      <div
        className="flex items-center justify-between px-3 py-1 bg-zinc-800 border-b border-zinc-700 cursor-row-resize select-none"
        onMouseDown={handleMouseDown}
      >
        <span className="text-zinc-400 text-xs font-medium">>_ Terminal</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-zinc-500 hover:text-zinc-300 text-xs"
        >
          ✕
        </button>
      </div>
      {/* Terminal container */}
      <div ref={containerRef} className="w-full h-[calc(100%-28px)]" />
    </div>
  );
}
```

- [ ] **Step 4: Integrate into WebsiteEditorPage**

In `frontend/src/pages/WebsiteEditorPage.tsx`:

1. Add imports:
```tsx
import TerminalPanel from '../components/TerminalPanel';
import TerminalToggle from '../components/TerminalToggle';
```

2. Add components before the closing `</div>` of the return statement. The full return becomes:

```tsx
  return (
    <div className="min-h-0 flex flex-col bg-zinc-900">
      <TopBar onRefreshPreview={handleRefreshPreview} />

      <div className="flex-1 overflow-hidden">
        <EditorPanelGroup
          panels={[
            {
              id: 'file-tree',
              minSize: 15,
              defaultSize: 20,
              collapsible: true,
              header: (
                <div className="flex items-center justify-between w-full">
                  <span>{showEditor ? '代码编辑器' : '文件树'}</span>
                  {showEditor && (
                    <button
                      onClick={handleCloseEditor}
                      className="text-zinc-400 hover:text-white text-xs"
                    >
                      返回文件树
                    </button>
                  )}
                </div>
              ),
              content: showEditor ? <CodeEditor /> : <FileTree onOpenFile={handleOpenFile} onDeleteFile={handleDeleteFile} />,
            },
            {
              id: 'agent-chat',
              minSize: 20,
              defaultSize: 25,
              collapsible: true,
              header: 'Agent 对话',
              content: <AgentChatContent topicId={id ?? ''} />,
            },
            {
              id: 'preview',
              minSize: 30,
              defaultSize: 55,
              collapsible: false,
              header: '应用预览',
              content: (
                <PreviewPanel
                  previewUrl={previewUrl}
                  isReady={isReady}
                  error={wcError}
                  onRefresh={handleRefreshPreview}
                  externalReloadKey={previewReloadKey}
                />
              ),
            },
          ]}
        />
      </div>

      <TerminalToggle />
      <TerminalPanel />
    </div>
  );
```

- [ ] **Step 5: Run dev server to visually verify**

Run:
```bash
cd /home/ccnuacm/work/web-learn/frontend && pnpm dev
```

Expected: App compiles. Terminal toggle visible at bottom-right. Clicking opens terminal panel with interactive shell.

- [ ] **Step 6: Commit**

```bash
cd /home/ccnuacm/work/web-learn && git add frontend/src/stores/useTerminalStore.ts frontend/src/components/TerminalToggle.tsx frontend/src/components/TerminalPanel.tsx frontend/src/pages/WebsiteEditorPage.tsx
git commit -m "feat(frontend): add TerminalPanel and TerminalToggle components"
```

---

### Task 6: Create run_command agent tool

**Files:**
- Create: `frontend/src/agent/tools/runCommand.ts`
- Modify: `frontend/src/agent/webcontainer.ts`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/agent/useAgentRuntime.ts`

**Rationale:** Add command execution capability for Agent. WebContainer `spawn` runs commands, captures output. Output is also visible in Terminal panel if open.

- [ ] **Step 1: Add spawn utility to webcontainer.ts**

Append to `frontend/src/agent/webcontainer.ts`:

```typescript
export interface SpawnResult {
  output: string;
  exitCode: number | null;
}

export const SAFE_COMMANDS = new Set([
  'npm', 'npx', 'node', 'ls', 'cat', 'mkdir', 'rm', 'echo', 'cp', 'mv',
]);

export async function wcSpawnCommand(
  command: string,
  args: string[] = [],
  options?: { timeout?: number; onOutput?: (data: string) => void }
): Promise<SpawnResult> {
  const wc = await getWebContainer();

  const output: string[] = [];
  const timeout = options?.timeout ?? 30000;

  if (!SAFE_COMMANDS.has(command)) {
    throw new Error(`Command "${command}" is not in the allowed command list`);
  }

  const process = await wc.spawn(command, args);

  process.output.pipeTo(
    new WritableStream({
      write: (data) => {
        output.push(data);
        if (options?.onOutput) {
          options.onOutput(data);
        }
      },
    })
  );

  const exitPromise = process.exit;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    setTimeout(() => {
      process.kill();
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);
  });

  await Promise.race([exitPromise, timeoutPromise]);

  return {
    output: output.join(''),
    exitCode: 0,
  };
}
```

- [ ] **Step 2: Create runCommand tool**

Create `frontend/src/agent/tools/runCommand.ts`:

```typescript
import { registerTool } from '../toolRegistry';
import { wcSpawnCommand } from '../webcontainer';

registerTool('run_command', {
  name: 'run_command',
  description: 'Execute a shell command in the project. Only safe commands are allowed (npm, npx, node, ls, cat, mkdir, rm, echo, cp, mv).',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The command to execute, e.g. "npm install lodash"' },
    },
    required: ['command'],
  },
}, async (args) => {
  const commandStr = args.command as string;
  if (!commandStr || typeof commandStr !== 'string') {
    return { content: 'command is required and must be a string', isError: true };
  }

  const parts = commandStr.trim().split(/\s+/);
  const cmd = parts[0];
  const cmdArgs = parts.slice(1);

  try {
    const result = await wcSpawnCommand(cmd, cmdArgs);
    const text = result.output || '(no output)';
    return { content: text };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Command execution failed';
    return { content: message, isError: true };
  }
});
```

- [ ] **Step 3: Register the tool in main.tsx**

Add to `frontend/src/main.tsx` alongside existing tool imports:

```typescript
import './agent/tools/runCommand';
```

- [ ] **Step 4: Update Agent system prompt**

In `frontend/src/agent/useAgentRuntime.ts`, in `SYSTEM_PROMPT`, add `run_command` to the tool list. Change:

```
- move_file: 移动或重命名文件
```

To:

```
- move_file: 移动或重命名文件
- run_command: 执行终端命令（npm, npx, node, ls, cat, mkdir, rm, echo 等）
```

- [ ] **Step 5: Commit**

```bash
cd /home/ccnuacm/work/web-learn && git add frontend/src/agent/tools/runCommand.ts frontend/src/agent/webcontainer.ts frontend/src/main.tsx frontend/src/agent/useAgentRuntime.ts
git commit -m "feat(frontend): add run_command agent tool with WebContainer spawn"
```

---

### Task 7: End-to-end verification

- [ ] **Step 1: Build and lint**

Run:
```bash
cd /home/ccnuacm/work/web-learn/frontend && pnpm tsc --noEmit && pnpm lint
```

Expected: No errors.

- [ ] **Step 2: Run tests**

Run:
```bash
cd /home/ccnuacm/work/web-learn/frontend && pnpm test
```

- [ ] **Step 3: Visual verification checklist**

Open dev server and verify:
- [ ] TopNav and breadcrumbs visible above editor (not covered by fixed overlay)
- [ ] Agent panel shows chat UI with messages and input (not empty box)
- [ ] Terminal toggle button at bottom-right
- [ ] Clicking toggle opens terminal with interactive shell
- [ ] Drag-resizing terminal header adjusts height
- [ ] AIChatSidebar floating button still works on non-editor pages
- [ ] Agent can call run_command tool and see output

- [ ] **Step 4: Final commit if any issues found**

```bash
cd /home/ccnuacm/work/web-learn && git add -A && git commit -m "fix(frontend): address issues from end-to-end verification"
```

---

## File Change Summary

| File | Action | Purpose |
|------|--------|---------|
| `frontend/package.json` | Modify (Task 2) | Add xterm dependencies |
| `frontend/src/pages/WebsiteEditorPage.tsx` | Modify (Tasks 1, 3, 5) | Layout fix + AgentChatContent + Terminal integration |
| `frontend/src/components/editor/TopBar.tsx` | Modify (Task 1) | Sticky positioning |
| `frontend/src/components/AgentChatContent.tsx` | **Create** (Task 3) | Pure chat UI, no fixed positioning |
| `frontend/src/components/AIChatSidebar.tsx` | Modify (Task 3) | Delegate to AgentChatContent |
| `frontend/src/components/TerminalPanel.tsx` | **Create** (Task 5) | VSCode-style bottom terminal |
| `frontend/src/components/TerminalToggle.tsx` | **Create** (Task 5) | Bottom-right toggle button |
| `frontend/src/stores/useTerminalStore.ts` | **Create** (Task 5) | Terminal visibility/height state |
| `frontend/src/hooks/useTerminal.ts` | **Create** (Task 4) | xterm lifecycle + WebContainer shell |
| `frontend/src/hooks/useWebContainer.ts` | Modify (Task 4) | Expose `getInstance()` |
| `frontend/src/agent/tools/runCommand.ts` | **Create** (Task 6) | run_command tool |
| `frontend/src/agent/webcontainer.ts` | Modify (Task 6) | Add `wcSpawnCommand` utility |
| `frontend/src/main.tsx` | Modify (Task 6) | Register runCommand tool |
| `frontend/src/agent/useAgentRuntime.ts` | Modify (Task 6) | Update SYSTEM_PROMPT |
