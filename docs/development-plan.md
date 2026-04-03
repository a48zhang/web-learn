# 开发计划：从当前状态到 Spec 目标状态

> 最后更新：2026-04-03

## 概述

本文档指导如何将当前项目从现有状态开发到最新 spec 描述的目标状态。主要工作包括：
- 简化数据模型（移除不必要的模型）
- 新增专题类型支持（知识库型和网站型）
- 新增 TopicPage 模型（Markdown 内容）
- 移除不必要的功能模块
- 新增 AI Agent 系统


---

## 当前状态与 Spec 差异分析

### 1. 数据模型差异

#### User 模型

**当前状态：**
- 角色：`admin | teacher | student | guest`
- 字段：id, username, email, password, role

**Spec 要求：**
- 角色：`teacher | student`（移除 admin 和 guest）
- 字段：id, username, email, password, role, created_at, updated_at

**差异：**
- ❌ 需移除 `admin` 和 `guest` 角色
- ✅ 字段基本匹配

#### Topic 模型

**当前状态：**
- 字段：id, title, description, created_by, deadline, status
- 状态：`draft | published | closed`

**Spec 要求：**
- 字段：id, title, description, **type**, **website_url**, created_by, status
- 类型：`knowledge | website`
- 状态：`draft | published | closed`

**差异：**
- ❌ 需移除 `deadline` 字段（spec 不需要）
- ❌ 需新增 `type` 字段（专题类型）
- ❌ 需新增 `website_url` 字段（网站型专题）
- ✅ 状态枚举匹配

#### TopicPage 模型

**当前状态：**
- ❌ 不存在

**Spec 要求：**
- 字段：id, topic_id, title, content (Markdown), parent_page_id, order
- 支持页面嵌套
- 仅知识库型专题使用

**差异：**
- ❌ 需新建模型

#### TopicMember 模型

**当前状态：**
- ✅ 存在（专题成员关系表）

**Spec 要求：**
- ❌ 不需要（专题完全公开，无需成员管理）

**差异：**
- ❌ 需删除整个模型及相关代码

#### Resource 模型

**当前状态：**
- ✅ 存在（独立学习资源表）

**Spec 要求：**
- ❌ 不需要（资源作为 Markdown 内容的一部分）

**差异：**
- ❌ 需删除整个模型及相关代码

#### Task 模型

**当前状态：**
- ✅ 存在（任务表）

**Spec 要求：**
- ❌ 不需要（移除任务系统）

**差异：**
- ❌ 需删除整个模型及相关代码

#### Submission 模型

**当前状态：**
- ✅ 存在（学习成果提交表）

**Spec 要求：**
- ❌ 不需要（移除提交评价流程）

**差异：**
- ❌ 需删除整个模型及相关代码

#### Review 模型

**当前状态：**
- ✅ 存在（评价反馈表）

**Spec 要求：**
- ❌ 不需要（移除提交评价流程）

**差异：**
- ❌ 需删除整个模型及相关代码

---

### 2. Controllers 和 Routes 差异

#### 需删除的 Controllers

- ❌ `resourceController.ts` - 资源管理（已废弃）
- ❌ `taskController.ts` - 任务管理（已废弃）
- ❌ `submissionController.ts` - 提交管理（已废弃）
- ❌ `reviewController.ts` - 评价管理（已废弃）

#### 需删除的 Routes

- ❌ `resourceRoutes.ts` - 资源路由
- ❌ `taskRoutes.ts` - 任务路由
- ❌ `submissionRoutes.ts` - 提交路由
- ❌ `reviewRoutes.ts` - 评价路由

#### 需新建的 Controllers

- ✅ `pageController.ts` - 页面管理（知识库型专题）
- ✅ `aiController.ts` - AI Agent 对话

#### 需新建的 Routes

- ✅ `pageRoutes.ts` - 页面路由
- ✅ `aiRoutes.ts` - AI Agent 路由

#### 需修改的 Controllers

- `authController.ts` - 移除 admin/guest 角色支持
- `topicController.ts` - 新增专题类型支持、网站代码上传、移除 deadline

---

### 3. API 端点差异

#### 需删除的 API 端点

```
POST   /api/topics/:id/resources         - 上传资源（废弃）
GET    /api/topics/:id/resources         - 查看资源列表（废弃）
DELETE /api/resources/:id                - 删除资源（废弃）

POST   /api/topics/:id/tasks             - 创建任务（废弃）
GET    /api/topics/:id/tasks             - 查看任务列表（废弃）
DELETE /api/tasks/:id                    - 删除任务（废弃）

POST   /api/tasks/:id/submissions        - 提交成果（废弃）
GET    /api/tasks/:id/submissions        - 查看提交列表（废弃）
GET    /api/submissions/me               - 查看我的提交（废弃）

POST   /api/submissions/:id/review       - 评价提交（废弃）
GET    /api/submissions/:id/review       - 查看评价（废弃）

POST   /api/topics/:id/join              - 加入专题（废弃）
DELETE /api/topics/:id/leave             - 退出专题（废弃）
GET    /api/topics/:id/members           - 查看成员列表（废弃）
```

#### 需新增的 API 端点

```
# 页面管理（知识库型）
POST   /api/topics/:id/pages             - 创建页面
GET    /api/topics/:id/pages             - 获取页面列表
GET    /api/pages/:id                    - 获取页面详情
PUT    /api/pages/:id                    - 更新页面 Markdown
DELETE /api/pages/:id                    - 删除页面
PATCH  /api/topics/:id/pages/reorder     - 调整页面顺序

# 网站型专题
POST   /api/topics/:id/website/upload    - 上传网站代码
PUT    /api/topics/:id/website/upload    - 更新网站代码
DELETE /api/topics/:id/website           - 删除网站代码
GET    /api/topics/:id/website/stats     - 获取访问统计

# AI Agent
POST   /api/ai/chat                      - AI 对话问答
```

---

### 4. 前端差异（估算）

#### 需删除的前端页面/组件

- 资源管理页面
- 任务管理页面
- 提交成果页面
- 评价反馈页面
- 专题成员管理页面
- 专题加入/退出功能

#### 需新建的前端页面/组件

- 知识库型专题页面：
  - Markdown 编辑器
  - 页面树状结构展示
  - 页面预览和渲染
- 网站型专题：
  - 网站代码上传界面
  - 网站预览界面
- AI Agent 侧边栏：
  - 学习助手对话框
  - 专题搭建助手对话框

---

## 开发计划（分阶段）

### Phase 1: 数据模型重构（后端）

**目标：** 清理旧模型，新增必要模型，建立正确的关联关系

#### 1.1 删除废弃模型

**任务清单：**
- [ ] 删除 `backend/src/models/TopicMember.ts`
- [ ] 删除 `backend/src/models/Resource.ts`
- [ ] 删除 `backend/src/models/Task.ts`
- [ ] 删除 `backend/src/models/Submission.ts`
- [ ] 删除 `backend/src/models/Review.ts`
- [ ] 更新 `backend/src/models/index.ts`：移除废弃模型的导入和关联定义

#### 1.2 修改 User 模型

**任务清单：**
- [ ] 更新 `backend/src/models/User.ts`：
  - 移除 `admin` 和 `guest` 角色
  - role 枚举改为 `'teacher' | 'student'`

#### 1.3 修改 Topic 模型

**任务清单：**
- [ ] 更新 `backend/src/models/Topic.ts`：
  - 移除 `deadline` 字段
  - 新增 `type` 字段：`'knowledge' | 'website'`
  - 新增 `website_url` 字段：VARCHAR(500), nullable
  - 更新接口定义

#### 1.4 新建 TopicPage 模型

**任务清单：**
- [ ] 创建 `backend/src/models/TopicPage.ts`：
  - 字段：id, topic_id, title, content (TEXT), parent_page_id, order
  - 支持自引用关联（parent_page_id → topic_pages.id）
  - Markdown content 存储和验证
- [ ] 更新 `backend/src/models/index.ts`：
  - 导入 TopicPage
  - 定义 Topic → TopicPage 一对多关联
  - 定义 TopicPage 自引用关联

#### 1.5 更新数据库迁移

**任务清单：**
- [ ] 创建数据库迁移脚本（如果使用 migrations）
- [ ] 测试模型定义正确性
- [ ] 运行迁移，验证数据库结构

---

### Phase 2: Controllers 和 Routes 重构（后端）

**目标：** 移除废弃功能，新增页面管理和 AI Agent 支持

#### 2.1 删除废弃 Controllers 和 Routes

**任务清单：**
- [ ] 删除 `backend/src/controllers/resourceController.ts`
- [ ] 删除 `backend/src/controllers/taskController.ts`
- [ ] 删除 `backend/src/controllers/submissionController.ts`
- [ ] 删除 `backend/src/controllers/reviewController.ts`
- [ ] 删除 `backend/src/routes/resourceRoutes.ts`
- [ ] 删除 `backend/src/routes/taskRoutes.ts`
- [ ] 删除 `backend/src/routes/submissionRoutes.ts`
- [ ] 删除 `backend/src/routes/reviewRoutes.ts`
- [ ] 更新 `backend/src/app.ts` 或主路由文件：移除废弃路由注册

#### 2.2 修改 authController

**任务清单：**
- [ ] 更新 `backend/src/controllers/authController.ts`：
  - 注册逻辑：移除 admin/guest 角色选项
  - 登录逻辑：验证只支持 teacher/student
  - 权限中间件：移除 admin 相关逻辑

#### 2.3 修改 topicController

**任务清单：**
- [ ] 更新 `backend/src/controllers/topicController.ts`：
  - 创建专题：新增 type 参数，支持 knowledge/website
  - 更新专题：移除 deadline 相关逻辑
  - 查询专题：返回 type 和 website_url 字段
  - 权限验证：确保只有教师可创建专题

#### 2.4 新建 pageController 和 pageRoutes

**任务清单：**
- [ ] 创建 `backend/src/controllers/pageController.ts`：
  - `createPage` - 创建页面（Markdown content 初始化）
  - `getPagesByTopic` - 获取专题页面列表
  - `getPageById` - 获取页面详情
  - `updatePage` - 更新页面 Markdown content
  - `deletePage` - 删除页面（包括子页面）
  - `reorderPages` - 调整页面顺序
- [ ] 创建 `backend/src/routes/pageRoutes.ts`：
  - 定义所有页面相关路由
  - 配置公开访问和认证中间件
- [ ] 注册路由到主应用

#### 2.5 新建网站型专题 Controllers

**任务清单：**
- [ ] 在 `topicController.ts` 中新增：
  - `uploadWebsite` - 上传网站代码（ZIP）到 OSS
  - `updateWebsite` - 更新网站代码
  - `deleteWebsite` - 删除网站代码
  - `getWebsiteStats` - 获取访问统计
- [ ] 配置 OSS 集成（如阿里云 OSS、AWS S3）
- [ ] 实现 ZIP 解压和静态文件托管

#### 2.6 新建 aiController 和 aiRoutes

**任务清单：**
- [ ] 创建 `backend/src/controllers/aiController.ts`：
  - `chat` - AI 对话（OpenAI API 格式）
  - 实现 Function Calling 工具执行逻辑：
    - get_topic_info
    - list_pages
    - read_page
    - grep
    - write_file（仅搭建 Agent）
    - new_file（仅搭建 Agent）
  - 上下文管理（topic_id + user_id）
- [ ] 创建 `backend/src/routes/aiRoutes.ts`：
  - POST /api/ai/chat（需认证）
- [ ] 集成 OpenAI API 或其他 AI 服务
- [ ] 实现权限控制（学生：学习助手，教师：学习+搭建助手）

---

### Phase 3: 测试更新（后端）

**目标：** 更新测试以匹配新的数据模型和 API

#### 3.1 删除废弃测试

**任务清单：**
- [ ] 检查并删除资源、任务、提交、评价相关测试代码
- [ ] 更新 `backend/tests/topics.test.ts`：移除 deadline、member、resource 相关测试
- [ ] 更新 `backend/tests/auth.test.ts`：移除 admin/guest 角色相关测试

#### 3.2 新增测试

**任务清单：**
- [ ] 创建 `backend/tests/pages.test.ts`：
  - 测试页面 CRUD 操作
  - 测试 Markdown content 存储
  - 测试页面嵌套关系
  - 测试页面顺序调整
- [ ] 创建 `backend/tests/ai.test.ts`：
  - 测试 AI 对话 API
  - 测试 Function Calling 工具执行
  - 测试权限控制（学生 vs 教师）
- [ ] 更新 `backend/tests/topics.test.ts`：
  - 测试专题类型（knowledge/website）
  - 测试网站代码上传（如已实现）

#### 3.3 运行测试验证

**任务清单：**
- [ ] 运行 `npm test` 确保所有测试通过
- [ ] 修复测试失败问题

---

### Phase 4: 前端重构（如果前端已开发）

**目标：** 前端适配新的数据模型和 API

#### 4.1 删除废弃前端页面

**任务清单：**
- [ ] 删除资源管理页面组件
- [ ] 删除任务管理页面组件
- [ ] 删除提交成果页面组件
- [ ] 删除评价反馈页面组件
- [ ] 删除专题成员管理页面组件

#### 4.2 修改专题列表页面

**任务清单：**
- [ ] 更新专题卡片展示：显示 type 字段（知识库/网站）
- [ ] 移除 deadline 显示
- [ ] 移除"加入专题"按钮（完全公开）

#### 4.3 新建知识库型专题页面

**任务清单：**
- [ ] 创建页面树状结构组件（支持嵌套）
- [ ] 集成 Markdown 编辑器（如 SimpleMDE、CodeMirror）
- [ ] 实现 Markdown 实时预览
- [ ] 实现页面 CRUD 操作
- [ ] 实现页面拖拽排序

#### 4.4 新建网站型专题页面

**任务清单：**
- [ ] 创建网站代码上传组件
- [ ] 实现网站预览 iframe
- [ ] 显示访问统计

#### 4.5 新建 AI Agent 侧边栏

**任务清单：**
- [ ] 创建 AI 对话侧边栏组件
- [ ] 实现学习助手对话界面
- [ ] 实现专题搭建助手对话界面（教师专用）
- [ ] 集成 OpenAI API 或其他 AI SDK
- [ ] 显示 AI 回复和引用内容

---

### Phase 5: 文档更新

**目标：** 确保文档与代码实现一致

#### 5.1 更新实现状态文档

**任务清单：**
- [ ] 更新 `docs/implementation-status.md`：
  - 标记 Phase 1-4 的完成状态
  - 记录关键实现细节
  - 更新已知问题列表
- [ ] 如有必要，创建新的实现状态报告

#### 5.2 更新 API 文档

**任务清单：**
- [ ] 确保 API 实现与 `docs/spec/api-design.md` 一致
- [ ] 补充实际的请求/响应示例

---

## 执行优先级

### 高优先级（必须完成）

1. **Phase 1: 数据模型重构** - 基础架构变更
2. **Phase 2: Controllers 和 Routes 重构** - API 层变更
3. **Phase 3: 测试更新** - 确保代码质量

### 中优先级（建议完成）

4. **Phase 4: 前端重构** - UI 层变更（如果前端已开发）

### 低优先级（可选）

5. **Phase 5: 文档更新** - 文档维护

---

## 技术实现要点

### Markdown 存储

- 使用 TEXT 类型字段存储 Markdown 内容
- 前端使用 Markdown 编辑器和渲染器（如 marked.js、markdown-it）
- 支持 GitHub Flavored Markdown (GFM)
- 图片、视频、链接等资源以 URL 形式嵌入 Markdown

### 网站型专题实现

- 使用对象存储服务（OSS/S3）托管静态网站代码
- ZIP 文件上传后自动解压到 OSS
- 每个专题分配独立的访问 URL
- 支持静态文件路由（index.html 必须存在）
- 访问统计通过 OSS 日志或独立统计服务实现

### AI Agent 实现

- 使用 OpenAI API 或兼容服务
- 采用标准的 Function Calling 格式（不自定义）
- 后端实现工具函数执行逻辑（查询数据库、读写文件等）
- 上下文管理：agentType + topic_id + user_id
- 权限控制：根据用户角色限制可用工具

### 公开访问实现

- 所有已发布专题的浏览不需要认证
- 只有创建、编辑、AI 使用需要认证
- 前端公开页面无需登录检查
- 后端公开 API 不强制认证中间件

---

## 验收标准

### Phase 1 完成标准

- ✅ 数据库中不存在 TopicMember、Resource、Task、Submission、Review 表
- ✅ User 表只有 teacher/student 角色
- ✅ Topic 表有 type 和 website_url 字段
- ✅ TopicPage 表存在，字段完整
- ✅ 模型关联关系正确（User → Topic → TopicPage）

### Phase 2 完成标准

- ✅ 所有废弃 Controllers 和 Routes 已删除
- ✅ 页面 CRUD API 正常工作
- ✅ AI Agent 对话 API 正常工作
- ✅ 公开访问权限正确配置
- ✅ 认证权限正确配置

### Phase 3 完成标准

- ✅ 所有后端测试通过
- ✅ 测试覆盖主要功能场景

### Phase 4 完成标准

- ✅ 前端可正常创建和浏览专题
- ✅ 知识库型专题：Markdown 编辑和渲染正常
- ✅ 网站型专题：代码上传和预览正常
- ✅ AI Agent 侧边栏正常工作

---

## 风险与注意事项

### 数据丢失风险

- ⚠️ 删除废弃模型会丢失所有相关数据
- ⚠️ 不考虑数据迁移，直接删除旧数据
- ⚠️ 确保开发团队了解此变更影响

### API 兼容性

- ⚠️ 删除 API 端点会导致现有客户端失效
- ⚠️ 如有外部系统依赖，需提前沟通
- ⚠️ API 变更应记录在变更日志中

### AI 服务集成

- ⚠️ 需配置 OpenAI API Key 或其他 AI 服务
- ⚠️ Function Calling 需精确的工具定义和执行逻辑
- ⚠️ AI 服务费用和调用限制需提前评估

### OSS 服务集成

- ⚠️ 需配置 OSS 服务账号和权限
- ⚠️ 网站代码存储和访问需正确配置
- ⚠️ OSS 费用需提前评估

---

## 相关文档

- [产品概述](./spec/overview.md)
- [数据模型](./spec/data-models.md)
- [API 设计](./spec/api-design.md)
- [AI Agent 系统](./spec/agents.md)
- [功能清单](./spec/features.md)