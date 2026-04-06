# 产品规格文档索引

> 最后更新：2026-04-06

本目录包含专题学习平台的完整产品规格文档，按模块组织便于查找和维护。

**系统架构：** 微服务架构（Gateway + Auth + Topic Space + AI）

## 文档导航

### 核心文档

1. **[产品概述](./overview.md)** - 产品定位、目标用户、核心价值
   - 产品定位
   - 目标用户
   - 适用场景
   - 核心价值
   - 公开访问设计

2. **[用户角色与权限](./user-roles.md)** - 角色定义、权限矩阵
   - 访客、学生、教师角色
   - 权限矩阵表
   - 公开访问原则

3. **[功能清单](./features.md)** - 详细功能列表
   - 专题管理
   - 知识库页面管理（Markdown）
   - 网站专题上传与预览
   - AI 学习助手

4. **[数据模型](./data-models.md)** - 数据库设计
   - 核心实体定义
   - ER 图
   - 模型关系

5. **[API 设计](./api-design.md)** - RESTful API 规范
   - API 端点列表
   - 权限控制矩阵
   - 认证机制
   - 错误处理

6. **[AI Agent 系统](./agents.md)** - 智能助手设计
   - 学习助手 Agent
   - 专题搭建 Agent
   - Tool Call 机制
   - 实现架构

7. **[技术架构](./architecture.md)** - 系统架构设计
   - 微服务架构（Gateway、Auth、Topic Space、AI）
   - pnpm workspace monorepo 结构
   - Docker Compose 部署
   - 核心流程

8. **[前端架构](./frontend-architecture.md)** - 前端页面与组件架构
   - 页面分流
   - 组件职责边界
   - 状态与数据流约定

## 快速查找

### 按主题查找

**产品定位：**
- [产品概述](./overview.md#产品定位)
- [核心价值](./overview.md#核心价值)
- [适用场景](./overview.md#适用场景)

**权限设计：**
- [用户角色](./user-roles.md#角色定义)
- [权限矩阵](./user-roles.md#权限矩阵)
- [公开访问原则](./user-roles.md#公开访问原则)

**功能说明：**
- [专题管理](./features.md#1-专题学习空间管理)
- [知识库页面管理](./features.md#12-知识库版专题管理markdown)
- [网站专题管理](./features.md#13-网站版专题管理)
- [AI 学习助手](./features.md#2-ai-学习助手)

**AI Agent 系统：**
- [学习助手 Agent](./agents.md#1-学习助手-agent)
- [专题搭建 Agent](./agents.md#2-专题搭建-agent)
- [Tool Call 机制](./agents.md#tool-call-机制)

**技术实现：**
- [数据模型](./data-models.md#核心实体)
- [API 端点](./api-design.md#api-端点)
- [微服务架构](./architecture.md#微服务架构)
- [技术栈](./architecture.md#技术栈)
- [部署架构](./architecture.md#部署架构)

### 按角色查找

**访客：**
- [访客权限](./user-roles.md#访客未登录用户)
- [公开 API](./api-design.md#公开访问规则)

**学生：**
- [学生权限](./user-roles.md#学生)
- [学习助手 Agent](./agents.md#1-学习助手-agent)

**教师：**
- [教师权限](./user-roles.md#教师)
- [专题管理](./features.md#1-专题学习空间管理)
- [学习助手 Agent](./agents.md#1-学习助手-agent)
- [专题搭建 Agent](./agents.md#2-专题搭建-agent)

## 设计原则

### 核心原则

1. **完全公开访问**
   - 所有已发布的专题对所有人开放（包括未登录访客）
   - 访客可自由浏览专题与知识库页面
   - AI 使用与管理操作需要登录

2. **简化设计**
   - 无加入机制
   - 移除任务/提交/评价工作流
   - 专注核心的"创建-浏览-AI辅助"流程

3. **用户友好**
   - 访客友好：无需注册即可浏览
   - 简单直接：无复杂流程
   - 按需认证：只在必要时要求登录

## 相关文档

- [微服务架构设计](../microservices-architecture-design.md) - 微服务重构完整设计文档
- [实现状况报告（已归档）](../archive/implementation-status-microservices-refactoring-2026-04-06.md) - 微服务重构完成状态
- [开发规范](../README.md) - 代码规范和提交规范

## 文档历史

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-04-06 | v3.0 | 微服务架构重构完成：更新所有文档反映微服务架构 |
| 2026-04-03 | v2.0 | 重大修改：明确"专题学习"概念，改为完全公开访问 |
| 2026-04-02 | v1.0 | 初始版本 |

## 贡献指南

更新文档时请注意：
1. 保持各文档间的一致性
2. 更新"最后更新"日期
3. 同步修改相关联的文档
4. 添加到本索引文件
