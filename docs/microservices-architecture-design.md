# 微服务架构重构设计方案

## Context

**问题/需求：** 当前 web-learn 是一个单体 Express 应用，按 `controllers/services/routes` 分层。随着功能增长，需要拆分为独立部署和扩缩容的微服务架构。

**目标：** 每个微服务作为独立的 pnpm workspace package，自包含完整实现，不再按传统分层组织代码。

## 架构概览

```
浏览器
  │
  │ HTTPS/WSS
  ▼
┌──────────────────────────────────┐
│         API Gateway              │  ← 前端唯一入口
└──┬──────────┬───────────┬───────┘
   │          │           │
   ▼          ▼           ▼
┌──────┐ ┌──────────┐ ┌──────┐
│ Auth │ │  Topic   │ │  AI  │
│ Svc  │ │  Space   │ │ Svc  │
└──┬───┘ │   Svc    │ └──┬───┘
   │     └─────┬────┘    │
   └───────────┼─────────┘
               │
        Redis Pub/Sub
        (事件总线)
               │
               ▼
         ┌──────────┐
         │  MySQL   │  ← 暂时共享单一数据库
         └──────────┘
```

## 目录结构（pnpm Workspace）

每个微服务是独立的 pnpm package，自包含完整实现：

```
services/
  gateway/            # API Gateway
  │   ├── package.json
  │   └── src/
  │       ├── index.ts          # 启动入口
  │       ├── app.ts            # Express app
  │       ├── routes.ts         # 路由转发配置
  │       └── middleware/
  │
  auth/               # Auth Service（用户注册/登录/JWT）
  │   ├── package.json
  │   └── src/
  │       ├── index.ts
  │       ├── app.ts
  │       └── routes/
  │           └── auth.ts
  │
  topic-space/        # Topic + Page Service
  │   ├── package.json
  │   └── src/
  │       ├── index.ts
  │       ├── app.ts
  │       └── routes/
  │           ├── topics.ts
  │           └── pages.ts
  │
  ai/                 # AI Service
      ├── package.json
      └── src/
          ├── index.ts
          ├── app.ts
          └── routes/
              └── chat.ts

packages/
  shared/             # 共享类型、DTO、常量
      ├── package.json
      └── src/
  utils/              # 共享工具（config、redis、logger）
      ├── package.json
      └── src/

pnpm-workspace.yaml
docker-compose.yml
```

### 包结构原则

- **自包含**：每个 microservice 是完整 package，有自己的 `package.json`、依赖、src
- **按域组织**：不再按 `controllers/services/routes` 分层，而是按 `routes/auth.ts`、`routes/topics.ts` 按域组织
- **共享抽离**：`packages/shared` 存放所有跨服务复用的类型；`packages/utils` 存放通用工具
- **Workspace 引用**：`"@web-learn/gateway": "workspace:*"` 形式引用

## 服务划分

| 服务 | 端口 | 职责 | 数据库表 |
|------|------|------|----------|
| Gateway | 3000 | 路由转发、鉴权、限流 | 无 |
| Auth | 3001 | 用户注册/登录/JWT 颁发 | `users` |
| Topic Space | 3002 | 专题 + 页面 CRUD + 网站上传 | `topics`, `topic_pages` |
| AI | 3003 | AI 对话 + 工具执行 | 无 |

## 服务间通信

### HTTP 同步调用（带 JWT）
- Gateway → 各 Service 转发请求
- Topic Space / AI → Auth Service 验证 token
- AI → Topic Space Service 读写页面

### Redis Pub/Sub 异步事件
- `user:created` — 用户注册
- `topic:published` — 专题发布
- `page:updated` — 页面更新

## 数据库策略

暂时共享单一 MySQL 数据库，通过表前缀隔离：
- `auth_users` → Auth Service
- `topic_topics`, `topic_pages` → Topic Space Service

## 分阶段迁移计划

### Phase 1: Workspace 结构 + Gateway
- 创建 `services/` + `packages/` 目录
- 创建 pnpm-workspace.yaml
- 实现 Gateway 的路由转发（HTTP proxy）
- 保留现有 `backend/` 作为可运行的 monolith

### Phase 2: Auth Service 独立
- 创建 `services/auth` 包
- 迁移 auth 域代码
- Gateway 集成 Auth Service

### Phase 3: Topic Space Service 独立
- 创建 `services/topic-space` 包
- 迁移 topic + page 域代码
- 实现 Redis Pub/Sub

### Phase 4: AI Service 独立
- 创建 `services/ai` 包
- 迁移 AI 域代码
- 实现服务间调用

### Phase 5: Docker Compose
- 每个服务 Dockerfile
- docker-compose.yml 编排
- 清理 `backend/` 目录

## 验证方式

1. 各服务独立测试：`pnpm --filter <pkg> test`
2. Docker Compose 全流程测试
3. 手动验证注册/登录/专题/AI 对话全流程
