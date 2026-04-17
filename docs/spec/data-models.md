# 数据模型

> 最后更新：2026-04-17

## 概述

系统采用简化设计，核心包含 **2 个主要实体**。

- **User** — 用户（详见 [Auth Service](./auth-service.md)）
- **Topic** — 专题学习空间（详见 [Topic Space Service](./topic-space-service.md)）

## ER 图

```mermaid
erDiagram
    User ||--o{ Topic : "创建"

    Note over User: 表名: auth_users<br/>Auth Service 管理
    Note over Topic: 表名: topic_topics<br/>Topic Space Service 管理<br/>统一网站模型
```

## 模型关系

- **User → Topic**：一个用户创建多个专题
- **Topic ↔ User**：多对多编辑权限（通过 `editors` JSON 字段）

## 模型所有权

| 表 | 管理服务 | 访问权限 |
|------|------|------|
| `auth_users` | Auth Service | Topic Space / AI 服务只读 |
| `topic_topics` | Topic Space Service | AI 服务只读 |
| `ai_agent_conversations` | AI Service | AI 服务读写 |
| `ai_agent_messages` | AI Service | AI 服务读写 |

## Agent 对话持久化模型

- ✅ `ai_agent_conversations`：按 `topic_id + user_id + agent_type` 维度存储会话摘要
  - `agent_type`：`building` / `learning`
  - `selected_skills`：已选技能 ID 列表
  - `compressed_summary` / `compressed_summary_version`
  - `last_compressed_message_id` / `has_compressed_context`
- ✅ `ai_agent_messages`：仅存储用户可见消息（`user` / `assistant`），按 `seq` 保持顺序
- ❌ 不持久化 tool call 细节、临时运行状态、内部推理消息

## 数据库环境

**生产环境（NODE_ENV=production）：**
- 使用 `sequelize-cli` 或 `umzug` 进行受控迁移
- 禁止 `sync({ alter: true })` 自动修改表结构

**开发环境：**
- 自动 `sync({ alter: true })` 同步表结构

## 已移除的模型

以下模型在旧设计中存在，但根据新的产品理解已移除：

- ❌ **Resource** — 独立学习资源
- ❌ **Submission** — 学习成果提交
- ❌ **Review** — 评价反馈
- ❌ **TopicMember** — 专题成员（改为 `editors` JSON 字段）
- ❌ **Task** — 任务
- ❌ **TopicTemplate** — 专题模板（采用AI对话生成）
- ❌ **TopicPage** — 专题页面（知识库型 Markdown 页面，已移除）
- ❌ **Block-based 结构** — 复杂的 blocks JSON
- ❌ **files_snapshot** — 数据库存储文件快照（改为 Git-on-OSS tarball）
- ❌ **chat_history** — 数据库存储对话历史（改为前端 localStorage）
- ❌ **website_url** — 静态网站URL（改为 WebContainer 动态生成）

> 关于 `/api/pages/*` 端点和 TopicPage 模型的完整废弃记录，见 [archive/page-endpoint-deprecation.md](../archive/page-endpoint-deprecation.md)

## 相关文档

- [Auth Service](./auth-service.md)
- [Topic Space Service](./topic-space-service.md)
- [产品概述](./overview.md)
- [功能清单](./features.md)
