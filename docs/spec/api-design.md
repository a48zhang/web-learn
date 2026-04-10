# API 设计

> 最后更新：2026-04-10

## RESTful API 概览

**基础URL：** `/api`（通过 Gateway 统一入口，端口 3000）

**认证方式：** JWT Bearer Token (HS256 算法强制)

**响应格式：**
```json
{
  "success": true/false,
  "data": {} | [],
  "error": "错误消息（失败时）"
}
```

**Gateway 路由转发：**
- `/api/auth/*` → Auth Service (端口 3001)
- `/api/users/*` → Auth Service (端口 3001)
- `/api/topics/*` → Topic Space Service (端口 3002)
- `/api/ai/*` → AI Service (端口 3003)

## API 端点

### 认证相关

```
POST   /api/auth/register    - 用户注册（rate limit: 5次/小时）
POST   /api/auth/login       - 用户登录（rate limit: 15次/15分钟）
GET    /api/users/me         - 获取当前用户信息（需认证）
GET    /:service/health      - 服务健康检查（公开，各服务独立）
```

**安全机制：**
- JWT verify 强制使用 HS256 算法（防止算法混淆攻击）
- 认证端点添加 rate limiting 防止暴力破解
- Gateway 全局请求限流（600次/分钟）

### 专题管理

所有专题统一为网站形式，文件通过 Git-on-OSS 存储（tarball 格式）。

```
POST   /api/topics              - 创建专题（需认证）
GET    /api/topics              - 获取专题列表（公开访问）
GET    /api/topics/:id          - 获取专题详情（公开访问，已发布）
PUT    /api/topics/:id          - 更新专题（需认证，editor）
PATCH  /api/topics/:id/status   - 更新专题状态（需认证，editor）
DELETE /api/topics/:id          - 删除专题（需认证，editor）
POST   /api/topics/:id/share    - 生成分享链接（需认证，editor）
GET    /api/topics/:id/git/presign - 获取 Git 预签名 URL
```

**创建专题请求：**
```json
{
  "title": "机器学习入门",
  "description": "从基础概念到实践应用的机器学习专题"
}
```

**专题详情响应：**
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

### AI Agent

所有 AI Agent 通过统一对话 API（OpenAI 兼容格式）：

```
POST   /api/ai/chat          - AI 对话（需认证）
```

## 权限控制

### API 权限矩阵

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

#### AI Agent 权限

| Agent 类型 | 访客 | 用户（非editor） | 用户（editor） |
|------|:----:|:----------------:|:--------------:|
| 学习助手 Agent（learning） | ✗ | ✓ 所有已发布的 | ✓ |
| 专题搭建 Agent（building） | ✗ | ✗ | ✓ 有编辑权限的专题 |

### 公开访问规则

**完全公开访问：**
- 所有已发布的专题对所有人公开可见（包括未登录访客）
- 访客可以查看任何已发布专题的详情
- 不需要"加入"操作
- 健康检查端点（`/health`）对所有服务公开

**需认证的操作：**
- 使用 AI 学习助手（需登录）
- 使用 AI 专题搭建助手（需登录且有编辑权限）
- 创建专题（需登录）
- 管理操作（editor 身份）

## 微服务架构

### Gateway 路由转发

**路由映射：**
```typescript
// Gateway 转发配置
app.use('/api/auth', proxy('http://auth:3001'))     // Auth Service
app.use('/api/users', proxy('http://auth:3001'))    // Auth Service
app.use('/api/topics', proxy('http://topic-space:3002')) // Topic Space
app.use('/api/ai', proxy('http://ai:3003'))         // AI Service
```

**Gateway 特性：**
- 全局 CORS 处理
- 全局请求限流（600次/分钟）
- JWT 验证 + 用户信息注入（通过 authMiddleware）
- 请求转发到下游服务（http-proxy-middleware）
- 30秒 proxy timeout

**服务健康检查：**
```typescript
// 各服务独立 /health 端点
GET http://auth:3001/health
GET http://topic-space:3002/health
GET http://ai:3003/health
GET http://gateway:3000/health

// 响应格式
{
  "success": true,
  "service": "auth",
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

### 服务间数据共享

**数据库表隔离：**
- `auth_users` → Auth Service 独立管理
- `topic_topics` → Topic Space Service 管理
- AI Service 通过 HTTP 调用 Auth/Topic Space 获取数据，不直接操作表

**JWT 跨服务验证：**
- 所有服务使用相同的 JWT_SECRET
- JWT payload 包含：`{ id: string (UUID), username, email, role }`
- 各服务 authMiddleware 验证 JWT 并查询用户信息

## 认证机制

### JWT Token

**JWT 配置：**
- 签名算法：HS256（强制）
- 环境变量：JWT_SECRET（生产环境必须配置）
- 过期时间：JWT_EXPIRES_IN（默认 7d）

**登录响应：**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "username": "user1",
      "role": "user"
    }
  }
}
```

**请求示例：**
```
GET /api/users/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**安全验证：**
```typescript
// 所有服务的 authMiddleware 强制 HS256 算法
jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })
```

### 权限中间件

**公开 API：** 无需认证
- GET /api/topics
- GET /api/topics/:id
- GET /api/topics/:id/git/presign?op=download（仅限已发布专题）
- GET /:service/health（各服务健康检查）

**需认证 API：** 需要有效的 JWT Token
- 所有 POST、PUT、PATCH、DELETE 操作
- GET /api/users/me
- POST /api/ai/chat

**Gateway 处理流程：**
```
请求 → Gateway authMiddleware → JWT验证 → 注入用户信息 → 转发到下游服务
```

## 错误响应

### 标准错误格式

```json
{
  "success": false,
  "error": "错误消息"
}
```

### 常见错误码

| 状态码 | 说明 | 示例 |
|--------|------|------|
| 400 | 请求参数错误 | 缺少必填字段 |
| 401 | 未认证 | 未提供有效的 Token |
| 403 | 权限不足 | 学生尝试创建专题 |
| 404 | 资源不存在 | 专题不存在 |
| 500 | 服务器错误 | 内部错误 |

## 分页和过滤

### 分页参数

```
GET /api/topics?page=1&limit=20
```

**响应：**
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

### 过滤参数

```
GET /api/topics?status=published
GET /api/topics?created_by={user_uuid}
```

## 与旧设计的差异

### 已移除的 API

根据 Git-on-OSS 存储架构，以下 API 端点已被移除：

- ❌ `POST /api/topics/:id/files` - 保存文件快照（改为 Git tarball）
- ❌ `GET /api/topics/:id/files` - 获取文件快照（改为 Git tarball）
- ❌ `POST /api/topics/:id/chat-history` - 保存对话历史（改为前端 localStorage）
- ❌ `GET /api/topics/:id/chat-history` - 获取对话历史（改为前端 localStorage）
- ❌ `POST /api/topics/:id/publish` - 发布专题网站（改为 PATCH /status）
- ❌ `POST /api/topics/:id/website/upload` - ZIP 上传（改为 Git tarball 直传 OSS）
- ❌ `PUT /api/topics/:id/website/upload` - ZIP 更新（改为 Git tarball 直传 OSS）
- ❌ `DELETE /api/topics/:id/website` - 网站删除（改为 OSS prefix 删除）
- ❌ `GET /api/topics/:id/website/stats` - 网站统计（已废弃）
- ❌ `POST /api/llm/chat/completions` - LLM 代理端点（改为前端 Agent 直连）
- ❌ `GET /api/pages/*` - 页面 API（TopicPage 模型已移除）
- ❌ `PATCH /api/topics/:id/pages/reorder` - 页面重排序

### 新的 API

- ✅ `GET /api/topics/:id/git/presign?op=upload` - 获取 Git tarball 上传预签名 URL
- ✅ `GET /api/topics/:id/git/presign?op=download` - 获取 Git tarball 下载预签名 URL
- ✅ `DELETE /api/topics/:id` - 删除专题（editor）
- ✅ `PATCH /api/topics/:id/status` - 更新专题状态（draft/published/closed）

## 相关文档

- [产品概述](./overview.md)
- [用户角色与权限](./user-roles.md)
- [功能清单](./features.md)
- [数据模型](./data-models.md)
- [AI Agent 系统](./agents.md)
