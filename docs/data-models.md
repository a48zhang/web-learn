# 数据模型文档

> 最后更新：2026-04-03

当前实现采用简化模型，围绕专题空间与页面内容组织。

## 核心实体

### 1. User

**表名：** `users`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, AUTO_INCREMENT | 用户ID |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 用户名 |
| email | VARCHAR(100) | UNIQUE, NOT NULL | 邮箱 |
| password | CHAR(60) | NOT NULL | bcrypt 加密密码 |
| role | ENUM | NOT NULL | `admin \| teacher \| student` |
| created_at | TIMESTAMP | AUTO | 创建时间 |
| updated_at | TIMESTAMP | AUTO | 更新时间 |

---

### 2. Topic

**表名：** `topics`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, AUTO_INCREMENT | 专题ID |
| title | VARCHAR(200) | NOT NULL | 专题标题 |
| description | TEXT | NULLABLE | 专题描述 |
| type | ENUM | NOT NULL, DEFAULT knowledge | `knowledge \| website` |
| website_url | VARCHAR(500) | NULLABLE | 网站型专题 URL |
| created_by | INTEGER | FK → users.id | 创建者 |
| status | ENUM | NOT NULL, DEFAULT draft | `draft \| published \| closed` |
| created_at | TIMESTAMP | AUTO | 创建时间 |
| updated_at | TIMESTAMP | AUTO | 更新时间 |

---

### 3. TopicPage

**表名：** `topic_pages`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, AUTO_INCREMENT | 页面ID |
| topic_id | INTEGER | FK → topics.id | 所属专题 |
| title | VARCHAR(200) | NOT NULL | 页面标题 |
| content | TEXT | NOT NULL | Markdown 内容 |
| parent_page_id | INTEGER | FK → topic_pages.id, NULLABLE | 父页面ID |
| order | INTEGER | NOT NULL | 同级排序值 |
| created_at | TIMESTAMP | AUTO | 创建时间 |
| updated_at | TIMESTAMP | AUTO | 更新时间 |

---

## 关联关系

- `User 1 - n Topic`（用户创建多个专题）
- `Topic 1 - n TopicPage`（知识库专题拥有多个页面）
- `TopicPage 1 - n TopicPage`（页面树结构，自引用 parent/children）

## 已移除模型

以下旧模型已从实现中移除：

- `TopicMember`
- `Resource`
- `Task`
- `Submission`
- `Review`

## 设计说明

- 已发布专题对访客公开可读（专题与页面读取）
- 教师创建者可编辑专题与页面
- AI 助手通过 Topic / TopicPage 数据提供学习与搭建能力
