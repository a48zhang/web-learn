# 微服务认证架构重构设计规范

## 背景

当前微服务架构（auth、topic-space、ai + gateway）存在严重的代码重复和认证问题：

1. **认证中间件重复**：三个服务各自实现完全相同的 authMiddleware（36-43 行代码）
2. **User 模型表名不一致**：
   - auth service: `auth_users` 表（完整用户数据）
   - topic-space service: `topic_users` 表（无数据）
   - ai service: `auth_users` 表
3. **Token 验证失败**：topic-space 服务查询错误的表导致认证失败
4. **其他重复代码**：database.ts、config.ts 等基础设施代码在三个服务中重复

## 目标

通过 Gateway 统一认证架构解决跨服务 token 验证问题，提取共享代码到 shared 包，实现：

1. 单点认证：Gateway 作为唯一认证入口
2. 服务边界清晰：Auth Service 提供内部验证接口
3. 代码复用：下游服务使用 shared 包统一解析用户信息
4. 最小改动：仅提取认证相关代码，降低风险

## 架构设计

### 认证流程

```
客户端 → Gateway → Auth Service (验证) → Gateway → 下游服务 (topic-space/ai)
```

**详细流程：**

1. 客户端请求携带 `Authorization: Bearer <token>` 到达 Gateway
2. Gateway 提取 token，调用 Auth Service 内部接口验证
3. Auth Service 验证 token 并查询 auth_users 表返回用户信息
4. Gateway 将用户信息注入请求 headers：
   - `X-User-Id`
   - `X-User-Username`
   - `X-User-Email`
   - `X-User-Role`
5. Gateway 使用 `http-proxy-middleware` 转发请求到下游服务
6. 下游服务使用 shared 包的 `internalAuthMiddleware` 从 headers 提取用户信息到 `req.user`
7. 下游服务业务逻辑正常执行（无需关心认证细节）

### 内部接口设计

**Auth Service 新增接口：**

```
POST /internal/verify
Body: { "token": "<jwt-token>" }
Response: {
  "success": true,
  "user": {
    "id": 1,
    "username": "test",
    "email": "test@example.com",
    "role": "teacher"
  }
}
```

**接口特点：**

- 无认证要求：假设内部网络可信（Gateway 和 Auth Service 在同一内部网络）
- 仅限内部调用：路径 `/internal/*` 不对外暴露（Gateway 代理配置排除）
- 错误处理：token 无效/过期返回 `{ "success": false, "error": "..." }`

### Gateway 改造

**新增组件：**

1. **Auth Verification Middleware**
   - 在 proxy 转发前拦截需要认证的路由
   - 调用 Auth Service `/internal/verify` 接口
   - 设置用户信息 headers

2. **路由分级：**
   - 公开路由（无需认证）：`/api/auth/login`, `/api/auth/register`, `/health`
   - 受保护路由（需要认证）：其他所有 `/api/*` 路径

3. **Auth Service Client**
   - 封装 HTTP 调用 Auth Service 的逻辑
   - 配置 Auth Service URL（环境变量 `AUTH_SERVICE_URL`）
   - 处理调用超时和错误

### 下游服务改造

**删除代码：**
- `services/*/src/middlewares/authMiddleware.ts`（JWT 验证逻辑）
- `services/*/src/models/User.ts`（不再需要）

**替换为：**
- 使用 shared 包的 `internalAuthMiddleware`

**保留代码：**
- 各服务的 database.ts、config.ts 等基础设施代码（暂不提取）
- 业务逻辑相关代码保持不变

### Shared 包新增内容

**目录结构：**

```
shared/src/auth/
  ├── internalAuthMiddleware.ts  # Express middleware：从 headers 提取用户信息
  ├── userContext.ts             # 工具函数：解析 headers 到 User 对象
  └ types.ts                     # 类型定义：InternalUser, AuthHeaders
```

**核心实现：**

**1. `shared/src/auth/types.ts`**

```typescript
export interface InternalUser {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
}

export interface AuthHeaders {
  'x-user-id': string;
  'x-user-username': string;
  'x-user-email': string;
  'x-user-role': string;
}
```

**2. `shared/src/auth/userContext.ts`**

```typescript
import { InternalUser, AuthHeaders } from './types';

export function extractUserFromHeaders(headers: Partial<AuthHeaders>): InternalUser | null {
  const id = headers['x-user-id'];
  const username = headers['x-user-username'];
  const email = headers['x-user-email'];
  const role = headers['x-user-role'];

  if (!id || !username || !email || !role) {
    return null;
  }

  return {
    id: parseInt(id, 10),
    username,
    email,
    role: role as InternalUser['role'],
  };
}
```

**3. `shared/src/auth/internalAuthMiddleware.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { InternalUser } from './types';
import { extractUserFromHeaders } from './userContext';

export interface AuthenticatedRequest extends Request {
  user?: InternalUser;
}

export function internalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = extractUserFromHeaders(req.headers as any);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: missing or invalid user context headers'
    });
  }

  req.user = user;
  next();
}
```

**4. Shared 包导出更新：**

`shared/src/index.ts` 新增导出：

```typescript
export * from './auth/types';
export * from './auth/userContext';
export * from './auth/internalAuthMiddleware';
```

## 实现细节

### Gateway 认证拦截逻辑

**选择需要认证的路由：**

```typescript
const publicPaths = ['/api/auth/login', '/api/auth/register', '/health'];

app.use((req, res, next) => {
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next(); // 公开路由直接转发
  }

  // 需要认证的路由：验证 token
  authVerificationMiddleware(req, res, next);
});
```

**Auth Verification Middleware 实现：**

```typescript
async function authVerificationMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  try {
    // 调用 Auth Service 验证
    const authResponse = await callAuthService('/internal/verify', { token });

    if (!authResponse.success || !authResponse.user) {
      return res.status(401).json({ success: false, error: authResponse.error || 'Invalid token' });
    }

    // 设置 headers 传递给下游服务
    req.headers['x-user-id'] = authResponse.user.id.toString();
    req.headers['x-user-username'] = authResponse.user.username;
    req.headers['x-user-email'] = authResponse.user.email;
    req.headers['x-user-role'] = authResponse.user.role;

    next(); // 继续转发到 proxy
  } catch (error) {
    return res.status(503).json({ success: false, error: 'Auth service unavailable' });
  }
}
```

### Auth Service 内部接口实现

**新增路由：**

`services/auth/src/routes/internal.ts`:

```typescript
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { config } from '../utils/config';

const router = Router();

router.post('/verify', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, error: 'Token required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'username', 'email', 'role']
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    return res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

export default router;
```

**App 配置：**

`services/auth/src/app.ts` 新增：

```typescript
import internalRoutes from './routes/internal';

// 内部接口（不对外暴露）
app.use('/internal', internalRoutes);

// 对外接口（通过 Gateway 代理）
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
```

### 下游服务使用 shared 包

**安装依赖：**

```bash
pnpm --filter @web-learn/topic-space-service add @web-learn/shared
pnpm --filter @web-learn/ai-service add @web-learn/shared
pnpm --filter @web-learn/gateway add @web-learn/shared
```

**替换 middleware：**

`services/topic-space/src/app.ts`:

```typescript
import { internalAuthMiddleware } from '@web-learn/shared';

// 删除旧的 authMiddleware 导入
// import { authMiddleware } from './middlewares/authMiddleware';

// 使用 shared 包的 middleware
app.use('/api/topics', internalAuthMiddleware, topicRoutes);
app.use('/api/pages', internalAuthMiddleware, pageRoutes);
```

**删除旧文件：**

```bash
rm services/topic-space/src/middlewares/authMiddleware.ts
rm services/ai/src/middlewares/authMiddleware.ts
rm services/topic-space/src/models/User.ts
rm services/ai/src/models/User.ts
```

## 错误处理

### Gateway 错误场景

1. **Token 缺失**：返回 401 `{ success: false, error: 'No token provided' }`
2. **Auth Service 调用失败**：返回 503 `{ success: false, error: 'Auth service unavailable' }`
3. **Token 无效/过期**：返回 401 `{ success: false, error: 'Token expired' }` 或 `'Invalid token'`

### 下游服务错误场景

1. **Headers 缺失**：返回 401 `{ success: false, error: 'Unauthorized: missing user context headers' }`
   - 原因：请求未经过 Gateway（直连服务）或 Gateway 配置错误

### Auth Service 内部接口错误

1. **Token 缺失**：返回 400 `{ success: false, error: 'Token required' }`
2. **User 不存在**：返回 401 `{ success: false, error: 'User not found' }`
3. **Token 过期/无效**：返回 401 对应错误信息

## 安全考虑

### Headers 信任机制

**假设：** 内部网络可信，Gateway 是唯一入口

**风险：** 如果攻击者能直接访问下游服务（绕过 Gateway），可伪造 headers

**缓解措施：**

1. **网络隔离：** 下游服务仅监听内部端口，不对外暴露
2. **Gateway 作为唯一入口：** 所有外部流量必须经过 Gateway
3. **未来可扩展：** 如需更高安全性，可添加 HMAC 签名或 Internal API Key

### Auth Service 内部接口保护

**当前方案：** `/internal/*` 无认证，任何内部服务可调用

**风险：** 内部其他服务可能滥用验证接口

**缓解措施：**

1. **路径隔离：** Gateway 代理配置不转发 `/internal/*` 路径
2. **日志监控：** 记录所有 `/internal/verify` 调用，便于审计
3. **未来扩展：** 可添加 Internal API Key 或 Service Token

## 测试策略

### 单元测试

**Shared 包：**

- `userContext.extractUserFromHeaders` 正常解析测试
- Headers 缺失字段返回 null 测试
- Role 类型验证测试

**Gateway：**

- Auth Verification Middleware 成功验证测试
- Token 缺失/无效测试
- Auth Service 调用失败测试

**Auth Service：**

- `/internal/verify` 接口成功验证测试
- Token 过期/无效测试
- User 不存在测试

### 集成测试

**完整认证流程：**

1. 客户端登录获取 token
2. 客户端使用 token 访问 Gateway 受保护路由
3. Gateway 转发到下游服务
4. 下游服务返回业务数据

**错误流程：**

1. 无 token 访问受保护路由 → 401
2. 过期 token 访问 → 401
3. Auth Service 不可用 → 503

### 手动验证

**Postman/curl 测试：**

```bash
# 登录获取 token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# 访问受保护路由（带 token）
curl -X GET http://localhost:3000/api/topics \
  -H "Authorization: Bearer <token>"

# 验证内部接口（仅 Gateway 可调用）
curl -X POST http://localhost:3001/internal/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"<token>"}'
```

## 迁移步骤

### Phase 1: Shared 包实现

1. 创建 `shared/src/auth/` 目录和文件
2. 实现 types、userContext、internalAuthMiddleware
3. 更新 `shared/src/index.ts` 导出
4. 运行 `pnpm -C shared build` 编译
5. 单元测试验证

### Phase 2: Auth Service 内部接口

1. 创建 `services/auth/src/routes/internal.ts`
2. 实现 `/internal/verify` 接口
3. 在 `services/auth/src/app.ts` 注册路由
4. 启动 auth service 测试接口
5. curl/Postman 验证接口工作

### Phase 3: Gateway 认证拦截

1. 实现 authVerificationMiddleware
2. 实现 Auth Service client（HTTP 调用封装）
3. 配置公开路由白名单
4. 在 proxy 转发前插入认证 middleware
5. Gateway 安装 shared 包依赖
6. 手动测试完整认证流程

### Phase 4: 下游服务迁移

1. topic-space 和 ai service 安装 shared 包依赖
2. 替换 middleware 导入（使用 shared 包）
3. 删除旧的 `authMiddleware.ts` 文件
4. 删除 `User.ts` model（不再需要）
5. 启动服务测试业务流程
6. 验证认证失败场景（headers 缺失）

### Phase 5: 验证与清理

1. 运行所有服务集成测试
2. 验证公开路由（login/register）无需认证
3. 验证受保护路由需要 token
4. 验证 token 过期/无效场景
5. 删除各服务中未使用的代码（彻底清理）
6. 更新文档和 README

## 风险与回滚

### 主要风险

1. **Gateway 成为瓶颈：** 所有请求经过 Gateway，认证失败或 Gateway 不可用导致全站不可访问
   - 缓解：Gateway 高可用部署（未来），Auth Service 调用超时设置

2. **Headers 伪造风险：** 内部网络泄露时攻击者可伪造 headers
   - 缓解：网络隔离，下游服务仅监听内部端口

3. **迁移期间服务中断：** 改动多个服务，可能出现短暂认证失败
   - 缓解：逐步迁移，保留旧 middleware 作为备份（短期）

### 回滚方案

**如果新架构出现问题：**

1. Gateway 移除认证拦截（恢复纯 proxy）
2. 下游服务恢复旧 authMiddleware（Git revert）
3. 删除 Auth Service `/internal/verify` 接口
4. Shared 包 auth 模块标记为 deprecated（暂不删除）

**回滚命令：**

```bash
git revert <commit-hash>  # 回滚相关 commits
pnpm install              # 重新安装依赖
pnpm dev                  # 恢复旧架构运行
```

## 未来扩展

### 性能优化

1. **Gateway 缓存：** 缓存 token 验证结果（短期，如 5 分钟）
   - 注意：用户信息变更时需失效缓存

2. **JWT 本地验证：** Gateway 本地验证 JWT（无需调用 Auth Service）
   - 需要共享 JWT secret 到 Gateway
   - 权限变更时仍需调用 Auth Service 查询最新信息

### 安全增强

1. **Internal API Key：** Auth Service 要求 Gateway 提供认证
2. **HMAC 签名：** Gateway 对 headers 签名，下游服务验证签名
3. **mTLS：** Gateway 和 Auth Service 双向 TLS 认证

### 代码提取扩展

当前仅提取认证代码，未来可考虑：

1. **Database connection：** 提取到 shared/src/database/
2. **Config utilities：** 提取到 shared/src/config/
3. **Error handling：** 提取到 shared/src/errors/
4. **Logging：** 提取到 shared/src/logging/

## 成功标准

架构重构成功的衡量指标：

1. **功能正确性：**
   - Token 验证成功，用户信息正确传递到下游服务
   - 公开路由无需认证可访问
   - 受保护路由无 token 或无效 token 返回 401

2. **代码质量：**
   - 删除三个服务的重复 authMiddleware（约 100 行代码）
   - Shared 包提供统一的认证解析逻辑
   - 无编译错误，无 lint 错误

3. **测试覆盖：**
   - Shared 包单元测试覆盖 userContext 和 middleware
   - Auth Service `/internal/verify` 接口测试
   - Gateway 认证拦截测试
   - 集成测试验证完整认证流程

4. **性能与可用性：**
   - 认证延迟增加小于 100ms（Gateway → Auth Service 调用）
   - Auth Service 不可用时 Gateway 返回明确错误（503）
   - 下游服务业务逻辑无影响

## 参考资料

- 当前代码结构：`services/auth/src/middlewares/authMiddleware.ts`, `services/topic-space/src/middlewares/authMiddleware.ts`, `services/ai/src/middlewares/authMiddleware.ts`
- Gateway 代理配置：`services/gateway/src/proxy.ts`, `services/gateway/src/app.ts`
- Shared 包结构：`shared/src/types/index.ts`, `shared/package.json`
- User model 定义：`services/auth/src/models/User.ts`（auth_users 表）