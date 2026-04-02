# 实现状况报告

> 基于 SPEC.md 开发计划与当前代码实现的对比分析
> 生成时间：2026-04-02

---

## 一、整体进度概览

| 阶段 | 计划任务数 | 已实现 | 状态 |
|------|-----------|--------|------|
| Phase 0 项目初始化 | 6 | 6 | ✅ 完成 |
| Phase 1 用户系统 | 8 | 8（含缺陷） | 🟡 大部分完成 |
| Phase 2 专题管理 | 8 | 8 | ✅ 完成 |
| Phase 3 资源管理 | 7 | 7 | ✅ 完成 |
| Phase 4 任务提交 | 6 | 6 | ✅ 完成 |
| Phase 5 评价反馈 | 5 | 5 | ✅ 完成 |
| Phase 6 界面完善与测试 | 6 | 5 | 🟡 大部分完成 |

**总体评估：核心功能已全部实现，部分细节需要完善。**

---

## 二、Phase 0：项目初始化

| 计划任务 | 实际实现 | 状态 |
|---------|---------|------|
| Monorepo (pnpm workspace) | `pnpm-workspace.yaml` 定义 frontend/backend/shared 三个包 | ✅ |
| 前端项目 (Vite + React + TS + TailwindCSS) | `frontend/` 完整创建，Vite 5 + React 18 + TypeScript + TailwindCSS 3 | ✅ |
| 后端项目 (Express + TS + Sequelize) | `backend/` 完整创建，Express 4 + TypeScript + Sequelize 6 | ✅ |
| shared 包 | `shared/` 包含完整 TypeScript 类型定义 | ✅ |
| ESLint/Prettier | 后端 eslint，前端 eslint，根目录 prettier | ✅ |
| 并行启动脚本 | 根目录 `pnpm dev` 使用 concurrently 并行启动前后端 | ✅ |

**额外完成：**
- Docker Compose 配置 MySQL 开发环境
- `.env` 单文件配置源（backend 和 docker-compose 共用）
- 根目录 `pnpm-workspace.yaml`

---

## 三、Phase 1：用户系统

### 3.1 已实现功能

| 组件 | 状态 | 说明 |
|------|------|------|
| User 模型 | ✅ | username, email, password(bcrypt), role, timestamps |
| POST /api/auth/register | ✅ | 创建用户，返回 JWT token + user |
| POST /api/auth/login | ✅ | 验证凭证，返回 JWT token + user |
| GET /api/users/me | ✅ | 获取当前用户（需认证） |
| LoginPage | ✅ | 前端登录页，有完整测试 |
| RegisterPage | ✅ | 前端注册页，有完整测试 |
| authApi | ✅ | login, register, getCurrentUser, logout |
| useAuthStore | ✅ | Zustand store，登录/注册/登出/状态持久化 |

### 3.2 发现的问题

| 问题 | 严重性 | 说明 |
|------|--------|------|
| **注册时 role 被硬编码为 'student'** | 🔴 Bug | `authController.ts` 忽略请求中的 role，始终创建 student |
| **/auth/me 与 /users/me 重复** | 🟡 冗余 | 两个路由指向同一 controller |
| **id 类型不匹配** | 🟡 类型 | 数据库 INTEGER vs shared 类型定义 string |
| **日期字段命名不一致** | 🟡 类型 | 数据库 `created_at` vs shared 类型 `createdAt` |
| **User model 多了 admin/guest 角色** | 🟡 清理 | model 定义了超出需求的角色 |

### 3.3 修复建议

```typescript
// authController.ts - register 函数中
// 当前（错误）：
const { username, email, password } = req.body;
const role = 'student'; // 硬编码

// 应改为：
const { username, email, password, role: bodyRole } = req.body;
const role = bodyRole === 'teacher' ? 'teacher' : 'student'; // 允许选择角色
```

---

## 四、Phase 2：专题管理

| 计划任务 | 实际实现 | 状态 |
|---------|---------|------|
| POST /api/topics | ✅ | 创建专题（教师） |
| GET /api/topics | ✅ | 获取专题列表（按角色过滤） |
| GET /api/topics/:id | ✅ | 获取专题详情 |
| PUT /api/topics/:id | ✅ | 编辑专题（仅创建者） |
| PATCH /api/topics/:id/status | ✅ | 发布/关闭专题 |
| 前端专题列表页 | ✅ | TopicListPage（含测试） |
| 前端专题创建页 | ✅ | TopicCreatePage |
| 前端专题详情页 | ✅ | TopicDetailPage（含测试） |

**额外实现：**
- TopicMember 模型（参与关系表）
- POST /api/topics/:id/join（学生加入专题）

---

## 五、Phase 3：资源管理

| 计划任务 | 实际实现 | 状态 |
|---------|---------|------|
| multer 文件上传配置 | ✅ | uploadMiddleware.ts |
| POST /api/topics/:id/resources | ✅ | 上传资源 |
| GET /api/topics/:id/resources | ✅ | 获取资源列表 |
| GET /api/resources/:id/download | ✅ | 下载资源 |
| DELETE /api/resources/:id | ✅ | 删除资源（仅上传者/教师） |
| 前端资源上传组件 | ✅ | ResourceUpload.tsx |
| 前端资源列表组件 | ✅ | ResourceList.tsx |

**说明：** 文件存储目前为本地 `./uploads` 目录（开发模式），生产环境需迁移 OSS/S3。

---

## 六、Phase 4：任务与提交

| 计划任务 | 实际实现 | 状态 |
|---------|---------|------|
| POST /api/topics/:id/tasks | ✅ | 创建任务（教师） |
| GET /api/topics/:id/tasks | ✅ | 获取任务列表 |
| POST /api/tasks/:id/submit | ✅ | 提交作业（学生，含文件上传） |
| GET /api/tasks/:id/submissions | ✅ | 获取提交列表（教师视角） |
| GET /api/submissions/me | ✅ | 获取我的提交（学生视角） |
| 前端任务创建页 | ✅ | TaskCreate.tsx |
| 前端作业提交页 | ✅ | SubmissionForm.tsx |

**额外实现：**
- GET /api/submissions/:id/attachment（下载提交附件）

---

## 七、Phase 5：评价反馈

| 计划任务 | 实际实现 | 状态 |
|---------|---------|------|
| POST /api/submissions/:id/review | ✅ | 创建评价（教师） |
| GET /api/submissions/:id/review | ✅ | 获取评价详情 |
| PUT /api/reviews/:id | ✅ | 更新评价 |
| 前端评价表单组件 | ✅ | ReviewForm.tsx |
| 前端评价结果页 | ✅ | StudentFeedbackPage.tsx, ReviewDisplay.tsx |

---

## 八、Phase 6：界面完善与测试

| 计划任务 | 实际实现 | 状态 |
|---------|---------|------|
| 响应式布局 | ✅ | TailwindCSS 已配置，移动端可用 |
| 错误边界 | ✅ | ErrorBoundary.tsx |
| 加载状态 | ✅ | Loading.tsx, LoadingSpinner 组件 |
| 后端单元测试 | 🟡 部分 | auth, topic, submission 等有基础测试 |
| 前端组件测试 | 🟡 部分 | LoginPage, RegisterPage, TopicListPage, TopicDetailPage 有测试 |
| E2E 测试 | ❌ | 未实现 |

---

## 九、项目结构

```
web-learn/
├── docs/
│   └── README.md              # 产品文档
│   └── implementation-status.md  # 本报告
├── frontend/                   # React 前端
│   └── src/
│       ├── components/        # 13 个共享组件
│       ├── pages/            # 8 个页面
│       ├── services/          # API 调用层
│       ├── stores/           # Zustand 状态管理
│       │   ├── useAuthStore.ts
│       │   └── useToastStore.ts
│       ├── types/            # 前端类型
│       ├── App.tsx           # 路由配置
│       └── main.tsx
├── backend/                   # Express 后端
│   └── src/
│       ├── controllers/       # 6 个控制器
│       ├── models/           # 8 个 Sequelize 模型
│       ├── routes/           # 7 个路由模块
│       ├── middlewares/      # auth + upload 中间件
│       ├── utils/            # config + database 工具
│       ├── app.ts            # Express 应用配置
│       └── server.ts         # 服务入口
├── shared/                    # 前后端共享类型
│   └── src/
│       └── types/            # 接口定义、DTO、枚举
├── docker-compose.yml         # MySQL 开发环境
├── .env                       # 环境配置（单文件）
├── .env.example               # 环境配置示例
├── package.json              # 根配置
└── pnpm-workspace.yaml       # Monorepo 配置
```

---

## 十、最近的 CORS 修复（2026-04-02）

发现前后端跨域通信完全失效，已修复以下问题：

| 问题 | 修复 |
|------|------|
| `frontend/.env` 不存在，axios 回退到 `http://localhost:3000/api` 直接请求后端跨域失败 | 创建 `frontend/.env`，设置 `VITE_API_URL=/api` 走 Vite proxy |
| backend CORS origin 白名单逻辑复杂且端口不匹配 | 简化为 `app.use(cors())` 完全开放本地开发 |
| authMiddleware 拦截 OPTIONS preflight 请求返回 401 | 增加 `if (req.method === 'OPTIONS') return next()` |
| `frontend/.env.example` 值为 `http://localhost:3000/api` 会导致相同问题 | 同步更新为 `/api` |

---

## 十一、下一步建议

### 高优先级（影响功能正确性）
1. **修复注册 role 硬编码** — authController.ts
2. **统一 id 类型** — User 模型改用 string (UUID)，或 shared 类型改用 number
3. **统一日期字段命名** — Sequelize 模型配置 `underscored: true` 或 shared 类型适配 snake_case

### 中优先级（提升开发体验）
4. **删除冗余路由** — 统一为 `/api/auth/me` 或 `/api/users/me` 之一
5. **前端 E2E 测试** — 使用 Playwright 覆盖注册→登录→创建专题核心流程

### 低优先级（生产准备）
6. **文件存储迁移方案** — 当前本地存储，生产需 OSS/S3
7. **数据库迁移脚本** — 禁用 Sequelize `sync({ alter: true })`，使用正式迁移
8. **JWT_SECRET 安全警告** — `.env` 中的默认值需在生产环境替换

---

## 十二、技术栈版本

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | 18.x |
| 前端构建 | Vite | 5.x |
| 前端路由 | React Router | 6.x |
| 前端状态 | Zustand | 4.x |
| 前端样式 | TailwindCSS | 3.x |
| 前端请求 | Axios | 1.x |
| 后端框架 | Express | 4.x |
| 后端 ORM | Sequelize | 6.x |
| 后端鉴权 | JWT (jsonwebtoken) | 9.x |
| 后端文件 | Multer | 1.x |
| 数据库 | MySQL | 8.x |
| 运行时 | Node.js | 20.x |
| 包管理 | pnpm | 10.x |
