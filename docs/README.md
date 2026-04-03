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


### 技术文档

- **[data-models.md](./data-models.md)** - 完整数据模型文档（详细的表结构和字段说明）
- **[implementation-status.md](./implementation-status.md)** - 实现状况报告（开发进度、已知问题）

## 开发规范

- 应当尽力避免单文件过大(超过500行)
- 本阶段开发结束后,应当去掉非必要的注释,保留可读性注释
- 提交代码前应当执行npm test
- 提交代码时需使用英文提交消息,视情况前缀为 Plan: Add: Update: Refactor: Fix: 等
- 如有必要,拆分成多个 commit,不要一次性提交大量代码
- 做计划不需要列出任何关于工期的内容
- 很可能有人和你同时工作，因此请确保在提交 commit 时只选择你自己的文件，不要弄坏别人的文件

## 文档归档

- `archive/` - 已过时的文档归档
