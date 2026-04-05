# 开发计划：从当前状态到 Spec 目标状态

> 最后更新：2026-04-03（v2）

## 概述

将当前项目重构为专题学习平台。主要工作：
- 简化数据模型（移除 Task/Submission/Review/Resource/TopicMember）
- 新增专题类型支持（知识库型 + 网站型）
- 新增 TopicPage 模型（Markdown 内容）
- 新增 AI Agent 系统（学习助手 + 搭建助手）

### Phase 划分与并行策略

```
Phase 1: 后端基础重构（模型 + 清理 + 知识库 API）
Phase 2: 前端重构（知识库型完整体验）
Phase 3: AI Agent - 学习助手
Phase 4: AI Agent - 搭建助手（知识库型）
Phase 5: 网站型专题（后端 + 前端 + AI）
Phase 6: 测试 + 文档

并行关系：
- Phase 1 → Phase 2（前端依赖后端 API）
- Phase 1 → Phase 3（AI 依赖模型和 API）
- Phase 3 → Phase 4（搭建助手复用学习助手基础设施）
- Phase 2 + Phase 4 → Phase 5（网站型依赖知识库型完成）
- 全部 → Phase 6
```

---

## 当前状态与目标差异

### 需要删除的

| 模型/模块 | 当前 | 目标 | 涉及文件 |
|-----------|------|------|---------|
| TopicMember | 存在 | 删除 | Model, Controller(joinTopic), Route, 前端 |
| Resource | 存在 | 删除 | Model, Controller, Route, Middleware(upload), 前端 |
| Task | 存在 | 删除 | Model, Controller, Route, 前端 |
| Submission | 存在 | 删除 | Model, Controller, Route, 前端 |
| Review | 存在 | 删除 | Model, Controller, Route, 前端 |

### 需要修改的

| 模块 | 变更 |
|------|------|
| User.role | 枚举改为 `admin \| teacher \| student`（保留 admin，移除 guest） |
| Topic | 移除 `deadline`，新增 `type` + `website_url` |
| authController | 注册不允许 guest，admin 角色保留但注册时不可选 |
| topicController | 支持 type 字段，移除 joinTopic/deadline 逻辑 |
| 公开访问 | GET /api/topics、GET /api/topics/:id 改为无需认证 |

### 需要新建的

| 模块 | 说明 |
|------|------|
| TopicPage 模型 | Markdown 页面，支持嵌套 |
| pageController + pageRoutes | 页面 CRUD + 排序 |
| aiController + aiRoutes | AI 对话，Function Calling |
| 前端：知识库编辑器 | Markdown 编辑 + 页面树 |
| 前端：AI 侧边栏 | 学习助手 + 搭建助手对话 |
| 前端：网站上传 | ZIP 上传 + 预览 |

---

## Phase 1: 后端基础重构

**目标：** 完成数据模型变更 + 知识库型 API + 清理旧代码
**产出：** 后端 API 可用，支持认证、专题 CRUD、页面 CRUD、公开访问

### 1.1 修改 User 模型

- [ ] `backend/src/models/User.ts`：role 枚举改为 `'admin' | 'teacher' | 'student'`
- [ ] `shared/src/types/index.ts`：同步更新 User 类型定义

### 1.2 修改 Topic 模型

- [ ] `backend/src/models/Topic.ts`：
  - 移除 `deadline` 字段
  - 新增 `type: ENUM('knowledge', 'website')`, NOT NULL, DEFAULT 'knowledge'
  - 新增 `website_url: VARCHAR(500)`, NULLABLE
- [ ] `shared/src/types/index.ts`：同步更新 Topic 类型定义

### 1.3 新建 TopicPage 模型

- [ ] 创建 `backend/src/models/TopicPage.ts`：
  - 字段：id, topic_id (FK), title (VARCHAR 200), content (TEXT), parent_page_id (FK 自引用, NULLABLE), order (INT)
  - `underscored: true`，与其他模型一致
- [ ] `backend/src/models/index.ts`：
  - 导入 TopicPage
  - 定义 Topic.hasMany(TopicPage)
  - 定义 TopicPage.belongsTo(Topic)
  - 定义 TopicPage 自引用关联 (parent → children)
- [ ] `shared/src/types/index.ts`：新增 TopicPage 接口

### 1.4 删除废弃模型

- [ ] 删除 `backend/src/models/TopicMember.ts`
- [ ] 删除 `backend/src/models/Resource.ts`
- [ ] 删除 `backend/src/models/Task.ts`
- [ ] 删除 `backend/src/models/Submission.ts`
- [ ] 删除 `backend/src/models/Review.ts`
- [ ] `backend/src/models/index.ts`：移除所有废弃模型的导入和关联
- [ ] `backend/src/models/User.ts`：移除对废弃模型的 HasMany 关联
- [ ] `backend/src/models/Topic.ts`：移除对废弃模型的 HasMany/BelongsToMany 关联

### 1.5 删除废弃 Controller + Route

- [ ] 删除 `backend/src/controllers/resourceController.ts`
- [ ] 删除 `backend/src/controllers/taskController.ts`
- [ ] 删除 `backend/src/controllers/submissionController.ts`
- [ ] 删除 `backend/src/controllers/reviewController.ts`
- [ ] 删除 `backend/src/routes/resourceRoutes.ts`
- [ ] 删除 `backend/src/routes/taskRoutes.ts`
- [ ] 删除 `backend/src/routes/submissionRoutes.ts`
- [ ] 删除 `backend/src/routes/reviewRoutes.ts`
- [ ] `backend/src/app.ts`：移除废弃路由注册
- [ ] 删除 `backend/src/middlewares/uploadMiddleware.ts`（资源上传不再需要，网站型上传后续重建）

### 1.6 修改 authController

- [ ] `backend/src/controllers/authController.ts`：
  - 注册逻辑：仅允许 teacher/student 注册（admin 不可通过注册创建）
  - 移除 guest 角色相关逻辑
- [ ] `backend/src/middlewares/authMiddleware.ts`：保持不变（JWT 验证逻辑通用）

### 1.7 修改 topicController + topicRoutes

- [ ] `backend/src/controllers/topicController.ts`：
  - `createTopic`：新增 type 参数（默认 knowledge），移除 deadline
  - `updateTopic`：支持 type、website_url，移除 deadline
  - `getTopics`：返回 type 字段，支持 `?type=knowledge` 过滤
  - `getTopicById`：返回 type、website_url
  - 删除 `joinTopic` 函数
- [ ] `backend/src/routes/topicRoutes.ts`：
  - 删除 `POST /api/topics/:id/join`
  - `GET /api/topics` 和 `GET /api/topics/:id` 改为公开访问（移除 authMiddleware）

### 1.8 新建 pageController + pageRoutes

- [ ] 创建 `backend/src/controllers/pageController.ts`：
  - `createPage(req, res)` — 创建页面（需认证，教师+专题创建者）
    - 参数：topic_id (URL), title, content?, parent_page_id?
    - 自动计算 order（同级最大 order + 1）
    - 校验：topic 必须是 knowledge 类型
  - `getPagesByTopic(req, res)` — 获取专题页面列表（公开访问）
    - 返回树状结构（嵌套 children）
  - `getPageById(req, res)` — 获取页面详情（公开访问）
    - 返回完整 Markdown content
  - `updatePage(req, res)` — 更新页面（需认证，专题创建者）
    - 可更新 title, content, parent_page_id
  - `deletePage(req, res)` — 删除页面（需认证，专题创建者）
    - 级联删除子页面
  - `reorderPages(req, res)` — 调整顺序（需认证，专题创建者）
    - 参数：`{ pages: [{ id, order, parent_page_id }] }`
- [ ] 创建 `backend/src/routes/pageRoutes.ts`：
  ```
  POST   /api/topics/:id/pages           — authMiddleware → createPage
  GET    /api/topics/:id/pages           — (公开) → getPagesByTopic
  GET    /api/pages/:id                  — (公开) → getPageById
  PUT    /api/pages/:id                  — authMiddleware → updatePage
  DELETE /api/pages/:id                  — authMiddleware → deletePage
  PATCH  /api/topics/:id/pages/reorder   — authMiddleware → reorderPages
  ```
- [ ] `backend/src/app.ts`：注册 pageRoutes

### 1.9 更新 shared 类型

- [ ] `shared/src/types/index.ts`：
  - 移除 Resource, Task, Submission, Review, TopicMember 接口
  - 更新 User 接口（role 类型）
  - 更新 Topic 接口（新增 type, website_url，移除 deadline）
  - 新增 TopicPage 接口
  - 更新 API 请求/响应 DTO

### 1.10 数据库同步

- [ ] `backend/src/server.ts`：
  - 更新 `sequelize.sync()` 逻辑
  - 如果有 `runMigration`，更新迁移脚本以适配新模型
  - 确保旧表在 sync 时不会报错（force: false 下旧表保留但不影响新代码）

### Phase 1 验收标准

- [ ] `pnpm --filter backend build` 编译通过
- [ ] 后端启动无报错
- [ ] POST /api/auth/register 只接受 teacher/student
- [ ] POST /api/topics 支持 type 字段
- [ ] GET /api/topics 无需认证即可访问
- [ ] 页面 CRUD API 全部可用
- [ ] 旧 API（resource/task/submission/review）全部 404

---

## Phase 2: 前端重构（知识库型完整体验）

**目标：** 前端适配新 API，实现知识库型专题的完整创建和浏览体验
**前置：** Phase 1

### 2.1 清理废弃前端代码

- [ ] 删除 `StudentSubmissionsPage` 组件
- [ ] 删除 `StudentFeedbackPage` 组件
- [ ] `TopicDetailPage`：移除资源、任务、提交、评价相关的 UI 区块
- [ ] `services/api.ts`：移除 resourceApi, taskApi, submissionApi, reviewApi
- [ ] 路由配置：移除废弃页面的路由

### 2.2 更新专题列表和创建

- [ ] `TopicListPage`：
  - 专题卡片显示 type 标签（知识库 / 网站）
  - 移除 deadline 显示
  - 移除"加入专题"按钮
  - 未登录用户也能浏览
- [ ] `TopicCreatePage`：
  - 新增 type 选择器（knowledge / website）
  - 移除 deadline 输入
- [ ] `services/api.ts`：更新 topicApi 匹配新字段

### 2.3 知识库型专题浏览页

- [ ] 新建 `KnowledgeTopicPage` 组件（或重构 TopicDetailPage）：
  - 左侧：页面树状导航（支持嵌套展开/折叠）
  - 右侧：Markdown 渲染区域
  - 集成 Markdown 渲染库（如 react-markdown + remark-gfm + rehype-highlight）
  - 支持代码高亮、图片、链接等
- [ ] 新建 `PageTreeNav` 组件：
  - 树状结构展示
  - 点击切换页面
  - 当前页面高亮
- [ ] `services/api.ts`：新增 pageApi（CRUD + reorder）

### 2.4 知识库型专题编辑页（教师）

- [ ] 新建 `KnowledgeEditorPage` 组件：
  - 左侧：可编辑的页面树（新增/删除/拖拽排序）
  - 右侧：Markdown 编辑器（如 @uiw/react-md-editor 或 CodeMirror + Markdown 扩展）
  - 支持实时预览（编辑/预览切换或分屏）
  - 保存按钮调用 PUT /api/pages/:id
- [ ] 新建 `PageTreeEditor` 组件：
  - 支持新增页面（+ 按钮）
  - 支持删除页面（确认弹窗）
  - 支持拖拽调整顺序和层级
  - 调用 PATCH /api/topics/:id/pages/reorder

### 2.5 更新路由和导航

- [ ] 路由配置：
  - `/topics/:id` → 知识库型浏览 / 网站型浏览（根据 type 分流）
  - `/topics/:id/edit` → 知识库型编辑（教师专用）
- [ ] 全局导航：更新菜单项
- [ ] `DashboardPage`：适配新数据结构

### 2.6 公开访问支持

- [ ] `useAuthStore`：支持未登录状态浏览
- [ ] 路由守卫：浏览页面不要求登录
- [ ] API 拦截器：GET 请求不强制携带 token

### Phase 2 验收标准

- [ ] 未登录用户可浏览已发布专题列表和知识库页面内容
- [ ] 教师可创建知识库型专题并编辑 Markdown 页面
- [ ] 页面树状导航正常工作（嵌套、展开/折叠）
- [ ] Markdown 渲染正确（代码高亮、图片、链接）
- [ ] 前端无废弃功能的残留 UI

---

## Phase 3: AI Agent - 学习助手

**目标：** 实现学习助手 Agent，学生和教师可以在专题内与 AI 对话
**前置：** Phase 1

### 3.1 后端 AI 基础设施

- [ ] `backend/package.json`：新增 `openai` 依赖
- [ ] `backend/src/utils/config.ts`：新增 AI 相关配置项
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL`（支持兼容 API）
  - `OPENAI_MODEL`（默认模型名）
- [ ] 创建 `backend/src/services/aiService.ts`：
  - OpenAI client 初始化
  - `chat(messages, tools, metadata)` → 封装 OpenAI API 调用
  - 处理 Function Calling 循环（tool_calls → 执行 → 返回结果 → 再次调用，直到返回 content）
  - 设置最大循环次数防止无限调用

### 3.2 学习助手工具函数实现

- [ ] 创建 `backend/src/services/agentTools.ts`：
  - `get_topic_info(topic_id)` → 查询 Topic 表，返回 title/description/type/status
  - `list_pages(topic_id)` → 查询 TopicPage 表，返回页面树结构（title + id + order）
  - `read_page(page_id)` → 查询 TopicPage 表，返回完整 Markdown content
  - `grep(topic_id, keyword)` → 在该 topic 所有 TopicPage.content 中搜索关键词，返回匹配片段
- [ ] 工具定义（OpenAI Function Calling JSON schema），与 agents.md spec 一致

### 3.3 学习助手 Controller + Route

- [ ] 创建 `backend/src/controllers/aiController.ts`：
  - `chat(req, res)`：
    - 参数：`{ messages, topic_id, agent_type: 'learning' }`
    - 验证：用户已登录，topic 存在且已发布
    - 注入 system prompt（带 topic 上下文信息）
    - 调用 aiService.chat，传入学习助手工具集
    - 返回 OpenAI 格式响应
- [ ] 创建 `backend/src/routes/aiRoutes.ts`：
  - `POST /api/ai/chat` — authMiddleware → chat
- [ ] `backend/src/app.ts`：注册 aiRoutes

### 3.4 上下文管理

- [ ] 上下文隔离：`agentType + topic_id + user_id` 为唯一键
- [ ] 选择存储方案：
  - 方案 A：前端管理 messages 数组，每次请求带完整历史（简单，推荐 MVP）
  - 方案 B：后端存储对话历史到数据库（需新建 ChatMessage 模型）
- [ ] MVP 阶段建议选方案 A，后续按需迁移

### 3.5 前端学习助手 UI

- [ ] 新建 `AIChatSidebar` 组件：
  - 可展开/收起的侧边栏
  - 消息列表（用户消息 + AI 回复）
  - 输入框 + 发送按钮
  - 加载状态指示
  - AI 回复支持 Markdown 渲染
- [ ] 在 `KnowledgeTopicPage`（浏览页）中集成侧边栏
- [ ] `services/api.ts`：新增 aiApi（POST /api/ai/chat）
- [ ] 传入当前 topic_id + agent_type: 'learning'

### Phase 3 验收标准

- [ ] 登录用户在浏览专题时可打开学习助手
- [ ] AI 可以回答关于专题内容的问题
- [ ] AI 回复引用具体页面内容（Function Calling 正常工作）
- [ ] 关键词搜索 (grep) 正常工作
- [ ] 切换专题时对话上下文重置
- [ ] 访客无法使用学习助手（返回 401）

---

## Phase 4: AI Agent - 搭建助手（知识库型）

**目标：** 教师在编辑专题时可使用 AI 助手创建和编辑页面内容
**前置：** Phase 3（复用 AI 基础设施）

### 4.1 搭建助手工具函数

- [ ] `backend/src/services/agentTools.ts` 新增：
  - `write_file(page_id, content)` → 更新 TopicPage.content（Markdown 写入）
  - `new_file(topic_id, title, parent_page_id?)` → 创建新 TopicPage 并返回 id
  - 权限校验：确保操作者是专题创建者

### 4.2 搭建助手 Controller 逻辑

- [ ] `backend/src/controllers/aiController.ts` 扩展 `chat` 函数：
  - 当 `agent_type: 'building'` 时：
    - 验证用户是教师且是专题创建者
    - 注入搭建助手的 system prompt
    - 传入搭建助手工具集（学习助手工具 + write_file + new_file）
  - 操作审计：记录所有写入操作日志

### 4.3 前端搭建助手 UI

- [ ] `AIChatSidebar` 扩展：
  - 根据 agent_type 切换 UI 模式
  - 搭建模式下显示操作确认提示（AI 创建/修改了页面）
  - 显示 AI 执行的写入操作记录
- [ ] 在 `KnowledgeEditorPage` 中集成搭建助手侧边栏
  - agent_type: 'building'
  - AI 修改页面后自动刷新编辑器内容

### Phase 4 验收标准

- [ ] 教师在编辑页面可使用搭建助手
- [ ] AI 可以创建新页面（new_file 工作正常）
- [ ] AI 可以编辑已有页面内容（write_file 工作正常）
- [ ] 学生无法使用搭建助手（返回 403）
- [ ] 非创建者教师无法使用搭建助手操作他人专题
- [ ] 操作后编辑器内容自动刷新

---

## Phase 5: 网站型专题

**目标：** 完整支持网站型专题（上传 HTML/CSS/JS 代码包、预览、AI 搭建）
**前置：** Phase 2 + Phase 4

> 此 Phase 涉及 OSS 集成、文件上传解压、静态托管、WebContainer 集成。

### 5.1 OSS 集成

- [ ] 选择 OSS 服务（阿里云 OSS / AWS S3 / MinIO 本地开发）
- [ ] `backend/package.json`：新增 OSS SDK 依赖
- [ ] `backend/src/utils/config.ts`：新增 OSS 配置项
  - `OSS_ENDPOINT`, `OSS_BUCKET`, `OSS_ACCESS_KEY`, `OSS_SECRET_KEY`
- [ ] 创建 `backend/src/services/ossService.ts`：
  - `uploadFile(key, buffer)` → 上传文件到 OSS
  - `deleteFolder(prefix)` → 删除 OSS 目录
  - `getPublicUrl(key)` → 获取公开访问 URL
  - 每个专题的 OSS 路径：`websites/{topic_id}/`

### 5.2 网站上传 API

- [ ] 重建 `backend/src/middlewares/uploadMiddleware.ts`：
  - 仅支持 ZIP 文件上传
  - 文件大小限制（如 50MB）
- [ ] `backend/src/controllers/topicController.ts` 新增：
  - `uploadWebsite(req, res)`：
    - 接收 ZIP 文件
    - 解压到临时目录
    - 验证 index.html 存在
    - 上传所有文件到 OSS
    - 更新 Topic.website_url
  - `updateWebsite(req, res)`：
    - 删除旧文件 → 上传新文件
  - `deleteWebsite(req, res)`：
    - 删除 OSS 文件 → 清空 website_url
  - `getWebsiteStats(req, res)`：
    - 返回基础信息（文件数量、总大小、上传时间）
- [ ] `backend/src/routes/topicRoutes.ts` 新增：
  ```
  POST   /api/topics/:id/website/upload  — authMiddleware, upload → uploadWebsite
  PUT    /api/topics/:id/website/upload  — authMiddleware, upload → updateWebsite
  DELETE /api/topics/:id/website         — authMiddleware → deleteWebsite
  GET    /api/topics/:id/website/stats   — authMiddleware → getWebsiteStats
  ```

### 5.3 前端网站型浏览

- [ ] 新建 `WebsiteTopicPage` 组件：
  - 使用 iframe 加载 website_url
  - 全屏/嵌入模式切换
- [ ] `/topics/:id` 路由根据 topic.type 分流：
  - knowledge → KnowledgeTopicPage
  - website → WebsiteTopicPage

### 5.4 前端网站型编辑（教师）

- [ ] 新建 `WebsiteEditorPage` 组件：
  - ZIP 文件上传区域（拖拽 + 点击上传）
  - 上传进度显示
  - 当前已上传网站的预览（iframe）
  - 重新上传 / 删除操作
- [ ] `/topics/:id/edit` 路由根据 type 分流

### 5.5 网站型 AI 搭建助手

- [ ] 前端集成 WebContainer API（@webcontainer/api）
  - 初始化 WebContainer 实例
  - 文件系统挂载（将 OSS 已有文件加载到 WebContainer）
  - 终端输出流接入前端 UI
- [ ] 搭建助手新增工具函数（`backend/src/services/agentTools.ts`）：
  - `bash(command)` → 通过前端 WebContainer 执行 shell 命令（npm install, node 等）
  - `write_website_file(path, content)` → 在 WebContainer 文件系统中写入文件
  - `read_website_file(path)` → 读取 WebContainer 中的文件内容
  - `list_website_files(path?)` → 列出 WebContainer 文件目录
- [ ] 前端 WebContainer 通信机制：
  - 后端 AI 返回 tool_call（bash/write_website_file 等）
  - 前端拦截这些 tool_call，在本地 WebContainer 中执行
  - 将执行结果返回后端继续 AI 对话循环
- [ ] WebContainer 预览：
  - 监听 WebContainer 的 server-ready 事件
  - 在 iframe 中展示实时预览
  - 支持热更新（文件变更后自动刷新）
- [ ] 导出部署：
  - 从 WebContainer 文件系统导出所有文件
  - 打包为 ZIP 并调用 uploadWebsite API 部署到 OSS
  - 提供"导出并部署"一键操作

### 5.6 前端网站型编辑器完整集成

- [ ] `WebsiteEditorPage` 整合：
  - 手动模式：ZIP 上传（5.4 已实现）
  - AI 模式：WebContainer + 搭建助手
  - 模式切换 UI
- [ ] `AIChatSidebar` 扩展支持网站型：
  - agent_type: 'building'，topic type: 'website'
  - 显示 AI 执行的 bash 命令及输出
  - 显示文件写入操作记录
  - WebContainer 终端输出面板

### Phase 5 验收标准

- [ ] 教师可创建网站型专题
- [ ] ZIP 上传后自动解压并部署到 OSS
- [ ] 网站可通过 iframe 正确预览
- [ ] 重新上传覆盖旧版本
- [ ] 删除网站清理 OSS 文件
- [ ] WebContainer 正常初始化和运行
- [ ] AI 搭建助手可在 WebContainer 中编写和运行代码
- [ ] AI 编写的网站可一键导出部署到 OSS
- [ ] 实时预览正常工作

---

## Phase 6: 测试 + 文档

**目标：** 确保代码质量，文档与实现一致
**前置：** Phase 1-5 全部完成

### 6.1 更新后端测试

- [ ] `backend/tests/auth.test.ts`：
  - 移除 admin/guest 注册测试
  - 新增：注册时不允许选择 admin 角色
- [ ] `backend/tests/topics.test.ts`：
  - 移除 deadline、member 相关测试
  - 新增：type 字段测试、公开访问测试
- [ ] 删除或重写 `backend/tests/workflows.test.ts`：
  - 移除 task/submission/review 工作流
  - 新增：知识库页面 CRUD 工作流
- [ ] 新建 `backend/tests/pages.test.ts`：
  - 页面 CRUD 全流程
  - 页面嵌套关系
  - 页面排序
  - 权限控制（公开读、认证写）
- [ ] 新建 `backend/tests/ai.test.ts`：
  - AI 对话 API 基本调用
  - Function Calling 工具执行
  - 学习助手 vs 搭建助手权限差异
  - 上下文隔离

### 6.2 前端测试

- [ ] 更新组件测试匹配新 UI
- [ ] 新增 AI 侧边栏交互测试

### 6.3 文档更新

- [ ] `docs/data-models.md`：与实际代码同步（如有差异）
- [ ] `docs/spec/` 系列文档：确认所有 Spec 与实现一致
- [ ] 更新 `README.md`：项目说明、启动方式、环境变量列表

### Phase 6 验收标准

- [ ] `pnpm test` 全部通过
- [ ] 文档与代码实现一致，无过时描述

---

## 关键设计决策

### 保留 admin 角色

虽然当前不做管理后台 UI，但 User.role 枚举保留 `admin`：
- 成本为零（只是 ENUM 多一个值）
- 避免未来需要管理功能时改数据库 schema
- admin 用户不能通过注册 API 创建，需要直接操作数据库

### AI 对话上下文管理（MVP）

MVP 阶段采用前端管理方案：
- 前端维护 messages 数组
- 每次请求携带完整对话历史
- 切换专题或页面刷新时清空
- 后续可迁移到后端存储（新建 ChatMessage 模型）

### 网站型 WebContainer 架构

WebContainer 运行在前端浏览器中，AI tool_call 的执行路径：
1. 后端 AI 返回 tool_call（如 `bash("npm install")`）
2. 前端拦截 tool_call，在本地 WebContainer 中执行
3. 前端将执行结果作为 tool_result 发回后端
4. 后端继续 AI 对话循环，直到返回最终 content

这意味着 bash/write_website_file 等工具的实际执行在前端，后端只负责 AI 对话编排。

---

## 相关文档

- [产品概述](./spec/overview.md)
- [数据模型](./spec/data-models.md)
- [API 设计](./spec/api-design.md)
- [AI Agent 系统](./spec/agents.md)
- [功能清单](./spec/features.md)
- [技术架构](./spec/architecture.md)
