# 数据模型文档

> 最后更新：2026-04-03

本文档详细说明了专题学习平台的数据模型设计，包括数据库表结构、字段定义和模型关联关系。

## 概述

系统采用 MySQL 关系型数据库，使用 Sequelize ORM 进行数据操作。共包含 **7 个核心数据模型**：

- **User** - 用户
- **Topic** - 专题
- **TopicMember** - 专题成员（关联表）
- **Task** - 任务
- **Submission** - 作业提交
- **Review** - 评价
- **Resource** - 学习资源

## ER 图

```mermaid
erDiagram
    User ||--o{ Topic : "创建"
    User ||--o{ Resource : "上传"
    User ||--o{ Task : "发布"
    User ||--o{ Submission : "提交"
    User ||--o{ Review : "评价"
    User ||--o{ TopicMember : "加入"

    Topic ||--o{ Resource : "包含"
    Topic ||--o{ Task : "包含"
    Topic ||--o{ TopicMember : "有成员"

    Task ||--o{ Submission : "接收"
    Submission ||--o| Review : "获得"

    Topic ||--o{ User : "成员" : members
```

## 数据模型详解

### 1. User（用户）

用户模型存储平台所有用户信息，支持多角色。

**表名：** `users`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 用户 ID |
| username | VARCHAR(50) | NOT NULL, UNIQUE | 用户名 |
| email | VARCHAR(100) | NOT NULL, UNIQUE | 邮箱 |
| password | CHAR(60) | NOT NULL | 密码（bcrypt 加密） |
| role | ENUM | NOT NULL, DEFAULT 'student' | 角色：admin, teacher, student, guest |
| created_at | TIMESTAMP | AUTO | 创建时间 |
| updated_at | TIMESTAMP | AUTO | 更新时间 |

**角色权限：**
- `admin` - 系统管理员
- `teacher` - 教师（可创建专题、发布任务、评价作业）
- `student` - 学生（可加入专题、提交作业、查看评价）
- `guest` - 访客（仅查看公开内容）

**特性：**
- 密码自动加密（bcrypt，salt rounds: 10）
- 提供 `comparePassword()` 方法验证密码

---

### 2. Topic（专题）

专题模型表示教师创建的学习专题。

**表名：** `topics`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 专题 ID |
| title | VARCHAR(200) | NOT NULL | 专题标题 |
| description | TEXT | NULLABLE | 专题描述 |
| created_by | INTEGER | NOT NULL, FK → users.id | 创建者 ID |
| deadline | DATEONLY | NULLABLE | 截止日期（仅日期） |
| status | ENUM | NOT NULL, DEFAULT 'draft' | 状态：draft, published, closed |
| created_at | TIMESTAMP | AUTO | 创建时间 |
| updated_at | TIMESTAMP | AUTO | 更新时间 |

**状态流转：**
- `draft` → `published` → `closed`
- 仅创建者教师可修改状态

**业务规则：**
- 只有教师可以创建专题
- 发布后学生才能加入
- 关闭后不能再提交作业

---

### 3. TopicMember（专题成员）

专题与用户的多对多关联表，记录学生加入专题的信息。

**表名：** `topic_members`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 记录 ID |
| topic_id | INTEGER | NOT NULL, FK → topics.id | 专题 ID |
| user_id | INTEGER | NOT NULL, FK → users.id | 用户 ID |
| joined_at | TIMESTAMP | NOT NULL, DEFAULT NOW | 加入时间 |

**索引：**
- UNIQUE INDEX (`topic_id`, `user_id`) - 防止重复加入

**业务规则：**
- 学生可以主动加入已发布的专题
- 教师创建专题时自动成为成员
- 成员才能查看专题详细内容和提交作业

---

### 4. Task（任务）

任务模型表示专题下的具体学习任务。

**表名：** `tasks`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 任务 ID |
| topic_id | INTEGER | NOT NULL, FK → topics.id | 所属专题 ID |
| title | VARCHAR(200) | NOT NULL | 任务标题 |
| description | TEXT | NULLABLE | 任务描述 |
| created_by | INTEGER | NOT NULL, FK → users.id | 创建者 ID（教师） |
| created_at | TIMESTAMP | AUTO | 创建时间 |
| updated_at | TIMESTAMP | AUTO | 更新时间 |

**业务规则：**
- 只有教师可以创建任务
- 学生可以在专题详情页查看任务
- 每个任务可以有多次提交（每个学生）

---

### 5. Submission（作业提交）

学生提交的作业记录。

**表名：** `submissions`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 提交 ID |
| task_id | INTEGER | NOT NULL, FK → tasks.id | 任务 ID |
| student_id | INTEGER | NOT NULL, FK → users.id | 学生 ID |
| content | TEXT | NULLABLE | 文本内容 |
| file_url | VARCHAR(300) | NULLABLE | 附件文件路径 |
| submitted_at | TIMESTAMP | NOT NULL, DEFAULT NOW | 提交时间 |

**业务规则：**
- 学生只能提交自己已加入专题的任务
- 专题关闭后不能提交
- 可以同时提交文本内容和附件
- 每个任务每个学生可多次提交

---

### 6. Review（评价）

教师对学生作业的评价记录。

**表名：** `reviews`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 评价 ID |
| submission_id | INTEGER | NOT NULL, FK → submissions.id | 提交 ID |
| reviewer_id | INTEGER | NOT NULL, FK → users.id | 评价者 ID（教师） |
| score | DECIMAL(5,2) | NULLABLE | 分数（0-100） |
| feedback | TEXT | NULLABLE | 反馈意见 |
| reviewed_at | TIMESTAMP | NOT NULL, DEFAULT NOW | 评价时间 |

**业务规则：**
- 只有专题创建者教师可以评价
- 每个提交只能有一个评价
- 分数为可选，支持仅反馈
- 评价后学生可以查看

---

### 7. Resource（学习资源）

专题相关的学习资源文件。

**表名：** `resources`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 资源 ID |
| topic_id | INTEGER | NOT NULL, FK → topics.id | 所属专题 ID |
| owner_id | INTEGER | NOT NULL, FK → users.id | 上传者 ID |
| type | ENUM | NOT NULL | 类型：document, video, link, other |
| title | VARCHAR(200) | NULLABLE | 资源标题 |
| uri | VARCHAR(300) | NOT NULL | 文件路径或链接 URL |
| uploaded_at | TIMESTAMP | NOT NULL, DEFAULT NOW | 上传时间 |

**资源类型：**
- `document` - 文档（PDF, DOC, PPT 等）
- `video` - 视频
- `link` - 外部链接
- `other` - 其他类型

**业务规则：**
- 教师和学生都可以上传资源
- 专题成员可以下载资源
- 链接类型直接返回 URL
- 文件类型存储在服务器本地（生产环境建议使用 OSS/S3）

---

## 模型关联关系

### 一对多关系

```typescript
// User -> Topic (一个用户创建多个专题)
User.hasMany(Topic, { foreignKey: 'created_by', as: 'topics' });
Topic.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// User -> Task (一个用户发布多个任务)
User.hasMany(Task, { foreignKey: 'created_by', as: 'tasks' });
Task.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// Topic -> Task (一个专题包含多个任务)
Topic.hasMany(Task, { foreignKey: 'topic_id', as: 'tasks' });
Task.belongsTo(Topic, { foreignKey: 'topic_id', as: 'topic' });

// Topic -> Resource (一个专题包含多个资源)
Topic.hasMany(Resource, { foreignKey: 'topic_id', as: 'resources' });
Resource.belongsTo(Topic, { foreignKey: 'topic_id', as: 'topic' });

// Task -> Submission (一个任务接收多个提交)
Task.hasMany(Submission, { foreignKey: 'task_id', as: 'submissions' });
Submission.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });

// User -> Submission (一个学生提交多次作业)
User.hasMany(Submission, { foreignKey: 'student_id', as: 'submissions' });
Submission.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

// Submission -> Review (一个提交获得一个评价)
Submission.hasOne(Review, { foreignKey: 'submission_id', as: 'review' });
Review.belongsTo(Submission, { foreignKey: 'submission_id', as: 'submission' });
```

### 多对多关系

```typescript
// Topic <-> User (专题和用户的多对多关系)
Topic.belongsToMany(User, {
  through: TopicMember,
  foreignKey: 'topic_id',
  otherKey: 'user_id',
  as: 'members'
});

User.belongsToMany(Topic, {
  through: TopicMember,
  foreignKey: 'user_id',
  otherKey: 'topic_id',
  as: 'joinedTopics'
});
```

---

## API 响应格式

### 通用格式

所有 API 响应遵循统一格式：

```typescript
// 成功响应
{
  "success": true,
  "data": { ... } | [ ... ]
}

// 错误响应
{
  "success": false,
  "error": "错误消息"
}
```

### 字段命名转换

数据库使用 **snake_case**，API 响应使用 **camelCase**：

| 数据库字段 | API 字段 | 说明 |
|-----------|---------|------|
| created_by | createdBy | 创建者 ID |
| created_at | createdAt | 创建时间 |
| updated_at | updatedAt | 更新时间 |
| joined_at | joinedAt | 加入时间 |
| submitted_at | submittedAt | 提交时间 |
| reviewed_at | reviewedAt | 评价时间 |
| uploaded_at | uploadedAt | 上传时间 |
| file_url | fileUrl | 文件 URL |
| topic_id | topicId | 专题 ID |
| task_id | taskId | 任务 ID |
| student_id | studentId | 学生 ID |
| reviewer_id | reviewerId | 评价者 ID |
| owner_id | ownerId | 所有者 ID |

### ID 格式

所有 ID 在 API 响应中转换为字符串：

```typescript
// 数据库
id: 123 (INTEGER)

// API 响应
id: "123" (STRING)
```

### 日期格式

所有日期字段使用 ISO 8601 格式：

```typescript
// DATETIME/TIMESTAMP
createdAt: "2026-04-01T00:00:00.000Z"

// DATEONLY (deadline)
deadline: "2026-05-01"
```

---

## 示例 API 响应

### 用户对象

```json
{
  "id": "1",
  "username": "teacher1",
  "email": "teacher@example.com",
  "role": "teacher",
  "createdAt": "2026-04-01T00:00:00.000Z",
  "updatedAt": "2026-04-01T00:00:00.000Z"
}
```

### 专题对象

```json
{
  "id": "7",
  "title": "专题学习平台开发",
  "description": "Web 全栈开发实践",
  "createdBy": "1",
  "status": "published",
  "deadline": "2026-05-01",
  "createdAt": "2026-04-01T00:00:00.000Z",
  "updatedAt": "2026-04-01T00:00:00.000Z",
  "creator": {
    "id": "1",
    "username": "teacher1",
    "email": "teacher@example.com"
  },
  "hasJoined": true
}
```

### 任务对象

```json
{
  "id": "15",
  "topicId": "7",
  "title": "实现用户登录功能",
  "description": "使用 JWT 实现认证",
  "createdBy": "1",
  "createdAt": "2026-04-01T00:00:00.000Z",
  "updatedAt": "2026-04-01T00:00:00.000Z"
}
```

### 提交对象

```json
{
  "id": "42",
  "taskId": "15",
  "studentId": "5",
  "content": "已完成登录功能实现",
  "fileUrl": "/api/submissions/42/attachment",
  "submittedAt": "2026-04-02T10:30:00.000Z",
  "student": {
    "id": "5",
    "username": "student1",
    "email": "student@example.com"
  }
}
```

### 评价对象

```json
{
  "id": "8",
  "submissionId": "42",
  "reviewerId": "1",
  "score": 95,
  "feedback": "功能实现完整，代码质量良好",
  "reviewedAt": "2026-04-03T14:00:00.000Z",
  "reviewer": {
    "id": "1",
    "username": "teacher1",
    "email": "teacher@example.com"
  }
}
```

---

## 数据库配置

### Sequelize 配置

```typescript
{
  dialect: 'mysql',
  logging: false,
  define: {
    underscored: true,      // 自动转换 camelCase → snake_case
    timestamps: true,       // 自动添加 createdAt, updatedAt
  }
}
```

### 字段自动映射

得益于 `underscored: true` 配置：

```typescript
// TypeScript 代码使用 camelCase
user.createdAt
topic.createdBy

// 自动映射到数据库 snake_case
created_at
created_by
```

---

## 开发注意事项

1. **时间戳字段**
   - `createdAt` 和 `updatedAt` 自动管理
   - 其他时间字段需手动设置默认值（如 `submitted_at: { defaultValue: DataTypes.NOW }`）

2. **外键约束**
   - 所有外键都定义了引用关系
   - 删除行为依赖数据库默认（RESTRICT）

3. **密码安全**
   - 用户密码使用 bcrypt 加密
   - 在 `beforeCreate` 和 `beforeUpdate` 钩子中自动处理

4. **类型安全**
   - 所有模型定义了 TypeScript 接口
   - 使用 `declare` 关键字声明实例字段

5. **关联查询**
   - 使用 `include` 进行关联查询
   - 注意 Sequelize 关联类型需要类型断言

---

## 相关文档

- [API 接口文档](./SPEC.md#api-设计)
- [实现状态报告](./implementation-status.md)
- [项目 README](../README.md)