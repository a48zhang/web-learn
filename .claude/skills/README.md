# Superpowers 技能库

这个目录包含了 [Superpowers](https://github.com/obra/superpowers) 插件的完整技能库，已集成到项目中供团队成员使用。

## 技能列表

| 技能名称 | 描述 | 使用场景 |
|---------|------|---------|
| **brainstorming** | 需求探索和设计 | 在实现任何功能前，进行需求澄清和设计讨论 |
| **test-driven-development** | 测试驱动开发 | 编写测试后再写实现代码 (RED-GREEN-REFACTOR) |
| **systematic-debugging** | 系统化调试 | 遇到 bug 或测试失败时，按流程找根因再修复 |
| **writing-plans** | 编写实现计划 | 将设计拆解成详细的实现步骤 |
| **executing-plans** | 执行实现计划 | 批量执行计划任务并定期检查进度 |
| **verification-before-completion** | 完成前验证 | 声明工作完成前，运行验证命令确认一切正常 |
| **requesting-code-review** | 请求代码审查 | 完成任务后进行自我审查 |
| **receiving-code-review** | 接收代码审查 | 收到审查反馈后的处理流程 |
| **using-git-worktrees** | 使用 git worktrees | 创建隔离的工作分支环境 |
| **finishing-a-development-branch** | 完成开发分支 | 决定如何处理完成的开发分支 |
| **subagent-driven-development** | 子代理驱动开发 | 分派子代理并行执行任务 |
| **dispatching-parallel-agents** | 分派并行代理 | 同时处理多个独立任务 |
| **writing-skills** | 编写新技能 | 创建自定义技能的最佳实践 |
| **using-superpowers** | 使用 superpowers | 技能系统介绍和使用指南 |

## 如何使用

这些技能会**自动触发**。当你在 Claude Code 中提出相关请求时，AI 会自动调用相应的技能。

例如：
- "帮我设计一个新功能" → 自动触发 **brainstorming**
- "修复这个 bug" → 自动触发 **systematic-debugging**
- "实现这个功能" → 自动触发 **test-driven-development**

## 技能来源

- **版本**: 5.0.6
- **来源**: https://github.com/obra/superpowers
- **更新日期**: 2026-04-03

## 更新技能

要获取最新版本的技能，执行以下命令：

```bash
# 更新全局插件
/plugin update superpowers@claude-plugins-official

# 然后重新复制到项目
cp -r ~/.claude/plugins/cache/claude-plugins-official/superpowers/*/skills/* \
      /home/ccnuacm/work/web-learn/.claude/skills/
```

## 项目级技能说明

项目中的 `.claude/skills/` 目录会覆盖全局安装的插件。这意味着：

- ✅ 团队成员无需手动安装插件
- ✅ 所有技能自动随项目分发
- ✅ 技能版本在团队中保持一致
- ⚠️ 需要手动更新以获取最新版本

## 更多信息

- [Superpowers GitHub 仓库](https://github.com/obra/superpowers)
- [官方文档](https://claude.com/plugins/superpowers)
- [Discord 社区](https://discord.gg/Jd8Vphy9jq)