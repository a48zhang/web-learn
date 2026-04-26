# Agent WebContainer Filestore Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-04-25-agent-webcontainer-filestore-hardening-design.md`

**Goal:** Remove split-brain file state between WebContainer, EditorStore, agent tools, save/upload, and publish. WebContainer remains the runtime source of truth, EditorStore becomes a projection/cache, and OSS snapshots are built from synchronized project state.

**Explicit Non-Goals:** Do not change any agent's available tool set. Do not reduce `MAX_TOOL_LOOPS = 1000`. Do not change published-page iframe sandbox behavior.

**Tech Stack:** React 18, TypeScript, Zustand, WebContainer API, Vitest, Testing Library, Express/Sequelize topic-space service, existing custom tar utilities.

---

## File Scope

- Create: `frontend/src/utils/projectPaths.ts`
- Create: `frontend/src/utils/projectPaths.test.ts`
- Create: `frontend/src/services/projectFileService.ts`
- Create: `frontend/src/services/projectFileService.test.ts`
- Modify: `frontend/src/agent/webcontainer.ts`
- Modify: `frontend/src/hooks/useWebContainer.ts`
- Modify: `frontend/src/stores/useEditorStore.ts`
- Modify: `frontend/src/stores/useEditorStore.test.ts`
- Modify: `frontend/src/agent/tools/listFiles.ts`
- Modify: `frontend/src/agent/tools/readFile.ts`
- Modify: `frontend/src/agent/tools/writeFile.ts`
- Modify: `frontend/src/agent/tools/createFile.ts`
- Modify: `frontend/src/agent/tools/deleteFile.ts`
- Modify: `frontend/src/agent/tools/moveFile.ts`
- Modify: `frontend/src/agent/tools/runCommand.ts`
- Modify: `frontend/src/agent/useAgentRuntime.ts`
- Modify: `frontend/src/agent/useAgentRuntime.test.ts`
- Modify: `frontend/src/components/editor/CodeEditor.tsx`
- Modify: `frontend/src/components/editor/FileTree.tsx`
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`
- Modify: `frontend/src/pages/WebsiteEditorPage.test.tsx`
- Modify: `frontend/src/hooks/usePreviewSync.ts`
- Modify: `frontend/src/utils/tarUtils.ts`
- Modify: `frontend/src/utils/rewriteAssetUrls.ts`
- Modify: `frontend/src/utils/readDistFiles.ts`
- Modify: `frontend/src/utils/publishPipeline.ts`
- Modify: `frontend/src/utils/rewriteAssetUrls.test.ts`
- Create or modify: `frontend/src/utils/tarUtils.test.ts`
- Modify: `services/topic-space/src/controllers/topicController.ts`
- Modify: `services/topic-space/tests/topics.test.ts`

---

## Task 1: Add Project Path Normalization

**Files:**
- Create: `frontend/src/utils/projectPaths.ts`
- Create: `frontend/src/utils/projectPaths.test.ts`

- [ ] Add a branded `ProjectPath` type.
- [ ] Implement `normalizeProjectPath(input: string): ProjectPath`.
- [ ] Implement `toWcAbsolutePath(path: ProjectPath): string`.
- [ ] Reject empty input, absolute paths, `.` segments, `..` segments, repeated slash, backslash, and NUL.
- [ ] Normalize leading `./` away.
- [ ] Keep paths root-relative, for example `src/App.tsx`.
- [ ] Add unit tests for accepted and rejected paths.

**Exit Criteria:**
- Every project file path has one canonical representation before it reaches WebContainer, EditorStore, or tar utilities.

---

## Task 2: Harden WebContainer Adapter Paths And Commands

**Files:**
- Modify: `frontend/src/agent/webcontainer.ts`
- Modify or create tests through `frontend/src/services/projectFileService.test.ts` if direct WebContainer adapter mocking is easier there.

- [ ] Replace the current `wcPath(path: string)` behavior with `normalizeProjectPath` + `toWcAbsolutePath`.
- [ ] Reject absolute paths instead of passing them through.
- [ ] Update `wcReadFile`, `wcWriteFile`, `wcCreateFile`, `wcDeleteFile`, `wcMoveFile`, and `wcListFiles` to use normalized paths.
- [ ] Make delete and move emit file-change events, not only write/create.
- [ ] Change `wcSpawnCommand` to spawn with `{ cwd: '/home/project' }` by default.
- [ ] Keep `SAFE_COMMANDS` and keep the existing `MAX_TOOL_LOOPS = 1000` behavior untouched.
- [ ] Add output truncation for `wcSpawnCommand` result content so command output cannot flood LLM context.

**Exit Criteria:**
- Tools cannot write outside `/home/project`.
- Agent command execution runs from the same project root that install/dev/build uses.

---

## Task 3: Introduce Project File Service

**Files:**
- Create: `frontend/src/services/projectFileService.ts`
- Create: `frontend/src/services/projectFileService.test.ts`
- Modify: `frontend/src/stores/useEditorStore.ts` as needed for projection-only setters.

- [ ] Implement a file service facade around WebContainer file operations.
- [ ] Expose `readProjectFile`, `writeProjectFile`, `createProjectFile`, `deleteProjectPath`, `moveProjectPath`, `listProjectFiles`, `rescanProjectFiles`, and `getProjectSnapshot`.
- [ ] Ensure every mutation writes WebContainer first, then updates EditorStore projection.
- [ ] Ensure failures do not mutate EditorStore.
- [ ] Ensure `rescanProjectFiles` ignores `node_modules` and other generated dependency directories.
- [ ] Ensure `getProjectSnapshot` returns the synchronized project state, not stale EditorStore-only state.
- [ ] Add tests proving write/create/delete/move update EditorStore only after WebContainer success.
- [ ] Add tests proving rescan picks up files created by commands.

**Exit Criteria:**
- There is one frontend file API for runtime, UI, agent tools, save, and publish to share.

---

## Task 4: Convert EditorStore To Projection Semantics

**Files:**
- Modify: `frontend/src/stores/useEditorStore.ts`
- Modify: `frontend/src/stores/useEditorStore.test.ts`

- [ ] Add `fileRevision`, `lastSavedRevision`, and `saveInFlightRevision`.
- [ ] Add internal projection methods used by the file service.
- [ ] Mark existing direct file mutation methods as internal or replace callers so UI no longer calls them directly.
- [ ] Rebuild `fileTree` when setting content for a new path.
- [ ] When deleting the active file, clear `activeFile` or select a remaining open file.
- [ ] When renaming/moving paths, update `openFiles` and `activeFile`.
- [ ] Increment `fileRevision` on every file projection change.
- [ ] Keep local backup parsing compatibility with current `snapshot-<topicId>` and `local-backup-<topicId>` formats.
- [ ] Add tests for active-file delete, rename tab updates, new-file tree rebuild, and revision increments.

**Exit Criteria:**
- EditorStore no longer independently creates a second filesystem reality.

---

## Task 5: Refactor Agent File Tools To Use File Service

**Files:**
- Modify: `frontend/src/agent/tools/listFiles.ts`
- Modify: `frontend/src/agent/tools/readFile.ts`
- Modify: `frontend/src/agent/tools/writeFile.ts`
- Modify: `frontend/src/agent/tools/createFile.ts`
- Modify: `frontend/src/agent/tools/deleteFile.ts`
- Modify: `frontend/src/agent/tools/moveFile.ts`
- Modify: `frontend/src/agent/tools/runCommand.ts`

- [ ] Make `list_files` read through `listProjectFiles`.
- [ ] Make `read_file` read through `readProjectFile`.
- [ ] Make write/create/delete/move call corresponding project file service methods.
- [ ] Make `run_command` call `wcSpawnCommand` with project cwd and then `rescanProjectFiles`.
- [ ] Preserve current tool names, schemas, and availability.
- [ ] Preserve current command allowlist unless a test proves a command is broken.
- [ ] Return `isError: true` for validation and service failures.

**Exit Criteria:**
- Agent tools no longer read or write global EditorStore directly.
- Command-created files become visible to save and file tree.

---

## Task 6: Fix Agent Tool UI Error State

**Files:**
- Modify: `frontend/src/agent/useAgentRuntime.ts`
- Modify: `frontend/src/agent/useAgentRuntime.test.ts`

- [ ] Capture the full `AgentToolResult` from `executeTool`.
- [ ] Keep sending tool result content back to the model.
- [ ] If `result.isError` is true, set the visible tool action state to `error`.
- [ ] If the tool succeeds, set state to `success`.
- [ ] Do not change `MAX_TOOL_LOOPS = 1000`.
- [ ] Add a regression test where a tool returns `{ isError: true }` and UI state becomes `error`.
- [ ] Add a regression test proving `MAX_TOOL_LOOPS` remains `1000` if it is exported/testable, or assert behavior indirectly without changing the constant.

**Exit Criteria:**
- The UI no longer shows failed tools as completed.

---

## Task 7: Add Topic-Aware WebContainer Sessions

**Files:**
- Modify: `frontend/src/hooks/useWebContainer.ts`
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`
- Modify: `frontend/src/pages/WebsiteEditorPage.test.tsx`

- [ ] Change `init(initialFiles)` to `initProject(topicId, initialFiles)` or add a compatible wrapper while migrating.
- [ ] Track the current topic session in `useWebContainer`.
- [ ] On topic change, kill the old dev process.
- [ ] On topic change, clear `/home/project` before writing the new snapshot.
- [ ] On topic change, reset `previewUrl`, dev-server state, and project readiness state.
- [ ] Ensure stale `server-ready` events cannot update previewUrl for a newer topic session.
- [ ] Ensure `setupNpmRegistry` runs in a deterministic order before the first install attempt.
- [ ] If install or dev startup fails, allow later retry instead of permanently setting a global started flag.
- [ ] In `WebsiteEditorPage`, reset `filesLoaded` and topic load state when `id` changes.
- [ ] Add tests for topic A to topic B switching: old files are cleared, previewUrl is reset, and `initProject` receives B files only.

**Exit Criteria:**
- Opening a second topic in the same browser session cannot inherit files, preview URL, or dev-server state from the first topic.

---

## Task 8: Convert UI File Operations To File Service

**Files:**
- Modify: `frontend/src/components/editor/CodeEditor.tsx`
- Modify: `frontend/src/components/editor/FileTree.tsx`
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`
- Modify: `frontend/src/hooks/usePreviewSync.ts`

- [ ] Make CodeEditor save changes through `writeProjectFile`.
- [ ] Do not call `setFileContent` before WebContainer write succeeds.
- [ ] Make FileTree new-file action call `createProjectFile` instead of `useEditorStore.createFile`.
- [ ] Make WebsiteEditorPage delete action call `deleteProjectPath` instead of separate WebContainer/store calls.
- [ ] Make preview sync consume the EditorStore projection or file service consistently; avoid double-source races.
- [ ] Surface user-facing toast errors for UI file operation failures.

**Exit Criteria:**
- Manual editor actions follow the same write path as agent tools.

---

## Task 9: Fix Save And Recovery Correctness

**Files:**
- Modify: `frontend/src/stores/useEditorStore.ts`
- Modify: `frontend/src/hooks/useAutoSave.ts` if needed
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`
- Modify: `frontend/src/stores/useEditorStore.test.ts`
- Modify: `frontend/src/pages/WebsiteEditorPage.test.tsx`

- [ ] Make `saveToOSS` build its upload tarball from `getProjectSnapshot`.
- [ ] Capture `savingRevision` when save starts.
- [ ] After upload succeeds, call `markSaved` only when current `fileRevision === savingRevision`.
- [ ] If edits occurred during upload, leave `hasUnsavedChanges` true.
- [ ] Keep explicit save force-upload behavior.
- [ ] Keep local backup before cloud upload.
- [ ] Ensure local recovery restore enters `initProject(topicId, files)` and does not only call `loadSnapshot`.
- [ ] Add a test where upload starts, a file changes before upload resolves, and dirty state remains true.
- [ ] Add a test where local recovery initializes WebContainer project.

**Exit Criteria:**
- A successful upload of an older snapshot cannot hide newer unsaved edits.

---

## Task 10: Support Binary-Safe Tar And Publish

**Files:**
- Modify: `frontend/src/utils/tarUtils.ts`
- Create or modify: `frontend/src/utils/tarUtils.test.ts`
- Modify: `frontend/src/utils/readDistFiles.ts`
- Modify: `frontend/src/utils/rewriteAssetUrls.ts`
- Modify: `frontend/src/utils/rewriteAssetUrls.test.ts`
- Modify: `frontend/src/utils/publishPipeline.ts`

- [ ] Change tar content model from `Record<string, string>` to support `string | Uint8Array`.
- [ ] Preserve exact bytes for binary files.
- [ ] Reject unsafe paths on create and extract.
- [ ] Throw on unsupported long paths instead of truncating silently.
- [ ] Make `readDistFiles` read binary bytes, not UTF-8 strings.
- [ ] Make `buildPublishedHtml` create asset Blobs from bytes.
- [ ] Keep text editing flow compatible by decoding known text files only where needed.
- [ ] Add tests for binary round-trip and long-path rejection.
- [ ] Update existing rewrite-asset tests to work with binary-capable tar output.

**Exit Criteria:**
- Published images, fonts, icons, and other binary assets survive build/upload/load.

---

## Task 11: Fix Topic OSS Cleanup

**Files:**
- Modify: `services/topic-space/src/controllers/topicController.ts`
- Modify: `services/topic-space/tests/topics.test.ts`

- [ ] When deleting a topic, call `storageService.delete("topics/<topicId>.tar.gz")`.
- [ ] Also call `storageService.delete("topics/<topicId>-published.tar.gz")`.
- [ ] Keep `deleteDir("topics/<topicId>/")` for legacy prefix cleanup.
- [ ] Treat missing storage objects as non-fatal.
- [ ] Add backend tests for both exact key deletes and legacy prefix cleanup.

**Exit Criteria:**
- Deleting a topic cleans up the actual objects produced by current upload/publish flows.

---

## Task 12: Final Verification

**Commands:**

- [ ] Run frontend typecheck:

```bash
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```

- [ ] Run focused frontend tests:

```bash
cd frontend && npm test -- src/utils/projectPaths.test.ts src/services/projectFileService.test.ts src/stores/useEditorStore.test.ts src/agent/useAgentRuntime.test.ts src/pages/WebsiteEditorPage.test.tsx src/utils/rewriteAssetUrls.test.ts
```

- [ ] Run topic-space tests:

```bash
cd services/topic-space && npm test -- topics.test.ts
```

- [ ] Run full frontend tests if focused tests pass:

```bash
cd frontend && npm test
```

**Manual Smoke Test:**

- [ ] Open topic A, create/edit/delete files manually, save, reload.
- [ ] Run agent file tools and `run_command`; confirm generated files appear in file tree and save.
- [ ] Switch to topic B without refreshing; confirm topic A files and preview URL are gone.
- [ ] Trigger save while editing again before upload resolves; confirm unsaved indicator stays visible.
- [ ] Publish a project with an image or font asset; confirm asset renders after publish.

---

## Rollout Notes

- [ ] Implement Tasks 1-6 first to remove the highest-risk split-brain file tool behavior.
- [ ] Implement Tasks 7-9 together or in one branch; partial topic-session migration can make stale project state harder to reason about.
- [ ] Implement Task 10 after save correctness is stable, because binary tar touches upload and publish behavior.
- [ ] Implement Task 11 independently if backend cleanup can be shipped sooner.

## Risks

- [ ] Converting EditorStore to projection semantics touches many callers; keep file service APIs small and test every caller.
- [ ] Clearing `/home/project` on topic switch must not race with an old dev process; kill process before deleting files.
- [ ] Binary tar support can break existing string-only assumptions; keep compatibility helpers where text callers still expect strings.
- [ ] Save revision guard changes UI semantics: a successful upload can leave the editor dirty if newer edits happened during upload. This is intentional.
