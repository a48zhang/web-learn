# 文档索引

## 核心文档

### 产品规格文档

**[spec/](./spec/)** - 完整的产品规格文档，按模块组织

[spec/README.md](./spec/README.md) 获取完整的文档导航和快速查找指南

- **[产品概述](./spec/overview.md)** - 产品定位、目标用户、核心价值
- **[用户角色与权限](./spec/user-roles.md)** - 角色定义、权限矩阵
- **[功能清单](./spec/features.md)** - 详细功能列表
- **[数据模型](./spec/data-models.md)** - 数据库设计
- **[API 设计](./spec/api-design.md)** - RESTful API 规范
- **[技术架构](./spec/architecture.md)** - 系统架构设计

### 设计与规划

**[superpowers/specs/](./superpowers/specs/)** - 设计文档
- **[用户设置设计](./superpowers/specs/2026-04-07-user-settings-design.md)** - 个人资料、密码修改、主题切换
- **[网站编辑器设计](./superpowers/specs/2026-04-07-website-editor-design.md)** - VSCode风格三栏编辑器设计
- **[前端 Agent Runtime 设计](./superpowers/specs/2026-04-08-frontend-agent-runtime-webcontainer-design.md)** - 前端工具循环与 WebContainer 集成

**[superpowers/plans/](./superpowers/plans/)** - 实施计划
- **[用户设置实施计划](./superpowers/plans/2026-04-07-user-settings.md)** - 用户设置实施计划
- **[网站编辑器实施计划](./superpowers/plans/2026-04-07-website-editor.md)** - 16步实施计划
- **[前端 Agent Runtime 实施计划](./superpowers/plans/2026-04-08-frontend-agent-runtime-webcontainer-plan.md)** - WebContainer 工具循环实施

### 迁移文档

**[migrations/](./migrations/)** - 数据库迁移文档

## 文档归档

- `archive/` - 已过时的文档归档（已完成的设计文档、旧计划等）

## 开发规范

- 应当尽力避免单文件过大(超过500行)
- 本阶段开发结束后,应当去掉非必要的注释,保留可读性注释
- 提交代码前应当执行npm test
- 提交代码时需使用英文提交消息,视情况前缀为 Plan: Add: Update: Refactor: Fix: 等
- 如有必要,拆分成多个 commit,不要一次性提交大量代码
- 做计划不需要列出任何关于工期的内容
- 很可能有人和你同时工作，因此请确保在提交 commit 时只选择你自己的文件，不要弄坏别人的文件
