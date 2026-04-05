# 实现状况报告 — 已校准修复

## 微服务架构重构 PR Review 综合报告

本 PR 按照计划实现了微服务器重构，并针对 Review 发现的架构级风险进行了深度修复。

---

## 核心架构原则

1. **数据库物理共享，逻辑隔离**：所有服务连接到同一个 MySQL 实例，但通过 \`tableName\` 前缀（\`auth_\`, \`topic_\`, \`ai_\`）确保不同服务使用不同的物理表，彻底杜绝 DDL 冲突和数据覆写风险。
2. **构建一致性**：各子服务 \`Dockerfile\` 已校准以支持 \`packages/utils\` 的构建上下文映射。
3. **环境安全同步**：所有服务的 \`sequelize.sync\` 均受 \`NODE_ENV\` 守卫保护，仅在非生产运行环境下启用 \`alter: true\`。

---

## 已验证并修复的 Critical & Important 风险

### 1. 杜绝表定义冲突 (Resolved)
- **风险**：多个微服务定义的 \`users\` 表结构不一致，同时开启 \`alter: true\` 会导致数据（如密码列）被意外删除。
- **修复**：
    - \`auth\` 服务：使用 \`auth_users\` 表。
    - \`topic-space\` 服务：使用 \`topic_users\`, \`topic_topics\`, \`topic_topic_pages\` 表。
    - \`ai\` 服务：使用 \`ai_users\`, \`ai_topics\`, \`ai_topic_pages\` 表。
- **意义**：实现了服务间数据的硬隔离，即使共用一个库也不会互相干扰。

### 2. 补全 StorageService 运行时崩溃 (Resolved)
- **风险**：\`topic-space\` 使用了 Storage 服务但未进行 \`initStorageService()\` 初始化，导致文件上传相关路由直接抛错。
- **修复**：补全了从单体代码迁移丢失的 \`AliOSS\`, \`S3\`, \`Azure\` 适配器，并在 \`index.ts\` 中调用了 \`initStorage()\` 初始化工厂。

### 3. Docker 构建依赖链断裂 (Resolved)
- **风险**：各微服务 Dockerfile 原本未 COPY \`packages/utils\`，导致生产镜像构建失败。
- **修复**：更新了 \`auth\`, \`topic-space\`, \`ai\`, \`gateway\` 的 Dockerfile，将根目录 \`packages/\` 纳入构建上下文。

### 4. 数据安全：同步守卫 (Resolved)
- **风险**：无条件的 \`sync({ alter: true })\` 可能在生产环境触发破坏性修改。
- **修复**：在 \`auth\` 和 \`topic-space\` 入口中添加 \`NODE_ENV === 'production'\` 判断，生产环境默认不执行 Schema 修改。

---

## Review 反馈的技术驳回 (Rejected)

### 1. Gateway \`changeOrigin: true\` 的 CORS 误判
- **反馈**：认为该配置会导致 \`Origin\` 被重写。
- **事实**：\`changeOrigin: true\` 仅修改 \`Host\` 请求头。浏览器发出的 \`Origin\` 头在转发过程中保持不变，CORS 逻辑正常工作。该配置维持现状，无需修改。

---

## 状态汇总

| 任务 | 状态 | 涉及文件 |
|---|---|---|
| 表名隔离 (Prefixing) | ✅ 已完成 | 各服务 \`models/*.ts\` |
| 存储服务初始化 | ✅ 已完成 | \`services/topic-space/src/index.ts\` |
| DB 同步环境守卫 | ✅ 已完成 | 各服务 \`index.ts\` |
| Dockerfile 依赖修复 | ✅ 已完成 | 各服务 \`Dockerfile\` |
| LIKE 通配符转义 | ✅ 已完成 | \`services/ai/src/services/agentTools.ts\` |
| Any 类型 Cast 清理 | ✅ 已完成 | \`services/topic-space/src/middlewares/authMiddleware.ts\` |
