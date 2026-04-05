# 存在问题

## 待改进项

- 缺失对专题空间的删除
- 编辑专题界面缺乏自动保存
- 编辑专题ui/ux设计差

---

## 后端问题

### 数据模型与约束

1. **TopicPage缺少级联约束保证** - `backend/src/models/TopicPage.ts`
   - 问题：虽然定义了 `onDelete: 'CASCADE'`，但 Sequelize 的 `force: false` 不会在数据库层强制执行
   - 影响：并发删除时可能产生孤儿页面（父页面删除后子页面残留）
   - 建议：在 `deletePage` 操作中使用事务加锁，或添加数据库迁移脚本强制级联约束

### 安全问题

2. **AI聊天缺少输入验证** - `backend/src/controllers/aiController.ts:37-47`
   - 问题：未验证 `messages` 数组结构和内容
   - 影响：提示词注入攻击、超出token限制导致账单问题、可能崩溃OpenAI客户端
   - 建议：添加消息数量限制（50条）、内容长度限制（10000字符）、角色类型验证

3. **CORS配置错误** - `backend/src/app.ts`
   - 问题：使用 `cors()` 无任何限制，允许任意来源
   - 影响：跨站攻击、凭证盗窃
   - 建议：配置为 `origin: config.cors.origins`，限制允许的来源

4. **网站上传缺少文件类型验证** - `backend/src/controllers/topicController.ts:182-195`
   - 问题：未验证上传文件是真正的ZIP，或包含有效HTML结构
   - 影响：教师上传恶意可执行文件伪装成ZIP、上传钓鱼内容冒充平台
   - 建议：使用 `file-type` 库验证魔数，确保是 `application/zip`

5. **可选认证中间件静默失败** - `backend/src/middlewares/optionalAuthMiddleware.ts`
   - 问题：所有认证错误被静默捕获忽略，无法检测攻击
   - 影响：安全问题无审计追踪，认证失败无日志
   - 建议：添加日志记录令牌过期、无效令牌等事件

6. **上传文件名可预测** - `backend/src/middlewares/uploadMiddleware.ts`
   - 问题：使用 `Date.now()` 生成文件名，可预测
   - 影响：攻击者可预测上传路径，定向攻击
   - 建议：使用 `randomBytes(16).toString('hex')` 生成随机文件名

---

## 前端问题

### 错误处理与状态管理

7. **KnowledgeTopicPage缺少错误处理** - `frontend/src/pages/KnowledgeTopicPage.tsx:80-88`
   - 问题：`handleSelectPage` 捕获错误但未正确显示给用户
   - 影响：页面加载失败时用户无反馈
   - 建议：使用 `toast.error()` 显示错误，或在渲染中正确处理错误状态

8. **KnowledgeEditorPage依赖循环** - `frontend/src/pages/KnowledgeEditorPage.tsx:67`
   - 问题：`refreshPages` 依赖 `selectedPageId`，但在 useEffect 中作为依赖项调用
   - 影响：闭包陷阱，`selectedPageId` 可能过期
   - 建议：移除 `selectedPageId` 依赖或将其作为参数传递

9. **AIChatSidebar缺少空值检查** - `frontend/src/components/AIChatSidebar.tsx:38`
    - 问题：`Number(topicId)` 转换无验证，格式错误时变为NaN
    - 影响：可能发送无效请求到后端
    - 建议：添加验证：`if (!topicId || !/^\d+$/.test(topicId)) return`

### UX与交互

10. **加载状态不一致** - 多个页面
    - 问题：KnowledgeEditorPage用文本"加载中..."，KnowledgeTopicPage用LoadingOverlay组件
    - 影响：用户体验不一致
    - 建议：统一使用 LoadingOverlay 组件

11. **window.prompt/confirm阻塞UX** - `frontend/src/pages/KnowledgeEditorPage.tsx:108,127`
    - 问题：使用原生对话框创建页面标题、确认删除
    - 影响：阻塞UI、无法自定义样式、用户体验差
    - 建议：创建模态对话框组件替代

12. **页面树导航缺少加载指示器** - `frontend/src/pages/KnowledgeTopicPage.tsx`
    - 问题：点击页面导航时不显示加载状态
    - 影响：慢速连接时用户以为无响应
    - 建议：页面切换时显示加载指示器

13. **缺少撤销/确认机制** - 多个编辑页面
    - 问题：页面删除立即级联子页面，仅一个确认对话框，无法撤销
    - 影响：误删无法恢复
    - 建议：添加二次确认、撤销功能、或软删除机制

### 代码质量

14. **树遍历工具函数重复** - `frontend/src/pages/KnowledgeEditorPage.tsx:12-35`, `KnowledgeTopicPage.tsx:12-29`
    - 问题：相似的树遍历函数（`flattenPages`, `findNode`, `findFirstPage`）在多个文件重复
    - 影响：代码重复、维护困难
    - 建议：提取到共享工具文件 `frontend/src/utils/treeUtils.ts`

---

## 测试覆盖问题（严重不足）

### API端点测试

15. **70%专题端点未测试** - `backend/tests/topics.test.ts`
    - 缺失：PUT更新专题、PATCH状态、网站上传相关（5个端点）
    - 当前：仅测试GET列表和POST创建（2个端点）
    - 影响：核心功能无测试保障

17. **66%页面端点未测试** - `backend/tests/pages.test.ts`
    - 缺失：GET单个页面、PUT更新、DELETE删除、PATCH重排序（4个端点）
    - 当前：仅测试GET列表和POST创建（2个端点）
    - 影响：页面管理功能无测试

18. **AI工具执行零测试** - `backend/tests/ai.test.ts`
    - 缺失：工具调用验证、消息验证、错误处理、边界情况（20+场景）
    - 当前：仅测试认证拒绝和学习聊天成功路径（3个测试）
    - 影响：AI核心功能（工具调用）完全未测试

### 测试场景覆盖

19. **零错误处理测试** - 所有测试文件
    - 问题：所有测试仅覆盖成功路径，无失败场景测试
    - 缺失：数据库连接失败、无效ID格式、错误请求体、并发冲突、文件系统错误
    - 影响：生产环境错误无法提前发现

20. **授权矩阵测试不完整** - 所有测试文件
    - 缺失：教师访问他人草稿专题、学生访问草稿、管理员权限、非所有者操作权限
    - 影响：权限控制漏洞可能上线

### 功能逻辑测试

21. **页面树结构未测试** - `backend/src/controllers/pageController.ts:22-41` (toTree函数)
    - 缺失：单根页面、多根页面、3+层嵌套、循环引用防御、孤儿页面
    - 影响：复杂树逻辑未验证，渲染bug可能遗漏

22. **页面删除级联未测试** - `backend/src/controllers/pageController.ts:197-223`
    - 缺失：删除叶子页面、删除带子页面、删除嵌套子树、验证后代ID返回
    - 影响：内容管理关键功能未测试

23. **网站文件上传未测试** - `backend/src/controllers/topicController.ts:210-242`
    - 缺失：上传ZIP、更新文件、删除文件、文件大小统计、知识专题拒绝上传
    - 影响：整个网站专题功能未测试

---

## 文档问题

24. **Webcontainer/bash工具未实现但已文档化** - `docs/spec/agents.md:142-145,261-285`
    - 问题：文档描述网站型专题有bash工具和webcontainer集成，但代码未实现
    - 建议：实现

25. **缺少前端架构文档** - `docs/spec/README.md`
    - 问题：无前端组件架构文档，但实现复杂（AIChatSidebar、PageTreeNav/Editor、Markdown渲染）
    - 影响：前端开发者缺少架构指引
    - 建议：创建 `docs/spec/frontend-architecture.md`

---

## 代码质量与维护性

### 日志与错误处理

26. **console.error未替换** - 多个页面
    - 问题：使用 `console.error` 记录错误而非正规错误追踪
    - 影响：生产环境错误未追踪
    - 建议：使用错误日志服务或工具函数

27. **错误消息模式不一致** - 多个页面
    - 问题：部分页面硬编码错误消息，部分使用 `getApiErrorMessage`
    - 影响：错误消息不一致
    - 建议：统一使用工具函数

### UI与样式

28. **魔数像素值** - 多个组件
    - 问题：硬编码像素值（16px, 420px, calc(100vh-180px))
    - 影响：间距不一致、可访问性问题
    - 建议：使用Tailwind间距尺度或CSS变量

### 文档与实现一致性

29. **工具名称不一致** - `docs/spec/agents.md:198` vs `backend/src/services/agentTools.ts:117`
    - 问题：文档命名为 `read_file`，实现为 `read_page`
    - 影响：文档与代码不符
    - 建议：统一命名 
