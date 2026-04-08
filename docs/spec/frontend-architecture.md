# 前端架构说明

> 最后更新：2026-04-07

## 1. 架构概览

**前后端分离：**
- 前端：React SPA（端口 5173 开发，生产环境静态托管）
- 后端：微服务架构，通过 API Gateway 统一入口（端口 3000）
- 前端所有 API 请求统一发往 Gateway：`http://localhost:3000/api/*`

**微服务路由：**
- `/api/auth/*` → Auth Service
- `/api/users/*` → Auth Service
- `/api/topics/*` → Topic Space Service
- `/api/ai/*` → AI Service

## 2. 路由与页面分层

- `TopicDetailPage` 统一展示专题网站（不再按类型分流）
- 编辑路由统一为 `WebsiteEditorPage`（VSCode 风格三栏布局）

## 2. 专题网站编辑器体系

- `TopicDetailPage`
  - 负责公开浏览专题网站，通过 iframe 预览网站内容
  - 使用 `AIChatSidebar(agentType=learning)` 提供学习助手
- `WebsiteEditorPage`
  - 负责 VSCode 风格三栏布局编辑器
  - 左侧：文件树面板（FileTreePanel）
  - 中间：Agent 对话面板（AIChatPanel, agentType=building）
  - 右侧：WebContainer 预览面板（PreviewPanel）
  - 使用 Monaco Editor 进行文件编辑
  - WebContainer 在后台运行 Node.js 环境

## 3. 共享组件与工具

- `AIChatSidebar` / `AIChatPanel`
  - 统一聊天 UI，按 `agentType` 区分学习/搭建模式
  - 对 `topicId` 进行格式校验，避免无效请求
- `SettingsModal`
  - 用户设置弹窗：个人资料、修改密码、主题切换
  - 集成在 Dashboard 页面
- `LoadingOverlay`
  - 统一加载状态展示样式
- `frontend/src/utils/treeUtils.ts`
  - 提供文件树操作工具
- `frontend/src/utils/errors.ts`
  - 提供统一 API 错误信息提取
- `frontend/src/stores/themeStore.ts`
  - 主题状态管理（light/dark 模式）
- `frontend/src/stores/authStore.ts`
  - 认证状态管理

## 4. 编辑器核心组件

### FileTreePanel
- 展示专题网站的文件结构
- 支持文件操作：新建、重命名、删除
- 双击文件在 Monaco Editor 中打开
- WebContainer FS API 同步

### AIChatPanel (agentType=building)
- 与搭建助手 Agent 对话
- 支持文件上传作为参考（Markdown/Word/PDF）
- 渲染代码块和对话历史
- Agent 主动询问偏好（风格、布局、颜色等）

### PreviewPanel
- WebContainer 运行网站
- iframe 嵌入实时预览
- 支持响应式预览切换（桌面/平板/手机）
- 自动热重载

## 5. 数据流与接口边界

- 页面仅通过 `frontend/src/services/api.ts` 与后端通信
- 所有请求发往 Gateway：`http://localhost:3000/api/*`（生产环境配置为实际域名）
- API 层统一处理：
  - axios 基础配置（baseURL 指向 Gateway）
  - token 注入（JWT Bearer Token）
  - 非公开请求的 401 跳转
  - 全局错误处理
- 页面不直接拼接请求 URL，全部通过 `topicApi` / `aiApi` / `userApi` 调用

**Gateway 转发：**
- Gateway 处理 CORS、JWT 验证、请求限流
- 透明转发到下游微服务
- 前端无感知微服务拆分细节

## 6. 状态管理约定

- 认证态：`useAuthStore`（存储 JWT token、用户信息）
- 主题态：`useThemeStore`（light/dark 模式切换）
- 轻量通知：`useToastStore`
- 编辑器状态：保留在 `WebsiteEditorPage` 组件内（避免过度全局化）
- WebContainer 实例：编辑器局部状态

## 7. WebContainer 集成

**初始化流程：**
```typescript
// 1. 加载 WebContainer
const container = await WebContainer.boot();

// 2. 挂载文件系统
await container.mount(filesSnapshot);

// 3. 安装依赖
await container.spawn('npm', ['install']);

// 4. 启动开发服务器
await container.spawn('npm', ['run', 'dev']);

// 5. 获取预览 URL
const url = container.getServerUrl(5173);
```

**文件同步：**
- 编辑器修改 → WebContainer fs.writeFile
- Agent 生成代码 → WebContainer fs.writeFile
- 保存到后端 → 提交 filesSnapshot

## 8. 开发与部署

**开发环境：**
```
前端：http://localhost:5173
Gateway：http://localhost:3000（前端通过 proxy 访问）
```

**API 代理配置（vite.config.ts）：**
```typescript
server: {
  port: 5173,  // 前端开发服务器端口
  proxy: {
    '/api': {
      target: 'http://localhost:3000',  // Gateway 端口
      changeOrigin: true,
    }
  }
}
```

**生产环境：**
- 前端静态文件托管（Nginx/CDN）
- API 请求发往生产 Gateway URL
- 环境变量配置：`VITE_API_URL`

## 9. 与旧设计的差异

### 已移除的页面

根据新的统一网站模型，以下页面已被移除：

- ❌ `KnowledgeTopicPage` - 知识库浏览页面
- ❌ `KnowledgeEditorPage` - 知识库编辑页面
- ❌ `WebsiteTopicPage` - 旧版网站预览页面
- ❌ `WebsiteEditorPage` - 旧版 ZIP 上传页面
- ❌ `PageTreeNav` - 知识库页面树导航
- ❌ `PageTreeEditor` - 知识库页面树编辑器

### 新增/重构的页面

- ✅ `TopicDetailPage` - 统一的专题详情页，iframe 预览网站
- ✅ `WebsiteEditorPage` - VSCode 风格三栏编辑器
- ✅ `FileTreePanel` - 文件树面板
- ✅ `AIChatPanel` - Agent 对话面板
- ✅ `PreviewPanel` - WebContainer 预览面板
- ✅ `SettingsModal` - 用户设置弹窗

## 相关文档

- [产品概述](./overview.md)
- [功能清单](./features.md)
- [API 设计](./api-design.md)
- [技术架构](./architecture.md)
