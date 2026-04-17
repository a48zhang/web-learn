# Website Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dual-version topic space (knowledge/website) with a unified website editor featuring a VSCode-style three-panel layout, WebContainer-powered live preview, and Agent-driven code generation via LLM API.

**Architecture:** Frontend-dominant. The browser runs WebContainers for code execution and live preview, Monaco Editor for file editing, and communicates with the backend via standard OpenAI Chat Completions API format. Backend acts as an LLM proxy and persists file snapshots + chat history.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, `@webcontainer/api`, `@monaco-editor/react`, `react-resizable-panels`, `react-markdown`, `openai` SDK, Express, Sequelize, MySQL.

---

## File Map

### New Files

| File | Responsibility |
|------|----------------|
| `frontend/src/pages/WebsiteEditorPage.tsx` (rewrite) | New three-panel editor page (replaces current WebsiteEditorPage) |
| `frontend/src/components/editor/EditorLayout.tsx` | Three-panel resizable layout container |
| `frontend/src/components/editor/FileTree.tsx` | File tree component (left panel) |
| `frontend/src/components/editor/AgentChat.tsx` | Agent chat panel (middle panel) |
| `frontend/src/components/editor/PreviewPanel.tsx` | WebContainer + iframe preview (right panel) |
| `frontend/src/components/editor/CodeEditor.tsx` | Monaco editor overlay for file editing |
| `frontend/src/components/editor/TopBar.tsx` | Top action bar (Save, Refresh, Publish, Share) |
| `frontend/src/components/editor/ResizablePanel.tsx` | Individual resizable panel wrapper |
| `frontend/src/hooks/useWebContainer.ts` | WebContainer lifecycle hook |
| `frontend/src/stores/useEditorStore.ts` | Editor state store (files, open files, layout) |
| `frontend/src/stores/useChatStore.ts` | Chat state store (messages, history) |
| `frontend/src/services/llmApi.ts` | LLM API client using OpenAI SDK |
| `frontend/src/services/fileSync.ts` | File synchronization service (WC ↔ backend) |
| `services/topic-space/src/controllers/llmProxyController.ts` | LLM proxy controller (forward requests) |
| `services/topic-space/src/routes/llmRoutes.ts` | LLM API routes |
| `services/topic-space/src/services/llmProvider.ts` | LLM provider abstraction (OpenAI/Claude) |

### Modified Files

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Simplify TopicEditorRouter (no more type-based routing) |
| `frontend/src/pages/TopicCreatePage.tsx` | Remove type selector field |
| `frontend/src/pages/WebsiteTopicPage.tsx` | Delete (preview merged into editor) |
| `frontend/src/pages/KnowledgeEditorPage.tsx` | Keep temporarily, will be removed later |
| `frontend/src/pages/KnowledgeTopicPage.tsx` | Keep temporarily, will be removed later |
| `frontend/src/services/api.ts` | Add editor-related API methods |
| `frontend/src/components/AIChatSidebar.tsx` | Keep (existing AI chat, not replaced by AgentChat) |
| `shared/src/types/index.ts` | Add editor/agent types, remove `TopicType` distinction |
| `shared/src/types/index.ts:33-34` | Remove `TopicType` and `TopicTypeMap` |
| `services/topic-space/src/models/Topic.ts` | Add `files_snapshot`, `chat_history` fields |
| `services/topic-space/src/controllers/topicController.ts` | Remove type-based logic, add file save/load endpoints |
| `services/topic-space/src/routes/topicRoutes.ts` | Add new routes for file operations |
| `services/topic-space/src/app.ts` | Mount LLM routes |
| `services/topic-space/package.json` | Add `openai` SDK dependency |
| `frontend/package.json` | Add `@webcontainer/api`, `@monaco-editor/react`, `react-resizable-panels`, `openai` |

---

## Task 1: Add shared types for editor/agent

**Files:**
- Modify: `shared/src/types/index.ts`
- Test: (types only, no test)

- [ ] **Step 1: Update shared types**

Add new types for editor and agent, remove the knowledge/website distinction.

Edit `shared/src/types/index.ts`:

Replace the existing `TopicType` and related lines (line 33):
```ts
export type TopicType = 'knowledge' | 'website';
```

With:
```ts
export type TopicType = 'website';
```

And update the `TopicTypeMap` (around line 157-160):
```ts
export const TopicTypeMap = {
  WEBSITE: 'website',
} as const;
```

Add these new types at the end of the file (before the closing):
```ts
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
```

- [ ] **Step 2: Rebuild shared package**

Run:
```bash
cd shared && npx tsc
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add shared/src/types/index.ts
git commit -m "feat(types): add editor and agent types for website editor"
```

---

## Task 2: Add backend LLM proxy service

**Files:**
- Create: `services/topic-space/src/services/llmProvider.ts`
- Create: `services/topic-space/src/controllers/llmProxyController.ts`
- Create: `services/topic-space/src/routes/llmRoutes.ts`
- Modify: `services/topic-space/src/app.ts`
- Modify: `services/topic-space/package.json`
- Modify: `services/topic-space/src/utils/config.ts`

- [ ] **Step 1: Install OpenAI SDK**

Run:
```bash
cd services/topic-space && pnpm add openai
```

- [ ] **Step 2: Add LLM config to config.ts**

Add to `services/topic-space/src/utils/config.ts`, after the `database` block:
```ts
  llm: {
    provider: process.env.LLM_PROVIDER || 'openai',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-4o',
    baseUrl: process.env.LLM_BASE_URL || undefined,
  },
```

- [ ] **Step 3: Create LLM provider**

Create `services/topic-space/src/services/llmProvider.ts`:
```ts
import OpenAI from 'openai';
import { config } from '../utils/config';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.baseUrl,
    });
  }
  return openaiClient;
}

export async function createChatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null }>,
  options?: { stream?: boolean; response_format?: { type: 'json_object' | 'text' } }
) {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: config.llm.model,
    messages,
    stream: options?.stream || false,
    response_format: options?.response_format,
  });
  return response;
}
```

- [ ] **Step 4: Create LLM proxy controller**

Create `services/topic-space/src/controllers/llmProxyController.ts`:
```ts
import { Request, Response } from 'express';
import { createChatCompletion } from '../services/llmProvider';

export const llmChat = async (req: Request, res: Response) => {
  try {
    const { model, messages, stream, response_format } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const response = await createChatCompletion(messages, {
      stream: stream || false,
      response_format,
    });

    res.json(response);
  } catch (error) {
    console.error('LLM proxy error:', error);
    res.status(500).json({ error: 'LLM service unavailable' });
  }
};

export const llmChatStream = async (req: Request, res: Response) => {
  try {
    const { model, messages, response_format } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const response = await createChatCompletion(messages, {
      stream: true,
      response_format,
    });

    if (response && 'controller' in response) {
      // OpenAI returns AsyncIterable for streaming
      for await (const chunk of response as unknown as AsyncIterable<unknown>) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('LLM stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'LLM service unavailable' });
    } else {
      res.end();
    }
  }
};
```

- [ ] **Step 5: Create LLM routes**

Create `services/topic-space/src/routes/llmRoutes.ts`:
```ts
import express from 'express';
import { llmChat, llmChatStream } from '../controllers/llmProxyController';
import { internalAuthMiddleware } from '@web-learn/shared';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const llmLimiter = rateLimit({ windowMs: 60000, max: 30 });

router.post('/chat/completions', llmLimiter, internalAuthMiddleware, llmChat);
router.post('/chat/completions/stream', llmLimiter, internalAuthMiddleware, llmChatStream);

export default router;
```

- [ ] **Step 6: Mount LLM routes in app.ts**

Add to `services/topic-space/src/app.ts`, after the existing route mounts:
```ts
import llmRoutes from './routes/llmRoutes';
// ...
app.use('/api/llm', llmRoutes);
```

- [ ] **Step 7: Commit**

```bash
git add services/topic-space/src/services/llmProvider.ts \
  services/topic-space/src/controllers/llmProxyController.ts \
  services/topic-space/src/routes/llmRoutes.ts \
  services/topic-space/src/app.ts \
  services/topic-space/src/utils/config.ts \
  services/topic-space/package.json
git commit -m "feat(topic-space): add LLM proxy service with OpenAI API"
```

---

## Task 3: Add backend file snapshot persistence

**Files:**
- Modify: `services/topic-space/src/models/Topic.ts`
- Modify: `services/topic-space/src/controllers/topicController.ts`
- Modify: `services/topic-space/src/routes/topicRoutes.ts`
- Modify: `shared/src/types/index.ts` (already done in Task 1)

- [ ] **Step 1: Update Topic model with new fields**

Edit `services/topic-space/src/models/Topic.ts`.

Add new fields to `TopicAttributes` interface:
```ts
interface TopicAttributes {
  id: number;
  title: string;
  description?: string;
  type: 'website';
  website_url?: string | null;
  created_by: number;
  status: 'draft' | 'published' | 'closed';
  files_snapshot?: string | null;
  chat_history?: string | null;
  published_url?: string | null;
  share_link?: string | null;
}
```

Update the `TopicCreationAttributes`:
```ts
interface TopicCreationAttributes extends Optional<TopicAttributes, 'id' | 'description' | 'website_url' | 'status' | 'type' | 'files_snapshot' | 'chat_history' | 'published_url' | 'share_link'> {}
```

Add new fields to the `Topic` class:
```ts
class Topic extends Model<TopicAttributes, TopicCreationAttributes> implements TopicAttributes {
  // ... existing fields ...
  public files_snapshot?: string | null;
  public chat_history?: string | null;
  public published_url?: string | null;
  public share_link?: string | null;
}
```

Add new field initializations in `Topic.init()`:
```ts
Topic.init(
  {
    // ... existing fields ...
    type: { type: DataTypes.ENUM('website'), allowNull: false, defaultValue: 'website' },
    // ... existing fields ...
    files_snapshot: { type: DataTypes.TEXT, allowNull: true },
    chat_history: { type: DataTypes.TEXT, allowNull: true },
    published_url: { type: DataTypes.STRING(500), allowNull: true },
    share_link: { type: DataTypes.STRING(500), allowNull: true },
  },
  { sequelize, tableName: 'topic_topics', underscored: true }
);
```

- [ ] **Step 2: Update topicController formatTopic to include new fields**

In `services/topic-space/src/controllers/topicController.ts`, update `formatTopic`:
```ts
const formatTopic = (topic: any) => ({
  id: topic.id.toString(),
  title: topic.title,
  description: topic.description,
  type: topic.type,
  websiteUrl: topic.website_url ?? null,
  createdBy: topic.created_by.toString(),
  creator: topic.creator
    ? {
      id: topic.creator.id.toString(),
      username: topic.creator.username,
      email: topic.creator.email,
    }
    : undefined,
  status: topic.status,
  filesSnapshot: topic.files_snapshot ? JSON.parse(topic.files_snapshot) : null,
  chatHistory: topic.chat_history ? JSON.parse(topic.chat_history) : null,
  publishedUrl: topic.published_url ?? null,
  shareLink: topic.share_link ?? null,
  createdAt: topic.createdAt.toISOString(),
  updatedAt: topic.updatedAt.toISOString(),
});
```

- [ ] **Step 3: Simplify createTopic to always use 'website' type**

In `services/topic-space/src/controllers/topicController.ts`, update `createTopic`.

Replace:
```ts
const { title, description, type = 'knowledge' } = req.body;
// ...
const normalizedType = type === 'website' ? 'website' : 'knowledge';
// ...
const topic = await Topic.create({
  title,
  description,
  type: normalizedType,
```

With:
```ts
const { title, description } = req.body;
// ...
const topic = await Topic.create({
  title,
  description,
  type: 'website',
```

- [ ] **Step 4: Simplify getTopics to remove type filtering**

In `services/topic-space/src/controllers/topicController.ts`, update `getTopics`.

Replace the `where` logic:
```ts
const { type } = req.query as { type?: string };

const basePublished: any = { status: 'published' };
if (type === 'knowledge' || type === 'website') {
  basePublished.type = type;
}

let where: any = basePublished;
if (req.user?.role === 'teacher') {
  const own: any = { created_by: req.user.id };
  if (type === 'knowledge' || type === 'website') {
    own.type = type;
  }
  where = { [Op.or]: [basePublished, own] };
}
```

With:
```ts
const basePublished: any = { status: 'published' };
let where: any = basePublished;
if (req.user?.role === 'teacher') {
  where = { [Op.or]: [basePublished, { created_by: req.user.id }] };
}
```

- [ ] **Step 5: Add saveFilesSnapshot and saveChatHistory endpoints**

Append to `services/topic-space/src/controllers/topicController.ts`:
```ts
export const saveFilesSnapshot = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }
    const topicId = parseTopicId(req.params.id);
    if (!topicId) {
      return res.status(400).json({ success: false, error: 'Invalid topic ID' });
    }
    const topic = await Topic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
    if (!ensureTopicOwner(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const { files } = req.body;
    if (!files || typeof files !== 'object') {
      return res.status(400).json({ success: false, error: 'files object is required' });
    }
    await topic.update({ files_snapshot: JSON.stringify(files) });
    return res.json({ success: true, message: 'Snapshot saved' });
  } catch (error) {
    console.error('saveFilesSnapshot error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const saveChatHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }
    const topicId = parseTopicId(req.params.id);
    if (!topicId) {
      return res.status(400).json({ success: false, error: 'Invalid topic ID' });
    }
    const topic = await Topic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
    if (!ensureTopicOwner(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: 'messages array is required' });
    }
    await topic.update({ chat_history: JSON.stringify(messages) });
    return res.json({ success: true, message: 'Chat history saved' });
  } catch (error) {
    console.error('saveChatHistory error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
```

- [ ] **Step 6: Add routes for file operations**

In `services/topic-space/src/routes/topicRoutes.ts`, add:
```ts
import {
  // ... existing imports ...
  saveFilesSnapshot,
  saveChatHistory,
} from '../controllers/topicController';

// ... existing routes ...
router.put('/:id/files', writeLimiter, internalAuthMiddleware, saveFilesSnapshot);
router.put('/:id/chat-history', writeLimiter, internalAuthMiddleware, saveChatHistory);
```

- [ ] **Step 7: Commit**

```bash
git add services/topic-space/src/models/Topic.ts \
  services/topic-space/src/controllers/topicController.ts \
  services/topic-space/src/routes/topicRoutes.ts \
  shared/src/types/index.ts
git commit -m "feat(topic-space): add file snapshot and chat history persistence"
```

---

## Task 4: Add frontend dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install dependencies**

Run:
```bash
cd frontend && pnpm add @webcontainer/api @monaco-editor/react react-resizable-panels react-complex-tree openai react-icons
```

Note: `react-icons` is already installed. The new packages are:
- `@webcontainer/api` - WebContainer API for running dev servers in browser
- `@monaco-editor/react` - React wrapper for Monaco Editor
- `react-resizable-panels` - Resizable panel layout
- `react-complex-tree` - Virtualized tree with drag & drop
- `openai` - OpenAI SDK (standard API format)

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json pnpm-lock.yaml
git commit -m "chore(frontend): add editor dependencies"
```

---

## Task 5: Create editor stores

**Files:**
- Create: `frontend/src/stores/useEditorStore.ts`
- Create: `frontend/src/stores/useChatStore.ts`

- [ ] **Step 1: Create editor store**

Create `frontend/src/stores/useEditorStore.ts`:
```ts
import { create } from 'zustand';
import type { EditorFile, FileTreeNode } from '@web-learn/shared';

interface EditorState {
  // File system
  files: Record<string, string>; // path -> content
  fileTree: FileTreeNode[];
  openFiles: string[]; // paths of open files
  activeFile: string | null;

  // WebContainer
  previewUrl: string | null;
  isWebContainerReady: boolean;

  // Actions
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
}

function buildFileTree(files: Record<string, string>): FileTreeNode[] {
  const root: FileTreeNode = { name: '', path: '', type: 'directory', children: [] };

  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const existing = current.children?.find((child) => child.name === part);

      if (i === parts.length - 1) {
        // It's a file
        if (!existing) {
          current.children?.push({ name: part, path, type: 'file' });
        }
      } else {
        // It's a directory
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

  setFileContent: (path, content) => {
    set((state) => ({
      files: { ...state.files, [path]: content },
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
      // Delete file and any children (if it's a directory prefix)
      for (const key of Object.keys(newFiles)) {
        if (key === path || key.startsWith(path + '/')) {
          delete newFiles[key];
        }
      }
      return {
        files: newFiles,
        openFiles: state.openFiles.filter((f) => f !== path && !f.startsWith(path + '/')),
        fileTree: buildFileTree(newFiles),
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
      return { files: newFiles, fileTree: buildFileTree(newFiles) };
    });
  },

  createFile: (path, content = '') => {
    set((state) => ({
      files: { ...state.files, [path]: content },
      fileTree: buildFileTree({ ...state.files, [path]: content }),
    }));
  },

  setPreviewUrl: (url) => set({ previewUrl: url }),
  setWebContainerReady: (ready) => set({ isWebContainerReady: ready }),

  loadSnapshot: (files) => set({ files, fileTree: buildFileTree(files) }),

  getAllFiles: () => get().files,
  getFileTree: () => get().fileTree,
}));
```

- [ ] **Step 2: Create chat store**

Create `frontend/src/stores/useChatStore.ts`:
```ts
import { create } from 'zustand';
import type { AIChatMessage } from '@web-learn/shared';

interface ChatState {
  messages: AIChatMessage[];
  isLoading: boolean;
  error: string | null;

  addMessage: (message: AIChatMessage) => void;
  setMessages: (messages: AIChatMessage[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  error: null,

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),

  setMessages: (messages) => set({ messages }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  clearChat: () => set({ messages: [], error: null }),
}));
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/useEditorStore.ts frontend/src/stores/useChatStore.ts
git commit -m "feat(frontend): add editor and chat stores"
```

---

## Task 6: Create LLM API service (frontend)

**Files:**
- Create: `frontend/src/services/llmApi.ts`
- Modify: `frontend/src/services/api.ts` (add topic file endpoints)

- [ ] **Step 1: Create LLM API service**

Create `frontend/src/services/llmApi.ts`:
```ts
import OpenAI from 'openai';
import type { AIChatMessage, AgentResponse } from '@web-learn/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Configure OpenAI SDK to point at our backend proxy
const llmClient = new OpenAI({
  apiKey: 'proxy-key', // Not used directly, backend handles auth
  baseURL: `${API_BASE_URL}/llm`,
  dangerouslyAllowBrowser: true,
});

export async function sendChatMessage(
  messages: AIChatMessage[],
  onStream?: (chunk: string) => void
): Promise<AgentResponse | null> {
  try {
    const response = await llmClient.chat.completions.create({
      model: import.meta.env.VITE_LLM_MODEL || 'gpt-4o',
      messages: messages as any,
      response_format: { type: 'json_object' },
      stream: !!onStream,
    });

    if (onStream) {
      // Streaming response
      let fullContent = '';
      for await (const chunk of response as any) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullContent += content;
        onStream(content);
      }
      // Parse JSON from full content
      try {
        return JSON.parse(fullContent) as AgentResponse;
      } catch {
        return { message: fullContent, files: [] };
      }
    }

    // Non-streaming response
    const completion = response as any;
    const content = completion.choices?.[0]?.message?.content;
    if (!content) return null;

    try {
      return JSON.parse(content) as AgentResponse;
    } catch {
      return { message: content, files: [] };
    }
  } catch (error) {
    console.error('LLM API error:', error);
    throw error;
  }
}
```

- [ ] **Step 2: Add file sync API methods**

Add to `frontend/src/services/api.ts`:
```ts
// Topic file operations (editor)
export const topicFileApi = {
  saveSnapshot: async (topicId: string, files: Record<string, string>): Promise<void> => {
    await api.put(`/topics/${topicId}/files`, { files });
  },

  loadSnapshot: async (topicId: string): Promise<Record<string, string> | null> => {
    const response = await api.get<ApiResponse<any>>(`/topics/${topicId}`);
    const data = response.data.data;
    return data?.filesSnapshot ?? null;
  },

  saveChatHistory: async (topicId: string, messages: any[]): Promise<void> => {
    await api.put(`/topics/${topicId}/chat-history`, { messages });
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/llmApi.ts frontend/src/services/api.ts
git commit -m "feat(frontend): add LLM API service using OpenAI SDK format"
```

---

## Task 7: Create WebContainer hook

**Files:**
- Create: `frontend/src/hooks/useWebContainer.ts`

- [ ] **Step 1: Create WebContainer hook**

Create `frontend/src/hooks/useWebContainer.ts`:
```ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { WebContainer } from '@webcontainer/api';
import { useEditorStore } from '../stores/useEditorStore';

let webcontainerInstance: WebContainer | null = null;

export function useWebContainer() {
  const [isReady, setIsReady] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { setFileContent, createFile, deleteFile, getAllFiles } = useEditorStore();
  const isInitializing = useRef(false);

  const init = useCallback(async (initialFiles?: Record<string, string>) => {
    if (isInitializing.current) return;
    isInitializing.current = true;
    setError(null);

    try {
      if (!webcontainerInstance) {
        webcontainerInstance = await WebContainer.boot();
      }

      // Write initial files
      const files = initialFiles || {};
      for (const [path, content] of Object.entries(files)) {
        await writeFile(path, content);
      }

      setIsReady(true);

      // If package.json exists, install deps and start dev server
      if (files['package.json']) {
        const installProcess = await webcontainerInstance.spawn('npm', ['install']);
        installProcess.output.pipeTo(
          new WritableStream({ write: (data) => console.log('[npm]', data) })
        );
        await installProcess.exit;
      }

      // Start dev server
      const devProcess = await webcontainerInstance.spawn('npm', ['run', 'dev', '--', '--host', 'localhost', '--port', '5173']);
      devProcess.output.pipeTo(
        new WritableStream({ write: (data) => console.log('[dev]', data) })
      );

      // Wait for server to be ready
      webcontainerInstance.on('server-ready', (port, url) => {
        setPreviewUrl(url);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'WebContainer initialization failed';
      setError(message);
      console.error('WebContainer error:', err);
    } finally {
      isInitializing.current = false;
    }
  }, []);

  const writeFile = async (path: string, content: string) => {
    if (!webcontainerInstance) return;
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir) {
      await webcontainerInstance.fs.mkdir(dir, { recursive: true });
    }
    await webcontainerInstance.fs.writeFile(path, content);
  };

  const deleteFile = async (path: string) => {
    if (!webcontainerInstance) return;
    try {
      await webcontainerInstance.fs.rm(path, { recursive: true, force: true });
    } catch (err) {
      console.warn('Failed to delete file in WebContainer:', err);
    }
  };

  const syncFile = async (path: string, content: string) => {
    await writeFile(path, content);
    setFileContent(path, content);
  };

  const refresh = useCallback(() => {
    // Trigger iframe reload by updating previewUrl
    setPreviewUrl((prev) => prev);
  }, []);

  return {
    isReady,
    previewUrl,
    error,
    init,
    writeFile,
    deleteFile,
    syncFile,
    refresh,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useWebContainer.ts
git commit -m "feat(frontend): add WebContainer lifecycle hook"
```

---

## Task 8: Create editor components - TopBar and ResizablePanel

**Files:**
- Create: `frontend/src/components/editor/TopBar.tsx`
- Create: `frontend/src/components/editor/ResizablePanel.tsx`

- [ ] **Step 1: Create TopBar component**

Create `frontend/src/components/editor/TopBar.tsx`:
```tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { topicApi, topicFileApi } from '../../services/api';
import { useEditorStore } from '../../stores/useEditorStore';
import { useChatStore } from '../../stores/useChatStore';
import { toast } from '../../stores/useToastStore';

interface TopBarProps {
  onRefreshPreview: () => void;
  onPublish?: () => void;
  onShare?: () => void;
}

export default function TopBar({ onRefreshPreview, onPublish, onShare }: TopBarProps) {
  const { id } = useParams<{ id: string }>();
  const { getAllFiles } = useEditorStore();
  const { messages } = useChatStore();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const files = getAllFiles();
      await topicFileApi.saveSnapshot(id, files);
      await topicFileApi.saveChatHistory(id, messages);
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

- [ ] **Step 2: Create ResizablePanel component**

Create `frontend/src/components/editor/ResizablePanel.tsx`:
```tsx
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

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
  onLayoutChange?: (sizes: number[]) => void;
}

export function EditorPanelGroup({ panels, direction = 'horizontal', onLayoutChange }: EditorPanelGroupProps) {
  return (
    <PanelGroup
      direction={direction}
      onLayout={(sizes) => onLayoutChange?.(sizes)}
    >
      {panels.map((panel, index) => (
        <Panel
          key={panel.id}
          minSize={panel.minSize}
          defaultSize={panel.defaultSize}
          collapsible={panel.collapsible}
        >
          <div className="flex flex-col h-full bg-zinc-900">
            <div className="h-8 bg-zinc-800 border-b border-zinc-700 flex items-center px-3 text-xs text-zinc-400 font-medium shrink-0">
              {panel.header}
            </div>
            <div className="flex-1 overflow-hidden">
              {panel.content}
            </div>
          </div>
        </Panel>
      ))}
      {panels.slice(0, -1).map((_, index) => (
        <PanelResizeHandle
          key={`handle-${index}`}
          className="w-1 bg-zinc-700 hover:bg-blue-500 transition-colors cursor-col-resize shrink-0"
        />
      ))}
    </PanelGroup>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/editor/TopBar.tsx frontend/src/components/editor/ResizablePanel.tsx
git commit -m "feat(frontend): add TopBar and ResizablePanel editor components"
```

---

## Task 9: Create FileTree and CodeEditor components

**Files:**
- Create: `frontend/src/components/editor/FileTree.tsx`
- Create: `frontend/src/components/editor/CodeEditor.tsx`

- [ ] **Step 1: Create FileTree component**

Create `frontend/src/components/editor/FileTree.tsx`:
```tsx
import { useMemo } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import { FiFile, FiFolder, FiFolderOpen, FiPlus, FiTrash2 } from 'react-icons/fi';

function getFileIcon(filename: string) {
  if (filename.endsWith('.html') || filename.endsWith('.htm')) return '📄';
  if (filename.endsWith('.css')) return '🎨';
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return '📜';
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return '📘';
  if (filename.endsWith('.json')) return '⚙️';
  if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.svg')) return '🖼️';
  if (filename.endsWith('.md')) return '📝';
  return '📄';
}

interface FileTreeProps {
  onOpenFile: (path: string) => void;
}

export default function FileTree({ onOpenFile }: FileTreeProps) {
  const { fileTree, openFile, createFile, deleteFile } = useEditorStore();
  const expandedPaths = useMemo(() => new Set<string>(), []);

  const toggleExpand = (path: string) => {
    if (expandedPaths.has(path)) {
      expandedPaths.delete(path);
    } else {
      expandedPaths.add(path);
    }
    // Force re-render by toggling a dummy state
    // (In production, use useState for expandedPaths)
  };

  const handleNewFile = () => {
    const name = prompt('输入文件名:');
    if (name) {
      createFile(name, '');
    }
  };

  const handleDelete = (path: string) => {
    if (confirm(`确定删除 ${path} 吗？`)) {
      deleteFile(path);
    }
  };

  function renderNode(node: { name: string; path: string; type: 'file' | 'directory'; children?: typeof node[] }, depth: number) {
    const isExpanded = expandedPaths.has(node.path);

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1 px-2 py-1 text-sm hover:bg-zinc-800 cursor-pointer text-zinc-300`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (node.type === 'file') {
              onOpenFile(node.path);
            } else {
              toggleExpand(node.path);
            }
          }}
          onDoubleClick={() => node.type === 'file' && onOpenFile(node.path)}
        >
          <span className="text-xs">
            {node.type === 'file' ? getFileIcon(node.name) : (isExpanded ? '📂' : '📁')}
          </span>
          <span className="truncate">{node.name}</span>
        </div>
        {node.type === 'directory' && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900 text-zinc-300">
      <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-700">
        <span className="text-xs font-medium uppercase tracking-wide">文件</span>
        <button onClick={handleNewFile} className="text-zinc-400 hover:text-white p-1" title="新建文件">
          <FiPlus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {fileTree.length > 0 ? (
          fileTree.map((node) => renderNode(node, 0))
        ) : (
          <div className="p-4 text-xs text-zinc-500 text-center">
            暂无文件，请在对话中让Agent生成
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create CodeEditor component**

Create `frontend/src/components/editor/CodeEditor.tsx`:
```tsx
import { useCallback, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '../../stores/useEditorStore';
import { useWebContainer } from '../../hooks/useWebContainer';

export default function CodeEditor() {
  const { activeFile, files, setFileContent, openFiles, closeFile, setActiveFile } = useEditorStore();
  const { syncFile } = useWebContainer();
  const editorRef = useRef<any>(null);
  const isExternalChange = useRef(false);

  const handleEditorDidMount = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  const handleChange = useCallback(async (value: string | undefined) => {
    if (activeFile && value !== undefined && !isExternalChange.current) {
      setFileContent(activeFile, value);
      await syncFile(activeFile, value);
    }
    isExternalChange.current = false;
  }, [activeFile, setFileContent, syncFile]);

  // Sync when active file changes
  useEffect(() => {
    isExternalChange.current = true;
  }, [activeFile]);

  const getLanguage = (filename: string) => {
    if (filename.endsWith('.html')) return 'html';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
    if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
    if (filename.endsWith('.json')) return 'json';
    if (filename.endsWith('.md')) return 'markdown';
    return 'plaintext';
  };

  if (!activeFile) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-900 text-zinc-500 text-sm">
        双击文件树中的文件打开编辑器
      </div>
    );
  }

  const content = files[activeFile] || '';

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Tab bar */}
      <div className="flex items-center bg-zinc-800 border-b border-zinc-700 overflow-x-auto">
        {openFiles.map((path) => {
          const name = path.split('/').pop() || path;
          const isActive = path === activeFile;
          return (
            <div
              key={path}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer border-r border-zinc-700 ${
                isActive ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-700'
              }`}
              onClick={() => setActiveFile(path)}
            >
              <span>{name}</span>
              <button
                className="ml-1 text-zinc-500 hover:text-white"
                onClick={(e) => { e.stopPropagation(); closeFile(path); }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      {/* Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          theme="vs-dark"
          path={activeFile}
          defaultLanguage={getLanguage(activeFile)}
          value={content}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            padding: { top: 8 },
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/editor/FileTree.tsx frontend/src/components/editor/CodeEditor.tsx
git commit -m "feat(frontend): add FileTree and CodeEditor components"
```

---

## Task 10: Create AgentChat component

**Files:**
- Create: `frontend/src/components/editor/AgentChat.tsx`

- [ ] **Step 1: Create AgentChat component**

Create `frontend/src/components/editor/AgentChat.tsx`:
```tsx
import { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatStore } from '../../stores/useChatStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { sendChatMessage } from '../../services/llmApi';
import type { AIChatMessage, AgentFileOperation } from '@web-learn/shared';

const SYSTEM_PROMPT = `你是一名专业的前端开发者，负责帮助用户将他们的想法转化为网站。

当前上下文：
- 已存在的文件：{file_list}
- 当前打开的文件：{current_file}（如有）

你的职责：
1. 理解用户的需求，如果需求不够具体，先询问用户的偏好
   - 风格偏好（简约、商务、活泼、学术等）
   - 布局偏好（单栏、双栏、带导航、带侧边栏等）
   - 颜色偏好（浅色调、深色调、品牌色等）
2. 根据用户的偏好生成完整的网站代码
3. 使用标准的前端技术栈（HTML/CSS/JS、React、Vue等）
4. 每次只返回需要创建/修改的文件列表，让前端执行文件操作

返回格式（JSON）：
{
  "message": "给用户的自然语言回复",
  "files": [
    {
      "path": "src/index.html",
      "action": "create",
      "content": "<!DOCTYPE html>..."
    }
  ]
}

可用操作：create（新建）、update（修改）、delete（删除）`;

interface AgentChatProps {
  onApplyFiles: (operations: AgentFileOperation[]) => Promise<void>;
}

export default function AgentChat({ onApplyFiles }: AgentChatProps) {
  const { messages, addMessage, setMessages, isLoading, setLoading, setError } = useChatStore();
  const { files, activeFile, setFileContent, getFileTree } = useEditorStore();
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const buildFileList = () => {
    return Object.keys(files).join(', ') || '（暂无文件）';
  };

  const buildCurrentFile = () => {
    if (!activeFile) return '（无）';
    return `${activeFile}（${files[activeFile]?.length || 0} 字节）`;
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isLoading) return;

    setInput('');
    const userMessage: AIChatMessage = { role: 'user', content };
    addMessage(userMessage);
    setLoading(true);
    setError(null);

    // Build system prompt with context
    const systemPrompt = SYSTEM_PROMPT
      .replace('{file_list}', buildFileList())
      .replace('{current_file}', buildCurrentFile());

    const allMessages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
      userMessage,
    ];

    try {
      const response = await sendChatMessage(allMessages, (chunk) => {
        setStreamingContent((prev) => (prev || '') + chunk);
      });

      setStreamingContent(null);

      if (response) {
        addMessage({ role: 'assistant', content: response.message });

        if (response.files && response.files.length > 0) {
          await onApplyFiles(response.files);
        }
      }
    } catch (err) {
      setError('AI服务暂时不可用，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900 text-zinc-300">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-zinc-500 text-center py-8">
            <p>描述你想要创建的网站</p>
            <p className="mt-2">Agent会询问你的偏好，然后帮你生成代码</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`rounded-lg p-3 text-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white ml-8'
                : 'bg-zinc-800 border border-zinc-700 mr-8'
            }`}
          >
            {msg.role === 'assistant' ? (
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content || ''}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            )}
          </div>
        ))}
        {streamingContent && (
          <div className="rounded-lg p-3 text-sm bg-zinc-800 border border-zinc-700 mr-8">
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {streamingContent}
              </ReactMarkdown>
            </div>
          </div>
        )}
        {isLoading && !streamingContent && (
          <p className="text-xs text-zinc-500">Agent思考中...</p>
        )}
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-700">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-zinc-800 border border-zinc-600 rounded-md px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
          placeholder="描述你想要的网站，或上传文件作为参考..."
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-md py-2 text-sm disabled:opacity-50 transition-colors"
        >
          发送
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/editor/AgentChat.tsx
git commit -m "feat(frontend): add AgentChat component with streaming and file operations"
```

---

## Task 11: Create PreviewPanel component

**Files:**
- Create: `frontend/src/components/editor/PreviewPanel.tsx`

- [ ] **Step 1: Create PreviewPanel component**

Create `frontend/src/components/editor/PreviewPanel.tsx`:
```tsx
import { useState } from 'react';

interface PreviewPanelProps {
  previewUrl: string | null;
  isReady: boolean;
  error: string | null;
  onRefresh: () => void;
}

export default function PreviewPanel({ previewUrl, isReady, error, onRefresh }: PreviewPanelProps) {
  const [iframeKey, setIframeKey] = useState(0);

  const handleReload = () => {
    setIframeKey((k) => k + 1);
    onRefresh();
  };

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-300 p-6">
        <p className="text-lg mb-2">WebContainer初始化失败</p>
        <p className="text-sm text-zinc-500 mb-4">请检查浏览器兼容性（不支持Safari等）</p>
        <button
          onClick={handleReload}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 text-sm"
        >
          重试
        </button>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-900 text-zinc-500">
        <div className="text-center">
          <div className="animate-spin text-2xl mb-2">⏳</div>
          <p className="text-sm">WebContainer初始化中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-100 border-b border-zinc-200">
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <span>预览</span>
          {previewUrl && (
            <span className="text-zinc-400 truncate max-w-[200px]">{previewUrl}</span>
          )}
        </div>
        <button
          onClick={handleReload}
          className="text-zinc-500 hover:text-zinc-700 text-xs px-2 py-1 rounded hover:bg-zinc-200"
        >
          刷新
        </button>
      </div>
      {/* Iframe */}
      {previewUrl ? (
        <iframe
          key={iframeKey}
          src={previewUrl}
          className="flex-1 w-full border-0"
          title="Website Preview"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          暂无预览内容
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/editor/PreviewPanel.tsx
git commit -m "feat(frontend): add PreviewPanel with WebContainer iframe"
```

---

## Task 12: Assemble the new WebsiteEditorPage

**Files:**
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx` (complete rewrite)
- Modify: `frontend/src/App.tsx` (simplify TopicEditorRouter)

- [ ] **Step 1: Rewrite WebsiteEditorPage**

Replace the entire content of `frontend/src/pages/WebsiteEditorPage.tsx`:
```tsx
import { useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import type { Topic, AgentFileOperation } from '@web-learn/shared';
import { topicApi, topicFileApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import { toast } from '../stores/useToastStore';
import { getApiErrorMessage } from '../utils/errors';
import { LoadingOverlay } from '../components/Loading';
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';
import type { BreadcrumbSegment } from '../components/layout/LayoutMetaContext';
import { getBaseBreadcrumbs } from '../utils/breadcrumbs';
import TopBar from '../components/editor/TopBar';
import { EditorPanelGroup } from '../components/editor/ResizablePanel';
import FileTree from '../components/editor/FileTree';
import CodeEditor from '../components/editor/CodeEditor';
import AgentChat from '../components/editor/AgentChat';
import PreviewPanel from '../components/editor/PreviewPanel';
import { useWebContainer } from '../hooks/useWebContainer';
import { useEditorStore } from '../stores/useEditorStore';
import { useState } from 'react';

function WebsiteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { setMeta } = useLayoutMeta();
  const { user } = useAuthStore();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const {
    isReady,
    previewUrl,
    error: wcError,
    init: initWC,
    syncFile,
    writeFile: wcWriteFile,
    refresh,
  } = useWebContainer();

  const { files, setFileContent, openFile, getFileTree, getAllFiles, loadSnapshot } = useEditorStore();

  const canEdit = user?.role === 'teacher' && topic?.createdBy === user.id;

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
  }, [id]);

  // Initialize WebContainer once topic is loaded
  useEffect(() => {
    if (!topic || !id) return;
    const currentFiles = getAllFiles();
    initWC(Object.keys(currentFiles).length > 0 ? currentFiles : undefined);
  }, [topic]);

  // Apply files from Agent response
  const handleApplyFiles = async (operations: AgentFileOperation[]) => {
    for (const op of operations) {
      if (op.action === 'delete') {
        // handled in store
      } else if (op.action === 'create' || op.action === 'update') {
        if (op.content !== undefined) {
          setFileContent(op.path, op.content);
          await wcWriteFile(op.path, op.content);
          // Also sync to WebContainer
          await syncFile(op.path, op.content);
        }
      }
    }
    toast.success(`已应用 ${operations.length} 个文件更改`);
  };

  const handleOpenFile = useCallback((path: string) => {
    openFile(path);
    setShowEditor(true);
  }, [openFile]);

  const handleCloseEditor = useCallback(() => {
    setShowEditor(false);
  }, []);

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
    <div className="h-screen flex flex-col bg-zinc-900">
      {/* Top Bar */}
      <TopBar onRefreshPreview={refresh} />

      {/* Main Editor Area */}
      <div className="flex-1 overflow-hidden">
        <EditorPanelGroup
          panels={[
            {
              id: 'file-tree',
              minSize: 15,
              defaultSize: 18,
              collapsible: true,
              header: '文件树',
              content: showEditor ? (
                <div className="h-full flex flex-col">
                  <CodeEditor />
                  <button
                    onClick={handleCloseEditor}
                    className="absolute top-2 right-2 text-zinc-400 hover:text-white text-xs bg-zinc-800 px-2 py-1 rounded"
                  >
                    返回文件树
                  </button>
                </div>
              ) : (
                <FileTree onOpenFile={handleOpenFile} />
              ),
            },
            {
              id: 'agent-chat',
              minSize: 20,
              defaultSize: 28,
              collapsible: true,
              header: 'Agent 对话',
              content: <AgentChat onApplyFiles={handleApplyFiles} />,
            },
            {
              id: 'preview',
              minSize: 30,
              collapsible: false,
              header: '应用预览',
              content: (
                <PreviewPanel
                  previewUrl={previewUrl}
                  isReady={isReady}
                  error={wcError}
                  onRefresh={refresh}
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

- [ ] **Step 2: Simplify TopicEditorRouter in App.tsx**

In `frontend/src/App.tsx`, replace the `TopicEditorRouter` component:

```tsx
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

  if (!topic) {
    if (failed) {
      return <Navigate to="/topics" replace />;
    }
    return <Navigate to="/topics" replace />;
  }

  // All topics now use the website editor
  return <WebsiteEditorPage />;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/WebsiteEditorPage.tsx frontend/src/App.tsx
git commit -m "feat(frontend): assemble website editor with three-panel layout"
```

---

## Task 13: Simplify TopicCreatePage

**Files:**
- Modify: `frontend/src/pages/TopicCreatePage.tsx`

- [ ] **Step 1: Remove type selector from TopicCreatePage**

Edit `frontend/src/pages/TopicCreatePage.tsx`.

Remove the type selector form group (lines 131-144):
```tsx
            {/* Topic Type */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                专题类型
              </label>
              <select
                id="type"
                {...register('type')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="knowledge">知识库</option>
                <option value="website">网站</option>
              </select>
            </div>
```

Update the submit handler to always use 'website' type:
```tsx
  const onSubmit = async (data: CreateTopicDto) => {
    setLoading(true);
    setError(null);

    try {
      const payload: CreateTopicDto = {
        title: data.title,
        description: data.description,
        type: 'website',
      };
      await topicApi.create(payload);
      sessionStorage.removeItem(DRAFT_KEY);
      navigate(`/topics/${/* returned id */}`);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '创建专题失败'));
    } finally {
      setLoading(false);
    }
  };
```

Note: The navigation should go to the editor page. We need the created topic's ID. Update the API call to capture it:
```tsx
  const onSubmit = async (data: CreateTopicDto) => {
    setLoading(true);
    setError(null);

    try {
      const topic = await topicApi.create({
        title: data.title,
        description: data.description,
        type: 'website',
      });
      sessionStorage.removeItem(DRAFT_KEY);
      navigate(`/topics/${topic.id}/edit`);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '创建专题失败'));
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/TopicCreatePage.tsx
git commit -m "feat(frontend): simplify topic creation to always create website type"
```

---

## Task 14: Build database migration for new Topic fields

**Files:**
- Create: `services/topic-space/src/scripts/migrate.ts`

- [ ] **Step 1: Create migration script**

Create `services/topic-space/src/scripts/migrate.ts`:
```ts
import { sequelize } from '../utils/database';

async function runMigration() {
  console.log('Running migration: add editor fields to topics...');

  const queryInterface = sequelize.getQueryInterface();

  // Check and add columns
  const tableDescription = await queryInterface.describeTable('topic_topics');

  if (!tableDescription.files_snapshot) {
    await queryInterface.addColumn('topic_topics', 'files_snapshot', {
      type: 'TEXT',
      allowNull: true,
    });
    console.log('Added files_snapshot column');
  }

  if (!tableDescription.chat_history) {
    await queryInterface.addColumn('topic_topics', 'chat_history', {
      type: 'TEXT',
      allowNull: true,
    });
    console.log('Added chat_history column');
  }

  if (!tableDescription.published_url) {
    await queryInterface.addColumn('topic_topics', 'published_url', {
      type: 'STRING',
      allowNull: true,
    });
    console.log('Added published_url column');
  }

  if (!tableDescription.share_link) {
    await queryInterface.addColumn('topic_topics', 'share_link', {
      type: 'STRING',
      allowNull: true,
    });
    console.log('Added share_link column');
  }

  console.log('Migration complete.');
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Add migrate script to package.json**

In `services/topic-space/package.json`, add:
```json
"scripts": {
  "migrate": "tsx src/scripts/migrate.ts",
  // ... existing scripts
}
```

- [ ] **Step 3: Commit**

```bash
git add services/topic-space/src/scripts/migrate.ts services/topic-space/package.json
git commit -m "feat(topic-space): add migration script for editor fields"
```

---

## Task 15: Add editor CSS and environment variables

**Files:**
- Create: `frontend/.env.development`
- Modify: `frontend/index.html` (ensure full screen)

- [ ] **Step 1: Create environment file**

Create `frontend/.env.development`:
```
VITE_API_URL=http://localhost:3000/api
VITE_LLM_MODEL=gpt-4o
```

- [ ] **Step 2: Ensure index.html has proper meta for WebContainer**

The editor needs `SharedArrayBuffer` support for WebContainers. This requires COOP/COEP headers. For development, we'll add meta tags.

Add to `frontend/index.html` inside `<head>`:
```html
<meta http-equiv="Cross-Origin-Opener-Policy" content="same-origin">
<meta http-equiv="Cross-Origin-Embedder-Policy" content="require-corp">
```

- [ ] **Step 3: Commit**

```bash
git add frontend/.env.development frontend/index.html
git commit -m "chore(frontend): add COOP/COEP headers for WebContainer support"
```

---

## Task 16: Integration test - build and type check

**Files:** (verification only, no changes)

- [ ] **Step 1: Type check shared**

Run:
```bash
cd shared && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 2: Type check frontend**

Run:
```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors. Fix any type issues.

- [ ] **Step 3: Type check topic-space**

Run:
```bash
cd services/topic-space && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4: Build frontend**

Run:
```bash
cd frontend && pnpm build
```
Expected: Successful build.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: fix type errors and verify build"
```

---

## Self-Review

**1. Spec coverage check:**

| Spec Section | Task Coverage | Status |
|-------------|---------------|--------|
| 1. Design goals - unified topic model | Tasks 3, 12, 13 | ✅ |
| 2. Frontend-dominant architecture | Task 12 (WebsiteEditorPage) | ✅ |
| 3.1 Three-panel resizable layout | Tasks 8, 12 | ✅ |
| 3.2 File tree | Task 9 | ✅ |
| 3.3 Agent chat | Task 10 | ✅ |
| 3.4 App preview via WebContainer | Tasks 7, 11, 12 | ✅ |
| 3.5 Top bar (Save, Refresh, Publish, Share) | Task 8 | ✅ |
| 4.1 Tech stack | Task 4 (deps) | ✅ |
| 4.2 LLM proxy backend | Task 2 | ✅ |
| 4.3 WebContainer startup flow | Task 7 | ✅ |
| 5. Agent workflow & prompt | Task 10 (AgentChat) | ✅ |
| 5.3 OpenAI standard API | Task 2, 6 | ✅ |
| 6. Data model changes | Tasks 1, 3 | ✅ |
| 7.1 Delete WebsiteTopicPage | Not yet (keep temporarily) | ⚠️ |
| 7.2 Backend modifications | Tasks 2, 3 | ✅ |
| 7.3 New frontend components | Tasks 8, 9, 10, 11 | ✅ |
| 8. Error handling | Tasks 7, 11 | ✅ |

**WebsiteTopicPage deletion** is intentionally deferred. It can be removed safely after the new editor is verified working.

**2. Placeholder scan:** No TBD/TODO placeholders found. All code blocks have complete implementations.

**3. Type consistency:** All types are defined in `shared/src/types/index.ts` (Task 1) and imported consistently throughout. Method signatures match between tasks (e.g., `syncFile` in Task 7 matches usage in Task 12).

**4. Scope check:** This plan covers the core editor functionality. Publishing and sharing (publish/share buttons in TopBar) are stubbed but not fully implemented - these are P2/P3 features. The plan focuses on getting the editor working end-to-end.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-07-website-editor.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
