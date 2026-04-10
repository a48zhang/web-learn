# 基于 Git + OSS 的专题存储设计

> 2026-04-10

## 概述

专题文件以 **完整 Git 仓库**（含 `.git/`）形式存储在 OSS 对象存储中。WebContainer 通过 `isomorphic-git` 在浏览器中维护本地 Git 仓库，每次 commit 后将整个目录打包为 tarball 并直接上传到 OSS。

核心原则：

- **文件不经过后端** — 后端只签发预签名 URL，浏览器与 OSS 直连传输
- **每个专题一个独立 Git 仓库** — 完整的 commit history 包含在 `.git/` 目录中
- **clone = 下载 tarball 解压**，**push = 打包整个目录上传**

## 数据模型

### Topic 实体

**数据库表名：** `topic_topics`（Topic Space Service 管理）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | VARCHAR(36) | PRIMARY KEY, UUID | 专题ID |
| title | VARCHAR(200) | NOT NULL | |
| description | TEXT | NULLABLE | |
| type | ENUM | NOT NULL, DEFAULT 'website' | 固定 'website' |
| status | ENUM | NOT NULL | draft / published / closed |
| published_url | VARCHAR(500) | NULLABLE | 发布后外部访问URL |
| share_link | VARCHAR(500) | NULLABLE | 分享链接 |
| created_by | VARCHAR(36) | FK → auth_users.id | 创建者UUID |
| editors | JSON | NOT NULL, DEFAULT [] | 可编辑用户UUID列表 |
| created_at | TIMESTAMP | AUTO | |
| updated_at | TIMESTAMP | AUTO | |

**已移除字段：** `files_snapshot`、`chat_history`、`website_url`

### User 实体

**数据库表名：** `auth_users`（Auth Service 管理）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | VARCHAR(36) | PRIMARY KEY, UUID | |
| username | VARCHAR(50) | UNIQUE, NOT NULL | |
| email | VARCHAR(100) | UNIQUE, NOT NULL | |
| password | CHAR(60) | NOT NULL | bcrypt 加密 |
| role | ENUM | NOT NULL | admin / user |
| created_at | TIMESTAMP | AUTO | |
| updated_at | TIMESTAMP | AUTO | |

### OSS 存储结构

```
{bucket}/
└── topics/
    └── {topic_uuid}.tar.gz    ← 完整 Git 仓库（含 .git/）
```

## 架构

```
浏览器
├── WebContainer (内存文件系统)
│   ├── index.html
│   ├── style.css
│   ├── .git/                    ← isomorphic-git 完整仓库
│   └── ...
│
├── 前端 JS
│   ├── clone:  GET tarball → 解压到 WebContainer
│   ├── edit:   直接写 WebContainer 文件系统
│   ├── commit: isomorphic-git 本地提交
│   └── push:   打包 .tar.gz → PUT → OSS
│
└── 预签名 URL 请求
         │
         ▼
    后端 (只签名，不转发文件)
         │
         ▼
    OSS (对象存储)
```

## 数据流

### Clone（加载专题）
1. 前端：`GET /api/topics/:id/git/presign?op=download`
2. 后端：生成 GET 预签名 URL → 返回
3. 前端：下载 tarball → tar 解压到 WebContainer 文件系统
4. isomorphic-git：恢复完整 .git 仓库

### Commit + Push
1. isomorphic-git：本地 commit
2. 前端：打包整个目录为 tarball（含 .git/）
3. 前端：`GET /api/topics/:id/git/presign?op=upload`
4. 后端：生成 PUT 预签名 URL → 返回
5. 前端：PUT tarball → OSS（直传）

## API 端点

### Gateway 路由（不变）
```
/api/auth/*     → Auth Service (3001)
/api/users/*    → Auth Service (3001)
/api/topics/*   → Topic Space Service (3002)
/api/ai/*       → AI Service (3003)
```

### 专题管理端点

**保留：**
```
POST   /api/topics              - 创建专题（需认证）
GET    /api/topics              - 专题列表（公开，已发布）
GET    /api/topics/:id          - 专题详情（公开，已发布）
PUT    /api/topics/:id          - 更新专题信息（需认证，editor）
PATCH  /api/topics/:id/status   - 发布/关闭（需认证，editor）
DELETE /api/topics/:id          - 删除专题（需认证，editor）
POST   /api/topics/:id/share    - 生成分享链接（需认证，editor）
```

**新增：**
```
GET    /api/topics/:id/git/presign - 获取 Git 预签名 URL（需认证，editor）
```

**移除：**
```
PUT    /api/topics/:id/files           - 文件快照（旧）
GET    /api/topics/:id/files           - 文件快照（旧）
PUT    /api/topics/:id/chat-history    - 对话历史（旧）
POST   /api/topics/:id/website/upload  - ZIP上传（旧）
PUT    /api/topics/:id/website/upload  - ZIP上传（旧）
DELETE /api/topics/:id/website         - 删除网站（旧）
GET    /api/topics/:id/website/stats   - 网站统计（旧）
```

### 预签名 URL 端点详情

**`GET /api/topics/:id/git/presign?op=upload|download`**

下载响应：
```json
{
  "success": true,
  "data": {
    "url": "https://oss.../topics/abc-123.tar.gz?signature=...",
    "method": "GET"
  }
}
```

上传响应：
```json
{
  "success": true,
  "data": {
    "url": "https://oss.../topics/abc-123.tar.gz?signature=...",
    "method": "PUT",
    "contentType": "application/gzip"
  }
}
```

### AI 端点（不变）
```
POST   /api/ai/chat    - AI 对话（需认证）
```

## Topic Space Service 变更

### 新增控制器
- `gitPresignController` — 签发预签名 URL

### 移除控制器
- `saveFilesSnapshot`、`saveChatHistory`
- `uploadWebsite`、`deleteWebsite`、`getWebsiteStats`

### 移除中间件
- `uploadMiddleware`（multer 配置）
- `zipUtils`（extractZipToTempDir、uploadDirToOSS）

### 移除路由
- `pageRoutes`（整个 pages API 已废弃）

## Gateway 变更

### 移除
- `/api/pages` 路由

## 前端变更

### API 客户端 (`api.ts`)
- 新增 `topicGitApi.getPresign(topicId, op)`
- 移除 `topicFileApi` 全部方法
- 移除 `pageApi` 全部方法

### WebContainer 集成
- 新增：clone → tarball 下载 → 解压 → isomorphic-git 初始化
- 新增：commit → tarball 打包 → PUT 上传
- 移除：基于 filesSnapshot 的 mount 逻辑
