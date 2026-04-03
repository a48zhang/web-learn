# 技术架构

> 最后更新：2026-04-03

## 系统架构

采用**前后端分离的单体应用架构**，适合中小规模教育场景。

```mermaid
graph TD
    A[前端 React SPA] -->|HTTP/REST| B[后端 Express API]
    B -->|ORM| C[(MySQL 数据库)]
    B -->|文件操作| D[本地文件存储]
    E[用户浏览器] -->|HTTPS| A
```

## 技术栈

### 前端

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **TailwindCSS** - 样式框架
- **Axios** - HTTP 客户端
- **Zustand** - 状态管理

### 后端

- **Node.js 20** - 运行时
- **Express 4** - Web 框架
- **TypeScript** - 类型安全
- **Sequelize 6** - ORM
- **JWT** - 身份认证
- **bcrypt** - 密码加密

### 数据库

- **MySQL 8.0** - 关系型数据库

### 开发工具

- **pnpm workspace** - Monorepo 管理
- **Docker Compose** - 本地开发环境
- **Jest** - 测试框架

## 部署架构

### 开发环境

```
前端：http://localhost:5173
后端：http://localhost:3001
数据库：Docker MySQL 容器
```

### 生产环境建议

**前端：**
- 静态文件托管（Nginx/CDN）
- HTTPS SSL 证书

**后端：**
- 云服务器或容器服务
- 环境变量配置

**数据库：**
- 云数据库（如阿里云 RDS）
- 自动备份

**文件存储：**
- 对象存储（如 OSS/S3）
- CDN 加速

**安全：**
- HTTPS 加密传输
- 防火墙规则
- 定期安全审计

## 目录结构

```
web-learn/
├── frontend/               # React 前端应用
│   ├── src/
│   │   ├── components/    # UI 组件
│   │   ├── pages/         # 页面组件
│   │   ├── services/      # API 调用
│   │   ├── stores/        # 状态管理
│   │   └── types/         # TypeScript 类型
│   └── package.json
│
├── backend/                # Express 后端 API
│   ├── src/
│   │   ├── controllers/   # 业务逻辑
│   │   ├── models/        # 数据模型
│   │   ├── routes/        # 路由定义
│   │   ├── middlewares/   # 中间件
│   │   └── utils/         # 工具函数
│   └── package.json
│
├── shared/                 # 前后端共享类型
│   └── src/types/
│
├── docs/                   # 文档
│   ├── spec/              # 产品规格文档
│   ├── data-models.md     # 数据模型文档
│   └── implementation-status.md
│
├── docker-compose.yml      # 开发环境配置
├── package.json           # Monorepo 根配置
└── pnpm-workspace.yaml    # pnpm workspace 配置
```

## 核心流程

### 公开访问流程

```mermaid
sequenceDiagram
    participant 访客
    participant 前端
    participant 后端
    participant 数据库

    访客->>前端: 访问专题列表
    前端->>后端: GET /api/topics
    Note over 后端: 无需认证
    后端->>数据库: 查询已发布专题
    数据库-->>后端: 返回专题列表
    后端-->>前端: JSON 响应
    前端-->>访客: 显示专题列表
```

### 认证流程

```mermaid
sequenceDiagram
    participant 学生
    participant 前端
    participant 后端
    participant 数据库

    学生->>前端: 点击提交成果
    前端->>前端: 检查登录状态
    alt 未登录
        前端->>学生: 显示登录页面
        学生->>前端: 输入凭证
        前端->>后端: POST /api/auth/login
        后端->>数据库: 验证凭证
        数据库-->>后端: 返回用户信息
        后端->>后端: 生成 JWT Token
        后端-->>前端: 返回 Token
        前端->>前端: 存储 Token
    end
    前端->>后端: POST /api/topics/:id/submissions<br/>Authorization: Bearer <token>
    后端->>后端: 验证 Token
    后端->>数据库: 保存提交
    后端-->>前端: 提交成功
    前端-->>学生: 显示成功消息
```

## 相关文档

- [产品概述](./overview.md)
- [API 设计](./api-design.md)
- [数据模型](./data-models.md)