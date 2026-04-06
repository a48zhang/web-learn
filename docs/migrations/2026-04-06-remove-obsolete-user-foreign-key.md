# 数据库迁移：移除过时的User外键约束

## 背景

在微服务认证架构重构中，用户管理统一由Auth Service负责。Topic-space服务不再维护本地User表，但数据库表结构仍有外键约束指向已废弃的`topic_users`表。

## 问题

```
ERROR: Cannot add or update a child row: a foreign key constraint fails 
(`web_learn`.`topic_topics`, CONSTRAINT `topic_topics_ibfk_1` 
FOREIGN KEY (`created_by`) REFERENCES `topic_users` (`id`)
```

## 解决方案

### 方案1: 移除外键约束（推荐）

在新架构中，用户认证由Auth Service统一管理，`created_by`字段仅存储用户ID，不需要数据库级别的外键约束。

```sql
-- 移除旧的外键约束
ALTER TABLE topic_topics DROP FOREIGN KEY topic_topics_ibfk_1;

-- 验证约束已移除
SHOW CREATE TABLE topic_topics;
```

**优点：**
- 完全符合微服务架构原则（用户数据由Auth Service管理）
- 避免跨服务的数据库耦合
- 允许Topic-space独立运行

**缺点：**
- 失去数据库级别的引用完整性检查
- 需要应用层确保用户ID有效性（已通过Gateway认证保证）

### 方案2: 修改外键指向auth_users表

如果希望保留数据库级别的外键约束，可以改为指向Auth Service使用的`auth_users`表：

```sql
-- 移除旧约束
ALTER TABLE topic_topics DROP FOREIGN KEY topic_topics_ibfk_1;

-- 添加新约束指向auth_users
ALTER TABLE topic_topics ADD CONSTRAINT topic_topics_created_by_fk 
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON UPDATE CASCADE;
```

**优点：**
- 保留引用完整性检查
- 数据库层面保证created_by字段有效性

**缺点：**
- 创建了跨服务的数据库耦合（不推荐）
- 所有服务共享同一数据库，违反微服务独立性原则

## 推荐方案

**推荐使用方案1（移除外键约束）**，原因：

1. **符合微服务架构原则**：每个服务应该有自己的数据存储，不应共享数据库表
2. **认证已由Gateway保证**：所有请求经过Gateway验证，`created_by`字段来自已验证的用户信息
3. **避免跨服务依赖**：Topic-space不应依赖Auth Service的数据库表结构

## 执行步骤

```bash
# 1. 连接数据库
mysql -u root -p web_learn

# 2. 执行迁移
ALTER TABLE topic_topics DROP FOREIGN KEY topic_topics_ibfk_1;

# 3. 验证
SHOW CREATE TABLE topic_topics;

# 4. 测试创建Topic（使用应用）
```

## 回滚方案

如果需要回滚，重新创建外键约束：

```sql
-- 需要先创建topic_users表（如果不存在）
CREATE TABLE IF NOT EXISTS topic_users (
  id INT PRIMARY KEY,
  username VARCHAR(50),
  email VARCHAR(100),
  role VARCHAR(20)
);

-- 重新添加外键
ALTER TABLE topic_topics ADD CONSTRAINT topic_topics_ibfk_1
  FOREIGN KEY (created_by) REFERENCES topic_users(id) ON UPDATE CASCADE;
```

## 影响评估

- **数据完整性**：由Gateway认证保证，无需数据库级别约束
- **性能影响**：移除外键约束可能略微提升插入性能
- **向后兼容**：现有数据不受影响

## 相关文件

- `services/topic-space/src/models/Topic.ts` - Topic model定义
- `services/topic-space/src/models/index.ts` - 已移除User model关联
- `docs/superpowers/specs/2026-04-06-microservices-auth-refactor-design.md` - 认证架构设计