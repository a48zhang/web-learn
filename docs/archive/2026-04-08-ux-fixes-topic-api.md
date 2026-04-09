# UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four critical UX issues from the audit report.

**Architecture:** Frontend-first fixes with Zustand state management for persistence features.

**Tech Stack:** React, TypeScript, Zustand, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/App.tsx` | Modify | Add public home route, separate authenticated redirect |
| `frontend/src/pages/PublicHomePage.tsx` | Create | Public landing page with featured topics and CTAs |
| `frontend/src/components/editor/SaveIndicator.tsx` | Create | Editor save status indicator component |
| `frontend/src/pages/WebsiteEditorPage.tsx` | Modify | Integrate save indicator, auto-save, navigation warning |
| `frontend/src/stores/useEditorStore.ts` | Modify | Add `hasUnsavedChanges` tracking |
| `frontend/src/components/AIChatSidebar.tsx` | Modify | Add chat history persistence (load on mount, debounce save) |
| `frontend/src/pages/WebsiteEditorPage.tsx` | Modify | Fix layout: extract from AppShell, fix panel sizing, theme consistency |
| `frontend/src/components/editor/ResizablePanel.tsx` | Modify | Fix resize handle touch target, header consistency |
| `frontend/src/components/editor/PreviewPanel.tsx` | Modify | Unify panel header style with editor dark theme, replace emoji |
| `frontend/src/components/editor/FileTree.tsx` | Modify | Replace emoji icons with SVG icons |
| `frontend/src/components/editor/TopBar.tsx` | Modify | Integrate save status indicator, keep manual save button |
| `frontend/src/components/editor/CodeEditor.tsx` | Modify | Replace ✕ character with SVG close icon |
| `frontend/src/components/Toast.tsx` | Modify | Change default duration from 5000ms to 3000ms for non-error toasts |

---

## Task Breakdown

### Task 1: Public Home Page

**Goal:** Replace the root `/` redirect with a public landing page that showcases the platform to visitors.

**Files:**
- Create: `frontend/src/pages/PublicHomePage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create the PublicHomePage component**

```tsx
// frontend/src/pages/PublicHomePage.tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { topicApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import type { Topic } from '@web-learn/shared';
import { LoadingOverlay } from '../components/Loading';
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';

function PublicHomePage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const { setMeta } = useLayoutMeta();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMeta({
      pageTitle: 'WebLearn - 互动式学习平台',
      breadcrumbSegments: [],
      sideNavSlot: null,
    });
  }, [setMeta]);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const data = await topicApi.getAll();
        setTopics(data.filter(t => t.status === 'published').slice(0, 6));
      } catch {
        // Silently fail — page still shows hero section
      } finally {
        setLoading(false);
      }
    };
    fetchTopics();
  }, []);

  // Redirect authenticated users to dashboard
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            WebLearn
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            创建、发布和浏览互动式学习专题。教师可以轻松搭建网站型专题，学生能够沉浸式地探索知识。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="bg-white text-blue-600 font-semibold px-6 py-3 rounded-md hover:bg-blue-50 transition-colors"
            >
              免费注册
            </Link>
            <Link
              to="/login"
              className="border-2 border-white text-white font-semibold px-6 py-3 rounded-md hover:bg-white/10 transition-colors"
            >
              登录
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
            为什么选择 WebLearn？
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                所见即所得编辑器
              </h3>
              <p className="text-gray-600">
                内置代码编辑器和实时预览，AI 助手辅助生成网页，无需外部工具。
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                AI 学习助手
              </h3>
              <p className="text-gray-600">
                每个专题都配有 AI 助手，帮助学生理解内容、解答疑问。
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                完全公开浏览
              </h3>
              <p className="text-gray-600">
                无需注册即可浏览已发布的专题内容，先体验后注册。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Published Topics Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              热门专题
            </h2>
            <Link
              to="/topics"
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              查看全部 →
            </Link>
          </div>

          {loading ? (
            <LoadingOverlay message="加载专题中..." />
          ) : topics.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              暂无已发布的专题
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topics.map((topic) => (
                <Link
                  key={topic.id}
                  to={`/topics/${topic.id}`}
                  className="block bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {topic.title}
                  </h3>
                  {topic.description && (
                    <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                      {topic.description}
                    </p>
                  )}
                  <span className="text-xs text-gray-500">
                    {new Date(topic.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            准备好开始了吗？
          </h2>
          <p className="text-gray-600 mb-6">
            免费创建账户，开始搭建你的互动学习专题。
          </p>
          <button
            onClick={() => navigate('/register')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-md transition-colors"
          >
            立即注册
          </button>
        </div>
      </section>
    </div>
  );
}

export default PublicHomePage;
```

- [ ] **Step 2: Update App.tsx routing**

Replace the root route and add the import. Full `App.tsx` after changes:

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from './stores/useAuthStore';
import { useToastStore } from './stores/useToastStore';
import { ToastContainer } from './components/Toast';
import { LoadingOverlay } from './components/Loading';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TopicListPage from './pages/TopicListPage';
import TopicCreatePage from './pages/TopicCreatePage';
import TopicDetailPage from './pages/TopicDetailPage';
import WebsiteEditorPage from './pages/WebsiteEditorPage';
import PublicHomePage from './pages/PublicHomePage';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import { LayoutMetaProvider } from './components/layout/LayoutMetaContext';
import { topicApi } from './services/api';
import type { Topic } from '@web-learn/shared';

function App() {
  const { checkAuth, isLoading, isAuthenticated } = useAuthStore();
  const { toasts, removeToast } = useToastStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return <LoadingOverlay message="初始化中..." />;
  }

  return (
    <BrowserRouter>
      <LayoutMetaProvider>
        <Routes>
          {/* Public routes */}
          <Route
            path="/"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <PublicHomePage />
            }
          />
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
            }
          />
          <Route
            path="/register"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />
            }
          />

          {/* Protected routes wrapped with AppShell */}
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
          <Route
            path="/topics"
            element={
              <AppShell>
                <TopicListPage />
              </AppShell>
            }
          />
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
          <Route
            path="/topics/:id"
            element={
              <AppShell>
                <TopicDetailPage />
              </AppShell>
            }
          />
          <Route
            path="/topics/:id/edit"
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <TopicEditorRouter />
              </ProtectedRoute>
            }
          />

          {/* 404 route */}
          <Route
            path="*"
            element={
              <AppShell>
                <div className="flex items-center justify-center p-12">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                    <p className="text-gray-600 mb-4">页面未找到</p>
                    <a href="/dashboard" className="text-blue-600 hover:text-blue-500 font-medium">
                      返回首页
                    </a>
                  </div>
                </div>
              </AppShell>
            }
          />
        </Routes>
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </LayoutMetaProvider>
    </BrowserRouter>
  );
}

export default App;

function TopicEditorRouter() {
  const { id } = useParams<{ id: string }>();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const fetchTopic = async () => {
      if (!id) return;
      try {
        const data = await topicApi.getById(id);
        setTopic(data);
        setFailed(false);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    };
    fetchTopic();
  }, [id]);

  if (loading) {
    return <LoadingOverlay message="加载中..." />;
  }

  if (!topic || failed) {
    return <Navigate to="/topics" replace />;
  }

  return <WebsiteEditorPage />;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PublicHomePage.tsx frontend/src/App.tsx
git commit -m "feat: add public home page with featured topics and CTAs"
```

---

### Task 2: Editor Save State Indicator

**Goal:** Add auto-save with visual feedback to the website editor, including navigation warning.

**Files:**
- Create: `frontend/src/components/editor/SaveIndicator.tsx`
- Modify: `frontend/src/stores/useEditorStore.ts`
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`

- [ ] **Step 1: Add dirty tracking to the editor store**

Full `useEditorStore.ts` after changes:

```typescript
import { create } from 'zustand';
import type { FileTreeNode } from '@web-learn/shared';

interface EditorState {
  files: Record<string, string>;
  fileTree: FileTreeNode[];
  openFiles: string[];
  activeFile: string | null;
  previewUrl: string | null;
  isWebContainerReady: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
  setFileContent: (path: string, content: string) => void;
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  deleteFile: (path: string) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  createFile: (path: string, content?: string) => void;
  setPreviewUrl: (url: string | null) => void;
  setWebContainerReady: (ready: boolean) => void;
  loadSnapshot: (files: Record<string, string>) => void;
  getAllFiles: () => Record<string, string>;
  getFileTree: () => FileTreeNode[];
  markSaved: () => void;
  markUnsaved: () => void;
}

function buildFileTree(files: Record<string, string>): FileTreeNode[] {
  const root: FileTreeNode = { name: '', path: '', type: 'directory', children: [] };
  for (const [path] of Object.entries(files)) {
    const parts = path.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const existing = current.children?.find((child) => child.name === part);
      if (i === parts.length - 1) {
        if (!existing) {
          current.children?.push({ name: part, path, type: 'file' });
        }
      } else {
        if (!existing) {
          const dirNode: FileTreeNode = { name: part, path: parts.slice(0, i + 1).join('/'), type: 'directory', children: [] };
          current.children?.push(dirNode);
          current = dirNode;
        } else {
          current = existing;
        }
      }
    }
  }
  return root.children || [];
}

export const useEditorStore = create<EditorState>((set, get) => ({
  files: {},
  fileTree: [],
  openFiles: [],
  activeFile: null,
  previewUrl: null,
  isWebContainerReady: false,
  hasUnsavedChanges: false,
  lastSavedAt: null,

  setFileContent: (path, content) => {
    set((state) => ({
      files: { ...state.files, [path]: content },
      hasUnsavedChanges: true,
    }));
  },

  openFile: (path) => {
    set((state) => {
      if (state.openFiles.includes(path)) {
        return { activeFile: path };
      }
      return {
        openFiles: [...state.openFiles, path],
        activeFile: path,
      };
    });
  },

  closeFile: (path) => {
    set((state) => {
      const newOpenFiles = state.openFiles.filter((f) => f !== path);
      const newActiveFile = state.activeFile === path
        ? (newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null)
        : state.activeFile;
      return { openFiles: newOpenFiles, activeFile: newActiveFile };
    });
  },

  setActiveFile: (path) => set({ activeFile: path }),

  deleteFile: (path) => {
    set((state) => {
      const newFiles = { ...state.files };
      for (const key of Object.keys(newFiles)) {
        if (key === path || key.startsWith(path + '/')) {
          delete newFiles[key];
        }
      }
      return {
        files: newFiles,
        openFiles: state.openFiles.filter((f) => f !== path && !f.startsWith(path + '/')),
        fileTree: buildFileTree(newFiles),
        hasUnsavedChanges: true,
      };
    });
  },

  renameFile: (oldPath, newPath) => {
    set((state) => {
      const newFiles: Record<string, string> = {};
      for (const [key, value] of Object.entries(state.files)) {
        if (key === oldPath) {
          newFiles[newPath] = value;
        } else if (key.startsWith(oldPath + '/')) {
          newFiles[key.replace(oldPath, newPath)] = value;
        } else {
          newFiles[key] = value;
        }
      }
      return {
        files: newFiles,
        fileTree: buildFileTree(newFiles),
        hasUnsavedChanges: true,
      };
    });
  },

  createFile: (path, content = '') => {
    set((state) => ({
      files: { ...state.files, [path]: content },
      fileTree: buildFileTree({ ...state.files, [path]: content }),
      hasUnsavedChanges: true,
    }));
  },

  setPreviewUrl: (url) => set({ previewUrl: url }),
  setWebContainerReady: (ready) => set({ isWebContainerReady: ready }),

  loadSnapshot: (files) => set({
    files,
    fileTree: buildFileTree(files),
    hasUnsavedChanges: false,
    lastSavedAt: null,
  }),

  getAllFiles: () => get().files,
  getFileTree: () => get().fileTree,

  markSaved: () => set({ hasUnsavedChanges: false, lastSavedAt: new Date() }),
  markUnsaved: () => set({ hasUnsavedChanges: true }),
}));
```

- [ ] **Step 2: Create the SaveIndicator component**

```tsx
// frontend/src/components/editor/SaveIndicator.tsx
import { useEffect } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';

interface SaveIndicatorProps {
  topicId: string;
}

function SaveIndicator({ topicId }: SaveIndicatorProps) {
  const { hasUnsavedChanges, lastSavedAt, markSaved, getAllFiles } = useEditorStore();

  // Auto-save when changes are made (debounced)
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const timer = setTimeout(async () => {
      const files = getAllFiles();
      try {
        const { topicFileApi } = await import('../../services/api');
        await topicFileApi.saveSnapshot(topicId, files);
        markSaved();
      } catch {
        // Auto-save failed silently — user can retry manually
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, topicId, getAllFiles, markSaved]);

  // Navigation warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const formatLastSaved = (date: Date | null) => {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return '刚刚';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} 分钟前`;
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  // NOTE: Manual save is in TopBar's existing save button.
  // This component is status-only to avoid duplication.

  return (
    <div className="flex items-center gap-2 text-xs">
      {hasUnsavedChanges ? (
        <span className="flex items-center gap-1 text-amber-400">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          未保存
        </span>
      ) : lastSavedAt ? (
        <span className="flex items-center gap-1 text-green-400">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
          已保存 · {formatLastSaved(lastSavedAt)}
        </span>
      ) : (
        <span className="text-zinc-500">无未保存的更改</span>
      )}
    </div>
  );
}

export default SaveIndicator;
```

- [ ] **Step 3: Integrate SaveIndicator into TopBar**

In `frontend/src/components/editor/TopBar.tsx`, add the import:
```tsx
import SaveIndicator from './SaveIndicator';
```

Add the indicator to the right-side buttons area, before the save button:

```tsx
// In the right div, add SaveIndicator before the save button:
<div className="flex items-center gap-2">
  <SaveIndicator topicId={id ?? ''} />
  <button onClick={onRefreshPreview} ...>刷新预览</button>
  {onPublish && ...}
  {onShare && ...}
  <button onClick={handleSave} ...>{saving ? '保存中...' : '保存'}</button>
</div>
```

The TopBar's save button remains (TopBar already saves both files AND chat history). SaveIndicator is status-only — no save button duplication.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/stores/useEditorStore.ts frontend/src/components/editor/SaveIndicator.tsx frontend/src/pages/WebsiteEditorPage.tsx
git commit -m "feat: add editor save indicator with auto-save and navigation warning"
```

---

### Task 3: AI Chat History Persistence

**Goal:** Persist AI chat conversations so they survive sidebar close/navigation.

**Files:**
- Modify: `frontend/src/components/AIChatSidebar.tsx`

- [ ] **Step 1: Add chat history persistence to AIChatSidebar**

Replace `frontend/src/components/AIChatSidebar.tsx` with:

```tsx
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AIChatAgentType, AIChatMessage } from '@web-learn/shared';
import { aiApi, topicApi, topicFileApi } from '../services/api';
import { getApiErrorMessage } from '../utils/errors';

interface AIChatSidebarProps {
  topicId: string;
  agentType: AIChatAgentType;
  title?: string;
}

function AIChatSidebar({ topicId, agentType, title }: AIChatSidebarProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buttonText = title || (agentType === 'building' ? '搭建助手' : '学习助手');

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.role === 'user' || message.role === 'assistant'),
    [messages]
  );

  // Load chat history on mount
  useEffect(() => {
    const fetchTopic = async () => {
      try {
        const data = await topicApi.getById(topicId);
        if (data.chatHistory && Array.isArray(data.chatHistory)) {
          setMessages(data.chatHistory);
        }
      } catch {
        // Silently fail — start with empty chat
      }
    };
    fetchTopic();
  }, [topicId]);

  // Debounced save function
  const debouncedSave = useCallback(
    (msgs: AIChatMessage[]) => {
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

  const handleSend = async () => {
    const content = input.trim();
    if (!content || loading) return;
    if (!/^\d+$/.test(topicId)) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '请求失败：无效的专题ID' },
      ]);
      return;
    }
    const nextMessages: AIChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const response = await aiApi.chat({
        messages: nextMessages,
        topic_id: Number(topicId),
        agent_type: agentType,
      });
      const assistant = response.choices?.[0]?.message;
      if (assistant) {
        const updated = [...nextMessages, assistant as AIChatMessage];
        setMessages(updated);
        debouncedSave(updated);
      }
    } catch (error: unknown) {
      const errorMsg: AIChatMessage[] = [
        ...nextMessages,
        { role: 'assistant', content: `请求失败：${getApiErrorMessage(error, '未知错误')}` },
      ];
      setMessages(errorMsg);
      debouncedSave(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    setMessages([]);
    try {
      await topicFileApi.saveChatHistory(topicId, []);
    } catch {
      // Silently fail
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full px-4 py-3 shadow-lg"
      >
        {open ? '关闭助手' : buttonText}
      </button>
      {open && (
        <aside className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">{buttonText}</h3>
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
                {agentType === 'building'
                  ? '你可以让助手创建或修改专题页面。'
                  : '你可以询问当前专题的内容。'}
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
            {loading && <p className="text-xs text-gray-500">助手思考中...</p>}
          </div>
          <div className="p-3 border-t border-gray-200 space-y-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="输入你的问题..."
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !input.trim()}
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
git commit -m "feat: persist AI chat history to backend with debounced saves"
```

---

### Task 5: Editor UI Layout Fix

**Goal:** Fix the Website Editor page layout overflow, panel sizing, and dark theme consistency issues.

**Root cause analysis:**
- `WebsiteEditorPage` uses `h-screen` but is nested inside `AppShell` (which has `min-h-screen`), causing height overflow and double scrollbars
- Panel default sizes (18/28/30 = 76%) leave 24% uncontrolled, making the preview area too small
- PreviewPanel header uses `bg-zinc-100` (light theme) while all other panels use `bg-zinc-800` (dark theme), creating visual inconsistency
- Resize handle is `w-1` (~4px), below the minimum touch target (44×44pt)

**Files:**
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`
- Modify: `frontend/src/components/editor/ResizablePanel.tsx`
- Modify: `frontend/src/components/editor/PreviewPanel.tsx`
- Modify: `frontend/src/components/editor/FileTree.tsx`
- Modify: `frontend/src/components/editor/TopBar.tsx`

- [ ] **Step 1: Fix WebsiteEditorPage layout — remove h-screen overflow**

Change root container from `h-screen` to full-height flex container that fits inside AppShell:

```tsx
// frontend/src/pages/WebsiteEditorPage.tsx
// Root element changes:
// BEFORE:
<div className="h-screen flex flex-col bg-zinc-900">

// AFTER:
<div className="fixed inset-0 flex flex-col bg-zinc-900">
```

Using `fixed inset-0` ensures the editor takes the full viewport. Since the editor route (Task 1) no longer wraps in AppShell, the editor is now truly fullscreen.

- [ ] **Step 2: Integrate SaveIndicator into TopBar**

The SaveIndicator component from Task 2 is status-only (no manual save button). The TopBar already has a save button that saves both files and chat history.

In `frontend/src/components/editor/TopBar.tsx`, add the import:
```tsx
import SaveIndicator from './SaveIndicator';
```

Add the indicator to the right-side div, before the save button:
```tsx
<div className="flex items-center gap-3">
  <SaveIndicator topicId={id ?? ''} />
  <button onClick={onRefreshPreview} ...>刷新预览</button>
  {/* ... other buttons ... */}
  <button onClick={handleSave} ...>{saving ? '保存中...' : '保存'}</button>
</div>
```

- [ ] **Step 3: Fix ResizablePanel header consistency and resize handle**

Update `frontend/src/components/editor/ResizablePanel.tsx`:

```tsx
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';

export { Panel, PanelGroup, PanelResizeHandle };

export interface PanelConfig {
  id: string;
  minSize: number;
  defaultSize?: number;
  collapsible?: boolean;
  header: React.ReactNode;
  content: React.ReactNode;
}

interface EditorPanelGroupProps {
  panels: PanelConfig[];
  direction?: 'horizontal' | 'vertical';
}

export function EditorPanelGroup({ panels, direction = 'horizontal' }: EditorPanelGroupProps) {
  return (
    <PanelGroup
      orientation={direction}
      className="h-full"
    >
      {panels.map((panel, index) => (
        <>
          {index > 0 && (
            <PanelResizeHandle
              key={`handle-${panel.id}`}
              className="w-3 flex items-center justify-center shrink-0 group cursor-col-resize"
            >
              <div className="w-1 bg-zinc-700 group-hover:bg-blue-500 transition-colors h-full" />
            </PanelResizeHandle>
          )}
          <Panel
            key={panel.id}
            id={panel.id}
            minSize={panel.minSize}
            defaultSize={panel.defaultSize}
            collapsible={panel.collapsible}
          >
            <div className="flex flex-col h-full bg-zinc-900">
              <div className="h-8 bg-zinc-800 border-b border-zinc-700 flex items-center px-3 text-xs text-zinc-400 font-medium shrink-0 select-none">
                {panel.header}
              </div>
              <div className="flex-1 overflow-hidden">
                {panel.content}
              </div>
            </div>
          </Panel>
        </>
      ))}
    </PanelGroup>
  );
}
```

Changes:
- Resize handle widened from `w-1` to `w-3` (~12px touch target) with visual indicator remaining at `w-1`
- Header adds `select-none` to prevent text selection during resize

- [ ] **Step 4: Fix panel default sizes**

In `frontend/src/pages/WebsiteEditorPage.tsx`, update panel sizes:

```tsx
// BEFORE:
{
  id: 'file-tree',
  minSize: 15,
  defaultSize: 18,
  ...
},
{
  id: 'agent-chat',
  minSize: 20,
  defaultSize: 28,
  ...
},
{
  id: 'preview',
  minSize: 30,
  collapsible: false,
  ...
},

// AFTER:
{
  id: 'file-tree',
  minSize: 15,
  defaultSize: 20,
  ...
},
{
  id: 'agent-chat',
  minSize: 20,
  defaultSize: 25,
  ...
},
{
  id: 'preview',
  minSize: 30,
  defaultSize: 55,
  collapsible: false,
  ...
},
```

Preview gets 55% as the primary feedback area, file tree gets 20% (enough for filenames), agent chat gets 25%.

- [ ] **Step 5: Unify PreviewPanel header theme**

Update `frontend/src/components/editor/PreviewPanel.tsx` header to match editor dark theme:

```tsx
// BEFORE (lines 57-70):
<div className="flex items-center justify-between px-3 py-1.5 bg-zinc-100 border-b border-zinc-200 shrink-0">
  <div className="flex items-center gap-2 text-xs text-zinc-600">

// AFTER:
<div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800 border-b border-zinc-700 shrink-0">
  <div className="flex items-center gap-2 text-xs text-zinc-400">
```

Also update the refresh button:

```tsx
// BEFORE:
className="text-zinc-500 hover:text-zinc-700 text-xs px-2 py-1 rounded hover:bg-zinc-200"

// AFTER:
className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-700"
```

- [ ] **Step 6: Replace emoji icons in FileTree with SVG icons**

In `frontend/src/components/editor/FileTree.tsx`:

Add imports at the top (after existing `FiPlus` import):
```tsx
import { FiFile, FiFileText, FiPalette, FiCode, FiSettings, FiImage, FiEdit2, FiFolder, FiFolderOpen } from 'react-icons/fi';
```

Replace the entire `getFileIcon` function (lines 6-15):
```tsx
// BEFORE:
function getFileIcon(filename: string): string {
  if (filename.endsWith('.html') || filename.endsWith('.htm')) return '📄';
  if (filename.endsWith('.css')) return '🎨';
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return '📜';
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return '📘';
  if (filename.endsWith('.json')) return '⚙️';
  if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.svg')) return '🖼️';
  if (filename.endsWith('.md')) return '📝';
  return '📄';
}

// AFTER:
function getFileIcon(filename: string): React.ReactNode {
  if (filename.endsWith('.html') || filename.endsWith('.htm')) return <FiFileText size={14} />;
  if (filename.endsWith('.css')) return <FiPalette size={14} />;
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return <FiCode size={14} />;
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return <FiCode size={14} />;
  if (filename.endsWith('.json')) return <FiSettings size={14} />;
  if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.svg')) return <FiImage size={14} />;
  if (filename.endsWith('.md')) return <FiEdit2 size={14} />;
  return <FiFile size={14} />;
}
```

Replace the folder icon in TreeNode (line 73):
```tsx
// BEFORE:
<span className="text-xs shrink-0">{expanded ? '📂' : '📁'}</span>

// AFTER:
<span className="shrink-0 text-zinc-400">{expanded ? <FiFolderOpen size={14} /> : <FiFolder size={14} />}</span>
```

Also replace the file icon usage in the TreeNode file branch (line 53):
```tsx
// BEFORE:
<span className="text-xs shrink-0">{getFileIcon(node.name)}</span>

// AFTER:
<span className="shrink-0 text-zinc-400">{getFileIcon(node.name)}</span>
```

- [ ] **Step 7: Replace emoji in PreviewPanel loading state**

```tsx
// frontend/src/components/editor/PreviewPanel.tsx
// BEFORE (lines 46-48):
<div className="text-2xl mb-2">⏳</div>
<p className="text-sm">WebContainer初始化中...</p>

// AFTER:
<div className="mb-3">
  <svg className="animate-spin h-8 w-8 text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
</div>
<p className="text-sm">WebContainer初始化中...</p>
```

- [ ] **Step 8: Replace emoji in PreviewPanel loading state**

In `frontend/src/components/editor/PreviewPanel.tsx`:

```tsx
// BEFORE:
<div className="text-2xl mb-2">⏳</div>
<p className="text-sm">WebContainer初始化中...</p>

// AFTER:
<div className="mb-3">
  <svg className="animate-spin h-8 w-8 text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
</div>
<p className="text-sm">WebContainer初始化中...</p>
```

- [ ] **Step 9: Replace ✕ in CodeEditor tab close button and FileTree file delete button with SVG icons**

In `frontend/src/components/editor/CodeEditor.tsx`, replace the tab close button (lines 60-64):

```tsx
// BEFORE:
<button
  className="ml-1 text-zinc-500 hover:text-white"
  onClick={(e) => { e.stopPropagation(); closeFile(path); }}
>
  ✕
</button>

// AFTER:
<button
  className="ml-1 text-zinc-500 hover:text-white"
  onClick={(e) => { e.stopPropagation(); closeFile(path); }}
  aria-label={`关闭 ${name}`}
>
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
</button>
```

In `frontend/src/components/editor/FileTree.tsx`, replace the file delete button ✕ (lines 55-61):

```tsx
// BEFORE:
<button
  className="hidden group-hover:flex text-zinc-500 hover:text-red-400 ml-1 shrink-0"
  onClick={handleDelete}
  title="删除"
>
  ✕
</button>

// AFTER:
<button
  className="hidden group-hover:flex text-zinc-500 hover:text-red-400 ml-1 shrink-0"
  onClick={handleDelete}
  title="删除"
  aria-label={`删除 ${node.name}`}
>
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
</button>
```

- [ ] **Step 10: Fix Toast default duration**

Per UI/UX guidelines (toast-dismiss: auto-dismiss toasts in 3-5s). Current default is 5000ms for all toasts — too long for success/info/warning.

In `frontend/src/components/Toast.tsx`, line 22, change:

```tsx
// BEFORE:
    }, toast.duration || 5000);

// AFTER:
    }, toast.duration ?? (toast.type === 'error' ? 5000 : 3000));
```

This makes error toasts stay 5s, all others auto-dismiss at 3s.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/pages/WebsiteEditorPage.tsx \
  frontend/src/components/editor/ResizablePanel.tsx \
  frontend/src/components/editor/PreviewPanel.tsx \
  frontend/src/components/editor/FileTree.tsx \
  frontend/src/components/editor/CodeEditor.tsx \
  frontend/src/components/Toast.tsx
git commit -m "fix(editor): fix layout, panel sizing, theme consistency, emoji replacement, toast duration"
```

---

### Task 6: Verify Theme Persistence (Close as Not a Bug)

**Goal:** Confirm that the theme store already persists correctly and close this item.

- [ ] **Step 1: Verify and update audit report**

`useThemeStore` already uses Zustand `persist` middleware with localStorage key `theme-storage`. No code changes needed. Append to the audit report:

Run:
```bash
cat >> docs/superpowers/specs/2026-04-08-ux-audit-report.md << 'EOF'
---

## 已验证问题

#### 4. 所有用户 - 主题偏好持久化 ✅

**状态：** 无需修改

`useThemeStore` 已使用 Zustand `persist` 中间件将主题偏好保存到 localStorage（key: `theme-storage`）。
刷新页面、重新登录后均能正确恢复主题偏好。
EOF
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-08-ux-audit-report.md
git commit -m "docs: verify theme persistence is working correctly"
```

---

## Summary

| Task | Issue | Files Changed | Complexity |
|---|---|---|---|
| 1 | No public home page | `PublicHomePage.tsx` (new), `App.tsx` | Medium |
| 2 | No save indicator | `SaveIndicator.tsx` (new), `useEditorStore.ts`, `TopBar.tsx` | Medium |
| 3 | Chat history lost | `AIChatSidebar.tsx` | Low |
| 4 | Theme persistence | `ux-audit-report.md` (docs only) | Trivial |
| 5 | Editor UI layout broken | `WebsiteEditorPage.tsx`, `ResizablePanel.tsx`, `PreviewPanel.tsx`, `FileTree.tsx` | Medium |
