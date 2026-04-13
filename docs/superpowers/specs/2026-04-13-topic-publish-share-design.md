# Topic Publish & Share Design

**Goal:** Allow topic editors to publish a topic by building it in WebContainer, uploading the dist files to OSS, and generating a public shareable link that requires no login.

**Architecture:**
1. **Publish trigger** — "Publish" button in `EditorActions` (right of Save). Runs `npm run build` in WebContainer, reads `dist/` output, uploads tarball to OSS.
2. **Status transition** — Calls `PATCH /topics/:id/status` with `{ status: 'published' }`. Backend populates `publishedUrl` and `shareLink`.
3. **Public view** — New route `/p/:id` (no AppShell, no auth) downloads OSS tarball, extracts files, serves via Blob URL in an iframe.

**Tech Stack:** React, WebContainer API, OSS presigned URLs, existing `topicApi.updateStatus`, Blob URLs, React Router public routes.

---

## 1. UI Changes — EditorActions

Add a **Publish** button to the right of the existing Save button in `EditorActions.tsx`.

**States:**
- Idle: "Publish" button (purple/violet accent)
- Building: Spinner + "Building..." (npm run build in progress)
- Uploading: Spinner + "Publishing..." (OSS upload in progress)
- Success: Show shareable link with copy button
- Error: Red toast + retry option

**Save stays unchanged.** Publish is a separate action: build + upload + status change.

## 2. Build & Upload Pipeline

New module: `frontend/src/utils/publishPipeline.ts`

```typescript
export async function publishTopic(topicId: string): Promise<{ publishedUrl: string; shareLink: string }>
```

Steps (all in one function, sequential):

1. **Build**: `wc.spawn('npm', ['run', 'build'], { cwd: '/home/project' })` — await exit code, fail if non-zero
2. **Read dist**: Walk `/home/project/dist/` recursively via `wc.fs.readdir` + `wc.fs.readFile`, collect `Record<string, string>`
3. **Tarball**: `createTarball(distFiles)` → `Uint8Array`
4. **Upload**: `topicGitApi.getPresign(topicId, 'upload')` → `PUT` to OSS. Note: upload to a *different* OSS key, e.g. `topics/{id}-published.tar` (we'll need a minor backend change for the publish-specific key, or reuse the existing key pattern)
5. **Status update**: `topicApi.updateStatus(topicId, { status: 'published' })` — returns updated topic with `publishedUrl` and `shareLink`

**Build error handling**: If `npm run build` fails, show error toast, don't change status.

## 3. Public View Page

New page: `frontend/src/pages/PublishedTopicPage.tsx`

Route: `/p/:id` (public, no AppShell wrapper)

**Flow:**
1. `GET /topics/:id` via `topicApi.getById` — check `status === 'published'`
2. If not published: show "This topic has not been published" message
3. If published: download tarball from OSS via presigned URL
4. `extractTarball(buffer)` → `Record<string, string>`
5. Find `index.html` in the extracted files
6. Rewrite all relative asset paths (`./assets/...`, `/assets/...`) to Blob URLs
7. Create a single Blob URL for the entire site (index.html with inline asset references)
8. Render `<iframe src={blobUrl}>`

**Wait — Blob URL approach has limitations for multi-file sites.** A better approach:

### Revised Public View: Service Worker + Custom MIME

Actually, the simplest working approach for a multi-file SPA:

1. Extract tarball to `Record<string, string>`
2. Serve `index.html` in the iframe via `srcdoc`
3. Intercept iframe requests via a **data URL with an inline service worker** — but iframes can't register SWs from srcdoc.

### Final Approach: Subresource Rewrite

The most reliable cross-browser approach:

1. Extract tarball
2. For each asset file (CSS, JS), create a Blob URL
3. In `index.html`, rewrite `<script src="/assets/xxx.js">` and `<link href="/assets/xxx.css">` to use the corresponding Blob URLs
4. Set the rewritten HTML as iframe `srcdoc`

This works for standard Vite/webpack SPAs.

## 4. Route Registration

In `App.tsx`, add:
```tsx
<Route path="/p/:id" element={<PublishedTopicPage />} />
```

This route is outside `AppShell` — no sidebar, no auth. Minimal layout: centered iframe with a "Back to Home" link.

## 5. Files Summary

| Action | File | Purpose |
|--------|------|---------|
| Create | `frontend/src/utils/publishPipeline.ts` | Build, read dist, tarball, upload, status update |
| Create | `frontend/src/pages/PublishedTopicPage.tsx` | Public view page with asset rewriting |
| Create | `frontend/src/components/PublishShareDialog.tsx` | Publish progress dialog with share link copy |
| Modify | `frontend/src/components/editor/EditorActions.tsx` | Add Publish button + dialog trigger |
| Modify | `frontend/src/App.tsx` | Add `/p/:id` public route |
| Modify | `frontend/src/agent/webcontainer.ts` | Add `wcReadDir` and recursive dist reader helper |
| Modify | `backend (topic-space)` | Support publish-specific OSS key pattern in presign |

## 6. OSS Key Pattern

Current: `topics/{topicId}.tar.gz` (source code tarball)
Published: `topics/{topicId}-published.tar.gz` (built dist tarball)

**Frontend change**: Add `'publish'` to the `op` union in `topicGitApi.getPresign(topicId, 'publish')`.
**Backend change**: In `gitPresignController.getPresign`, add a `'publish'` case that generates the key as `topics/${topicId}-published.tar.gz` instead of `topics/${topicId}.tar.gz`. Content-Type remains `application/gzip`.

## 7. Asset Rewriting Details (Public Page)

For a standard Vite-built React SPA, the `dist/` output contains:
- `index.html` with `<script type="module" src="/assets/index-HASH.js">` and `<link rel="stylesheet" href="/assets/index-HASH.css">`
- `assets/*.js`, `assets/*.css`, and possibly fonts/images

Rewriting algorithm:
1. Extract tarball → `Record<string, string>` (e.g. `{ 'index.html': '...', 'assets/index-abc.js': '...', 'assets/index-def.css': '...' }`)
2. For each non-HTML asset, create a Blob URL: `URL.createObjectURL(new Blob([content], { type: mimeForExt }))`
3. In `index.html`, replace all `src="/assets/..."` and `href="/assets/..."` with `src="blob:..."` / `href="blob:..."`
4. Also handle `url(/assets/...)` inside CSS files — these are trickier since they're embedded in the CSS Blob URL. For Vite's output, CSS asset references to fonts/images are inlined as base64 data URIs, so this is rarely an issue.
5. Set the rewritten HTML as `<iframe srcdoc={rewrittenHtml}>`

**Known limitation**: Dynamic imports (`import('./chunk.js')`) inside the JS bundles won't resolve because they reference relative paths. For standard single-page React apps built as a single chunk (Vite default), this is not an issue. If the project uses code splitting, dynamic imports will 404. Since the spec says "assume everything is React with no special", this is acceptable.
