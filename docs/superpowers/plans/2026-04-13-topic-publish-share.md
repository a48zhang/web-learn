# Topic Publish & Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Publish button in the editor that builds the project in WebContainer, uploads dist to OSS, updates topic status to "published", and provides a public shareable link at `/p/:id`.

**Architecture:** Publish button in EditorActions → `publishPipeline.ts` runs `npm run build` in WebContainer, reads `dist/`, creates tarball, uploads to OSS via a new `publish` presign operation, calls `topicApi.updateStatus('published')`. A new public route `/p/:id` downloads the published tarball, extracts it, rewrites asset URLs to Blob URLs, and renders in an iframe via srcdoc.

**Tech Stack:** React, WebContainer API, OSS presigned URLs, Blob URLs, React Router, existing `topicApi.updateStatus`, `createTarball`/`extractTarball` from `tarUtils.ts`.

---

### Task 1: Backend — Add `publish` op to presign endpoint

**Files:**
- Modify: `services/topic-space/src/controllers/gitPresignController.ts`

**Why this first:** The frontend publish pipeline depends on `topicGitApi.getPresign(topicId, 'publish')` returning a presigned URL for the published tarball.

- [ ] **Step 1: Add `publish` case to gitPresignController**

Add `'publish'` to the allowed ops, generate a distinct OSS key `topics/{id}-published.tar.gz`, allow editors only:

```typescript
// services/topic-space/src/controllers/gitPresignController.ts
// Change line 18 from:
if (!['upload', 'download'].includes(op)) {
// To:
if (!['upload', 'download', 'publish'].includes(op)) {

// Change line 38 from:
const ossKey = `${OSS_PREFIX}/${topicId}.tar.gz`;
// To:
const ossKey = op === 'publish'
  ? `${OSS_PREFIX}/${topicId}-published.tar.gz`
  : `${OSS_PREFIX}/${topicId}.tar.gz`;
```

Add the publish permission check (only editors can publish):

```typescript
// After line 36 (after the upload check), add:
if (op === 'publish' && !isEditor) {
  return res.status(403).json({ success: false, error: 'Access denied' });
}
```

- [ ] **Step 2: Commit**

```bash
git add services/topic-space/src/controllers/gitPresignController.ts
git commit -m "feat(topic-space): add publish presign op for published dist tarball"
```

**Verification:** Start the backend, call `GET /api/topics/:id/git/presign?op=publish` as an editor — should return a presigned PUT URL for `topics/{id}-published.tar.gz`.

---

### Task 2: Frontend — Add `publish` to topicGitApi and build pipeline utility

**Files:**
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/utils/readDistFiles.ts`

- [ ] **Step 1: Add `publish` to getPresign type union**

```typescript
// frontend/src/services/api.ts, line 112
// Change from:
getPresign: async (topicId: string, op: 'upload' | 'download'): Promise<...>
// To:
getPresign: async (topicId: string, op: 'upload' | 'download' | 'publish'): Promise<...>
```

- [ ] **Step 2: Create `readDistFiles.ts`**

This utility walks `/home/project/dist/` in WebContainer and returns `Record<string, string>`.

```typescript
// frontend/src/utils/readDistFiles.ts
import { getWebContainer } from '../agent/webcontainer';

export async function readDistFiles(): Promise<Record<string, string>> {
  const wc = getWebContainer();
  if (!wc) throw new Error('WebContainer not initialized');

  const distPath = '/home/project/dist';
  const result: Record<string, string> = {};

  async function walk(dir: string) {
    const entries = await wc.fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        const content = await wc.fs.readFile(fullPath, 'utf-8');
        const relativePath = fullPath.replace('/home/project/', '');
        result[relativePath] = content;
      }
    }
  }

  await walk(distPath);
  return result;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/utils/readDistFiles.ts
git commit -m "feat(frontend): add publish presign op and readDistFiles utility"
```

---

### Task 3: Frontend — Publish pipeline (`publishTopic`)

**Files:**
- Create: `frontend/src/utils/publishPipeline.ts`

- [ ] **Step 1: Create `publishPipeline.ts`**

This function orchestrates: build → read dist → tarball → upload → status update.

```typescript
// frontend/src/utils/publishPipeline.ts
import { getWebContainer } from '../agent/webcontainer';
import { topicGitApi, topicApi } from '../services/api';
import { createTarball } from './tarUtils';
import { readDistFiles } from './readDistFiles';

export async function publishTopic(
  topicId: string,
  onProgress?: (phase: 'building' | 'uploading') => void
): Promise<{ publishedUrl: string; shareLink: string }> {
  const wc = getWebContainer();
  if (!wc) throw new Error('WebContainer not initialized');

  // 1. Build
  onProgress?.('building');
  const buildProcess = await wc.spawn('npm', ['run', 'build'], { cwd: '/home/project' });
  const buildOutput: string[] = [];
  buildProcess.output.pipeTo(
    new WritableStream({ write: (data) => buildOutput.push(data) })
  );
  const exitCode = await buildProcess.exit;
  if (exitCode !== 0) {
    throw new Error(`Build failed (exit code: ${exitCode})`);
  }

  // 2. Read dist files
  const distFiles = await readDistFiles();
  if (Object.keys(distFiles).length === 0) {
    throw new Error('Build produced no output files');
  }

  // 3. Create tarball and upload
  onProgress?.('uploading');
  const tarball = createTarball(distFiles);
  const { url } = await topicGitApi.getPresign(topicId, 'publish');

  const response = await fetch(url, {
    method: 'PUT',
    body: new Blob([tarball], { type: 'application/gzip' }),
  });
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  // 4. Update status to published
  const updatedTopic = await topicApi.updateStatus(topicId, { status: 'published' });

  return {
    publishedUrl: updatedTopic.publishedUrl ?? '',
    shareLink: updatedTopic.shareLink ?? '',
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/utils/publishPipeline.ts
git commit -m "feat(frontend): add publishTopic pipeline — build, upload, status update"
```

---

### Task 4: Frontend — PublishShareDialog component

**Files:**
- Create: `frontend/src/components/PublishShareDialog.tsx`

- [ ] **Step 1: Create the dialog component**

This dialog shows publish progress (building/uploading/success/error) and the share link with a copy button.

```tsx
// frontend/src/components/PublishShareDialog.tsx
import { useState } from 'react';
import { publishTopic } from '../utils/publishPipeline';
import { toast } from '../stores/useToastStore';

interface PublishShareDialogProps {
  topicId: string;
  onClose: () => void;
  onPublished: (shareLink: string, publishedUrl: string) => void;
}

export default function PublishShareDialog({ topicId, onClose, onPublished }: PublishShareDialogProps) {
  const [phase, setPhase] = useState<'building' | 'uploading' | 'success' | 'error'>('building');
  const [error, setError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [publishedUrl, setPublishedUrl] = useState('');

  const handlePublish = async () => {
    try {
      const result = await publishTopic(topicId, (p) => setPhase(p));
      setShareLink(result.shareLink);
      setPublishedUrl(result.publishedUrl);
      setPhase('success');
      onPublished(result.shareLink, result.publishedUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPhase('error');
    }
  };

  const handleCopyLink = async () => {
    const link = shareLink || `${window.location.origin}/p/${topicId}`;
    await navigator.clipboard.writeText(link);
    toast.success('链接已复制到剪贴板');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[#252526] border border-[#3c3c3c] rounded-lg shadow-xl w-[420px] max-w-[90vw] p-5">
        <h3 className="text-[14px] font-semibold text-white mb-4">发布专题</h3>

        {(phase === 'building' || phase === 'uploading') && (
          <div className="flex items-center gap-3 text-zinc-300 text-[13px]">
            <svg className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{phase === 'building' ? '正在构建项目...' : '正在上传并发布...'}</span>
          </div>
        )}

        {phase === 'success' && (
          <div className="space-y-3">
            <div className="text-green-400 text-[13px] flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              发布成功！
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareLink || `${window.location.origin}/p/${topicId}`}
                className="flex-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded px-2 py-1.5 text-[12px] text-zinc-300"
              />
              <button
                onClick={handleCopyLink}
                className="text-[12px] bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded"
              >
                复制
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-3">
            <div className="text-red-400 text-[13px]">发布失败：{error}</div>
            <div className="flex gap-2">
              <button
                onClick={handlePublish}
                className="text-[12px] bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded"
              >
                重试
              </button>
              <button
                onClick={onClose}
                className="text-[12px] bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-3 py-1.5 rounded"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/PublishShareDialog.tsx
git commit -m "feat(frontend): add PublishShareDialog with progress and copy link"
```

---

### Task 5: Frontend — Add Publish button to EditorActions

**Files:**
- Modify: `frontend/src/components/editor/EditorActions.tsx`

- [ ] **Step 1: Add Publish button and dialog trigger**

```typescript
// frontend/src/components/editor/EditorActions.tsx
// Add imports at the top:
import { useState } from 'react';  // already imported
import PublishShareDialog from './PublishShareDialog';

// Add state inside the component (after line 17):
const [showPublishDialog, setShowPublishDialog] = useState(false);
const [publishing, setPublishing] = useState(false);

// Add handler (after handleSave):
const handlePublish = () => {
  setPublishing(true);
  setShowPublishDialog(true);
};

const handlePublished = (_shareLink: string, _publishedUrl: string) => {
  setPublishing(false);
  markSaved();
  toast.success('发布成功');
};

// Add the Publish button in the return JSX, between the refresh button and the save button:
// After the refresh button (line 60), before the save button (line 62):
      <button
        type="button"
        onClick={handlePublish}
        disabled={publishing}
        className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center min-w-[60px]"
      >
        发布
      </button>

// Add the dialog at the end of the return JSX, before the closing </div>:
      {showPublishDialog && (
        <PublishShareDialog
          topicId={topicId}
          onClose={() => { setShowPublishDialog(false); setPublishing(false); }}
          onPublished={handlePublished}
        />
      )}
```

The full return block becomes:

```tsx
return (
    <div className="flex items-center justify-end gap-3 h-full">
      <div className="hidden sm:flex">
        <SaveIndicator topicId={topicId} />
      </div>

      <button
        type="button"
        onClick={onRefreshPreview}
        className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 w-8 h-8 flex items-center justify-center rounded-md border border-gray-300 dark:border-zinc-700 transition-colors outline-none"
        title="刷新预览 (Refresh Preview)"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      <button
        type="button"
        onClick={handlePublish}
        disabled={publishing}
        className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center min-w-[60px]"
      >
        发布
      </button>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center min-w-[70px]"
      >
        {saving ? '保存中...' : '保存代码'}
      </button>

      {showPublishDialog && (
        <PublishShareDialog
          topicId={topicId}
          onClose={() => { setShowPublishDialog(false); setPublishing(false); }}
          onPublished={handlePublished}
        />
      )}
    </div>
  );
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/editor/EditorActions.tsx
git commit -m "feat(frontend): add Publish button and dialog to EditorActions"
```

---

### Task 6: Frontend — Published topic page (`/p/:id`)

**Files:**
- Create: `frontend/src/pages/PublishedTopicPage.tsx`
- Create: `frontend/src/utils/rewriteAssetUrls.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `rewriteAssetUrls.ts`**

Utility that extracts tarball, creates Blob URLs for assets, and rewrites index.html.

```typescript
// frontend/src/utils/rewriteAssetUrls.ts
import { extractTarball } from './tarUtils';

const MIME_MAP: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

function getMime(path: string): string {
  const ext = path.slice(path.lastIndexOf('.'));
  return MIME_MAP[ext] || 'application/octet-stream';
}

export async function buildPublishedHtml(buffer: ArrayBuffer): Promise<string> {
  const files = extractTarball(buffer);
  const indexHtml = files['index.html'];
  if (!indexHtml) throw new Error('index.html not found in published files');

  // Create Blob URLs for all non-HTML assets
  const blobUrls: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    if (path === 'index.html') continue;
    const mime = getMime(path);
    const blob = new Blob([content], { type: mime });
    blobUrls[path] = URL.createObjectURL(blob);
  }

  // Rewrite asset references in index.html
  let html = indexHtml;
  for (const [path, blobUrl] of Object.entries(blobUrls)) {
    // Handle both absolute (/assets/foo) and relative (assets/foo) paths
    html = html.replaceAll(`"/${path}"`, `"${blobUrl}"`);
    html = html.replaceAll(`'/${path}'`, `'${blobUrl}'`);
    html = html.replaceAll(`href="/${path}"`, `href="${blobUrl}"`);
    html = html.replaceAll(`src="/${path}"`, `src="${blobUrl}"`);
  }

  return html;
}
```

- [ ] **Step 2: Create `PublishedTopicPage.tsx`**

Public page that downloads the published tarball and renders it via iframe with srcdoc.

```tsx
// frontend/src/pages/PublishedTopicPage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { topicGitApi, topicApi } from '../services/api';
import { buildPublishedHtml } from '../utils/rewriteAssetUrls';
import type { Topic } from '@web-learn/shared';

export default function PublishedTopicPage() {
  const { id } = useParams<{ id: string }>();
  const [srcdoc, setSrcdoc] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'unpublished'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        // Check topic is published
        const topic = await topicApi.getById(id);
        if (topic.status !== 'published') {
          setStatus('unpublished');
          return;
        }

        // Download published tarball
        const { url } = await topicGitApi.getPresign(id, 'download');
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Download failed: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const html = await buildPublishedHtml(buffer);
        setSrcdoc(html);
        setStatus('ready');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : '加载失败');
        setStatus('error');
      }
    };

    load();
  }, [id]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
        <div className="text-center text-zinc-400">
          <svg className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-[14px]">加载中...</p>
        </div>
      </div>
    );
  }

  if (status === 'unpublished') {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
        <div className="text-center text-zinc-400 max-w-md px-6">
          <p className="text-lg mb-2">该专题尚未发布</p>
          <a href="/" className="text-blue-400 hover:text-blue-300 text-sm">返回首页</a>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
        <div className="text-center text-zinc-400 max-w-md px-6">
          <p className="text-lg mb-2">加载失败</p>
          <p className="text-sm text-zinc-500 mb-4">{errorMessage}</p>
          <a href="/" className="text-blue-400 hover:text-blue-300 text-sm">返回首页</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#1e1e1e]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3c3c3c] bg-[#252526]">
        <a href="/" className="text-[13px] text-zinc-400 hover:text-white transition-colors">
          ← 返回首页
        </a>
        <span className="text-[12px] text-zinc-500">Published Topic</span>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 overflow-hidden">
        {srcdoc && (
          <iframe
            srcdoc={srcdoc}
            className="w-full h-full border-0 bg-white"
            title="Published Topic"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Register route in App.tsx**

Add the public route before the 404 catch-all. Add the import:

```typescript
// frontend/src/App.tsx
// Add import at the top:
import PublishedTopicPage from './pages/PublishedTopicPage';

// Add route before the 404 catch-all (before line 108):
          <Route path="/p/:id" element={<PublishedTopicPage />} />
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/rewriteAssetUrls.ts frontend/src/pages/PublishedTopicPage.tsx frontend/src/App.tsx
git commit -m "feat(frontend): add public published topic page at /p/:id with asset rewriting"
```

---

### Task 7: Integration — End-to-end publish flow verification

**Files:** No code changes — manual verification.

- [ ] **Step 1: Start the dev environment**

```bash
pnpm dev
```

- [ ] **Step 2: Verify the Publish button**

1. Navigate to `/topics/:id/edit` for any topic with a valid React project
2. Confirm the "发布" button appears between the refresh and save buttons
3. Click "发布" — dialog should open with "正在构建项目..."
4. Wait for build → upload → success states
5. Confirm the share link is displayed with a copy button
6. Copy the link and open it in a new tab — should show the published site

- [ ] **Step 3: Verify the public page**

1. Open `/p/:id` for a published topic
2. Confirm the page loads without authentication
3. Confirm the iframe renders the built site correctly
4. Open `/p/:id` for an unpublished topic — should show "尚未发布" message

- [ ] **Step 4: Commit any fixes found during verification**
