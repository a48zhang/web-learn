# API 设计

> 最后更新：2026-04-06

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
- `/api/pages/*` → Topic Space Service (端口 3002)
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

```
POST   /api/topics           - 创建专题（教师，需认证）
GET    /api/topics           - 获取专题列表（公开访问）
GET    /api/topics/:id       - 获取专题详情（公开访问，已发布）
PUT    /api/topics/:id       - 更新专题（创建者，需认证）
PATCH  /api/topics/:id/status - 更新专题状态（创建者，需认证）
```

#### 知识库版专题（Markdown）

```
POST   /api/topics/:id/pages            - 创建页面（需认证）
GET    /api/topics/:id/pages            - 获取页面列表（公开访问）
GET    /api/pages/:id                   - 获取页面详情（公开访问）
PUT    /api/pages/:id                   - 更新页面 Markdown（需认证）
DELETE /api/pages/:id                   - 删除页面（需认证）
PATCH  /api/topics/:id/pages/reorder    - 调整页面顺序（需认证）
```

**页面创建请求：**
```json
{
  "title": "神经网络基础",
  "parent_page_id": null,
  "content": ""
}
```

**页面更新请求：**
```json
{
  "content": "# 第一章：神经网络概述\n\n神经网络是深度学习的基础...\n\n## 1.1 基本概念\n\n- 输入层\n- 隐藏层\n- 输出层\n\n![网络结构图](https://example.com/network.png)\n\n```python\nimport torch\n```"
}
```

**页面详情响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "神经网络基础",
    "content": "# 第一章...",
    "parent_page_id": null,
    "order": 1,
    "created_at": "2026-04-01T00:00:00.000Z",
    "updated_at": "2026-04-01T00:00:00.000Z"
  }
}
```

#### 网站版专题

```
POST   /api/topics/:id/website/upload   - 上传网站代码（需认证）
PUT    /api/topics/:id/website/upload   - 更新网站代码（需认证）
DELETE /api/topics/:id/website          - 删除网站代码（需认证）
GET    /api/topics/:id/website/stats    - 获取访问统计（需认证）
```

### AI Agent

所有 AI Agent 通过统一对话 API（OpenAI 兼容格式）：

```
POST   /api/ai/chat          - AI 对话（需认证）
```

**请求参数（OpenAI API 格式）：**
```json
{
  "model": "gpt-5.4",
  "messages": [
    {
      "role": "user",
      "content": "这个专题的核心内容是什么？"
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
    "agent_type": "learning"
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
        "content": "根据专题信息，核心内容是...",
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

| 端点 | 访客 | 学生 | 教师 |
|------|:----:|:----:|:----:|
| GET /api/topics | ✓ 所有已发布的 | ✓ 所有已发布的 | ✓ 自己创建的 + 所有已发布的 |
| GET /api/topics/:id | ✓ 所有已发布的 | ✓ 所有已发布的 | ✓ 自己创建的 + 所有已发布的 |
| POST /api/topics | ✗ | ✗ | ✓ |
| PUT /api/topics/:id | ✗ | ✗ | ✓ 自己创建的 |
| PATCH /api/topics/:id/status | ✗ | ✗ | ✓ 自己创建的 |

#### 知识库版专题权限（Markdown）

| 端点 | 访客 | 学生 | 教师 |
|------|:----:|:----:|:----:|
| GET /api/topics/:id/pages | ✓ 所有已发布的 | ✓ 所有已发布的 | ✓ 所有已发布的 |
| GET /api/pages/:id | ✓ 所有已发布的 | ✓ 所有已发布的 | ✓ 所有已发布的 |
| POST /api/topics/:id/pages | ✗ | ✗ | ✓ 自己创建的 |
| PUT /api/pages/:id | ✗ | ✗ | ✓ 专题创建者 |
| DELETE /api/pages/:id | ✗ | ✗ | ✓ 专题创建者 |
| PATCH /api/topics/:id/pages/reorder | ✗ | ✗ | ✓ 专题创建者 |

#### 网站版专题权限

| 端点 | 访客 | 学生 | 教师 |
|------|:----:|:----:|:----:|
| POST /api/topics/:id/website/upload | ✗ | ✗ | ✓ 自己创建的 |
| PUT /api/topics/:id/website/upload | ✗ | ✗ | ✓ 自己创建的 |
| DELETE /api/topics/:id/website | ✗ | ✗ | ✓ 自己创建的 |
| GET /api/topics/:id/website/stats | ✗ | ✗ | ✓ 自己创建的 |

#### AI Agent 权限

| Agent 类型 | 访客 | 学生 | 教师 |
|------|:----:|:----:|:----:|
| 学习助手 Agent（learning） | ✗ | ✓ 所有已发布的 | ✓ 所有已发布的 |
| 专题搭建 Agent（building） | ✗ | ✗ | ✓ 自己创建的 |

### 公开访问规则

**完全公开访问：**
- 所有已发布的专题对所有人公开可见（包括未登录访客）
- 访客可以查看任何已发布专题的详情和页面内容
- 不需要"加入"操作
- 健康检查端点（`/health`）对所有服务公开

**需认证的操作：**
- 使用 AI 学习助手（学生身份）
- 使用 AI 专题搭建助手（教师身份）
- 创建专题（教师身份）
- 管理操作（创建者身份）

## 微服务架构

### Gateway 路由转发

**路由映射：**
```typescript
// Gateway 转发配置
app.use('/api/auth', proxy('http://auth:3001'))     // Auth Service
app.use('/api/users', proxy('http://auth:3001'))    // Auth Service
app.use('/api/topics', proxy('http://topic-space:3002')) // Topic Space
app.use('/api/pages', proxy('http://topic-space:3002'))  // Topic Space
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
  "timestamp": "2026-04-06T12:00:00.000Z"
}
```

### 服务间数据共享

**数据库表隔离：**
- `auth_users` → Auth Service 独立管理
- `topic_topics`, `topic_topic_pages` → Topic Space Service 管理
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
      "username": "teacher1",
      "role": "teacher"
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
- GET /api/topics/:id/pages
- GET /api/pages/:id
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
GET /api/topics?type=knowledge
```

## 相关文档

- [产品概述](./overview.md)
- [用户角色与权限](./user-roles.md)
- [功能清单](./features.md)
- [数据模型](./data-models.md)
- [AI Agent 系统](./agents.md)
