# Auth Service

> 最后更新：2026-04-12

## 概述

Auth Service 负责用户注册、登录、JWT 颁发和用户信息管理。

**端口：** 3001
**代码路径：** `services/auth`
**数据库表：** `auth_users`（独立管理）

## API 端点

### 用户注册

```
POST   /api/auth/register    - 用户注册（rate limit: 5次/小时）
```

**请求：**
```json
{
  "username": "user1",
  "email": "user1@example.com",
  "password": "securepassword"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "username": "user1",
      "role": "user"
    }
  }
}
```

### 用户登录

```
POST   /api/auth/login       - 用户登录（rate limit: 15次/15分钟）
```

**请求：**
```json
{
  "username": "user1",
  "password": "securepassword"
}
```

**响应：** 同注册。

### 获取当前用户

```
GET    /api/users/me         - 获取当前用户信息（需认证）
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "username": "user1",
    "email": "user1@example.com",
    "role": "user"
  }
}
```

### 健康检查

```
GET /health                  - 服务健康检查（公开）
```

## 用户模型

### User（用户）

**数据库表名：** `auth_users`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PRIMARY KEY, UUID | 用户ID |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 用户名 |
| email | VARCHAR(100) | UNIQUE, NOT NULL | 邮箱 |
| password | CHAR(60) | NOT NULL | 密码（bcrypt加密） |
| role | ENUM | NOT NULL | 角色：admin, user |
| created_at | TIMESTAMP | AUTO | 创建时间 |
| updated_at | TIMESTAMP | AUTO | 更新时间 |

**角色定义：**
- `admin` — 管理员（保留角色，不通过注册创建）
- `user` — 用户（原 teacher/student 已统一为此角色）

> 注：原 teacher/student 角色已统一为 `user`，详情见 [用户角色与权限](./user-roles.md)。

## JWT 配置

| 配置项 | 值 | 说明 |
|--------|------|------|
| 签名算法 | HS256 | 强制，防止算法混淆 |
| JWT_SECRET | 环境变量 | 生产环境必须配置 |
| 过期时间 | JWT_EXPIRES_IN | 默认 7d |

**JWT Payload：**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "username": "user1",
  "email": "user1@example.com",
  "role": "user"
}
```

**验证方式：**
```typescript
jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })
```

## 安全机制

- **密码加密：** bcrypt
- **算法强制：** JWT 仅允许 HS256
- **暴力防护：** 登录端点 rate limiting（15次/15分钟）
- **注册防护：** 注册端点 rate limiting（5次/小时）

## 跨服务访问

- Topic Space Service 和 AI Service 可只读访问 `auth_users` 表
- 通过 JWT 注入的用户信息（`x-user-*` 请求头）传递身份

## 相关文档

- [Gateway Service](./gateway-service.md)
- [数据模型](./data-models.md)
- [用户角色与权限](./user-roles.md)
