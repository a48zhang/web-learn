# API 设计

> 最后更新：2026-04-08

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

所有专题统一为网站形式，通过文件快照和对话历史进行管理。

```
POST   /api/topics           - 创建专题（教师，需认证）
GET    /api/topics           - 获取专题列表（公开访问）
GET    /api/topics/:id       - 获取专题详情（公开访问，已发布）
PUT    /api/topics/:id       - 更新专题（创建者，需认证）
PATCH  /api/topics/:id/status - 更新专题状态（创建者，需认证）
```

#### 专题网站文件管理

```
POST   /api/topics/:id/files              - 保存文件快照（需认证）
GET    /api/topics/:id/files              - 获取文件快照（公开访问，已发布）
POST   /api/topics/:id/chat-history       - 保存对话历史（需认证）
GET    /api/topics/:id/chat-history       - 获取对话历史（创建者，需认证）
POST   /api/topics/:id/publish            - 发布专题网站（需认证）
POST   /api/topics/:id/share              - 生成分享链接（需认证）
```

**创建专题请求：**
```json
{
  "title": "机器学习入门",
  "description": "从基础概念到实践应用的机器学习专题"
}
```

**保存文件快照请求：**
```json
{
  "files_snapshot": {
    "index.html": "<!DOCTYPE html><html><body>...</body></html>",
    "style.css": "body { ... }",
    "script.js": "// ...",
    "package.json": "{ \"name\": \"topic-site\", ... }"
  }
}
```

**专题详情响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "机器学习入门",
    "description": "从基础概念到实践应用的机器学习专题",
    "type": "website",
    "files_snapshot": { "index.html": "..." },
    "chat_history": [...],
    "published_url": "https://example.com/topic/1",
    "share_link": "https://example.com/share/abc123",
    "created_by": 1,
    "status": "published",
    "created_at": "2026-04-01T00:00:00.000Z",
    "updated_at": "2026-04-01T00:00:00.000Z"
  }
}
```

### AI Agent

所有 AI Agent 通过统一对话 API（OpenAI 兼容格式）：

```
POST   /api/ai/chat          - AI 对话（需认证）
```

### LLM 代理（专题搭建 Agent）

前端搭建 Agent 通过 OpenAI SDK 直接调用后端 LLM 代理端点，用于在网站编辑器中生成和修改网站代码：

```
POST   /api/llm/chat/completions    - LLM 对话（需认证，支持流式响应）
```

**请求参数：**
```json
{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "你是一名专业的前端开发者..." },
    { "role": "user", "content": "帮我做一个课程网站，风格简约" }
  ],
  "response_format": { "type": "json_object" },
  "stream": true
}
```

**实现位置：** `services/topic-space/src/routes/llmRoutes.ts`、`services/topic-space/src/services/llmProvider.ts`

**请求参数（OpenAI API 格式）：**
```json
{
  "model": "gpt-5.4",
  "messages": [
    {
      "role": "user",
      "content": "帮我创建一个关于机器学习的专题网站"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_topic_info",
        "description": "获取专题基础信息",
        "parameters": {
          "type": "object",
          "properties": {
            "topic_id": {"type": "integer", "description": "专题ID"}
          },
          "required": ["topic_id"]
        }
      }
    }
  ],
  "metadata": {
    "topic_id": 1,
    "agent_type": "building"
  }
}
```

**响应（OpenAI API 格式）：**
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "好的！我来帮你创建一个机器学习专题网站。首先让我了解一些你的偏好...",
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "get_topic_info",
              "arguments": "{\"topic_id\": 1}"
            }
          }
        ]
      }
    }
  ]
}
```

**详细设计：** Agent 的工具定义、Function Calling 流程详见 [AI Agent 系统](./agents.md)

## 权限控制

### API 权限矩阵

| 端点 | 访客 | 用户（非editor） | 用户（editor） |
|------|:----:|:----------------:|:--------------:|
| GET /api/topics | ✓ 所有已发布的 | ✓ 所有已发布的 | ✓ 自己参与的 + 所有已发布的（含draft） |
| GET /api/topics/:id | ✓ 所有已发布的 | ✓ 所有已发布的 | ✓ 自己参与的 + 所有已发布的 |
| GET /api/topics/:id/files | ✓ 所有已发布的 | ✓ 所有已发布的 | ✓ 自己参与的 + 所有已发布的 |
| POST /api/topics | ✗ | ✓ | ✓ |
| PUT /api/topics/:id | ✗ | ✗ | ✓ 自己参与的 |
| PATCH /api/topics/:id/status | ✗ | ✗ | ✓ 自己参与的 |
| POST /api/topics/:id/files | ✗ | ✗ | ✓ 自己参与的 |
| POST /api/topics/:id/chat-history | ✗ | ✗ | ✓ 自己参与的 |
| GET /api/topics/:id/chat-history | ✗ | ✗ | ✓ 自己参与的 |
| POST /api/topics/:id/publish | ✗ | ✗ | ✓ 自己参与的 |
| POST /api/topics/:id/share | ✗ | ✗ | ✓ 自己参与的 |

#### AI Agent 权限

| Agent 类型 | 访客 | 用户（非editor） | 用户（editor） |
|------|:----:|:----------------:|:--------------:|
| 学习助手 Agent（learning） | ✗ | ✓ 所有已发布的 | ✓ |
| 专题搭建 Agent（building） | ✗ | ✗ | ✓ 有编辑权限的专题 |

### 公开访问规则

**完全公开访问：**
- 所有已发布的专题对所有人公开可见（包括未登录访客）
- 访客可以查看任何已发布专题的详情和网站文件
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
- JWT payload 包含：`{ id, username, email, role }`
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
      "id": "1",
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
- GET /api/topics/:id/files
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
GET /api/topics?created_by=1
```

## 与旧设计的差异

### 已移除的 API

根据新的统一网站模型，以下 API 端点已被移除：

- ❌ `GET /api/topics?type=knowledge` - 类型过滤（统一为 website）
- ❌ `POST /api/topics/:id/pages` - Markdown 页面创建
- ❌ `GET /api/topics/:id/pages` - Markdown 页面列表
- ❌ `GET /api/pages/:id` - Markdown 页面详情
- ❌ `PUT /api/pages/:id` - Markdown 页面更新
- ❌ `DELETE /api/pages/:id` - Markdown 页面删除
- ❌ `PATCH /api/topics/:id/pages/reorder` - 页面重排序
- ❌ `POST /api/topics/:id/website/upload` - ZIP 上传
- ❌ `PUT /api/topics/:id/website/upload` - ZIP 更新
- ❌ `DELETE /api/topics/:id/website` - 网站删除
- ❌ `GET /api/topics/:id/website/stats` - 访问统计

### 新的 API

- ✅ `POST /api/topics/:id/files` - 保存文件快照
- ✅ `GET /api/topics/:id/files` - 获取文件快照
- ✅ `POST /api/topics/:id/chat-history` - 保存对话历史
- ✅ `GET /api/topics/:id/chat-history` - 获取对话历史
- ✅ `POST /api/topics/:id/publish` - 发布专题网站
- ✅ `POST /api/topics/:id/share` - 生成分享链接

## 相关文档

- [产品概述](./overview.md)
- [用户角色与权限](./user-roles.md)
- [功能清单](./features.md)
- [数据模型](./data-models.md)
- [AI Agent 系统](./agents.md)
