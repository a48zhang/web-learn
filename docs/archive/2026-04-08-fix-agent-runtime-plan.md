# Fix Agent Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 critical issues on `copilot/implement-frontend-agent-runtime-plan` — undo role unification regressions, wire up the new agent runtime, and resolve route/type mismatches so the branch is safe to merge.

**Architecture:** The branch has two classes of bugs: (1) it regressed the role unification changes already on main, and (2) the agent runtime was not wired in — AIChatSidebar uses local state, AgentChat was not deleted, and the LLM route mismatches. Fix by selectively reverting backend role-related files to main state, rewriting AIChatSidebar to use the agent runtime, and aligning routes/types.

**Tech Stack:** TypeScript, React, Zustand, OpenAI SDK, Express, Sequelize

---

### Task 1: Restore role unification in shared types

The branch undid the role unification (`'user'` → `'teacher' | 'student'`) and removed the `editors` field from Topic. Restore both.

**Files:**
- Modify: `shared/src/types/index.ts`

- [ ] **Step 1: Restore `editors` field in Topic interface and fix role types**

Replace the entire `shared/src/types/index.ts` file. This file needs TWO things done simultaneously: (a) keep role types as `'user'` (the role unification that was on main), and (b) add `editors` back to the Topic interface.

```typescript
// User types
export type UserRoleType = 'admin' | 'user';
// Admin accounts are reserved and should be provisioned manually, not via public registration.

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRoleType;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  role: 'user';
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Topic types
export type TopicStatusType = 'draft' | 'published' | 'closed';
export type TopicType = 'website';

export interface Topic {
  id: string;
  title: string;
  description?: string;
  type: TopicType;
  websiteUrl?: string | null;
  createdBy: string;
  status: TopicStatusType;
  filesSnapshot?: Record<string, string> | null;
  chatHistory?: AIChatMessage[] | null;
  publishedUrl?: string | null;
  shareLink?: string | null;
  editors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTopicDto {
  title: string;
  description?: string;
  type?: TopicType;
}

export interface UpdateTopicDto {
  title?: string;
  description?: string;
  type?: TopicType;
}

export interface UpdateTopicStatusDto {
  status: TopicStatusType;
}

export interface DeleteTopicResponse {
  id: string;
}

// Topic page types
export interface TopicPage {
  id: string;
  topicId: string;
  title: string;
  content: string;
  parentPageId?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface TopicPageTreeNode extends TopicPage {
  children: TopicPageTreeNode[];
}

export interface CreateTopicPageDto {
  title: string;
  content?: string;
  parent_page_id?: string | null;
}

export interface UpdateTopicPageDto {
  title?: string;
  content?: string;
  parent_page_id?: string | null;
}

export interface ReorderTopicPagesDto {
  pages: Array<{
    id: string;
    order: number;
    parent_page_id?: string | null;
  }>;
}

// AI chat types
export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

// Website topic types
export interface WebsiteStats {
  fileCount: number;
  totalSize: number;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export const UserRole = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export const TopicStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CLOSED: 'closed',
} as const;

export const TopicTypeMap = {
  WEBSITE: 'website',
} as const;

// Editor types
export interface EditorFile {
  path: string;
  content: string;
  isDirty: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export interface FileOperation {
  action: 'create' | 'update' | 'delete';
  path: string;
  content?: string;
}

export interface AgentFileOperation {
  path: string;
  action: 'create' | 'update' | 'delete';
  content?: string;
}

export interface AgentResponse {
  message: string;
  files: AgentFileOperation[];
}

export interface EditorState {
  files: Record<string, string>; // path -> content
  openFiles: string[]; // list of open file paths
  activeFile: string | null;
  isWebContainerReady: boolean;
  previewUrl: string | null;
}

export type { AgentToolDefinition, AgentToolResult, AgentMessage, AgentRunState } from '../agent/types';
```

- [ ] **Step 2: Commit**

```bash
git add shared/src/types/index.ts
git commit -m "fix: restore role unification and editors field in shared types"
```

---

### Task 2: Restore role unification in backend services

The branch reverted the auth service, topic-space service, and AI service to use `teacher`/`student` roles. Restore these to the main branch state (`user` role + editors-based permissions).

**Files:**
- Modify: `services/auth/src/models/User.ts`
- Modify: `services/auth/src/controllers/authController.ts`
- Modify: `services/topic-space/src/models/Topic.ts`
- Modify: `services/topic-space/src/controllers/topicController.ts`

- [ ] **Step 1: Restore `services/auth/src/models/User.ts` to main state**

```bash
git checkout main -- services/auth/src/models/User.ts
```

- [ ] **Step 2: Restore `services/auth/src/controllers/authController.ts` to main state**

```bash
git checkout main -- services/auth/src/controllers/authController.ts
```

- [ ] **Step 3: Restore `services/topic-space/src/models/Topic.ts` to main state (includes editors)**

```bash
git checkout main -- services/topic-space/src/models/Topic.ts
```

- [ ] **Step 4: Restore `services/topic-space/src/controllers/topicController.ts` to main state (includes editors-based permissions)**

```bash
git checkout main -- services/topic-space/src/controllers/topicController.ts
```

- [ ] **Step 5: Check for other role-related regressions in backend files**

Restore these to main state if they were regressed:

```bash
git checkout main -- services/auth/src/index.ts
git checkout main -- services/topic-space/src/index.ts
git checkout main -- services/topic-space/src/utils/migrate.ts
```

- [ ] **Step 6: Commit**

```bash
git add services/auth/src/models/User.ts services/auth/src/controllers/authController.ts services/topic-space/src/models/Topic.ts services/topic-space/src/controllers/topicController.ts services/auth/src/index.ts services/topic-space/src/index.ts services/topic-space/src/utils/migrate.ts
git commit -m "fix: restore role unification and editors-based permissions in backend services"
```

---

### Task 3: Restore role unification in frontend pages/components

Several frontend pages were regressed from `user` role back to `teacher`/`student`.

**Files:**
- Modify: `frontend/src/stores/useAuthStore.ts`
- Modify: `frontend/src/components/ProtectedRoute.tsx`
- Modify: `frontend/src/components/layout/TopNav.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/pages/RegisterPage.tsx`
- Modify: `frontend/src/pages/TopicListPage.tsx`
- Modify: `frontend/src/pages/KnowledgeEditorPage.tsx`
- Modify: `frontend/src/pages/KnowledgeTopicPage.tsx`

- [ ] **Step 1: Restore frontend files to main state (then re-apply only agent runtime changes)**

```bash
git checkout main -- frontend/src/stores/useAuthStore.ts frontend/src/components/ProtectedRoute.tsx frontend/src/components/layout/TopNav.tsx frontend/src/pages/DashboardPage.tsx frontend/src/pages/RegisterPage.tsx frontend/src/pages/TopicListPage.tsx frontend/src/pages/KnowledgeEditorPage.tsx frontend/src/pages/KnowledgeTopicPage.tsx
```

- [ ] **Step 2: Re-apply test file changes**

```bash
git checkout main -- frontend/src/components/ProtectedRoute.test.tsx frontend/src/pages/DashboardPage.test.tsx frontend/src/pages/RegisterPage.test.tsx frontend/src/pages/TopicListPage.test.tsx
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/useAuthStore.ts frontend/src/components/ProtectedRoute.tsx frontend/src/components/layout/TopNav.tsx frontend/src/pages/DashboardPage.tsx frontend/src/pages/RegisterPage.tsx frontend/src/pages/TopicListPage.tsx frontend/src/pages/KnowledgeEditorPage.tsx frontend/src/pages/KnowledgeTopicPage.tsx frontend/src/components/ProtectedRoute.test.tsx frontend/src/pages/DashboardPage.test.tsx frontend/src/pages/RegisterPage.test.tsx frontend/src/pages/TopicListPage.test.tsx
git commit -m "fix: restore role unification in frontend pages and components"
```

---

### Task 4: Rewrite AIChatSidebar to use the agent runtime

The current AIChatSidebar uses local `useState` for messages and calls `chatWithTools` directly without the tool-calling loop. It must use `useAgentRuntime` and `useAgentStore`.

**Files:**
- Modify: `frontend/src/components/AIChatSidebar.tsx`

- [ ] **Step 1: Rewrite `AIChatSidebar.tsx` to use agent runtime**

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgentRuntime } from '../agent/useAgentRuntime';
import { useAgentStore } from '../stores/useAgentStore';
import { topicApi, topicFileApi } from '../services/api';
import { getApiErrorMessage } from '../utils/errors';
import type { AgentMessage } from '@web-learn/shared';

interface AIChatSidebarProps {
  topicId: string;
  title?: string;
}

function AIChatSidebar({ topicId, title = 'AI 助手' }: AIChatSidebarProps) {
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
          const visible: AgentMessage[] = data.chatHistory
            .filter((m: any) => m.role === 'user' || m.role === 'assistant')
            .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content || '' }));
          setVisibleMessages(visible);
        }
      } catch {
        // Silently fail — start with empty chat
      }
    };
    fetchTopic();
  }, [topicId, setVisibleMessages]);

  // Debounced save function — only visible messages
  const debouncedSave = useCallback(
    (msgs: AgentMessage[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await topicFileApi.saveChatHistory(topicId, msgs);
        } catch {
          // Silently fail — will retry on next message
        }
      }, 2000);
    },
    [topicId]
  );

  // Cleanup timer on unmount
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
  }, [visibleMessages, debouncedSave]);

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
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full px-4 py-3 shadow-lg"
      >
        {open ? '关闭助手' : title}
      </button>
      {open && (
        <aside className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">{title}</h3>
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

export default AIChatSidebar;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AIChatSidebar.tsx
git commit -m "fix: rewrite AIChatSidebar to use agent runtime with tool-calling loop"
```

---

### Task 5: Wire AIChatSidebar into WebsiteEditorPage and fix permission check

Replace AgentChat with AIChatSidebar and restore the editors-based permission check.

**Files:**
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`

- [ ] **Step 1: Update WebsiteEditorPage.tsx**

Replace the entire file. Key changes:
1. Replace `AgentChat` import with `AIChatSidebar`
2. Restore editors-based `canEdit` check
3. Remove `handleApplyFiles` (no longer needed — AIChatSidebar handles its own file operations through tools)
4. Add `refreshEditorStore` to sync WebContainer state to the editor store after WC init

```typescript
import { useEffect, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Topic } from '@web-learn/shared';
import { topicApi, topicFileApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import { toast } from '../stores/useToastStore';
import { getApiErrorMessage } from '../utils/errors';
import { LoadingOverlay } from '../components/Loading';
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';
import { getBaseBreadcrumbs } from '../utils/breadcrumbs';
import TopBar from '../components/editor/TopBar';
import { EditorPanelGroup } from '../components/editor/ResizablePanel';
import FileTree from '../components/editor/FileTree';
import CodeEditor from '../components/editor/CodeEditor';
import AIChatSidebar from '../components/AIChatSidebar';
import PreviewPanel from '../components/editor/PreviewPanel';
import { useWebContainer } from '../hooks/useWebContainer';
import { useEditorStore } from '../stores/useEditorStore';
import '../agent/tools/index';

function WebsiteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { setMeta } = useLayoutMeta();
  const { user } = useAuthStore();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [previewReloadKey, setPreviewReloadKey] = useState(0);

  const {
    isReady,
    previewUrl,
    error: wcError,
    init: initWC,
    deleteFile: deleteFileWC,
  } = useWebContainer();

  const { openFile, getAllFiles, loadSnapshot, deleteFile } = useEditorStore();

  // Editors-based permission: creator or admin
  const canEdit =
    user?.role === 'admin' ||
    (topic && user?.id && (topic.createdBy === user.id.toString() || topic.editors?.includes(user.id.toString())));

  // Load topic and restore snapshot
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const topicData = await topicApi.getById(id);
        setTopic(topicData);

        // Try to restore files from snapshot
        const snapshot = await topicFileApi.loadSnapshot(id);
        if (snapshot && Object.keys(snapshot).length > 0) {
          loadSnapshot(snapshot);
        }

        setMeta({
          pageTitle: `编辑：${topicData.title}`,
          breadcrumbSegments: [
            ...getBaseBreadcrumbs(),
            { label: topicData.title, to: `/topics/${topicData.id}` },
            { label: '编辑' },
          ],
          sideNavSlot: null,
        });
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, '加载编辑器失败'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, setMeta, loadSnapshot]);

  // Initialize WebContainer once topic is loaded, then sync to store
  useEffect(() => {
    if (!topic || !id) return;
    const currentFiles = getAllFiles();
    initWC(Object.keys(currentFiles).length > 0 ? currentFiles : undefined);
  }, [topic, id, initWC, getAllFiles]);

  const handleOpenFile = useCallback((path: string) => {
    openFile(path);
    setShowEditor(true);
  }, [openFile]);

  const handleCloseEditor = useCallback(() => {
    setShowEditor(false);
  }, []);

  const handleRefreshPreview = useCallback(() => {
    setPreviewReloadKey((prev) => prev + 1);
  }, []);

  const handleDeleteFile = useCallback(async (path: string) => {
    try {
      await deleteFileWC(path);
      deleteFile(path);
    } catch (error) {
      console.error('File deletion failed:', error);
      toast.error('删除文件失败，请稍后重试');
    }
  }, [deleteFile, deleteFileWC]);

  if (loading) {
    return <LoadingOverlay message="加载编辑器中..." />;
  }

  if (error || !topic) {
    return (
      <div className="px-4 py-6">
        <div className="bg-white rounded-lg shadow p-6 text-gray-700">{error || '专题不存在'}</div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="px-4 py-6">
        <div className="bg-white rounded-lg shadow p-6 text-gray-700">你没有编辑该专题的权限</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-zinc-900">
      {/* Top Bar */}
      <TopBar onRefreshPreview={handleRefreshPreview} />

      {/* Main Editor Area */}
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
              content: <AIChatSidebar topicId={id} />,
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
}

export default WebsiteEditorPage;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/WebsiteEditorPage.tsx
git commit -m "fix: wire AIChatSidebar into editor, restore editors-based permission check"
```

---

### Task 6: Fix frontend LLM route mismatch

The frontend `llmApi.ts` points to `${API_BASE_URL}/llm` but the backend route is at `/api/ai`. The backend controller at `POST /api/ai/chat` accepts the same shape.

**Files:**
- Modify: `frontend/src/services/llmApi.ts`

- [ ] **Step 1: Fix baseURL in `llmApi.ts`**

Replace the entire file:

```typescript
import OpenAI from 'openai';
import type { AIChatMessage } from '@web-learn/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getAuthToken = () => localStorage.getItem('auth_token');

const createLlmClient = (token: string) =>
  new OpenAI({
    apiKey: token,
    baseURL: `${API_BASE_URL}/ai`,
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

The key change is `baseURL: ${API_BASE_URL}/ai` instead of `${API_BASE_URL}/llm`. The OpenAI SDK will POST to `{baseURL}/chat.completions`, which resolves to `/api/ai/chat.completions`.

However, the backend route is `POST /api/ai/chat`, not `/api/ai/chat.completions`. We need to handle this mismatch. The simplest fix: change the backend route to match OpenAI's path.

- [ ] **Step 2: Update backend route to match OpenAI SDK path**

In `services/ai/src/routes/aiRoutes.ts`, change the route:

```typescript
import express, { Router } from 'express';
import { chat } from '../controllers/aiController';
import { internalAuthMiddleware } from '@web-learn/shared';
import rateLimit from 'express-rate-limit';

const router: Router = express.Router();

const aiChatLimiter = rateLimit({ windowMs: 60000, max: 30 });

// OpenAI-compatible endpoint path (the OpenAI SDK POSTs to /chat.completions)
router.post('/chat.completions', aiChatLimiter, internalAuthMiddleware, chat);
// Also keep the old path for backward compat
router.post('/chat', aiChatLimiter, internalAuthMiddleware, chat);

export default router;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/llmApi.ts services/ai/src/routes/aiRoutes.ts
git commit -m "fix: align frontend LLM route with backend OpenAI-compatible endpoint"
```

---

### Task 7: Delete legacy files and remove dead code

**Files:**
- Delete: `frontend/src/components/editor/AgentChat.tsx`
- Delete: `frontend/src/stores/useChatStore.ts`
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Delete legacy AgentChat.tsx**

```bash
git rm frontend/src/components/editor/AgentChat.tsx
```

- [ ] **Step 2: Delete legacy useChatStore.ts**

```bash
git rm frontend/src/stores/useChatStore.ts
```

- [ ] **Step 3: Remove aiApi export from api.ts**

In `frontend/src/services/api.ts`, remove the aiApi block and its unused imports:

```typescript
// Remove the imports: AIChatRequestDto, AIChatResponseDto (lines in the import block)
```

Change the import line from:
```typescript
import type {
  User,
  AuthResponse,
  LoginDto,
  CreateUserDto,
  ApiResponse,
  Topic,
  CreateTopicDto,
  UpdateTopicDto,
  UpdateTopicStatusDto,
  DeleteTopicResponse,
  TopicPage,
  TopicPageTreeNode,
  CreateTopicPageDto,
  UpdateTopicPageDto,
  ReorderTopicPagesDto,
  AIChatRequestDto,
  AIChatResponseDto,
  WebsiteStats,
} from '@web-learn/shared';
```

to:

```typescript
import type {
  User,
  AuthResponse,
  LoginDto,
  CreateUserDto,
  ApiResponse,
  Topic,
  CreateTopicDto,
  UpdateTopicDto,
  UpdateTopicStatusDto,
  DeleteTopicResponse,
  TopicPage,
  TopicPageTreeNode,
  CreateTopicPageDto,
  UpdateTopicPageDto,
  ReorderTopicPagesDto,
  WebsiteStats,
} from '@web-learn/shared';
```

Remove the aiApi block (lines 175-181):

```typescript
// Delete these lines:
// export const aiApi = {
//   chat: async (data: AIChatRequestDto): Promise<AIChatResponseDto> => {
//     const response = await api.post<AIChatResponseDto>('/ai/chat', data);
//     return response.data;
//   },
// };
```

- [ ] **Step 4: Commit**

```bash
git rm frontend/src/components/editor/AgentChat.tsx frontend/src/stores/useChatStore.ts
git add frontend/src/services/api.ts
git commit -m "chore: delete legacy AgentChat, useChatStore, and aiApi dead code"
```

---

### Task 8: Fix useAgentRuntime error state reset and move tool imports to main.tsx

**Files:**
- Modify: `frontend/src/agent/useAgentRuntime.ts`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/agent/tools/writeFile.ts`
- Modify: `frontend/src/agent/tools/createFile.ts`
- Modify: `frontend/src/agent/tools/deleteFile.ts`
- Modify: `frontend/src/agent/tools/moveFile.ts`

- [ ] **Step 1: Fix error state reset in useAgentRuntime.ts**

Replace the `finally` block to call `clearRunState` properly:

```typescript
import { chatWithTools } from '../services/llmApi';
import { getOpenAITools, executeTool } from './toolRegistry';
import { useAgentStore } from '../stores/useAgentStore';
import type { AIChatMessage } from '@web-learn/shared';

const MAX_TOOL_LOOPS = 8;

const SYSTEM_PROMPT: AIChatMessage = {
  role: 'system',
  content: `你是一名专业的前端开发者，负责帮助用户将他们的想法转化为网站。

你可以使用以下文件系统工具直接操作项目文件：
- list_files: 列出项目中所有文件
- read_file: 读取文件内容
- write_file: 覆盖文件内容
- create_file: 创建新文件
- delete_file: 删除文件
- move_file: 移动或重命名文件

你的工作流程：
1. 先用 list_files 了解当前项目结构
2. 理解用户需求（如不明确，先询问风格、布局、颜色等偏好）
3. 使用工具直接创建或修改文件
4. 完成后告知用户所做的更改

使用标准的前端技术栈（HTML/CSS/JS 或 React 等）。每次完成后给出简洁的中文说明。`,
};

export function useAgentRuntime() {
  const visibleMessages = useAgentStore((s) => s.visibleMessages);
  const addVisibleMessage = useAgentStore((s) => s.addVisibleMessage);
  const setRunState = useAgentStore((s) => s.setRunState);
  const clearRunState = useAgentStore((s) => s.clearRunState);

  async function runAgentLoop(userMessage: string): Promise<void> {
    const internalMessages: AIChatMessage[] = [
      SYSTEM_PROMPT,
      ...visibleMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];
    internalMessages.push({ role: 'user', content: userMessage });

    const openAITools = getOpenAITools();

    addVisibleMessage({ role: 'user', content: userMessage });
    setRunState({ isRunning: true, error: null });

    try {
      for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
        const completion = await chatWithTools(internalMessages, openAITools);
        const choice = completion.choices[0];
        const message = choice.message;

        internalMessages.push(message as AIChatMessage);

        if (!message.tool_calls || message.tool_calls.length === 0) {
          const assistantContent = message.content || '';
          addVisibleMessage({ role: 'assistant', content: assistantContent });
          break;
        }

        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;

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

Key change: the `finally` block now calls `clearRunState()` which resets ALL fields including `error`, instead of manually setting partial fields.

- [ ] **Step 2: Move tool imports to main.tsx**

Add tool imports to the app entry point:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Import all agent tools to trigger registration at app startup
import './agent/tools/listFiles';
import './agent/tools/readFile';
import './agent/tools/writeFile';
import './agent/tools/createFile';
import './agent/tools/deleteFile';
import './agent/tools/moveFile';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
```

- [ ] **Step 3: Remove tool import from WebsiteEditorPage.tsx**

Since tools are now registered in main.tsx, remove `import '../agent/tools/index';` from WebsiteEditorPage.tsx.

In the file written in Task 5 Step 1, ensure this line is NOT present.

- [ ] **Step 4: Remove dual-write to useEditorStore from tool files**

The tools should only write to WebContainer, not to the editor store. The editor store will be synced via `loadSnapshot` from WebContainer.

In `frontend/src/agent/tools/writeFile.ts`:

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

In `frontend/src/agent/tools/createFile.ts`:

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

In `frontend/src/agent/tools/deleteFile.ts`:

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

In `frontend/src/agent/tools/moveFile.ts`:

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

- [ ] **Step 5: Commit**

```bash
git add frontend/src/agent/useAgentRuntime.ts frontend/src/main.tsx frontend/src/agent/tools/writeFile.ts frontend/src/agent/tools/createFile.ts frontend/src/agent/tools/deleteFile.ts frontend/src/agent/tools/moveFile.ts frontend/src/pages/WebsiteEditorPage.tsx
git commit -m "fix: clear error state properly, register tools at startup, remove dual-write"
```

---

### Task 9: Relax backend message validation for tool messages

The `validateMessages` function rejects messages with `content: null`, which is valid in the OpenAI protocol for tool messages. Also relax the empty content check.

**Files:**
- Modify: `services/ai/src/controllers/aiController.ts`

- [ ] **Step 1: Update message validation**

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
    // Tool messages can have null content; assistant messages with tool_calls can also have null content
    if (role === 'tool' || role === 'assistant') {
      // Content can be null for tool/assistant messages with tool_calls
      if (content !== null && content !== undefined && typeof content !== 'string') {
        return 'message content must be a string or null';
      }
      if (typeof content === 'string' && content.length > MAX_MESSAGE_CONTENT_LENGTH) {
        return `message content too long, max ${MAX_MESSAGE_CONTENT_LENGTH}`;
      }
    } else {
      // user/system messages must have non-empty string content
      if (typeof content !== 'string' || !content.trim()) {
        return 'message content must be a non-empty string';
      }
      if (content.length > MAX_MESSAGE_CONTENT_LENGTH) {
        return `message content too long, max ${MAX_MESSAGE_CONTENT_LENGTH}`;
      }
    }
  }
  return null;
};

export const chat = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const { messages, tools, tool_choice, model } = req.body as {
      messages: any[];
      tools?: any[];
      tool_choice?: string;
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

- [ ] **Step 2: Commit**

```bash
git add services/ai/src/controllers/aiController.ts
git commit -m "fix: relax message validation to allow null content for tool/assistant messages"
```
