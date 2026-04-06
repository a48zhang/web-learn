# 前端 UI/UX 优化实施计划

> 创建日期：2026-04-06
> 状态：待实施
> 范围：前端导航、面包屑、交互体验优化

---

## 前置说明

### 微服务架构重构状态
微服务架构重构已完成（详见 `docs/microservices-architecture-design.md`），当前项目结构：
- `backend/` — 已移除（传统 monolith 已被微服务替代）
- `services/` — 微服务模块（gateway, auth, topic-space, ai）
- `frontend/` — React 前端应用（本次优化重点）

---

## 1. 核心目标：统一导航与面包屑

### 1.1 背景
当前前端各页面独立维护外壳（返回按钮、顶部标题、背景容器），缺少统一导航结构：
- 无全局导航栏，依赖每页硬编码的返回链接
- 无面包屑导航，用户难以感知当前所处层级
- 卡片、按钮、空状态等视觉元素在各页面风格不统一

### 1.2 目标
1. **全站统一外壳**（登录/注册页除外），消除重复的导航/返回代码
2. **顶部主导航**：按角色感知展示入口（教师/学生/游客）
3. **左侧二级导航**：桌面常驻、移动端默认收起可滑出（抽屉）
4. **语义化面包屑**：显示真实业务名称（专题名/页面名）而非纯路径片段
5. **统一视觉风格**：卡片、按钮、空状态、加载/反馈体系一致

---

## 2. 导航架构设计

### 2.1 组件层次

```
AppShell（统一布局壳）
├── TopNav（顶部主导航）
│   ├── Logo / 站点标题
│   ├── 主导航入口（Dashboard / 专题列表 / 新建专题）
│   ├── 用户信息 & 角色
│   ├── 登出按钮
│   └── 汉堡菜单按钮（移动端，用于打开左侧抽屉）
├── BreadcrumbBar（语义化面包屑）
│   └── 由 LayoutMetaContext 提供数据源
├── LeftNav（左侧二级导航 / 抽屉）
│   ├── 桌面端：常驻左侧栏
│   ├── 移动端：默认隐藏，汉堡按钮触发滑出
│   └── 内容插槽：由页面注入具体树导航或快捷链接
└── MainContent（主内容区）
    └── 页面业务内容（卡片、表单、列表等）
```

### 2.2 布局元数据上下文（LayoutMetaContext）

页面通过 Context 向 AppShell 注入动态信息：

| 字段 | 说明 | 示例 |
|------|------|------|
| `pageTitle` | 页面主标题 | "专题学习" |
| `breadcrumbSegments` | 面包屑段数组 | `[{label: "首页", to: "/dashboard"}, {label: "专题列表", to: "/topics"}]` |
| `sideNavSlot` | 左侧导航内容 | `<PageTreeNav />` / `<PageTreeEditor />` / null |
| `actions` | 页面级快捷操作按钮 | `[{label: "编辑", onClick: ...}]` |

### 2.3 登录/注册排除

`AppShell` 仅包裹需要壳的路由。`/login`、`/register` 独立渲染，不进入 AppShell。

---

## 3. 面包屑策略

### 3.1 双层面包屑

**静态层**：路由元数据提供基础段

| 路由 | 静态面包屑 |
|------|-----------|
| `/dashboard` | 首页 / 控制台 |
| `/topics` | 首页 / 专题列表 |
| `/topics/create` | 首页 / 专题列表 / 新建专题 |
| `/topics/:id` | 首页 / 专题列表 / （动态：类型 + 标题） |
| `/topics/:id/edit` | 首页 / 专题列表 / （动态：标题）/ 编辑 |

**动态层**：页面拿到异步数据后更新面包屑

- `/topics/:id`（知识库）：`首页 / 专题列表 / 知识库专题 / {topic.title}`
- `/topics/:id`（网站）：`首页 / 专题列表 / 网站专题 / {topic.title}`
- `/topics/:id/edit`：`首页 / 专题列表 / {topic.title} / 编辑`
- 知识库内页切换：追加 `/{当前页面路径链}`

### 3.2 兜底规则

- 实体数据未加载前，使用静态标题（如"专题详情…"、"编辑中…"），避免空白闪烁
- 加载完成后替换为真实语义标题
- 面包屑最后一级为纯文本（不可点击），其余为可点击链接

### 3.3 知识库页面链路

知识库页面使用 `treeUtils` 补充页面链路：

- 输入：`selectedPageId` 和 `TopicPageTreeNode[]`
- 输出：从根到当前节点的路径链（`[root, parent, current]`）
- 面包屑拼接：静态段 + 专题名 + 页面链路

需要在 `treeUtils.ts` 中新增 `findNodePath` 函数（从树中查找节点到根的路径）。

---

## 4. 组件边界

### 4.1 AppShell

**职责**
- 管理整体布局结构（TopNav + BreadcrumbBar + LeftNav + MainContent）
- 控制移动端左侧抽屉开合状态
- 消费 LayoutMetaContext 渲染动态内容
- 处理公共样式（背景、内边距、最小高度）

**不做什么**
- 不发起业务数据请求
- 不管理认证态

### 4.2 TopNav

**职责**
- 显示品牌标识和站点名称
- 展示角色感知的主导航入口
- 移动端提供汉堡菜单按钮

**入口规则**
- 所有已登录用户：控制台、专题列表
- 教师：新建专题
- 未登录游客：登录 / 注册

### 4.3 LeftNav

**职责**
- 根据路由 `sideNavType` 渲染不同内容：
  - `topic-tree`：`PageTreeNav`（知识库浏览）
  - `topic-edit-tree`：`PageTreeEditor`（知识库编辑）
  - `quick-links`：快捷导航链接
  - `none`：隐藏
- 桌面端常驻显示
- 移动端默认收起，点击汉堡按钮滑出

**移动端行为**
- 使用固定定位遮罩层
- 点击遮罩或按 Esc 关闭
- 宽度为 `84vw`，最大 `20rem`（`320px`）

### 4.4 BreadcrumbBar

**职责**
- 只读渲染面包屑段数组
- 处理最后一级纯文本 vs 其余可点击链接
- 加载中的降级 fallback
- 移动端支持折行/截断显示

**数据结构**

```typescript
interface BreadcrumbSegment {
  label: string;
  to?: string;  // undefined 表示当前页（不可点击）
}
```

---

## 5. 统一视觉规范

### 5.1 顶部导航
- 高度：`4rem`（64px）
- 背景：`bg-white border-b border-gray-200`
- 激活项：主色文字 + 底部边框高亮
- 阴影：`shadow-sm`

### 5.2 面包屑
- 字号：`text-sm`
- 分隔符：`/`
- 链接色：`text-gray-500 hover:text-blue-600`
- 当前页：`text-gray-900 font-medium`
- 容器：`px-4 py-2`

### 5.3 卡片
- 类名：`bg-white rounded-lg shadow-sm border border-gray-200`
- 内边距：`p-4` 或 `p-6`
- 悬停：`hover:shadow-md transition-shadow`

### 5.4 按钮
- 主按钮：`bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 text-sm transition-colors`
- 次按钮：`bg-gray-100 hover:bg-gray-200 text-gray-900 border rounded-md px-4 py-2 text-sm transition-colors`
- 危险按钮：`bg-red-600 hover:bg-red-700 text-white rounded-md px-4 py-2 text-sm transition-colors`
- 禁用：`disabled:opacity-50 disabled:cursor-not-allowed`

### 5.5 空状态
- 复用现有 `EmptyState.tsx`
- 统一结构：图标 + 标题 + 说明 + 可选操作按钮

### 5.6 移动端适配
- 左侧导航默认收起（`lg:hidden`）
- 面包屑在小屏可折行
- 页面容器内边距适配移动端

---

## 6. 导航实施关键改造点

### 现有文件改造

| 文件 | 改造内容 |
|------|---------|
| `frontend/src/App.tsx` | 路由层引入 AppShell，公开路由不包裹壳，其余统一包裹 |
| `frontend/src/components/ProtectedRoute.tsx` | 保持现有鉴权逻辑，确保与 AppShell 不冲突 |
| `frontend/src/pages/DashboardPage.tsx` | 去除外壳代码，仅保留内容；通过 Context 注入元数据 |
| `frontend/src/pages/TopicListPage.tsx` | 去除返回按钮与外壳，面包屑由 BreadcrumbBar 接管 |
| `frontend/src/pages/TopicDetailPage.tsx` | 注入专题名称到面包屑上下文 |
| `frontend/src/pages/KnowledgeTopicPage.tsx` | 左侧树通过 sideNavSlot 注入；页面链路追加到面包屑 |
| `frontend/src/pages/KnowledgeEditorPage.tsx` | 左侧编辑器树通过 sideNavSlot 注入；面包屑含"编辑"段 |
| `frontend/src/pages/WebsiteTopicPage.tsx` | 去除返回按钮，面包屑接管导航 |
| `frontend/src/pages/WebsiteEditorPage.tsx` | 同上 |
| `frontend/src/pages/TopicCreatePage.tsx` | 去除返回按钮，面包屑接管 |
| `frontend/src/utils/treeUtils.ts` | 新增 `findNodePath` 函数 |

### 新增文件

| 文件 | 说明 |
|------|------|
| `frontend/src/components/layout/AppShell.tsx` | 统一布局壳层 |
| `frontend/src/components/layout/TopNav.tsx` | 顶部主导航组件 |
| `frontend/src/components/layout/LeftNav.tsx` | 左侧二级导航 / 抽屉 |
| `frontend/src/components/layout/BreadcrumbBar.tsx` | 面包屑渲染组件 |
| `frontend/src/components/layout/LayoutMetaContext.tsx` | 布局元数据上下文 |

---

## 7. 导航实施风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 401 重定向循环 | `api.ts` 直接跳 `/login` 可能导致 shell 闪烁 | 保持现有行为可用；后续优化为携带 `?redirect=` 参数 |
| 面包屑异步闪烁 | 专题名未加载前短暂显示兜底标题 | 使用静态 fallback，加载后平滑替换 |
| 左侧导航在公开页无内容 | `/topics` 游客浏览时侧栏无树 | `sideNavType` 设为 `none`，隐藏侧栏 |
| 受保护路由角色差异 | 学生/教师看到不同入口 | TopNav 按角色渲染，ProtectedRoute 鉴权保留 |
| 现有测试回归 | 页面结构变化导致断言失败 | 更新 RTL 测试 selector |

---

## 8. 导航验证方案

### 手工验证路径

1. **未登录游客**
   - 访问 `/login`、`/register`：无 AppShell
   - 访问 `/topics`、`/topics/:id`：有 AppShell，但左侧导航隐藏
   - 面包屑语义正确

2. **已登录教师**
   - 顶部导航显示：控制台、专题列表、新建专题
   - 桌面端左侧导航常驻（知识库页显示树导航）
   - 移动端左侧导航默认收起，可滑出
   - 各页面面包屑语义正确

3. **已登录学生**
   - 顶部导航显示：控制台、专题列表（无新建专题）
   - 其余同教师

4. **关键页面检查**
   - `/dashboard`：面包屑 = 首页 / 控制台
   - `/topics`：面包屑 = 首页 / 专题列表
   - `/topics/:id`（知识库）：面包屑 = 首页 / 专题列表 / 知识库专题 / {标题}
   - `/topics/:id/edit`：面包屑 = 首页 / 专题列表 / {标题} / 编辑
   - 知识库内页切换：面包屑追加页面路径链

### 自动化测试

- `BreadcrumbBar` 组件测试：静态路径、动态标题、loading fallback、最后一级不可点击
- `AppShell` 组件测试：登录/注册不渲染 shell、公开页正确渲染、移动端抽屉行为
- `treeUtils.findNodePath` 单元测试

---

## 9. 附加 UX 优化

> 已排除：国际化、性能优化、新用户引导、删除关联提示、AI 引导、错误页美化。

### 9.1 Markdown 阅读宽度优化

**问题**：`KnowledgeTopicPage` 右侧内容区使用 `prose max-w-none`，宽屏下行宽撑满，阅读费力。

**改造方案**：
1. 右侧阅读区改为 `prose prose-lg max-w-3xl mx-auto`
2. 窄屏（`< lg`）保持全宽但加 `px-4`
3. 图片、表格、代码块添加 `max-w-full overflow-x-auto`

**文件**：
- `frontend/src/pages/KnowledgeTopicPage.tsx`
- `frontend/src/pages/KnowledgeEditorPage.tsx`（可选同步）

**验证**：
- 1920px 宽屏：正文居中，两侧留白
- 768px 窄屏：正文占满但有内边距
- 代码块/表格不溢出

---

### 9.2 表单草稿暂存

**问题**：`TopicCreatePage` 表单填写中途刷新或误关闭，内容丢失。

**改造方案**：
1. 使用 `sessionStorage` 暂存表单数据（key: `draft:topic-create`）
2. `useEffect` 监听表单变化，自动存入
3. 组件挂载时读取并恢复
4. 提交成功后清除草稿
5. 取消时若有内容，弹窗确认"是否保留草稿"

**文件**：
- `frontend/src/pages/TopicCreatePage.tsx`

**验证**：
- 填写 → 刷新 → 字段恢复
- 提交成功 → sessionStorage 清除
- 填写一半取消 → 确认弹窗

---

### 9.3 编辑器快捷操作

**问题**：`KnowledgeEditorPage` 保存仅能点按钮，无快捷键。

**改造方案**：
1. **Ctrl+S / Meta+S**
   - `useEffect` 监听 `keydown`
   - `e.preventDefault()` 阻止默认
   - 仅在可编辑且未保存时触发
2. **预览模式切换**
   - 状态 `previewMode: 'edit' | 'preview' | 'live'`
   - 切换按钮组：编辑 / 分栏 / 预览
   - Ctrl+E 快捷切换
3. **保存状态优化**
   - 按钮文案：保存 / 保存中... / 已保存 ✓ / 自动保存于 HH:mm:ss

**文件**：
- `frontend/src/pages/KnowledgeEditorPage.tsx`

**验证**：
- Ctrl+S 触发保存
- Ctrl+E 切换预览
- 自动保存中 Ctrl+S 不重复触发

---

### 9.4 专题状态快速切换

**问题**：教师无法在列表页直接切换专题状态，需进详情页。

**改造方案**：
1. `TopicListPage` 每张卡片增加状态下拉菜单
2. 菜单选项按当前状态动态变化：
   - 草稿 → 发布 / 删除
   - 已发布 → 关闭 / 编辑 / 删除
   - 已关闭 → 重新发布 / 编辑 / 删除
3. 调用 `topicApi.updateStatus(id, { status })`
4. Toast 反馈
5. 仅对 `createdBy === user.id` 教师可见
6. 乐观更新本地状态，失败时回滚

**文件**：
- `frontend/src/pages/TopicListPage.tsx`

**验证**：
- 教师点击"发布" → 状态立即变，badge 颜色变
- 学生不看到菜单
- 失败时显示错误 Toast 并回滚

---

### 9.5 iframe 容错（错误处理）

**问题**：`WebsiteTopicPage` / `WebsiteEditorPage` iframe 加载失败只显示空白。

**改造方案**：
1. 添加 `iframeLoading` / `iframeError` 状态
2. `onLoad` → `setIframeLoading(false)`, `setIframeError(false)`
3. `onError` → `setIframeLoading(false)`, `setIframeError(true)`
4. 超时兜底（15s）
5. 错误态 UI：提示文案 + 重新加载按钮

**文件**：
- `frontend/src/pages/WebsiteTopicPage.tsx`
- `frontend/src/pages/WebsiteEditorPage.tsx`

**验证**：
- 正常 URL：无错误提示
- 无效 URL：15s 或 onError 触发，显示错误态
- 点击重新加载：重置状态重试

---

## 10. 实施优先级与顺序

### 优先级分级

| 级别 | 项目 | 原因 |
|------|------|------|
| P0 | Markdown 宽度优化 | 影响阅读体验，改动最小 |
| P0 | 表单草稿暂存 | 减少用户挫败感 |
| P1 | 编辑器快捷键 | 教师高频场景 |
| P1 | 状态快速切换 | 提升操作效率 |
| P1 | iframe 容错 | 边界兜底 |

### 实施阶段划分

**阶段 1：导航壳层搭建**
- AppShell + TopNav + LeftNav + BreadcrumbBar
- 路由元数据改造
- 现有页面外壳剥离

**阶段 2：面包屑动态注入**
- LayoutMetaContext 实现
- 专题详情/编辑页动态标题
- 知识库页面链路

**阶段 3：附加 UX 优化**
- Markdown 宽度
- iframe 容错
- 表单草稿
- 编辑器快捷键
- 状态快速切换

**阶段 4：回归测试**
- 更新 RTL 测试
- 手工全路径验证
- E2E（可选）

---

## 11. 上线前统一校验

```bash
pnpm -C frontend lint
pnpm -C frontend test
pnpm -C frontend build
```

---

## 附录：微服务架构重构摘要

详见 `docs/microservices-architecture-design.md`。

**已完成内容**：
- `packages/utils`：共享配置、日志、数据库工具
- `services/gateway`：API 代理（端口 3000）
- `services/auth`：认证服务（端口 3001）
- `services/topic-space`：专题 + 页面 CRUD（端口 3002）
- `services/ai`：AI 聊天（端口 3003）
- Docker Compose 编排