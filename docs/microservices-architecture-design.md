# 微服务架构重构设计方案

## Context

**状态：已实现 ✅**

**问题/需求：** 当前 web-learn 是一个单体 Express 应用，按 `controllers/services/routes` 分层。随着功能增长，需要拆分为独立部署和扩缩容的微服务架构。

**目标：** 每个微服务作为独立的 pnpm workspace package，自包含完整实现，不再按传统分层组织代码。

**完成时间：** 2026-04-06
**实现分支：** `copilot/refactor-microservices-architecture-docs`
**验证状态：** 所有服务已实现并通过生产就绪审查

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
| Auth | 3001 | 用户注册/登录/JWT 颁发 | `auth_users` |
| Topic Space | 3002 | 专题 + 页面 CRUD + 网站上传 | `topic_topics`, `topic_topic_pages` |
| AI | 3003 | AI 对话 + 工具执行 | 共享 `auth_users`, `topic_topics`, `topic_topic_pages` |

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

共享单一 MySQL 数据库，通过表前缀实现服务间数据隔离：
- `auth_users` → Auth Service（用户认证）
- `topic_topics`, `topic_topic_pages` → Topic Space Service（专题管理）
- AI Service 通过 HTTP 调用访问其他服务数据，不直接操作表

**生产环境：** 使用 `sequelize-cli` 或 `umzug` 进行受控迁移，不依赖 `sync({ alter: true })`

## Docker 配置（已实现）

- 所有服务配置 `NODE_ENV=production`
- 健康检查通过 `/health` 端点实现
- Gateway `depends_on` 等待下游服务健康
- MySQL 版本固定为 `mysql:8.0`
- `.dockerignore` 排除敏感文件和构建产物

## 分阶段迁移计划（已完成）

### Phase 1: Workspace 结构 + Gateway ✅
- 创建 `services/` + `packages/` 目录
- 创建 pnpm-workspace.yaml
- 实现 Gateway 的路由转发（HTTP proxy）
- 移除 `backend/` 单体应用（功能已完全迁移到微服务）

### Phase 2: Auth Service 独立 ✅
- 创建 `services/auth` 包
- 迁移 auth 域代码
- Gateway 集成 Auth Service
- 添加 JWT 算法强制和认证端点限流

### Phase 3: Topic Space Service 独立 ✅
- 创建 `services/topic-space` 包
- 迁移 topic + page 域代码
- 实现 Null Storage Service 模式
- Redis Pub/Sub 待后续实现

### Phase 4: AI Service 独立 ✅
- 创建 `services/ai` 包
- 迁移 AI 域代码
- 实现服务间调用
- AI agent tools 添加查询限制和安全转义

### Phase 5: Docker Compose ✅
- 每个服务 Dockerfile（包含 packages/）
- docker-compose.yml 编排（健康检查、版本固定）
- 移除 `backend/` 目录（单体应用已完全被微服务替代）

## 验证方式

1. 各服务独立测试：`pnpm --filter <pkg> test`
2. Docker Compose 全流程测试
3. 手动验证注册/登录/专题/AI 对话全流程
4. 生产就绪审查：所有 Critical/Important 问题已修复

## 安全加固（已实现）

- JWT verify 强制使用 `HS256` 算法
- Auth 端点添加 rate limiting（login: 15/15min, register: 5/hour）
- Gateway 全局限流（600/min）
- SQL LIKE 查询特殊字符转义
- 环境变量支持 `DOTENV_CONFIG_PATH` 自定义配置路径
