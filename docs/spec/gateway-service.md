# Gateway Service

> 最后更新：2026-04-12

## 概述

API Gateway 是系统的唯一入口，负责路由转发、JWT 验证、用户信息注入、CORS 处理和全局限流。

**端口：** 3000
**代码路径：** `services/gateway`

## 路由映射

| Gateway 路由 | 目标服务 | 目标端口 |
|---|---|---|
| `/api/auth/*` | Auth Service | 3001 |
| `/api/users/*` | Auth Service | 3001 |
| `/api/topics/*` | Topic Space Service | 3002 |
| `/api/ai/*` | AI Service | 3003 |

**转发配置：**
```typescript
app.use('/api/auth', proxy('http://auth:3001'))
app.use('/api/users', proxy('http://auth:3001'))
app.use('/api/topics', proxy('http://topic-space:3002'))
app.use('/api/ai', proxy('http://ai:3003'))
```

每个代理使用 `http-proxy-middleware`，通过 `pathRewrite` 恢复被 Express 移除的 mount point：
```typescript
pathRewrite: (path, req) => {
  const fullPath = (req.baseUrl || '') + path;
  return fullPath;
}
```

## 认证与用户上下文注入

**JWT 验证：**
- Gateway `authMiddleware` 验证 JWT Bearer Token
- 强制 HS256 算法，防止算法混淆攻击
- 验证通过后注入用户上下文到请求头

**注入的请求头：**
| 请求头 | 说明 |
|---|---|
| `x-user-id` | 用户 UUID |
| `x-user-username` | 用户名 |
| `x-user-email` | 用户邮箱 |
| `x-user-role` | 用户角色 |

下游服务直接从这些请求头读取用户信息，无需重复验证 JWT。

**处理流程：**
```
请求 → authMiddleware → JWT 验证 → 注入 x-user-* 头 → 转发到下游
```

## 全局特性

### 限流

- **全局限流：** 600 次/分钟
- **认证端点限流：** 注册 5 次/小时，登录 15 次/15 分钟

### CORS

全局 CORS 处理，前端无感知微服务拆分细节。

### Proxy 超时

所有代理 30 秒超时（30000ms）。

## 健康检查

各服务独立 `/health` 端点，通过 Gateway 公开可访问：

```
GET http://gateway:3000/health
GET http://auth:3001/health
GET http://topic-space:3002/health
GET http://ai:3003/health
```

**响应格式：**
```json
{
  "success": true,
  "service": "gateway",
  "timestamp": "2026-04-12T12:00:00.000Z"
}
```

## 错误响应

**标准错误格式：**
```json
{ "success": false, "error": "错误消息" }
```

| 状态码 | 说明 | 示例 |
|--------|------|------|
| 400 | 请求参数错误 | 缺少必填字段 |
| 401 | 未认证 | 未提供有效的 Token |
| 403 | 权限不足 | 未授权的操作 |
| 404 | 路由不存在 | 错误的 API 路径 |
| 500 | 服务器错误 | 内部错误 |

## 服务启动顺序

Gateway 等待下游服务健康后才启动（Docker Compose `depends_on` + healthcheck）。

## 相关文档

- [技术架构](./architecture.md)
- [Auth Service](./auth-service.md)
- [Topic Space Service](./topic-space-service.md)
- [AI Service](./ai-service.md)
