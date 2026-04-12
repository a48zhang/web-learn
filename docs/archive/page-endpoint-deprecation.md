# 页面端点废弃记录

> 废弃日期：2026-04-10

## 废弃原因

原设计支持两种专题类型：

- **知识库专题**：Markdown 页面 + 树形导航
- **网站专题**：ZIP 上传的静态网站

统一为网站模型的原因：
1. 知识库模型增加复杂度但价值不明确
2. AI Agent 可同时生成静态内容和交互式网站
3. 统一体验减少维护负担
4. `TopicPage` 模型被 Git-on-OSS tarball 存储方案替代

## 废弃的 API 端点

```
GET    /api/pages/:id           - 获取页面详情（公开访问）
PUT    /api/pages/:id           - 更新页面（需认证）
DELETE /api/pages/:id           - 删除页面（需认证）
PATCH  /api/topics/:id/pages/reorder - 页面重排序
```

## 移除的文件

### 后端（commit 19fb997）
- `services/topic-space/src/controllers/pageController.ts` (331 行)
- `services/topic-space/src/routes/pageRoutes.ts` (26 行)
- `services/topic-space/src/models/TopicPage.ts` (38 行)
- `services/topic-space/tests/pages.test.ts` (296 行)

### 前端（commit 0d15b6e）
- `frontend/src/components/PageTreeEditor.tsx`
- `frontend/src/components/PageTreeNav.tsx`
- `frontend/src/pages/KnowledgeEditorPage.tsx`
- `frontend/src/pages/KnowledgeTopicPage.tsx`
- `frontend/src/pages/TopicDetailPage.test.tsx`
- `frontend/src/utils/treeUtils.ts` 及其测试

### 测试（commit 4017680）
- 移除 page 相关集成测试和 e2e 测试

## Git 提交记录

| Commit | 描述 |
|--------|------|
| `8c294e5` | gateway 移除 `/api/pages` 路由 |
| `985c216` | 类型系统移除 TopicPage 和 WebsiteStats |
| `19fb997` | topic-space 服务删除 page controller/routes/models/测试 |
| `0d15b6e` | 前端删除 Knowledge 页面和 PageTree 组件 |
| `4017680` | 移除 page 相关集成和 e2e 测试 |

## 原始 API 规范

原始页面 API 规范见 `docs/archive/development-plan.md` 第 162-165 行和第 241 行。
