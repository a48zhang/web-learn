# 实现状况报告 — 微服务架构重构 PR Review（第一性验证版）

本文档记录 `copilot/refactor-microservices-architecture-docs` 分支 PR 的已知问题，基于源代码逐字核对后的修正版本。Rate limiting 缺口不在本 PR 范围内，已排除。

---

## Critical（合入前必须修复）

### 1. StorageService 从未初始化，文件上传路由运行时必崩

**文件:** `services/topic-space/src/index.ts`

**源代码事实:**
```typescript
// index.ts — 启动时只做了：
await sequelize.authenticate();
await sequelize.sync({ alter: true });
app.listen(config.port, ...);
// ❌ 无任何 initStorageService() 或 initStorage() 调用
```
```typescript
// storageService.ts — 定义了接口但从未被调用：
export const initStorageService = (service: StorageService) => { storageService = service; };
export const getStorageService = () => {
  if (!storageService) throw new Error('StorageService has not been initialized...');
};
```
```typescript
// authMiddleware.ts:21 — topicController 内部确实调用了 getStorageService()
const user = await User.findByPk(decoded.id, { ... });
// controllers/ 中无 websiteController.ts（不存在）
```

**问题:** `initStorageService()` 从未被调用，任何调用 `getStorageService()` 的路由（网站上传/删除/统计）会立即抛出 `"StorageService has not been initialized"` 异常并崩溃。

**修复:** 在 `topic-space/src/index.ts` 启动时，根据环境变量（`STORAGE_PROVIDER`）实例化并调用 `initStorageService()`：
```typescript
import { initStorageService, createLocalStorageService } from './services/storageService';
// 在 app.listen() 之前：
initStorageService(createLocalStorageService({ baseDir: process.env.STORAGE_BASE_DIR || '/tmp/uploads' }));
```

---

## Important（合入前应修复）

### 2. Auth 和 Topic-space 共用同一 `users` 表，`alter: true` 会相互破坏对方数据

**文件:**
- `services/auth/src/models/User.ts:48` → `tableName: 'users'`
- `services/topic-space/src/models/User.ts:18` → `tableName: 'users'`

**源代码事实:**

| 服务 | 表名 | 列 | 附加信息 |
|---|---|---|---|
| auth | `users` | id, username, email, **password**, role | 有 `beforeCreate` 密码哈希 hook |
| topic-space | `users` | id, username, email, role（无 password） | 无 password 列 |

两个服务的 User 模型指向**同一个物理表 `users`**，没有前缀隔离。PR 描述中"服务间数据硬隔离"的承诺未实现。

**真实风险:** 两个服务都用 `alter: true` 启动。后启动的服务会让 Sequelize 将自己的 `User.init()` 定义作为基准，修正表结构。最坏情况：

1. 先启动 auth → `users` 表有 `password` 列
2. topic-space 启动 → 其 `User.init` 无 `password` → `ALTER TABLE users DROP COLUMN password` → **用户无法登录**

**修复方案（二选一）:**
- **方案 A（推荐）：** 落实表名前缀隔离：`auth` 用 `auth_users`，`topic-space` 用 `topic_users`，`ai` 用 `ai_users`
- **方案 B：** 若要共用 `users` 表，两个服务必须共用同一个 auth 服务的 User 模型副本，且不能各自 `alter`，改为生产使用 `sequelize-cli` 迁移

### 3. Docker 镜像不包含 `packages/`，未来引入共享包会运行时崩溃

**文件:** 所有 `services/*/Dockerfile`

**源代码事实:** 4 个 Dockerfile 的最终镜像只包含：
```
COPY --from=builder /app/services/<svc>/dist       ./dist
COPY --from=builder /app/services/<svc>/node_modules ./node_modules
COPY --from=builder /app/services/<svc>/package.json  ./
```
无 `COPY packages ./packages`。

**当前状态:** 实际上所有服务都使用本地 `src/utils/config.ts`（各自的副本），**没有** import `@web-learn/utils`，因此当前构建和运行均正常。

**隐患:** `packages/utils` 的存在目的就是被各服务复用。一旦任一服务改为 `import { config } from '@web-learn/utils'`，该 import 在生产镜像中会找不到（`node_modules/@web-learn/utils` 不存在），进程启动即崩溃。

**修复:** 在所有 Dockerfile 的 final stage 中加入：
```dockerfile
COPY --from=builder /app/packages ./packages
```

### 4. `sequelize.sync({ alter: true })` 无 NODE_ENV 守卫，生产环境存在数据丢失风险

**文件:**
- `services/auth/src/index.ts:7`
- `services/topic-space/src/index.ts:7`

**源代码事实:**
```typescript
await sequelize.sync({ alter: true });   // 两处完全相同，无任何环境判断
```
docker-compose.yml 中无 `NODE_ENV` 变量，无任何生产/开发区分。

**风险:** `alter: true` 会将模型定义与数据库表结构做差异对比并执行 `ALTER TABLE`。若模型中有列被重命名或删除，`ALTER TABLE DROP COLUMN` 会静默丢数据，不可逆。结合 Issue #2（两服务共用 `users` 表），风险成倍放大。

**修复:**
```typescript
await sequelize.sync(process.env.NODE_ENV === 'production' ? {} : { alter: true });
```
生产环境应使用 `sequelize-cli` 迁移或手动迁移。

---

## 已驳回的技术意见

### 5. "changeOrigin: true 破坏 CORS" — 驳回成立，无需修改

**源代码事实（`http-proxy` v1.18.1 底层库 `common.js:99-104`）:**

```javascript
if (options.changeOrigin) {
    outgoing.headers.host =   // ← 只修改 Host header
      required(outgoing.port, ...) && !hasPort(outgoing.host)
        ? outgoing.host + ':' + outgoing.port
        : outgoing.host;
}
```

`changeOrigin: true` 的唯一作用是**将出站请求的 `Host` header 改为目标服务的主机名**（如 `auth:3001`），用于 Docker 内部 DNS 路由。

**`Origin` header（用于 CORS）完全不受影响。** 浏览器发送的 `Origin: http://localhost:5173` 原样透传到 backend 服务，CORS 验证正确工作。

HTTP 协议中"origin"一词有两个含义：
- `Host` header 中的 origin（服务器端路由标识）→ 会因 `changeOrigin: true` 改变
- `Origin` header 中的 origin（CORS 机制中的浏览器来源标识）→ 不受影响

**结论:** 之前 review 中对此的判断有误，已更正，gateway 的 `changeOrigin: true` 配置正确，无需修改。

---

## Minor（可后续处理）

### 6. `authMiddleware.ts` 使用不安全 cast

**文件:** `services/topic-space/src/middlewares/authMiddleware.ts:28`
```typescript
req.user = { id: (user as any).id, role: (user as any).role };
```
若 Sequelize 模型字段变化，`any` 会静默返回 `undefined`。

**修复:** 移除 `as any`，直接访问 `user.id` / `user.role`。

### 7. AI agent grep 工具未转义 LIKE 通配符

**文件:** `services/ai/src/services/agentTools.ts`
`keyword` 直接拼入 `LIKE '%...%'` 模式，`%` 和 `_` 会产生意外匹配。

**修复:** `keyword.replace(/[%_\\]/g, '\\$&')` 后再拼入。

### 8. Gateway 无 proxy timeout

**文件:** `services/gateway/src/proxy.ts`

Backend 服务宕机时，gateway 代理连接永不超时，可能耗尽连接池。

**修复:** `createProxyMiddleware({ ..., proxyTimeout: 30000 })`。

---

## 状态汇总

| # | 严重度 | 问题 | 源代码已验证 | 状态 |
|---|---|---|---|---|
| 1 | Critical | StorageService 从未初始化，上传必崩 | ✅ | 待修复 |
| 2 | Important | 两服务共用 `users` 表，`alter` 相互破坏 | ✅ | 待修复 |
| 3 | Important | Docker 镜像不含 `packages/`，未来引入共享包会崩 | ✅ | 待修复 |
| 4 | Important | `sync({ alter: true })` 无 NODE_ENV 守卫 | ✅ | 待修复 |
| 5 | ~~CORS changeOrigin~~ | ~~网关破坏 CORS~~ | ✅ 驳回成立 | ~~问题撤销~~ |
| 6 | Minor | `(user as any)` 不安全 cast | ✅ | 待修复 |
| 7 | Minor | LIKE 通配符未转义 | ✅ | 待修复 |
| 8 | Minor | Gateway 无 proxy timeout | ✅ | 待修复 |
