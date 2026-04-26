# Design: Agent WebContainer Filestore Hardening

> 创建时间：2026-04-25
> 目标：修复 agent、WebContainer、EditorStore、OSS/publish 之间的恶性一致性问题。

---

## 1. 问题诊断

当前系统的问题不是单点 bug，而是文件状态被多个模块同时拥有：

- WebContainer FS 保存真实运行环境。
- EditorStore 保存 UI 文件快照，同时也被保存逻辑当作云端上传源。
- agent tools 有的读写 WebContainer，有的读写 EditorStore。
- UI 文件树可以直接改 EditorStore。

这导致三类恶性风险：

1. **跨专题污染**：WebContainer、EditorStore、AgentStore 都有全局状态，专题切换时容易串项目。
2. **数据丢失/假保存**：命令、UI、agent 写入路径不一致，保存只取其中一份状态。
3. **恢复与发布不可靠**：tarball 路径和二进制处理不足，OSS 删除 key 不匹配。

---

## 2. 目标

- 建立明确的文件状态所有权：WebContainer FS 是编辑器运行态 source of truth，EditorStore 是 UI projection/cache。
- 按 topic 隔离 WebContainer project、previewUrl、dev server、agent session。
- 统一所有文件读写入口，消除只写 EditorStore 或只写 WebContainer 的旁路。
- 保证保存过程不会把未上传的新修改错误标记为已保存。
- 让命令工具产生的文件变化可以被保存、预览、文件树一致感知。
- 修复 tarball 的路径校验、长路径策略和二进制资产处理。
- 修正删除专题时 OSS key 清理范围。

---

## 3. 非目标

- 不移除或降低 `MAX_TOOL_LOOPS = 1000`。1000 次工具调用是允许的能力，不作为本次问题修复目标。
- 不重做整体 UI 视觉设计。
- 不替换 WebContainer 技术栈。
- 不把 frontend tool execution 迁回 backend。
- 不实现多人实时协作冲突解决；本次只处理单浏览器会话内的保存竞态和跨专题污染。

---

## 4. 最终边界

### 4.1 文件状态所有权

```
WebContainer FS
  └─ canonical runtime filesystem

EditorStore
  ├─ cached files projection
  ├─ fileTree projection
  ├─ openFiles / activeFile / previewMode
  └─ save status metadata

OSS
  └─ persisted snapshot built from synchronized project state
```

规则：

- 所有文件 mutation 必须先成功写入 WebContainer，再更新 EditorStore projection。
- EditorStore 不能有独立创建/删除/重命名文件的生产入口。
- 保存前必须从统一 project snapshot 获取文件，不能只信任可能过期的 EditorStore。
- `run_command` 后必须触发 project rescan，发现命令修改的文件。

### 4.2 Agent tool 边界

- 本次不改变任何 agent 的工具可用范围。
- 本次只修复工具实现内部的数据源、路径校验、写入顺序和保存同步。
- `run_command` 保持现有产品能力，但命令结束后必须让文件 projection 与 WebContainer 重新一致。

---

## 5. 详细设计

### 5.1 Project path normalizer

新增统一路径模块，例如：

```typescript
type ProjectPath = string & { readonly __brand: 'ProjectPath' };

function normalizeProjectPath(input: string): ProjectPath;
function toWcAbsolutePath(path: ProjectPath): string; // /home/project/<path>
```

校验规则：

- 拒绝空字符串。
- 拒绝绝对路径。
- 拒绝 `.`、`..` 路径段。
- 拒绝重复斜杠、反斜杠、NUL。
- 统一去掉开头的 `./`。
- tarball 解包、agent tool 参数、FileTree 新建文件名、Editor tab path 都必须经过该 normalizer。

对 tarball：

- `createTarball` 写入前校验 path。
- `extractTarball` 解出 path 后校验，不合法则抛错并拒绝加载该包。
- 长路径暂不静默截断：超过当前 tar 实现能力时直接抛错，后续再实现 PAX 或 prefix。

### 5.2 WebContainer project session

`useWebContainer` 引入 project session 状态：

```typescript
interface WebContainerProjectSession {
  topicId: string;
  initializedAt: number;
  packageJsonHash: string | null;
  devProcess: { kill(): void } | null;
  installPromise: Promise<void> | null;
}
```

`init` 改成：

```typescript
initProject(topicId: string, files: Record<ProjectPath, string | Uint8Array>)
```

行为：

1. 等待 WebContainer boot。
2. 如果 `topicId` 改变：
   - kill 旧 dev process；
   - 清空 `/home/project`；
   - 清空 previewUrl；
   - 重置 dev server 状态；
   - 记录新 session。
3. 写入完整 snapshot。
4. 更新 EditorStore projection。
5. 如果有 `package.json`，按 session 启动 install/dev。

重要约束：

- `isReady` 表示 project files 已写入完成。
- `previewUrl` 只属于当前 `topicId`。
- 旧 server-ready 事件必须校验 session topicId，不能更新新专题 previewUrl。

### 5.3 Dev server lifecycle

保留 1000 工具调用能力，但 dev server 必须有独立生命周期：

- `devServerStarted` 不再是永久全局 boolean。
- `npm install` 失败不能永久阻止重试。
- `package.json` 初次出现或 hash 变化时，允许重新 install/restart。
- topic 切换时必须 kill 旧 dev process。
- dev output 可以继续进入 console，后续再接入 terminal sink。

`setupNpmRegistry` 不应 fire-and-forget 于 install 竞态。中国时区 registry 设置要在第一次 install 前完成，失败可降级继续，但必须有确定顺序。

### 5.4 File service facade

新增 frontend file service，例如 `frontend/src/agent/projectFiles.ts` 或 `frontend/src/services/projectFileService.ts`。

对外提供：

```typescript
readProjectFile(path): Promise<string | Uint8Array>
writeProjectFile(path, content): Promise<void>
createProjectFile(path, content): Promise<void>
deleteProjectPath(path): Promise<void>
moveProjectPath(oldPath, newPath): Promise<void>
listProjectFiles(): Promise<ProjectPath[]>
rescanProjectFiles(): Promise<void>
getProjectSnapshot(): Promise<Record<ProjectPath, string | Uint8Array>>
```

所有入口统一走它：

- agent tools
- CodeEditor
- FileTree 新建/删除
- preview sync
- saveToOSS
- publish pipeline

写路径：

```
validate path
→ mutate WebContainer FS
→ rescan or targeted update EditorStore projection
→ mark dirty with revision
```

读路径：

```
validate path
→ read WebContainer FS
→ update EditorStore cache for that file
→ return content
```

### 5.5 EditorStore projection model

EditorStore 保留 UI 状态，但文件 mutation API 分级：

- 内部 projection setter：仅 file service 可调用。
- UI action 不直接调用 `createFile/deleteFile/renameFile/setFileContent` 修改文件。

Store 需要新增 revision：

```typescript
fileRevision: number;
lastSavedRevision: number;
saveInFlightRevision: number | null;
```

规则：

- 每次文件 projection 变化，`fileRevision += 1`。
- 保存开始记录 `savingRevision = fileRevision`。
- 上传成功后只有当当前 `fileRevision === savingRevision`，才可 `markSaved`。
- 如果保存期间又发生编辑，上传成功也不能清 dirty，只能记录 `lastSavedRevision = savingRevision`。

同时修正：

- 删除 active file 时清空或切换 `activeFile`。
- rename 时同步 `openFiles` 和 `activeFile`。
- set file content 新增路径时必须 rebuild fileTree。

### 5.6 Agent tools

工具注册和可用范围保持当前产品行为。本文档只要求工具实现满足统一 file service 约束：

- 文件工具不直接读写全局 EditorStore。
- 文件工具通过 file service 读写 WebContainer，并同步 EditorStore projection。
- UI 工具状态必须正确反映 tool result。

`run_command`：

- 默认 cwd 必须是 `/home/project`。
- 允许保留当前 string command 参数，但内部仍必须结构化解析。
- 命令结束后执行 `rescanProjectFiles()`。
- 对 `rm/cp/mv/npm/node` 产生的文件变化，EditorStore 必须可见并可保存。
- 输出需要限制最大返回长度，完整日志可走 terminal sink，不进入 LLM 上下文。
- `MAX_TOOL_LOOPS = 1000` 保持不变。

工具错误：

- `isError: true` 时 UI 状态显示 `error`。
- 错误结果仍进入 tool message，让模型可恢复。

### 5.7 Save and OSS upload

`saveToOSS` 改为从 file service 获取 synchronized snapshot：

```
snapshot = await getProjectSnapshot()
revision = current fileRevision
tarball = createTarball(snapshot)
PUT presigned URL
if success and revision unchanged -> markSaved
if success and revision changed -> keep dirty, record partial save
```

本地备份：

- 保存前仍可写 local backup。
- beforeunload backup 应使用当前 EditorStore projection。
- local recovery snapshot 恢复后，必须进入 `initProject(topicId, files)`，不能只 loadSnapshot。

### 5.8 Tarball and binary assets

文件内容类型改为：

```typescript
type ProjectFileContent = string | Uint8Array;
```

tar 工具：

- 支持 binary body。
- `extractTarball` 根据调用场景返回 bytes，再由编辑器文本文件解码。
- 发布包里的 PNG、字体、ico 等不得经过 UTF-8 文本解码。
- `buildPublishedHtml` 创建 Blob 时直接使用 bytes。

短期兼容：

- 源码编辑区只打开文本文件。
- 二进制文件在 file tree 中可显示但不可用 Monaco 文本编辑。

### 5.9 Publish flow

发布前：

1. 保存当前 project snapshot。
2. 确保 WebContainer project 是当前 topicId。
3. 运行 `npm run build`。
4. 读取 dist，保留 binary。
5. 上传 published tarball。
6. 更新 topic status。

### 5.10 Topic delete cleanup

当前保存 key 是：

- `topics/<topicId>.tar.gz`
- `topics/<topicId>-published.tar.gz`

删除专题时应删除：

- `topics/<topicId>.tar.gz`
- `topics/<topicId>-published.tar.gz`
- 兼容旧前缀：`topics/<topicId>/`

后端 `StorageService` 已有 `delete` 和 `deleteDir`，controller 应调用精确 key 删除并容忍不存在。

---

## 6. 迁移步骤

### Phase 1: Source-of-truth cleanup

- read_file/list_files 等文件工具不再直接读取全局 EditorStore，而是通过统一 file service 保持 source-of-truth 一致。
- 所有文件 mutation 入口改为先写 WebContainer，再更新 EditorStore projection。
- 工具错误状态按 `isError` 正确显示。

### Phase 2: Path and project session hardening

- 新增 path normalizer。
- WebContainer helper 全面使用 normalized ProjectPath。
- `initProject(topicId, files)` 清理旧 project 并重置 preview/dev 状态。
- WebsiteEditorPage 在 id 变化时重置 `filesLoaded` 和本地 topic load 状态。

### Phase 3: Unified file service

- 引入 file service facade。
- 改造 agent tools、CodeEditor、FileTree、WebsiteEditorPage 删除逻辑。
- 移除 UI 对 EditorStore 文件 mutation 的直接调用。
- run_command 后 rescan。

### Phase 4: Save correctness

- EditorStore 增加 revision。
- saveToOSS 使用 file service snapshot。
- 保存成功按 revision guard 标记。
- local recovery 恢复必须初始化 WebContainer project。

### Phase 5: Tarball and publish robustness

- tarUtils 支持 binary。
- readDistFiles 返回 bytes。
- buildPublishedHtml 使用 binary Blob。
- 长路径策略改为显式失败。
- topic delete 删除精确 OSS key。

---

## 7. 测试策略

### Unit tests

- path normalizer:
  - accepts `src/App.tsx`
  - normalizes `./src/App.tsx`
  - rejects `/src/App.tsx`
  - rejects `../secret`
  - rejects `src/../secret`
  - rejects empty and NUL

- tarUtils:
  - rejects unsafe paths on create/extract
  - preserves binary bytes
  - throws on unsupported long paths

- EditorStore:
  - save revision guard keeps dirty when edit happens during upload
  - delete active file clears activeFile/openFiles
  - rename updates activeFile/openFiles
  - new projected file rebuilds fileTree

- agent runtime:
  - tool availability remains unchanged
  - tool `isError` maps to UI `error`
  - `MAX_TOOL_LOOPS = 1000` remains unchanged

### Integration-style frontend tests

- switching from topic A to topic B clears old project files and previewUrl.
- local recovery snapshot initializes WebContainer, not only EditorStore.
- FileTree create writes to WebContainer and appears in EditorStore.
- run_command generated file appears in save snapshot.
- save upload in-flight followed by edit keeps unsaved indicator.

### Backend tests

- deleting a topic calls delete for both tarball keys and deleteDir for legacy prefix.
- missing storage object cleanup does not block DB delete.

## 8. Rollout Notes

- Phase 1 should ship first because it removes the most direct split-brain file state.
- Phase 2 and Phase 3 should be reviewed together; partial rollout can make split-brain state worse.
- Phase 4 can ship after file service is in place.
- Phase 5 can be incremental, but binary publish should be fixed before users rely on image/font-heavy builds.

---

## 9. Decisions

- 不改变任何 agent 的工具可用范围；本次只修工具内部的数据一致性。
- 保存期间又发生新修改时，保存成功不清 dirty。第一版只保持“未保存”状态即可，可选 toast 提示“已保存到较早版本，仍有新修改未保存”。
- 继续只读兼容旧 localStorage `snapshot-<topicId>` 格式。读取后按新结构写回 `local-backup-<topicId>`，后续恢复必须进入 `initProject(topicId, files)`。
