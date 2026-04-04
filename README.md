# 专题学习 WEB 平台

教育领域的专题学习平台，支持教师创建专题空间、访客/学生公开浏览专题内容，并通过 AI 助手完成学习问答与专题搭建。

## 技术栈

- **前端**: React 18 + TypeScript + Vite + TailwindCSS
- **后端**: Node.js 20 + Express + TypeScript + Sequelize
- **数据库**: MySQL 8.0
- **架构**: Monorepo（pnpm workspace）

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动开发数据库

```bash
docker-compose up -d
```

### 3. 配置环境变量

复制环境变量示例文件：

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

### 4. 启动开发服务器

```bash
pnpm dev
```

默认地址：
- 前端：http://localhost:5173
- 后端：http://localhost:3001

## 环境变量

### 根目录 `.env`

- `PORT`：后端端口（默认 `3001`）
- `JWT_SECRET`：JWT 密钥（必填）
- `JWT_EXPIRES_IN`：JWT 过期时间（默认 `7d`）
- `CORS_ORIGINS`：允许的前端域名列表（逗号分隔）
- `DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`：数据库连接配置
- `UPLOADS_DIR`：本地上传目录
- `OPENAI_API_KEY`：OpenAI/API 兼容服务密钥（启用 AI 助手时必填）
- `OPENAI_BASE_URL`：可选，自定义 OpenAI 兼容 API 地址
- `OPENAI_MODEL`：可选，默认模型名

### 前端 `frontend/.env`

- `VITE_API_URL`：后端 API 基础地址（默认 `/api`）

## 当前核心能力

- ✅ 用户注册与登录（JWT 认证）
- ✅ 角色体系（admin / teacher / student）
- ✅ 专题管理（knowledge / website）
- ✅ 知识库页面树 CRUD 与排序
- ✅ 公开浏览已发布专题与页面
- ✅ AI 学习助手与搭建助手（`/api/ai/chat`）
- ✅ 网站型专题 ZIP 上传/更新/删除与预览

## 常用命令

```bash
pnpm lint
pnpm build
pnpm test
```

## 文档

- [产品概述](docs/spec/overview.md)
- [功能清单](docs/spec/features.md)
- [数据模型](docs/spec/data-models.md)
- [API 设计](docs/spec/api-design.md)
- [AI Agent 系统](docs/spec/agents.md)
- [技术架构](docs/spec/architecture.md)
