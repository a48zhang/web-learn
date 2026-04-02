# 专题学习 WEB 平台

教育领域的专题学习平台，支持教师发布专题任务、学生协作探究、资源共享与成果评价。

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

使用 Docker Compose 快速启动 MySQL 开发环境：

```bash
docker-compose up -d
```

这将在后台启动 MySQL 8.0 容器，配置如下：
- 端口: 3306
- 数据库名: web_learn
- 用户: root
- 密码: dev_password

### 3. 配置环境变量

复制环境变量示例文件：

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

后端 `.env` 默认配置已适配 Docker Compose 的 MySQL 设置。

**重要**: 生产环境请修改 `JWT_SECRET` 为安全的随机字符串。

### 4. 启动开发服务器

```bash
pnpm dev
```

这将并行启动：
- 前端开发服务器 (http://localhost:5173)
- 后端 API 服务器 (http://localhost:3001)

### 5. 数据库初始化

首次启动后端服务时，Sequelize 会自动同步数据库表结构（开发模式）。

### 6. 访问应用

打开浏览器访问 http://localhost:5173

## 项目结构

```
web-learn/
├── frontend/          # React 前端应用
├── backend/           # Express 后端 API
├── shared/            # 前后端共享类型定义
├── docs/              # 产品文档
└── docker-compose.yml # 开发环境配置
```

## 主要功能

- ✅ 用户注册与登录（JWT 认证）
- ✅ 角色权限管理（教师/学生）
- ✅ 专题创建与管理
- ✅ 学习资源上传与下载
- ✅ 任务发布与作业提交
- ✅ 教师评分与反馈

## 测试

```bash
# 后端测试
cd backend && pnpm test

# 前端测试
cd frontend && pnpm test
```

## 开发规范

详见 [docs/README.md](docs/README.md)

## 生产部署

生产环境部署前请注意：

1. 修改所有 `.env` 文件中的敏感配置
2. 使用安全的 `JWT_SECRET`
3. 配置正确的 CORS 白名单
4. 使用 HTTPS
5. 配置文件上传存储方案（OSS/S3）
6. 禁用 Sequelize 自动同步，使用迁移脚本