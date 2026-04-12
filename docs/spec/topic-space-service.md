# Topic Space Service

> 最后更新：2026-04-12

## 概述

Topic Space Service 负责专题的 CRUD、状态管理、分享和 Git 预签名 URL 管理。

**端口：** 3002
**代码路径：** `services/topic-space`
**数据库表：** `topic_topics`（独立管理）

## API 端点

### 专题管理

```
POST   /api/topics              - 创建专题（需认证）
GET    /api/topics              - 获取专题列表（公开访问）
GET    /api/topics/:id          - 获取专题详情（公开访问，已发布）
PUT    /api/topics/:id          - 更新专题（需认证，editor）
PATCH  /api/topics/:id/status   - 更新专题状态（需认证，editor）
DELETE /api/topics/:id          - 删除专题（需认证，editor）
POST   /api/topics/:id/share    - 生成分享链接（需认证，editor）
```

### Git 预签名 URL

```
GET /api/topics/:id/git/presign?op=upload    - 获取上传预签名 URL（需认证，editor）
GET /api/topics/:id/git/presign?op=download  - 获取下载预签名 URL（已发布专题公开访问）
```

**上传响应（op=upload）：**
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

**下载响应（op=download）：**
```json
{
  "success": true,
  "data": {
    "url": "https://oss.../topics/abc-123.tar.gz?signature=...",
    "method": "GET"
  }
}
```

### 健康检查

```
GET /health                  - 服务健康检查（公开）
```

## 专题模型

### Topic（专题学习空间）

**数据库表名：** `topic_topics`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PRIMARY KEY, UUID | 专题ID |
| title | VARCHAR(200) | NOT NULL | 专题标题 |
| description | TEXT | NULLABLE | 专题描述 |
| type | ENUM | NOT NULL, DEFAULT 'website' | 固定为 'website' |
| published_url | VARCHAR(500) | NULLABLE | 发布后的外部访问URL |
| share_link | VARCHAR(500) | NULLABLE | 分享链接 |
| created_by | VARCHAR(100) | FK → auth_users.id | 创建者 ID |
| editors | JSON | NOT NULL, DEFAULT [] | 可编辑用户 UUID 列表 |
| status | ENUM | NOT NULL | 状态：draft, published, closed |
| created_at | TIMESTAMP | AUTO | 创建时间 |
| updated_at | TIMESTAMP | AUTO | 更新时间 |

**状态流转：**
```
draft → published → closed
```
仅创建者可修改状态。

**业务规则：**
- 已注册用户可创建专题，创建者自动成为 editor
- `editors` 字段存储可编辑此专题的用户 UUID 列表（JSON 数组）
- 普通用户仅看到 `published` 状态的专题，editors 额外可见自己参与的 `draft` 专题
- 已发布专题对所有人公开可见（包括未登录访客）
- 关闭后标记为已关闭（仍可见）

## 权限矩阵

| 端点 | 访客 | 用户（非editor） | 用户（editor） |
|------|:----:|:----------------:|:--------------:|
| GET /api/topics | ✓ 已发布的 | ✓ 已发布的 | ✓ 自己参与的 + 已发布的（含 draft） |
| GET /api/topics/:id | ✓ 已发布的 | ✓ 已发布的 | ✓ 自己参与的 + 已发布的 |
| GET /api/topics/:id/git/presign?op=download | ✓ 已发布的 | ✓ 已发布的 | ✓ 自己参与的 + 已发布的 |
| POST /api/topics | ✗ | ✓ | ✓ |
| PUT /api/topics/:id | ✗ | ✗ | ✓ |
| PATCH /api/topics/:id/status | ✗ | ✗ | ✓ |
| DELETE /api/topics/:id | ✗ | ✗ | ✓ |
| POST /api/topics/:id/share | ✗ | ✗ | ✓ |
| GET /api/topics/:id/git/presign?op=upload | ✗ | ✗ | ✓ |

## 存储架构

专题文件通过 Git-on-OSS 存储（tarball 格式）：
- 上传：前端获取预签名 URL 后直接 PUT tarball 到 OSS
- 下载：前端获取预签名 URL 后 GET tarball
- 删除：OSS prefix 级联删除

## 分页和过滤

```
GET /api/topics?page=1&limit=20
GET /api/topics?status=published
GET /api/topics?created_by={user_uuid}
```

**分页响应：**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

## 专题详情响应

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "title": "机器学习入门",
    "description": "从基础概念到实践应用的机器学习专题",
    "type": "website",
    "published_url": "https://example.com/topic/550e8400...",
    "share_link": "https://example.com/share/abc123",
    "created_by": "user-uuid-string",
    "editors": ["user-uuid-string"],
    "status": "published",
    "created_at": "2026-04-01T00:00:00.000Z",
    "updated_at": "2026-04-01T00:00:00.000Z"
  }
}
```

## 创建专题请求

```json
{
  "title": "机器学习入门",
  "description": "从基础概念到实践应用的机器学习专题"
}
```

## 公开访问规则

- 所有已发布的专题对所有人公开可见（包括未登录访客）
- 访客可以查看任何已发布专题的详情
- 不需要"加入"操作

## 已移除的 API

以下 API 端点已被移除（改为 Git-on-OSS 存储架构）：

- ❌ `POST /api/topics/:id/files` — 文件快照（改为 Git tarball）
- ❌ `GET /api/topics/:id/files` — 文件快照（改为 Git tarball）
- ❌ `POST /api/topics/:id/publish` — 发布专题（改为 PATCH /status）
- ❌ `POST /api/topics/:id/website/upload` — ZIP 上传（改为 Git tarball 直传）
- ❌ `PUT /api/topics/:id/website/upload` — ZIP 更新（改为 Git tarball 直传）
- ❌ `DELETE /api/topics/:id/website` — 网站删除（改为 OSS prefix 删除）
- ❌ `GET /api/topics/:id/website/stats` — 网站统计（已废弃）

> 关于已废弃的 `/api/pages/*` 端点和 TopicPage 模型，详见 [archive/page-endpoint-deprecation.md](../archive/page-endpoint-deprecation.md)

## 相关文档

- [Gateway Service](./gateway-service.md)
- [数据模型](./data-models.md)
- [用户角色与权限](./user-roles.md)
