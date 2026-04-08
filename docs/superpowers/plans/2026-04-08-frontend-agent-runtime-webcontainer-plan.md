# Frontend Agent Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move agent runtime from backend to frontend — backend becomes a generic LLM proxy + chat history persistence, frontend implements full tool-calling loop with WebContainer-based file tools.

**Architecture:** Frontend owns agent runtime, tool registry, and tool execution in WebContainer. Backend only proxies OpenAI-compatible requests and persists user-visible messages. WebContainer FS is the single source of truth for file state.

**Tech Stack:** TypeScript, React, Zustand, OpenAI SDK, WebContainer API, Express, Sequelize (MySQL)

---

### Task 1: Add shared types for agent runtime and tools

**Files:**
- Modify: `shared/src/types/index.ts`
- Create: `shared/src/agent/types.ts`

- [ ] **Step 1: Create agent types in `shared/src/agent/types.ts`**

```typescript
// Agent tool definitions shared between frontend and model protocol
export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// Result returned by a tool execution
export interface AgentToolResult {
  content: string;
  isError?: boolean;
}

// Visible message persisted to backend
export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Agent runtime state (frontend only, not sent to backend)
export interface AgentRunState {
  isRunning: boolean;
  currentToolName?: string | null;
  currentToolPath?: string | null;
  error: string | null;
}
```

- [ ] **Step 2: Export new types from `shared/src/types/index.ts`**

Add at end of file:

```typescript
export type { AgentToolDefinition, AgentToolResult, AgentMessage, AgentRunState } from './agent/types';
```

- [ ] **Step 3: Commit**

```bash
git add shared/src/agent/types.ts shared/src/types/index.ts
git commit -m "feat: add shared types for agent runtime and tools"
```

---

### Task 2: Create frontend LLM proxy API

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/services/llmApi.ts`

- [ ] **Step 1: Replace `sendChatMessage` with a generic `chatWithTools` in `frontend/src/services/llmApi.ts`**

Replace entire file:

```typescript
import OpenAI from 'openai';
import type { AIChatMessage } from '@web-learn/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getAuthToken = () => localStorage.getItem('auth_token');

const createLlmClient = (token: string) =>
  new OpenAI({
    apiKey: token,
    baseURL: `${API_BASE_URL}/llm`,
    dangerouslyAllowBrowser: true,
  });

export async function chatWithTools(
  messages: AIChatMessage[],
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[],
  onStream?: (chunk: string) => void
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const token = getAuthToken();
  if (!token?.trim()) {
    throw new Error('Missing auth token');
  }
  const llmClient = createLlmClient(token);

  const response = await llmClient.chat.completions.create({
    model: import.meta.env.VITE_LLM_MODEL || 'gpt-4o',
    messages: messages as any,
    tools,
    tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
    stream: !!onStream,
  });

  return response as OpenAI.Chat.Completions.ChatCompletion;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/llmApi.ts
git commit -m "feat: replace legacy llmApi with generic chatWithTools supporting OpenAI tool-calling"
```

---

### Task 3: Create WebContainer adapter for tools

**Files:**
- Create: `frontend/src/agent/webcontainer.ts`

- [ ] **Step 1: Create WebContainer adapter module**

```typescript
import { WebContainer } from '@webcontainer/api';

let wcInstance: WebContainer | null = null;

export async function getWebContainer(): Promise<WebContainer> {
  if (!wcInstance) {
    throw new Error('WebContainer is not initialized');
  }
  return wcInstance;
}

export function setWebContainerInstance(wc: WebContainer): void {
  wcInstance = wc;
}

export async function wcReadFile(path: string): Promise<string> {
  const wc = await getWebContainer();
  try {
    const content = await wc.fs.readFile(path, 'utf-8');
    return content;
  } catch {
    throw new Error(`File not found: ${path}`);
  }
}

export async function wcWriteFile(path: string, content: string): Promise<void> {
  const wc = await getWebContainer();
  const dir = path.substring(0, path.lastIndexOf('/'));
  if (dir) {
    await wc.fs.mkdir(dir, { recursive: true });
  }
  await wc.fs.writeFile(path, content);
}

export async function wcCreateFile(path: string, content = ''): Promise<void> {
  const wc = await getWebContainer();
  const dir = path.substring(0, path.lastIndexOf('/'));
  if (dir) {
    await wc.fs.mkdir(dir, { recursive: true });
  }
  await wc.fs.writeFile(path, content);
}

export async function wcDeleteFile(path: string): Promise<void> {
  const wc = await getWebContainer();
  await wc.fs.rm(path, { recursive: true, force: true });
}

export async function wcMoveFile(oldPath: string, newPath: string): Promise<void> {
  const wc = await getWebContainer();
  const dir = newPath.substring(0, newPath.lastIndexOf('/'));
  if (dir) {
    await wc.fs.mkdir(dir, { recursive: true });
  }
  await wc.fs.rename(oldPath, newPath);
}

export async function wcListFiles(rootPath = '.'): Promise<string[]> {
  const wc = await getWebContainer();
  const files: string[] = [];

  async function walk(dir: string) {
    const entries = await wc.fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = dir === '.' ? entry.name : `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') {
          await walk(fullPath);
        }
      } else {
        files.push(fullPath);
      }
    }
  }

  await walk(rootPath);
  return files;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/agent/webcontainer.ts
git commit -m "feat: add WebContainer adapter for file system tools"
```

---

### Task 4: Create frontend tool registry and tool implementations

**Files:**
- Create: `frontend/src/agent/toolRegistry.ts`
- Create: `frontend/src/agent/tools/listFiles.ts`
- Create: `frontend/src/agent/tools/readFile.ts`
- Create: `frontend/src/agent/tools/writeFile.ts`
- Create: `frontend/src/agent/tools/createFile.ts`
- Create: `frontend/src/agent/tools/deleteFile.ts`
- Create: `frontend/src/agent/tools/moveFile.ts`

- [ ] **Step 1: Create tool registry in `frontend/src/agent/toolRegistry.ts`**

```typescript
import type { AgentToolDefinition, AgentToolResult } from '@web-learn/shared';

export type ToolExecuteFn = (args: Record<string, unknown>) => Promise<AgentToolResult>;

export interface RegisteredTool {
  definition: AgentToolDefinition;
  execute: ToolExecuteFn;
}

const tools = new Map<string, RegisteredTool>();

export function registerTool(name: string, definition: AgentToolDefinition, execute: ToolExecuteFn): void {
  tools.set(name, { definition, execute });
}

export function getToolDefinitions(): AgentToolDefinition[] {
  return Array.from(tools.values()).map((t) => t.definition);
}

export function getOpenAITools(): any[] {
  return Array.from(tools.values()).map((t) => ({
    type: 'function',
    function: {
      name: t.definition.name,
      description: t.definition.description,
      parameters: t.definition.parameters,
    },
  }));
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<AgentToolResult> {
  const tool = tools.get(name);
  if (!tool) {
    return { content: `Unknown tool: ${name}`, isError: true };
  }
  try {
    return await tool.execute(args);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tool execution failed';
    return { content: message, isError: true };
  }
}
```

- [ ] **Step 2: Create `frontend/src/agent/tools/listFiles.ts`**

```typescript
import { registerTool } from '../toolRegistry';
import { wcListFiles } from '../webcontainer';

registerTool('list_files', {
  name: 'list_files',
  description: 'List all files in the project. Returns an array of file paths.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
}, async (_args) => {
  const files = await wcListFiles();
  return { content: JSON.stringify(files) };
});
```

- [ ] **Step 3: Create `frontend/src/agent/tools/readFile.ts`**

```typescript
import { registerTool } from '../toolRegistry';
import { wcReadFile } from '../webcontainer';

registerTool('read_file', {
  name: 'read_file',
  description: 'Read the contents of a file at the given path. Returns the file content as a string.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to read' },
    },
    required: ['path'],
  },
}, async (args) => {
  const path = args.path as string;
  if (!path || typeof path !== 'string') {
    return { content: 'path is required and must be a string', isError: true };
  }
  const content = await wcReadFile(path);
  return { content };
});
```

- [ ] **Step 4: Create `frontend/src/agent/tools/writeFile.ts`**

```typescript
import { registerTool } from '../toolRegistry';
import { wcWriteFile } from '../webcontainer';

registerTool('write_file', {
  name: 'write_file',
  description: 'Overwrite the contents of an existing file. Creates parent directories if needed.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to write' },
      content: { type: 'string', description: 'New content for the file' },
    },
    required: ['path', 'content'],
  },
}, async (args) => {
  const path = args.path as string;
  const content = args.content as string;
  if (!path || typeof path !== 'string') {
    return { content: 'path is required and must be a string', isError: true };
  }
  if (typeof content !== 'string') {
    return { content: 'content is required and must be a string', isError: true };
  }
  await wcWriteFile(path, content);
  return { content: `Successfully wrote ${content.length} bytes to ${path}` };
});
```

- [ ] **Step 5: Create `frontend/src/agent/tools/createFile.ts`**

```typescript
import { registerTool } from '../toolRegistry';
import { wcCreateFile } from '../webcontainer';

registerTool('create_file', {
  name: 'create_file',
  description: 'Create a new file with optional content. Creates parent directories if needed.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the new file' },
      content: { type: 'string', description: 'Initial file content (optional)', default: '' },
    },
    required: ['path'],
  },
}, async (args) => {
  const path = args.path as string;
  const content = (args.content as string) || '';
  if (!path || typeof path !== 'string') {
    return { content: 'path is required and must be a string', isError: true };
  }
  await wcCreateFile(path, content);
  return { content: `Successfully created file ${path}` };
});
```

- [ ] **Step 6: Create `frontend/src/agent/tools/deleteFile.ts`**

```typescript
import { registerTool } from '../toolRegistry';
import { wcDeleteFile } from '../webcontainer';

registerTool('delete_file', {
  name: 'delete_file',
  description: 'Delete a file or directory at the given path.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file or directory to delete' },
    },
    required: ['path'],
  },
}, async (args) => {
  const path = args.path as string;
  if (!path || typeof path !== 'string') {
    return { content: 'path is required and must be a string', isError: true };
  }
  await wcDeleteFile(path);
  return { content: `Successfully deleted ${path}` };
});
```

- [ ] **Step 7: Create `frontend/src/agent/tools/moveFile.ts`**

```typescript
import { registerTool } from '../toolRegistry';
import { wcMoveFile } from '../webcontainer';

registerTool('move_file', {
  name: 'move_file',
  description: 'Move or rename a file. Creates parent directories of the destination if needed.',
  parameters: {
    type: 'object',
    properties: {
      oldPath: { type: 'string', description: 'Current path of the file' },
      newPath: { type: 'string', description: 'New path for the file' },
    },
    required: ['oldPath', 'newPath'],
  },
}, async (args) => {
  const oldPath = args.oldPath as string;
  const newPath = args.newPath as string;
  if (!oldPath || typeof oldPath !== 'string' || !newPath || typeof newPath !== 'string') {
    return { content: 'oldPath and newPath are required and must be strings', isError: true };
  }
  await wcMoveFile(oldPath, newPath);
  return { content: `Successfully moved ${oldPath} to ${newPath}` };
});
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/agent/toolRegistry.ts frontend/src/agent/tools/listFiles.ts frontend/src/agent/tools/readFile.ts frontend/src/agent/tools/writeFile.ts frontend/src/agent/tools/createFile.ts frontend/src/agent/tools/deleteFile.ts frontend/src/agent/tools/moveFile.ts
git commit -m "feat: add frontend tool registry and WebContainer file tools"
```

---

### Task 5: Create `useAgentRuntime` hook

**Files:**
- Create: `frontend/src/agent/useAgentRuntime.ts`
- Create: `frontend/src/agent/useAgentSession.ts`
- Create: `frontend/src/stores/useAgentStore.ts`

- [ ] **Step 1: Create Zustand store for agent session state in `frontend/src/stores/useAgentStore.ts`**

```typescript
import { create } from 'zustand';
import type { AgentMessage, AgentRunState } from '@web-learn/shared';

interface AgentStoreState {
  visibleMessages: AgentMessage[];
  runState: AgentRunState;
  addVisibleMessage: (message: AgentMessage) => void;
  setRunState: (state: Partial<AgentRunState>) => void;
  clearRunState: () => void;
  setVisibleMessages: (messages: AgentMessage[]) => void;
}

const initialRunState: AgentRunState = {
  isRunning: false,
  currentToolName: null,
  currentToolPath: null,
  error: null,
};

export const useAgentStore = create<AgentStoreState>((set) => ({
  visibleMessages: [],
  runState: initialRunState,

  addVisibleMessage: (message) =>
    set((state) => ({ visibleMessages: [...state.visibleMessages, message] })),

  setRunState: (partial) =>
    set((state) => ({ runState: { ...state.runState, ...partial } })),

  clearRunState: () => set({ runState: { ...initialRunState } }),

  setVisibleMessages: (messages) => set({ visibleMessages: messages }),
}));
```

- [ ] **Step 2: Create `useAgentRuntime` hook in `frontend/src/agent/useAgentRuntime.ts`**

```typescript
import { chatWithTools } from '../services/llmApi';
import { getOpenAITools, executeTool } from './toolRegistry';
import { useAgentStore } from '../stores/useAgentStore';
import type { AgentMessage, AIChatMessage } from '@web-learn/shared';
import OpenAI from 'openai';

const MAX_TOOL_LOOPS = 8;

export function useAgentRuntime() {
  const visibleMessages = useAgentStore((s) => s.visibleMessages);
  const addVisibleMessage = useAgentStore((s) => s.addVisibleMessage);
  const setRunState = useAgentStore((s) => s.setRunState);
  const clearRunState = useAgentStore((s) => s.clearRunState);

  async function runAgentLoop(userMessage: string): Promise<void> {
    // Build internal messages for this run
    const internalMessages: AIChatMessage[] = visibleMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    internalMessages.push({ role: 'user', content: userMessage });

    const openAITools = getOpenAITools();

    setRunState({ isRunning: true, error: null });

    try {
      for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
        setRunState({ isRunning: true });

        const completion = await chatWithTools(internalMessages, openAITools);
        const choice = completion.choices[0];
        const message = choice.message;

        // Push to internal messages for the loop
        internalMessages.push(message as AIChatMessage);

        // If no tool calls, we have the final answer
        if (!message.tool_calls || message.tool_calls.length === 0) {
          const assistantContent = message.content || '';
          addVisibleMessage({ role: 'assistant', content: assistantContent });
          break;
        }

        // Execute each tool call
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;

          // Try to extract file path for UI display
          let toolPath: string | null = null;
          try {
            const args = JSON.parse(toolCall.function.arguments || '{}');
            toolPath = args.path ?? args.oldPath ?? args.newPath ?? null;
          } catch {
            // ignore
          }

          setRunState({ currentToolName: toolName, currentToolPath: toolPath });

          const result = await executeTool(toolName, JSON.parse(toolCall.function.arguments || '{}'));

          internalMessages.push({
            role: 'tool',
            content: result.content,
            tool_call_id: toolCall.id,
          } as AIChatMessage);
        }
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'LLM request failed';
      setRunState({ error: errorMsg });
    } finally {
      clearRunState();
    }
  }

  return { runAgentLoop, visibleMessages };
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/useAgentStore.ts frontend/src/agent/useAgentRuntime.ts
git commit -m "feat: add agent runtime hook with tool-calling loop"
```

---

### Task 6: Update `useWebContainer` to register itself with the agent system

**Files:**
- Modify: `frontend/src/hooks/useWebContainer.ts`

- [ ] **Step 1: Add `setWebContainerInstance` call to `useWebContainer`**

In `frontend/src/hooks/useWebContainer.ts`, add import at top:

```typescript
import { setWebContainerInstance } from '../agent/webcontainer';
```

In the `init` function, after `webcontainerInstance` is created, register it:

```typescript
if (!webcontainerInstance) {
  webcontainerInstance = await WebContainer.boot();
  setWebContainerInstance(webcontainerInstance);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useWebContainer.ts
git commit -m "feat: register WebContainer instance with agent system on boot"
```

---

### Task 7: Update `AIChatSidebar` to use the new agent runtime

**Files:**
- Modify: `frontend/src/components/AIChatSidebar.tsx`

- [ ] **Step 1: Rewrite `AIChatSidebar.tsx` to use `useAgentRuntime`**

Replace entire file:

```typescript
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgentRuntime } from '../agent/useAgentRuntime';
import { useAgentStore } from '../stores/useAgentStore';
import { topicApi, topicFileApi } from '../services/api';
import type { AgentMessage } from '@web-learn/shared';

interface AIChatSidebarProps {
  topicId: string;
}

function AIChatSidebar({ topicId }: AIChatSidebarProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { runAgentLoop, visibleMessages } = useAgentRuntime();
  const runState = useAgentStore((s) => s.runState);
  const setVisibleMessages = useAgentStore((s) => s.setVisibleMessages);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load chat history on mount
  useEffect(() => {
    const fetchTopic = async () => {
      try {
        const data = await topicApi.getById(topicId);
        if (data.chatHistory && Array.isArray(data.chatHistory)) {
          const visible = data.chatHistory
            .filter((m: any) => m.role === 'user' || m.role === 'assistant')
            .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
          setVisibleMessages(visible);
        }
      } catch {
        // Silently fail — start with empty chat
      }
    };
    fetchTopic();
  }, [topicId, setVisibleMessages]);

  // Debounced save function — only visible messages
  const debouncedSave = (msgs: AgentMessage[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await topicFileApi.saveChatHistory(topicId, msgs);
      } catch {
        // Silently fail — will retry on next message
      }
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Save on visible message changes
  useEffect(() => {
    if (visibleMessages.length > 0) {
      debouncedSave(visibleMessages);
    }
  }, [visibleMessages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || runState.isRunning) return;

    setInput('');
    await runAgentLoop(content);
  };

  const handleClearChat = async () => {
    setVisibleMessages([]);
    try {
      await topicFileApi.saveChatHistory(topicId, []);
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full px-4 py-3 shadow-lg"
      >
        {open ? '关闭助手' : 'AI 助手'}
      </button>
      {open && (
        <aside className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">AI 助手</h3>
            <div className="flex items-center gap-2">
              {visibleMessages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="text-xs text-gray-500 hover:text-red-500"
                >
                  清空对话
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                关闭
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {visibleMessages.length === 0 && (
              <p className="text-sm text-gray-500">
                让助手读取或修改项目文件。
              </p>
            )}
            {visibleMessages.map((message, idx) => (
              <div
                key={`${message.role}-${idx}`}
                className={`rounded-lg p-3 text-sm ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white ml-8'
                    : 'bg-white border border-gray-200 mr-8'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none">
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
              <div className="rounded-lg p-3 text-sm bg-blue-50 border border-blue-200 mr-8 text-blue-700">
                {runState.currentToolPath
                  ? `正在${getToolActionText(runState.currentToolName)}：${runState.currentToolPath}`
                  : `正在调用工具：${runState.currentToolName}`}
              </div>
            )}
            {runState.isRunning && !runState.currentToolName && (
              <p className="text-xs text-gray-500">助手思考中...</p>
            )}
            {runState.error && (
              <div className="rounded-lg p-3 text-sm bg-red-50 border border-red-200 mr-8 text-red-700">
                工具执行失败：{runState.error}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-200 space-y-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
        </aside>
      )}
    </>
  );
}

function getToolActionText(toolName: string): string {
  const map: Record<string, string> = {
    read_file: '读取文件',
    write_file: '写入文件',
    create_file: '创建文件',
    delete_file: '删除文件',
    move_file: '移动文件',
    list_files: '列出文件',
  };
  return map[toolName] || '执行工具';
}

export default AIChatSidebar;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AIChatSidebar.tsx
git commit -m "feat: rewrite AI chat sidebar to use frontend agent runtime"
```

---

### Task 8: Update `WebsiteEditorPage` to use editor-based permission check and sync WebContainer with store

**Files:**
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`

- [ ] **Step 1: Update `canEdit` check and add WebContainer sync to store**

In `frontend/src/pages/WebsiteEditorPage.tsx`, replace line 43:

```typescript
// OLD:
// const canEdit = user?.role === 'teacher' && topic?.createdBy === user.id;
// NEW:
const canEdit = topic?.editors?.includes(user?.id?.toString() ?? '') || user?.role === 'admin';
```

Add a `refreshEditorStore` function and use it after WebContainer init. Add this after the `handleApplyFiles` callback:

```typescript
// Refresh editor store from WebContainer after WC state changes
const refreshEditorStore = useCallback(async () => {
  const { useEditorStore } = await import('../stores/useEditorStore');
  const { wcListFiles, wcReadFile } = await import('../agent/webcontainer');
  const files = await wcListFiles();
  const fileContents: Record<string, string> = {};
  for (const path of files) {
    try {
      fileContents[path] = await wcReadFile(path);
    } catch {
      // skip binary or unreadable files
    }
  }
  useEditorStore.getState().loadSnapshot(fileContents);
}, []);
```

In the `initWC` effect, add `refreshEditorStore` after WC init:

```typescript
  useEffect(() => {
    if (!topic || !id) return;
    const currentFiles = getAllFiles();
    initWC(Object.keys(currentFiles).length > 0 ? currentFiles : undefined).then(() => {
      refreshEditorStore();
    });
  }, [topic, id, initWC, getAllFiles, refreshEditorStore]);
```

- [ ] **Step 2: Update `handleApplyFiles` to use new WebContainer + store sync**

Replace the existing `handleApplyFiles`:

```typescript
  const handleApplyFiles = useCallback(async (operations: AgentFileOperation[]) => {
    const { useEditorStore } = await import('../stores/useEditorStore');
    for (const op of operations) {
      if (op.action === 'create' || op.action === 'update') {
        if (op.content !== undefined) {
          const { wcWriteFile, wcCreateFile } = await import('../agent/webcontainer');
          if (op.action === 'create') {
            await wcCreateFile(op.path, op.content);
          } else {
            await wcWriteFile(op.path, op.content);
          }
          useEditorStore.getState().setFileContent(op.path, op.content);
        }
      } else if (op.action === 'delete') {
        const { wcDeleteFile } = await import('../agent/webcontainer');
        await wcDeleteFile(op.path);
        useEditorStore.getState().deleteFile(op.path);
      }
    }
    toast.success(`已应用 ${operations.length} 个文件更改`);
  }, []);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/WebsiteEditorPage.tsx
git commit -m "feat: update editor page for new permission model and WebContainer-store sync"
```

---

### Task 9: Refactor backend AI service — remove tool loop and topic-specific logic

**Files:**
- Modify: `services/ai/src/controllers/aiController.ts`
- Modify: `services/ai/src/routes/aiRoutes.ts`
- Modify: `services/ai/src/services/aiService.ts`
- Modify: `services/ai/src/app.ts`

- [ ] **Step 1: Rewrite `aiController.ts` as a generic LLM proxy**

Replace entire file:

```typescript
import { Request, Response } from 'express';
import { AuthenticatedRequest as AuthRequest } from '@web-learn/shared';
import { chatWithLLM } from '../services/aiService';

const ALLOWED_MESSAGE_ROLES = new Set(['system', 'user', 'assistant', 'tool']);
const MAX_MESSAGES = 100;
const MAX_MESSAGE_CONTENT_LENGTH = 10000;

const validateMessages = (messages: unknown): string | null => {
  if (!Array.isArray(messages)) {
    return 'messages must be an array';
  }
  if (messages.length === 0 || messages.length > MAX_MESSAGES) {
    return `messages length must be between 1 and ${MAX_MESSAGES}`;
  }
  for (const message of messages) {
    if (!message || typeof message !== 'object') {
      return 'each message must be an object';
    }
    const role = (message as { role?: unknown }).role;
    const content = (message as { content?: unknown }).content;
    if (typeof role !== 'string' || !ALLOWED_MESSAGE_ROLES.has(role)) {
      return 'message role is invalid';
    }
    if (typeof content !== 'string' || !content.trim()) {
      return 'message content must be a non-empty string';
    }
    if (content.length > MAX_MESSAGE_CONTENT_LENGTH) {
      return `message content too long, max ${MAX_MESSAGE_CONTENT_LENGTH}`;
    }
  }
  return null;
};

export const chat = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const { messages, tools, tool_choice, stream, model } = req.body as {
      messages: any[];
      tools?: any[];
      tool_choice?: string;
      stream?: boolean;
      model?: string;
    };

    const messagesError = validateMessages(messages);
    if (messagesError) {
      return res.status(400).json({ success: false, error: messagesError });
    }

    const completion = await chatWithLLM(messages, tools, tool_choice, model);
    return res.json(completion);
  } catch (error: any) {
    console.error('LLM proxy error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
};
```

- [ ] **Step 2: Rewrite `aiService.ts` as a thin LLM proxy**

Replace entire file:

```typescript
import OpenAI from 'openai';
import { config } from '../utils/config';

const client = config.ai.apiKey
  ? new OpenAI({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseUrl || undefined,
    })
  : null;

export const chatWithLLM = async (
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[],
  toolChoice?: string,
  model?: string
): Promise<OpenAI.Chat.Completions.ChatCompletion> => {
  if (!client || !config.ai.apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
    model: model || config.ai.model,
    messages,
    stream: false,
  };

  if (tools && tools.length > 0) {
    params.tools = tools;
    if (toolChoice) {
      params.tool_choice = toolChoice as any;
    }
  }

  return await client.chat.completions.create(params);
};
```

- [ ] **Step 3: Update `aiRoutes.ts` — keep same route shape**

The route stays as-is (`POST /chat`), since it still proxies requests. No changes needed to the route file itself.

- [ ] **Step 4: Commit**

```bash
git add services/ai/src/controllers/aiController.ts services/ai/src/services/aiService.ts
git commit -m "refactor: simplify AI service to generic LLM proxy, remove tool loop and topic-specific logic"
```

---

### Task 10: Update TopBar to use useAgentStore for chat history persistence

**Files:**
- Modify: `frontend/src/components/editor/TopBar.tsx`
- Delete: `frontend/src/components/editor/AgentChat.tsx`
- Delete: `frontend/src/stores/useChatStore.ts`
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`

- [ ] **Step 1: Update `TopBar.tsx` — replace useChatStore with useAgentStore**

Replace entire file:

```typescript
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { topicFileApi } from '../../services/api';
import { useEditorStore } from '../../stores/useEditorStore';
import { useAgentStore } from '../../stores/useAgentStore';
import { toast } from '../../stores/useToastStore';
import SaveIndicator from './SaveIndicator';

interface TopBarProps {
  onRefreshPreview: () => void;
  onPublish?: () => void;
  onShare?: () => void;
}

export default function TopBar({ onRefreshPreview, onPublish, onShare }: TopBarProps) {
  const { id } = useParams<{ id: string }>();
  const { getAllFiles, markSaved } = useEditorStore();
  const visibleMessages = useAgentStore((s) => s.visibleMessages);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const files = getAllFiles();
      await topicFileApi.saveSnapshot(id, files);
      markSaved();
      await topicFileApi.saveChatHistory(id, visibleMessages as any[]);
      toast.success('保存成功');
    } catch {
      toast.error('保存失败，请检查网络连接');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-10 bg-zinc-900 border-b border-zinc-700 flex items-center justify-between px-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-zinc-400 font-medium">网站编辑器</span>
      </div>
      <div className="flex items-center gap-2">
        <SaveIndicator topicId={id ?? ''} />
        <button
          type="button"
          onClick={onRefreshPreview}
          className="text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-zinc-700 text-xs"
          title="刷新预览"
        >
          刷新预览
        </button>
        {onPublish && (
          <button
            type="button"
            onClick={onPublish}
            className="text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-zinc-700 text-xs"
            title="发布到网站"
          >
            发布到网站
          </button>
        )}
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-zinc-700 text-xs"
            title="分享链接"
          >
            分享链接
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete legacy files**

```bash
rm frontend/src/components/editor/AgentChat.tsx
rm frontend/src/stores/useChatStore.ts
```

- [ ] **Step 3: Remove AgentChat and useChatStore from WebsiteEditorPage**

Remove these imports and usages:
```typescript
// Remove: import AgentChat from '../components/editor/AgentChat';
// Remove: import { useChatStore } from '../../stores/useChatStore';
// Remove: const { setMessages } = useChatStore();
// Remove: setMessages(topicData.chatHistory) from useEffect
// Remove: setMessages from useEffect dependency array
```

Replace the AgentChat panel (line ~178):
```typescript
// OLD:
{
  id: 'agent-chat',
  minSize: 20,
  defaultSize: 25,
  collapsible: true,
  header: 'Agent 对话',
  content: <AgentChat onApplyFiles={handleApplyFiles} />,
},
// NEW:
{
  id: 'agent-chat',
  minSize: 20,
  defaultSize: 25,
  collapsible: true,
  header: 'Agent 对话',
  content: <AIChatSidebar topicId={id} />,
},
```

Add import:
```typescript
import AIChatSidebar from '../components/AIChatSidebar';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/editor/TopBar.tsx frontend/src/components/editor/AgentChat.tsx frontend/src/stores/useChatStore.ts frontend/src/pages/WebsiteEditorPage.tsx
git commit -m "refactor: replace useChatStore with useAgentStore, remove legacy AgentChat"
```

---

### Task 11: Remove dead code — old backend agent tools

**Files:**
- Delete: `services/ai/src/services/agentTools.ts`

- [ ] **Step 1: Delete `services/ai/src/services/agentTools.ts`**

This file is no longer imported after the backend refactor in the prior task:

```bash
rm services/ai/src/services/agentTools.ts
```

- [ ] **Step 2: Commit**

```bash
git add services/ai/src/services/agentTools.ts
git commit -m "chore: remove dead backend agent tools file"
```

---

### Task 12: Update frontend API layer — remove old `aiApi` usage

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Remove `aiApi` export from `api.ts`**

Remove lines 175-181:

```typescript
// Remove:
// export const aiApi = {
//   chat: async (data: AIChatRequestDto): Promise<AIChatResponseDto> => {
//     const response = await api.post<AIChatResponseDto>('/ai/chat', data);
//     return response.data;
//   },
// };
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "refactor: remove legacy aiApi from frontend api service"
```

---

### Task 13: Update shared types — remove old AI types

**Files:**
- Modify: `shared/src/types/index.ts`

- [ ] **Step 1: Remove unused `AIChatRequestDto`, `AIChatResponseDto`, `AIChatAgentType` if still present and no longer used**

Search for references to `AIChatRequestDto`, `AIChatResponseDto`, `AIChatAgentType` in frontend code. If none remain, remove:

```typescript
// Remove these interfaces/types if no longer imported anywhere:
// export interface AIChatRequestDto
// export interface AIChatResponseDto
// export type AIChatAgentType
```

Also remove their imports from `frontend/src/services/api.ts` and any remaining references.

- [ ] **Step 2: Commit**

```bash
git add shared/src/types/index.ts frontend/src/services/api.ts
git commit -m "refactor: remove unused legacy AI chat types"
```

---

### Task 14: Import all frontend tools on app startup

**Files:**
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Import all tool files at app startup to trigger `registerTool` calls**

Find the app entry point:

```bash
ls frontend/src/main.tsx frontend/src/main.ts 2>/dev/null
```

Add tool imports at the top of the entry file (after React imports):

```typescript
// Import all agent tools to trigger registration
import './agent/tools/listFiles';
import './agent/tools/readFile';
import './agent/tools/writeFile';
import './agent/tools/createFile';
import './agent/tools/deleteFile';
import './agent/tools/moveFile';
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/main.tsx
git commit -m "chore: import agent tools at app startup to trigger registration"
```
