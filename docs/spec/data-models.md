# 数据模型

> 最后更新：2026-04-06

## 概述

系统采用简化设计，核心包含 **2 个主要实体**，聚焦于专题学习空间的创建和管理。

### 核心模型

- **User** - 用户（教师、学生）
- **Topic** - 专题学习空间

### 知识库型专题存储

- **TopicPage** - 专题页面（Markdown 内容）

> **设计原则：**
> - **完全公开访问：** 所有已发布的专题对所有人公开可见（包括未登录访客）
> - **无需提交评价：** 聚焦于专题内容的创建和浏览，无复杂的任务、提交、评价流程
> - **AI 辅助：** 学习助手帮助理解，搭建助手帮助创建
> - **Markdown 内容：** 简单直接的 Markdown 编辑和渲染
> - **微服务数据隔离：** 通过表名前缀实现服务间数据隔离

## 核心实体

### 1. User（用户）

**数据库表名：** `auth_users`（Auth Service 管理）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY | 用户ID |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 用户名 |
| email | VARCHAR(100) | UNIQUE, NOT NULL | 邮箱 |
| password | CHAR(60) | NOT NULL | 密码（bcrypt加密） |
| role | ENUM | NOT NULL | 角色：admin, teacher, student |
| created_at | TIMESTAMP | AUTO | 创建时间 |
| updated_at | TIMESTAMP | AUTO | 更新时间 |

**角色定义：**
- `admin` - 管理员（保留角色，不通过注册创建）
- `teacher` - 教师（可创建和管理专题）
- `student` - 学生（可浏览专题、使用学习助手）

**服务归属：**
- Auth Service：用户注册、登录、JWT 颁发
- Topic Space Service：只读访问（通过 HTTP 或共享数据库）
- AI Service：只读访问（通过 HTTP 或共享数据库）

### 2. Topic（专题学习空间）

**数据库表名：** `topic_topics`（Topic Space Service 管理）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY | 专题ID |
| title | VARCHAR(200) | NOT NULL | 专题标题 |
| description | TEXT | NULLABLE | 专题描述 |
| type | ENUM | NOT NULL, DEFAULT 'knowledge' | 类型：knowledge（知识库）, website（网站） |
| website_url | VARCHAR(500) | NULLABLE | 网站访问URL（仅网站型），由系统自动生成（ZIP上传后解压到OSS所得），教师不可手动编辑 |
| created_by | INTEGER | FK → auth_users.id | 创建者（教师） |
| status | ENUM | NOT NULL | 状态：draft, published, closed |
| created_at | TIMESTAMP | AUTO | 创建时间 |
| updated_at | TIMESTAMP | AUTO | 更新时间 |

**状态流转：**
- `draft` → `published` → `closed`
- 仅创建者教师可修改状态

**类型说明：**
- `knowledge`：知识库型，Markdown 页面，内容存数据库（TopicPage 表）
- `website`：网站型，上传 ZIP 网站代码，存 OSS；website_url 由系统自动生成，教师不可手动修改

**业务规则：**
- 只有教师可以创建专题
- **发布后所有人可见（完全公开，包括访客）**
- 关闭后标记为已关闭（仍可见）

**服务归属：**
- Topic Space Service：专题 CRUD、状态管理、网站上传
- AI Service：只读访问（通过 HTTP 或共享数据库）

---

### 3. TopicPage（专题页面） - 仅知识库型

> **说明：** 知识库型专题的页面内容，采用 Markdown 格式存储

**数据库表名：** `topic_topic_pages`（Topic Space Service 管理）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY | 页面ID |
| topic_id | INTEGER | FK → topic_topics.id | 所属专题 |
| title | VARCHAR(200) | NOT NULL | 页面标题 |
| content | TEXT | NOT NULL | 页面内容（Markdown 格式） |
| parent_page_id | INTEGER | FK → topic_topic_pages.id, NULLABLE | 父页面ID（支持嵌套） |
| order | INTEGER | NOT NULL | 页面顺序 |
| created_at | TIMESTAMP | AUTO | 创建时间 |
| updated_at | TIMESTAMP | AUTO | 更新时间 |

**服务归属：**
- Topic Space Service：页面 CRUD、顺序管理、嵌套结构
- AI Service：只读访问（通过 HTTP 或共享数据库，用于 AI 工具查询）

**Markdown 内容示例：**

```markdown
# 第一章：神经网络概述

神经网络是深度学习的基础结构，由多个神经元层组成。

## 1.1 基本概念

神经网络包含三个核心组件：
- **输入层**：接收原始数据
- **隐藏层**：进行特征提取和转换
- **输出层**：生成预测结果

![网络结构图](https://example.com/network.png)

## 1.2 代码示例

```python
import torch
import torch.nn as nn

class SimpleNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(10, 20)
        self.fc2 = nn.Linear(20, 5)

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        return self.fc2(x)
```

> **提示：** 深度学习需要大量计算资源，建议使用 GPU 加速。

---

**参考资料：**
- [PyTorch 官方文档](https://pytorch.org/docs/)
- [深度学习入门教程](https://example.com/tutorial)
```

**页面嵌套：**

- 通过 `parent_page_id` 实现页面树状结构
- 子页面继承父页面的访问权限
- 支持无限层级嵌套（实际建议不超过3层）

**优势：**

- ✅ **简单直接**：Markdown 是广泛使用的标准格式
- ✅ **易于编辑**：可用任何 Markdown 编辑器
- ✅ **AI友好**：AI Agent 可直接生成 Markdown 内容
- ✅ **嵌套结构**：支持子页面，组织复杂知识体系
- ✅ **扩展性强**：可嵌入图片、视频、代码、链接等多种内容

## ER 图

```mermaid
erDiagram
    User ||--o{ Topic : "创建"
    Topic ||--o{ TopicPage : "包含页面（知识库型）"
    TopicPage ||--o| TopicPage : "嵌套子页面"

    Note over User: 表名: auth_users<br/>Auth Service 管理
    Note over Topic: 表名: topic_topics<br/>Topic Space Service 管理<br/>type: knowledge/website
    Note over TopicPage: 表名: topic_topic_pages<br/>Topic Space Service 管理<br/>仅知识库型<br/>Markdown content
```

## 模型关系

### 一对多关系

- **User → Topic**：一个教师创建多个专题
- **Topic → TopicPage**：一个知识库型专题包含多个页面

### 自引用关系（页面嵌套）

- **TopicPage → TopicPage**：页面可以嵌套子页面（通过 `parent_page_id`）
- 支持树状结构，组织复杂知识体系

### 特殊关系

- **Topic.type = 'knowledge'**：使用 TopicPage 表，Markdown 内容
- **Topic.type = 'website'**：使用 website_url 字段，内容存储在 OSS

### 微服务数据隔离

**表名前缀策略：**
- `auth_*` → Auth Service 专属表（用户认证）
- `topic_*` → Topic Space Service 专属表（专题管理）
- AI Service 通过 HTTP 调用或共享数据库访问数据，不创建独立表

**跨服务访问：**
- Topic Space Service 和 AI Service 可访问 `auth_users` 表（只读）
- AI Service 可访问 `topic_topics` 和 `topic_topic_pages` 表（只读）

### 公开访问设计

- **已发布的专题对所有人公开可见**（包括未登录访客）
- 访客可自由浏览专题内容（知识库型：查看所有页面的 Markdown 渲染内容；网站型：访问网站）
- 无提交、评价等复杂流程
- 只有创建和管理需要登录（教师身份）

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

- ❌ **Resource** - 独立学习资源（不再需要，资源链接直接写在 Markdown 中）
- ❌ **Submission** - 学习成果提交（不再需要）
- ❌ **Review** - 评价反馈（不再需要）
- ❌ **TopicMember** - 专题成员（不再需要，专题完全公开）
- ❌ **Task** - 任务（不再需要）
- ❌ **TopicTemplate** - 专题模板（不再需要，采用 Markdown 自由编辑）
- ❌ **Block-based 结构** - 复杂的 blocks JSON（改为简单的 Markdown）

### 设计改进

**从固定模板到 Markdown：**

- ❌ **旧设计**：预定义模板（TopicTemplate）或复杂的 block-based 结构
- ✅ **新设计**：Markdown 内容存储，简单直接

**优势：**

1. **简单直接**：Markdown 是广泛使用的标准格式
2. **易于编辑**：可用任何 Markdown 编辑器，无需自定义编辑器
3. **AI友好**：搭建 Agent 可直接生成 Markdown 内容，无需复杂的 blocks 映射
4. **扩展性强**：Markdown 支持图片、视频、代码、链接等多种内容嵌入
5. **渲染简单**：前端可直接用 Markdown 渲染器展示内容

### 简化原因

1. **聚焦核心**：专题学习空间的核心是内容创建和浏览
2. **降低复杂度**：移除任务、提交、评价、模板流程，简化系统
3. **AI 辅助替代**：学习助手帮助理解，搭建助手帮助创建
4. **公开访问**：专题完全公开，无需成员管理
5. **灵活优先**：Notion-style 编辑体验，适应多样化教学需求

## 相关文档

- [产品概述](./overview.md)
- [功能清单](./features.md)
- [API 设计](./api-design.md)
- [AI Agent 系统](./agents.md)
