# 数据模型

> 最后更新：2026-04-10

## 概述

系统采用简化设计，核心包含 **2 个主要实体**，聚焦于专题学习空间的创建和管理。

### 核心模型

- **User** - 用户（教师、学生）
- **Topic** - 专题学习空间（统一为网站型）

> **设计原则：**
> - **完全公开访问：** 所有已发布的专题对所有人公开可见（包括未登录访客）
> - **统一网站模型：** 所有专题都是网站形式，通过 AI Agent 辅助创建和编辑
> - **无需提交评价：** 聚焦于专题内容的创建和浏览，无复杂的任务、提交、评价流程
> - **AI 辅助：** 学习助手帮助理解，搭建助手帮助创建
> - **WebContainer 运行：** 编辑器中通过 WebContainer 运行，文件快照存数据库

## 核心实体

### 1. User（用户）

**数据库表名：** `auth_users`（Auth Service 管理）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PRIMARY KEY, UUID | 用户ID（UUID） |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 用户名 |
| email | VARCHAR(100) | UNIQUE, NOT NULL | 邮箱 |
| password | CHAR(60) | NOT NULL | 密码（bcrypt加密） |
| role | ENUM | NOT NULL | 角色：admin, user |
| created_at | TIMESTAMP | AUTO | 创建时间 |
| updated_at | TIMESTAMP | AUTO | 更新时间 |

**角色定义：**
- `admin` - 管理员（保留角色，不通过注册创建）
- `user` - 用户（原 teacher/student 已统一为此角色，可创建和管理专题）

**服务归属：**
- Auth Service：用户注册、登录、JWT 颁发
- Topic Space Service：只读访问（通过 HTTP 或共享数据库）
- AI Service：只读访问（通过 HTTP 或共享数据库）

### 2. Topic（专题学习空间）

**数据库表名：** `topic_topics`（Topic Space Service 管理）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PRIMARY KEY, UUID | 专题ID（UUID） |
| title | VARCHAR(200) | NOT NULL | 专题标题 |
| description | TEXT | NULLABLE | 专题描述 |
| type | ENUM | NOT NULL, DEFAULT 'website' | 固定为 'website' |
| published_url | VARCHAR(500) | NULLABLE | 发布后的外部访问URL |
| share_link | VARCHAR(500) | NULLABLE | 分享链接 |
| created_by | VARCHAR(100) | FK → auth_users.id | 创建者 ID |
| editors | JSON | NOT NULL, DEFAULT [] | 可编辑此专题的用户 UUID 列表 |
| status | ENUM | NOT NULL | 状态：draft, published, closed |
| created_at | TIMESTAMP | AUTO | 创建时间 |
| updated_at | TIMESTAMP | AUTO | 更新时间 |

**状态流转：**
- `draft` → `published` → `closed`
- 仅创建者教师可修改状态

**业务规则：**
- 已注册用户可创建专题，创建者自动成为该专题的 editor
- `editors` 字段存储可编辑此专题的用户 ID 列表（JSON 数组）
- 普通用户仅看到 `published` 状态的专题，editors 额外可见自己参与的 `draft` 专题
- **发布后所有人可见（完全公开，包括访客）**
- 关闭后标记为已关闭（仍可见）
- 网站内容通过 AI Agent 对话生成，文件快照存数据库

**服务归属：**
- Topic Space Service：专题 CRUD、状态管理、文件快照保存
- AI Service：只读访问（通过 HTTP 或共享数据库）

## ER 图

```mermaid
erDiagram
    User ||--o{ Topic : "创建"

    Note over User: 表名: auth_users<br/>Auth Service 管理
    Note over Topic: 表名: topic_topics<br/>Topic Space Service 管理<br/>统一网站模型<br/>文件快照存数据库
```

## 模型关系

### 一对多关系

- **User → Topic**：一个用户创建多个专题
- **Topic ↔ User**：多对多编辑权限（通过 `editors` 字段）

### 微服务数据隔离

**表名前缀策略：**
- `auth_*` → Auth Service 专属表（用户认证）
- `topic_*` → Topic Space Service 专属表（专题管理）
- AI Service 通过 HTTP 调用或共享数据库访问数据，不创建独立表

**跨服务访问：**
- Topic Space Service 和 AI Service 可访问 `auth_users` 表（只读）
- AI Service 可访问 `topic_topics` 表（只读）

### 公开访问设计

- **已发布的专题对所有人公开可见**（包括未登录访客）
- 访客可自由浏览专题内容（iframe 预览网站）
- 无提交、评价等复杂流程
- 专题创建和编辑需要登录（user 身份）
- Draft 专题仅对创建者和 editors 可见

### 生产环境数据库管理

**生产环境（NODE_ENV=production）：**
- 使用 `sequelize-cli` 或 `umzug` 进行受控迁移
- 禁止 `sync({ alter: true })` 自动修改表结构
- 数据库 schema 变更需通过显式迁移脚本

**开发环境：**
- 自动 `sync({ alter: true })` 同步表结构
- 方便开发迭代

## 与旧设计的差异

### 已移除的模型

以下模型在旧设计中存在，但根据新的产品理解已移除：

- ❌ **Resource** - 独立学习资源（不再需要，资源链接直接写在网站中）
- ❌ **Submission** - 学习成果提交（不再需要）
- ❌ **Review** - 评价反馈（不再需要）
- ❌ **TopicMember** - 专题成员（不再需要，改为 `editors` JSON 字段）
- ❌ **Task** - 任务（不再需要）
- ❌ **TopicTemplate** - 专题模板（不再需要，采用AI对话生成）
- ❌ **TopicPage** - 专题页面（知识库型的Markdown页面，已移除）
- ❌ **Block-based 结构** - 复杂的 blocks JSON（改为AI生成网站代码）
- ❌ **files_snapshot** - 数据库存储文件快照（改为 Git-on-OSS tarball）
- ❌ **chat_history** - 数据库存储对话历史（改为前端 localStorage）
- ❌ **website_url** - 静态网站URL（改为 WebContainer 动态生成）

### 设计改进

**从知识库/网站双版本到统一网站模型：**
- ❌ **旧设计**：两种专题类型，分别对应不同创建流程和展示方式
- ✅ **新设计**：所有专题统一为网站形式，通过AI Agent对话创建和编辑

**优势：**

1. **简化模型**：无需维护两套系统，降低开发和维护成本
2. **AI 驱动创建**：教师通过对话描述需求，Agent 生成网站代码
3. **即时预览**：WebContainer 在浏览器中运行，代码修改实时可见
4. **统一体验**：所有专题使用相同的编辑器和预览方式
5. **灵活定制**：网站可包含任意内容（文本、图片、交互等）

### 简化原因

1. **聚焦核心**：专题空间的核心是内容创建和浏览
2. **降低复杂度**：移除知识库/网站区分，简化系统
3. **AI 辅助替代**：学习助手帮助理解，搭建助手帮助创建
4. **公开访问**：专题完全公开，无需成员管理
5. **灵活优先**：AI 生成网站，适应多样化教学需求

## 相关文档

- [产品概述](./overview.md)
- [功能清单](./features.md)
- [API 设计](./api-design.md)
- [AI Agent 系统](./agents.md)
