# 前端架构说明

> 最后更新：2026-04-06

## 1. 架构概览

**前后端分离：**
- 前端：React SPA（端口 5173 开发，生产环境静态托管）
- 后端：微服务架构，通过 API Gateway 统一入口（端口 3000）
- 前端所有 API 请求统一发往 Gateway：`http://localhost:3000/api/*`

**微服务路由：**
- `/api/auth/*` → Auth Service
- `/api/users/*` → Auth Service
- `/api/topics/*` → Topic Space Service
- `/api/pages/*` → Topic Space Service
- `/api/ai/*` → AI Service

## 2. 路由与页面分层

- `TopicDetailPage` 负责按 `topic.type` 分流：
  - `knowledge` -> `KnowledgeTopicPage`
  - `website` -> `WebsiteTopicPage`
- 编辑路由按专题类型分流：
  - `KnowledgeEditorPage`
  - `WebsiteEditorPage`

## 2. 知识库页面体系

- `KnowledgeTopicPage`
  - 负责公开浏览知识库页面树与 Markdown 内容。
  - 使用 `PageTreeNav` 渲染树导航。
  - 使用 `AIChatSidebar(agentType=learning)` 提供学习助手。
- `KnowledgeEditorPage`
  - 负责页面树编辑、Markdown 编辑、手动保存与自动保存。
  - 使用 `PageTreeEditor` 做页面增删与结构调整入口。
  - 使用 `AIChatSidebar(agentType=building)` 提供搭建助手。
  - 通过对话框替代 `window.prompt/confirm`。

## 3. 网站专题体系

- `WebsiteTopicPage`
  - 负责网站专题只读浏览与全屏预览。
  - 使用 iframe 加载 `topic.websiteUrl`。
- `WebsiteEditorPage`
  - 负责 ZIP 上传、删除、统计信息展示与预览。

## 4. 共享组件与工具

- `AIChatSidebar`
  - 统一聊天 UI，按 `agentType` 区分学习/搭建模式。
  - 对 `topicId` 进行格式校验，避免无效请求。
- `PageTreeNav` / `PageTreeEditor`
  - 分别面向浏览与编辑场景复用页面树渲染逻辑。
- `LoadingOverlay`
  - 统一加载状态展示样式。
- `frontend/src/utils/treeUtils.ts`
  - 提供 `flattenPages` / `findNode` / `findFirstPage`，避免页面层重复实现。
- `frontend/src/utils/errors.ts`
  - 提供统一 API 错误信息提取。

## 5. 数据流与接口边界

- 页面仅通过 `frontend/src/services/api.ts` 与后端通信。
- 所有请求发往 Gateway：`http://localhost:3000/api/*`（生产环境配置为实际域名）
- API 层统一处理：
  - axios 基础配置（baseURL 指向 Gateway）
  - token 注入（JWT Bearer Token）
  - 非公开请求的 401 跳转
  - 全局错误处理
- 页面不直接拼接请求 URL，全部通过 `topicApi` / `pageApi` / `aiApi` 调用。

**Gateway 转发：**
- Gateway 处理 CORS、JWT 验证、请求限流
- 透明转发到下游微服务
- 前端无感知微服务拆分细节

## 6. 状态管理约定

- 认证态：`useAuthStore`（存储 JWT token、用户信息）
- 轻量通知：`useToastStore`
- 页面内部请求状态（loading/saving/error）保留在组件内，避免过度全局化。

## 7. 开发与部署

**开发环境：**
```
前端：http://localhost:5173
Gateway：http://localhost:3000
```

**API 代理配置（vite.config.ts）：**
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    }
  }
}
```

**生产环境：**
- 前端静态文件托管（Nginx/CDN）
- API 请求发往生产 Gateway URL
- 环境变量配置：`VITE_API_BASE_URL`
