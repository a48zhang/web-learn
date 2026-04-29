# Agent Workspace Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the agent, editor UI, WebContainer runtime, preview, and OSS save flow agree on one project workspace state.

**Architecture:** Treat project-root-relative paths as the public contract. Keep WebContainer as the runtime filesystem and EditorStore as a synchronized projection used by UI and persistence. Every file mutation must pass through a shared project file service or must rescan WebContainer before the next agent/save operation.

**Tech Stack:** React 18, TypeScript, Zustand, WebContainer API, Vitest, Testing Library, existing tar utilities.

---

## Scope And Constraints

- Do not expose `/home/project` to the agent prompt or tool schemas.
- Do not change existing tool names.
- Do not reduce `MAX_TOOL_LOOPS`.
- Do not redesign the editor UI.
- Do not rely on command text heuristics to guess whether files changed; rescan after allowed commands that can mutate files.
- Preserve current local recovery formats: `snapshot-<topicId>` and `local-backup-<topicId>`.

## Current Failure Model

- `EditorStore.files` is used by file tree, `read_file`, `list_files`, local backup, and OSS upload.
- WebContainer FS is used by preview, dev server, `run_command`, and runtime file writes.
- `write_file/create_file/delete_file/move_file` currently attempt to update both stores manually.
- `run_command` can mutate WebContainer but does not update EditorStore.
- Loading a new topic writes new files into WebContainer but does not clear stale files from the previous topic.
- Global readiness and dev-server flags are not tied to a topic/session.

## File Structure

- Modify `frontend/src/utils/projectPaths.ts`: keep canonical project-root-relative path helpers.
- Modify `frontend/src/agent/webcontainer.ts`: make WebContainer adapter reject public absolute paths, add project reset and snapshot read helpers.
- Create `frontend/src/services/projectFileService.ts`: central project file API used by agent tools, UI, save, and command rescan.
- Create `frontend/src/services/projectFileService.test.ts`: tests for write/read/delete/move/rescan/snapshot.
- Modify `frontend/src/stores/useEditorStore.ts`: keep projection methods, revision fields, and snapshot load/reset behavior.
- Modify `frontend/src/hooks/useWebContainer.ts`: add topic-aware `initProject(topicId, files)` lifecycle.
- Modify `frontend/src/pages/WebsiteEditorPage.tsx`: call topic-aware init and reset topic load state on `id` change.
- Modify `frontend/src/agent/tools/*.ts`: route every file tool through project file service.
- Modify `frontend/src/agent/tools/runCommand.ts`: rescan project files after command completion.
- Modify `frontend/src/agent/useAgentRuntime.ts`: save after file-service mutation or command rescan changed files.
- Modify `frontend/src/components/editor/CodeEditor.tsx`: write edits through project file service.
- Modify `frontend/src/components/editor/FileTree.tsx`: create/delete/move through project file service.
- Modify `frontend/src/hooks/usePreviewSync.ts`: consume one consistent projection.
- Modify `frontend/src/utils/tarUtils.ts` tests if path validation requires coverage.

---

## Task 1: Lock The Public Path Contract

**Files:**
- Modify: `frontend/src/utils/projectPaths.ts`
- Modify: `frontend/src/utils/projectPaths.test.ts`
- Modify: `frontend/src/agent/systemPrompts.ts`
- Modify: `frontend/src/agent/systemPrompts.test.ts`
- Modify: `frontend/src/agent/tools/projectToolPath.ts`
- Modify: `frontend/src/agent/tools/projectToolPath.test.ts`

- [ ] Ensure `normalizeProjectPath(input)` accepts `src/App.tsx` and normalizes `./src/App.tsx` to `src/App.tsx`.
- [ ] Ensure it rejects `/home/project/src/App.tsx`, `/src/App.tsx`, `src/../App.tsx`, `src//App.tsx`, backslashes, NUL, `.`, and `..`.
- [ ] Ensure system prompt says “项目根目录” and “项目根相对路径”, and does not describe the workspace as `/home/project`.
- [ ] Ensure each tool schema says paths are project-root-relative and absolute paths are invalid.
- [ ] Run:

```bash
cd frontend && npm test -- --run src/utils/projectPaths.test.ts src/agent/systemPrompts.test.ts src/agent/tools/projectToolPath.test.ts
```

Expected: all tests pass.

## Task 2: Add WebContainer Snapshot And Reset APIs

**Files:**
- Modify: `frontend/src/agent/webcontainer.ts`
- Modify: `frontend/src/agent/webcontainer.test.ts`

- [ ] Export an internal `PROJECT_ROOT` constant with value `/home/project`.
- [ ] Replace public path resolution with `normalizeProjectPath` + `toWcAbsolutePath`; only adapter internals may use `PROJECT_ROOT`.
- [ ] Add `wcResetProject(files: Record<string, string>): Promise<void>`.
- [ ] Implement reset by listing project-root entries, removing each entry, recreating directories, then writing the supplied snapshot.
- [ ] Add `wcGetProjectSnapshot(): Promise<Record<string, string>>`.
- [ ] Make snapshot walk ignore `node_modules`, `dist`, `.vite`, and `.git`.
- [ ] Ensure write/create/delete/move emit file-change events.
- [ ] Add tests proving reset removes stale files and snapshot returns only relative paths.
- [ ] Run:

```bash
cd frontend && npm test -- --run src/agent/webcontainer.test.ts
```

Expected: all WebContainer adapter tests pass.

## Task 3: Introduce Project File Service

**Files:**
- Create: `frontend/src/services/projectFileService.ts`
- Create: `frontend/src/services/projectFileService.test.ts`
- Modify: `frontend/src/stores/useEditorStore.ts`
- Modify: `frontend/src/stores/useEditorStore.test.ts`

- [ ] Implement:

```ts
readProjectFile(path: string): Promise<string>
writeProjectFile(path: string, content: string): Promise<void>
createProjectFile(path: string, content?: string): Promise<void>
deleteProjectPath(path: string): Promise<void>
moveProjectPath(oldPath: string, newPath: string): Promise<void>
listProjectFiles(): Promise<string[]>
rescanProjectFiles(): Promise<{ changed: boolean; files: Record<string, string> }>
getProjectSnapshot(): Promise<Record<string, string>>
loadProjectSnapshot(files: Record<string, string>): void
```

- [ ] Each mutation writes WebContainer first, then updates EditorStore projection.
- [ ] If WebContainer write/delete/move fails, EditorStore must not change.
- [ ] `rescanProjectFiles` reads WebContainer and replaces EditorStore projection only if content differs.
- [ ] Add `fileRevision` and `lastSavedRevision` to EditorStore.
- [ ] Increment `fileRevision` on every projection content change.
- [ ] Update open tabs and active file correctly after delete/move.
- [ ] Run:

```bash
cd frontend && npm test -- --run src/services/projectFileService.test.ts src/stores/useEditorStore.test.ts
```

Expected: service and store tests pass.

## Task 4: Make WebContainer Topic Sessions Explicit

**Files:**
- Modify: `frontend/src/hooks/useWebContainer.ts`
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`
- Modify: `frontend/src/pages/WebsiteEditorPage.test.tsx`

- [ ] Replace or wrap `init(initialFiles)` with `initProject(topicId, initialFiles)`.
- [ ] Track `currentTopicId`, `sessionId`, `isReady`, `previewUrl`, `error`, and dev process handles per session.
- [ ] On topic change, kill the old dev process if it exists.
- [ ] On topic change, set ready false and previewUrl null before writing files.
- [ ] Call `wcResetProject(initialFiles)` instead of overlay-writing files.
- [ ] Ignore stale `server-ready` callbacks whose session id no longer matches.
- [ ] Reset `filesLoaded`, `topic`, and `error` in `WebsiteEditorPage` when `id` changes.
- [ ] Add a regression test: topic A has `src/A.ts`, topic B has `src/B.ts`; after switching to B, WebContainer reset receives only B files and previewUrl resets.
- [ ] Run:

```bash
cd frontend && npm test -- --run src/pages/WebsiteEditorPage.test.tsx
```

Expected: editor page session tests pass.

## Task 5: Route Agent Tools Through Project File Service

**Files:**
- Modify: `frontend/src/agent/tools/listFiles.ts`
- Modify: `frontend/src/agent/tools/readFile.ts`
- Modify: `frontend/src/agent/tools/writeFile.ts`
- Modify: `frontend/src/agent/tools/createFile.ts`
- Modify: `frontend/src/agent/tools/deleteFile.ts`
- Modify: `frontend/src/agent/tools/moveFile.ts`
- Modify: `frontend/src/agent/tools/runCommand.ts`
- Add or modify tests near existing tool tests.

- [ ] Make `list_files` call `listProjectFiles`.
- [ ] Make `read_file` call `readProjectFile`.
- [ ] Make write/create/delete/move call the corresponding service methods.
- [ ] Make `run_command` call `rescanProjectFiles()` after the command exits.
- [ ] Keep the current command allowlist initially, but mark command-created files as visible through rescan.
- [ ] Return `isError: true` with a clear message for validation and service failures.
- [ ] Add regression test: command writes `src/generated.ts`; after `run_command`, `list_files` sees `src/generated.ts`.
- [ ] Run:

```bash
cd frontend && npm test -- --run src/agent/tools/runCommand.test.ts src/services/projectFileService.test.ts
```

Expected: command rescan and file tools pass.

## Task 6: Fix Agent Save Decision After Any Project Mutation

**Files:**
- Modify: `frontend/src/agent/useAgentRuntime.ts`
- Modify: `frontend/src/agent/useAgentRuntime.test.ts`
- Modify: `frontend/src/stores/useEditorStore.ts`

- [ ] Track `fileRevision` before the agent loop starts.
- [ ] After every tool call, compare current `fileRevision` to the starting revision.
- [ ] Treat any revision increase as a project mutation, including mutations discovered by `run_command` rescan.
- [ ] Save to OSS after successful build-agent loops when revision changed.
- [ ] Keep sending tool result content back to the LLM even when the tool failed.
- [ ] Add tests:
  - `write_file` increases revision and triggers save.
  - `run_command` rescan increases revision and triggers save.
  - failed tools do not trigger save unless a revision changed before failure.
- [ ] Run:

```bash
cd frontend && npm test -- --run src/agent/useAgentRuntime.test.ts
```

Expected: agent runtime save tests pass.

## Task 7: Convert UI File Operations To The Same Service

**Files:**
- Modify: `frontend/src/components/editor/CodeEditor.tsx`
- Modify: `frontend/src/components/editor/FileTree.tsx`
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`
- Modify: `frontend/src/hooks/usePreviewSync.ts`

- [ ] Make editor text saves call `writeProjectFile`.
- [ ] Make file tree create/delete/rename operations call project file service.
- [ ] Remove UI code that writes WebContainer and EditorStore separately.
- [ ] Show toast errors when service operations fail.
- [ ] Ensure preview sync reads the EditorStore projection after service updates.
- [ ] Run relevant component tests:

```bash
cd frontend && npm test -- --run src/pages/WebsiteEditorPage.test.tsx src/components/editor/EditorActions.test.tsx
```

Expected: editor UI tests pass.

## Task 8: Save And Recovery Must Use The Synchronized Snapshot

**Files:**
- Modify: `frontend/src/stores/useEditorStore.ts`
- Modify: `frontend/src/hooks/useAutoSave.ts`
- Modify: `frontend/src/utils/tarUtils.test.ts`
- Modify or add tests for save flow.

- [ ] Make `saveToOSS` use `getProjectSnapshot()` or a guaranteed synchronized EditorStore projection.
- [ ] Set `lastSavedRevision = fileRevision` after successful save.
- [ ] Keep local backup from the same snapshot that is uploaded.
- [ ] If snapshot is empty, return false and surface the existing failure behavior.
- [ ] Add test: command-created file is included in backup and tarball after rescan.
- [ ] Run:

```bash
cd frontend && npm test -- --run src/stores/useEditorStore.test.ts src/hooks/useAutoSave.test.ts src/utils/tarUtils.test.ts
```

Expected: save and backup tests pass.

## Task 9: Final Verification

**Files:**
- No new files.

- [ ] Run focused frontend tests:

```bash
cd frontend && npm test -- --run src/agent/useAgentRuntime.test.ts src/agent/tools/runCommand.test.ts src/pages/WebsiteEditorPage.test.tsx src/stores/useEditorStore.test.ts src/services/projectFileService.test.ts
```

- [ ] Run typecheck:

```bash
cd frontend && npx tsc --noEmit
```

- [ ] Manual smoke path:
  - Create a topic from landing page.
  - Confirm initial prompt auto-sends.
  - Ask agent to create a new file using `write_file`; confirm file tree, preview, and save include it.
  - Ask agent to run a command that creates a file; confirm file tree and save include it after rescan.
  - Open another topic in the same browser session; confirm old files do not appear.

Expected: no stale files, no `/home/project` paths in agent-visible outputs, and saved snapshots match visible project files.

