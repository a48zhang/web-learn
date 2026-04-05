# 网站型专题 - 整改计划

> 创建时间：2026-04-04
> 问题发现：通过代码审查发现实现与 Spec 严重偏离
> 更新：2026-04-04（补充 OSS 支持）

---

## 1. 问题本质

**Spec 定义的网站型专题设计：**

```
教师上传 ZIP → 系统解压到 OSS → website_url = OSS 上的访问入口 URL
```

- `website_url` 是**系统自动生成的**，不是教师手动输入的
- 存储层是 **OSS**，不是本地文件系统
- 必须包含 `index.html` 作为入口文件

**当前实现的错误：**

1. 教师可以在创建/编辑专题时**手动输入任意 URL**
2. ZIP 上传后**没有解压**，只存了 ZIP 文件本身到本地 `/uploads/`
3. `website_url` 被设置成了本地 ZIP 文件路径 `/uploads/xxx.zip`
4. 使用**本地文件系统存储**，完全未实现 OSS
5. 预览时 `<iframe src="/uploads/xxx.zip">` 无法正常工作

---

## 2. 问题清单

### 问题 1：使用本地存储，未实现 OSS（严重）

| 位置 | 问题 |
|------|------|
| `uploadMiddleware.ts` | 使用 `multer.diskStorage` 存到本地目录 |
| `config.uploadsDir` | 本地路径 `${process.cwd()}/uploads` |
| `topicController.ts` | 所有文件操作使用 `fs.*` 读写本地文件 |

**影响**：与 Spec "存 OSS" 的设计完全不符，无法用于生产环境。

### 问题 2：教师可手动输入 website_url（严重）

| 位置 | 问题 |
|------|------|
| `createTopic` | 接受 `website_url` / `websiteUrl` 参数 |
| `updateTopic` | 接受 `website_url` / `websiteUrl` 参数，可随时修改 |
| `TopicCreatePage.tsx` | 专题类型=网站时显示 URL 输入框 |

**影响**：教师可以填任意外部链接，完全绕过 ZIP 上传流程。

### 问题 3：ZIP 没有被解压（严重）

| 位置 | 问题 |
|------|------|
| `uploadWebsite` | ZIP 验证后直接存为文件，**没有解压操作** |
| `hasHtmlEntryInZip` | 解析 ZIP 头只是为了验证"包含 HTML"，不是实际解压 |

**影响**：教师上传的 HTML/CSS/JS 文件从未被提取，系统无法正确托管和展示网站。

### 问题 4：WebsiteTopicPage 无法正确预览（严重）

`websiteUrl` 的值是 `/uploads/xxx.zip`，浏览器无法渲染 ZIP 文件，预览功能失效。

### 问题 5：WebsiteEditorPage 仍用 window.confirm

与其他页面的模态对话框不一致（KnowledgeEditorPage 已修复）。

### 问题 6：updateWebsite 与 uploadWebsite 是同一函数

---

## 3. 正确的设计理解

**网站型专题的工作流（基于 OSS）：**

```
1. 教师创建 website 类型专题（无 URL）
         ↓
2. 教师上传 ZIP 包
         ↓
3. 系统验证 ZIP 格式（包含 index.html）
         ↓
4. 系统解压 ZIP，上传到 OSS 目录
         oss://bucket/topics/{topic_id}/
           ├── index.html
           ├── css/
           ├── js/
           └── ...
         ↓
5. website_url = "{OSS_CDN_BASE}/topics/{topic_id}/index.html"  ← 系统自动生成
         ↓
6. 学生/访客通过 iframe 预览网站
```

**关键约束：**
- `website_url` 只能由系统写入，不允许教师手动编辑
- 存储层必须是 OSS，不允许本地文件系统
- 上传后必须解压，不能直接存 ZIP

---

## 4. 整改方案

### Phase 0：OSS 服务抽象层（基础设施）

**目的**：建立统一的文件存储接口，彻底移除本地存储依赖。

新建 `backend/src/services/storageService.ts`：

```ts
export interface StorageService {
  uploadFile(localPath: string, ossKey: string): Promise<string>;
  uploadBuffer(buffer: Buffer, ossKey: string): Promise<string>;
  downloadToLocal(ossKey: string, localPath: string): Promise<void>;
  delete(ossKey: string): Promise<void>;
  deleteDir(prefix: string): Promise<void>;
  getUrl(ossKey: string, expires?: number): string;
  getSize(ossKey: string): Promise<number>;
  listFiles(prefix: string): Promise<string[]>;
}
```


配置项（`config.ts`）：

```ts
storage: {
  provider: 'oss' | 's3';
  bucket: string;
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  cdnBase?: string;  // CDN 加速域名，如有
}
```

**文件清单：**

- [ ] 新建 `backend/src/services/storageService.ts` - 存储抽象层
- [ ] 新建 `backend/src/services/aliOSSStorage.ts` - 阿里云 OSS 实现
- [ ] 更新 `backend/src/utils/config.ts` - 添加 OSS 配置项
- [ ] 更新 `backend/src/middlewares/uploadMiddleware.ts` - 改用内存存储
- [ ] 删除 `config.uploadsDir` 配置项

---

### Phase 1：移除手动 URL 输入（立即修复）

#### Backend

- [ ] `createTopic`：移除 `website_url` / `websiteUrl` 参数，网站型专题初始 `website_url = null`
- [ ] `updateTopic`：移除 `website_url` / `websiteUrl` 参数，禁止手动修改
- [ ] 类型切换保护：如果专题已有 website 内容，禁止切换回 knowledge

#### Frontend

- [ ] `TopicCreatePage.tsx`：移除 website URL 输入框
- [ ] `TopicEditPage`（如有）：同样移除 website URL 字段
- [ ] 更新 `CreateTopicDto` / `UpdateTopicDto` 类型定义，移除 `websiteUrl` 字段

---

### Phase 2：实现 ZIP 上传→解压→上传 OSS（核心功能）

`uploadWebsite` 新流程：

```
1. 接收 multipart 上传（内存或临时文件）
         ↓
2. 验证 ZIP 格式（magic bytes）
         ↓
3. 验证 ZIP 包含 index.html
         ↓
4. 解压到临时目录
         ↓
5. 上传解压后所有文件到 OSS
         oss://bucket/topics/{topic_id}/
         ↓
6. 清理旧 OSS 目录（如有）
         ↓
7. 清理临时文件
         ↓
8. website_url = "{CDN_BASE}/topics/{topic_id}/index.html"
```

**依赖：**
- `yauzl` - ZIP 读取
- `unzipper` 或手写流式解压 - ZIP 解压
- OSS SDK（如 `ali-oss`）

**文件清单：**

- [ ] 实现 `extractZipToTempDir(zipPath: string): Promise<string>` - 解压到临时目录
- [ ] 重写 `uploadWebsite`：
  - [ ] 调用 `extractZipToTempDir`
  - [ ] 遍历目录上传到 OSS
  - [ ] 清理旧 OSS 内容
  - [ ] 设置 `website_url`
  - [ ] 清理临时文件（finally 块）
- [ ] 重写 `deleteWebsite`：
  - [ ] 删除 OSS 目录 `topics/{topic_id}/`
  - [ ] 设置 `website_url = null`
- [ ] 重写 `getWebsiteStats`：
  - [ ] 调用 `storageService.listFiles`
  - [ ] 调用 `storageService.getSize` 统计

---

### Phase 3：修复预览与前端

- [ ] `WebsiteTopicPage.tsx`：确保 iframe src 指向解压后的 `index.html` 而非 ZIP
- [ ] `WebsiteEditorPage.tsx`：替换 `window.confirm` 为模态对话框
- [ ] `WebsiteEditorPage.tsx`：上传状态反馈优化

---

### Phase 4：清理与文档

- [ ] 删除 `backend/src/controllers/topicController.ts` 中的 `resolveUploadPath` 函数
- [ ] 删除 `backend/uploads/` 目录及相关代码
- [ ] 移除 `export const updateWebsite = uploadWebsite` 别名
- [ ] 更新 `docs/spec/data-models.md`：澄清 `website_url` 是 OSS URL
- [ ] 更新 `docs/spec/features.md`：澄清"解压到 OSS"而非"解压到本地"

---

## 5. 优先级

| 优先级 | 内容 | 理由 |
|--------|------|------|
| **P0** | Phase 0 OSS 抽象层 | 所有文件操作的基础设施 |
| **P0** | Phase 1 移除手动 URL | 阻止错误使用 |
| **P1** | Phase 2 实现解压+OSS上传 | 核心功能完全不可用 |
| **P2** | Phase 3 修复预览 | 影响用户体验 |
| **P3** | Phase 4 清理文档 | 收尾工作 |

---

## 6. 关键技术决策

### 6.1 OSS SDK 选择

实现：
- 阿里云 OSS（兼容 S3 API）
- 腾讯 COS

### 6.2 ZIP 解压方案

避免一次性加载整个 ZIP 到内存：
- 流式解压：`yauzl` + `unzipper`
- 逐文件处理，避免大 ZIP 导致 OOM
- 临时目录使用 `os.tmpdir()`

### 6.3 路径安全（zip slip 防护）

解压时必须验证每个文件的路径：

```ts
const safePath = path.resolve(destDir, entry.fileName);
if (!safePath.startsWith(destDir)) {
  throw new Error('Path traversal detected');
}
```

### 6.4 CDN 配置

`website_url` 应使用 CDN 域名而非 OSS 内网地址：
- 开发/测试：OSS 公网地址
- 生产：`config.storage.cdnBase` + 路径

### 6.5 临时文件清理

无论成功失败，临时文件必须清理：

```ts
try {
  const tempDir = await extractZipToTempDir(filePath);
  await uploadDirToOSS(tempDir, ossKey);
} finally {
  await fs.promises.rm(tempDir, { recursive: true, force: true });
}
```

---

## 7. 影响范围

| 文件 | 操作 |
|------|------|
| `backend/src/services/storageService.ts` | 新建 |
| `backend/src/services/aliOSSStorage.ts` | 新建 |
| `backend/src/utils/config.ts` | 修改 |
| `backend/src/middlewares/uploadMiddleware.ts` | 修改 |
| `backend/src/controllers/topicController.ts` | 重写 uploadWebsite/deleteWebsite/getWebsiteStats |
| `shared/src/types/index.ts` | 修改 |
| `frontend/src/pages/TopicCreatePage.tsx` | 修改 |
| `frontend/src/pages/WebsiteEditorPage.tsx` | 修改 |
| `frontend/src/pages/WebsiteTopicPage.tsx` | 修改 |
| `docs/spec/data-models.md` | 修改 |
| `docs/spec/features.md` | 修改 |

---

## 8. 注意事项

1. **向后兼容**：已创建的含手动 URL 的专题数据如何处理？建议添加数据迁移脚本。
2. **空 website_url**：创建后、上传前的 website 专题，Preview 页面应显示"请先上传网站代码"。
3. **删除专题**：删除 website 专题时必须同时删除 OSS 上所有相关文件。
4. **权限**：OSS bucket 应配置公读（或通过 CDN），专题内容对所有人可见。
