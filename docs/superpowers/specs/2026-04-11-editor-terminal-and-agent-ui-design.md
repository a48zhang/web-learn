# 编辑器 UI 增强：终端面板与 Agent 面板修复

> 创建时间：2026-04-11
> 目标：修复 Agent 面板空框问题，新增交互式终端面板，为 Agent 提供 run_command 工具。

---

## 1. 问题诊断

### 1.1 Agent 面板空框

`WebsiteEditorPage.tsx` 中 Agent 面板嵌入的是 `AIChatSidebar` 组件。该组件使用 `fixed top-0 right-0` 绝对定位，自身渲染为一个浮动覆盖层。当它被嵌入 `EditorPanelGroup` 的面板内容时，聊天 UI 脱离了面板容器，导致面板内没有任何内容 — 表现为空框。

### 1.2 终端缺失

当前 WebContainer 的 npm install/dev 输出仅通过 `console.log` 打印到浏览器控制台，没有用户可见的终端界面。`run_command` 工具也未实现，Agent 无法执行命令行操作。

---

## 2. 最终布局

```
┌────────────────────────────────────────────────────────────────┐
│ TopBar                                                          │
├──────────────┬─────────────────────┬───────────────────────────┤
│ FileTree     │ Agent Chat (实心)   │ Preview                   │
│ (18%)        │ (25%)               │ (57%)                     │
│              │                     │                           │
│ [文件树]     │ [消息列表]          │ [iframe 预览]             │
│              │ [输入框]            │                           │
├──────────────┴─────────────────────┴───────────────────────────┤
│ >_ Terminal                                          [−] [✕]   │  ← 拖拽调整高度
├────────────────────────────────────────────────────────────────┤
│ $ npm run dev                                                   │
│ > vite@5.0.0  ready in 243ms                                    │  ← xterm.js
│ > █                                                             │
└────────────────────────────────────────────────────────────────┘

默认状态 Terminal 隐藏。底部右侧有 Terminal 切换按钮，点击展开/收起。
```

---

## 3. 组件架构

```
WebsiteEditorPage.tsx
├── TopBar (不变)
├── EditorPanelGroup
│   ├── FileTree / CodeEditor (不变)
│   ├── AgentChatContent (新建 — 替代 AIChatSidebar)
│   └── PreviewPanel (不变)
├── TerminalToggle (新建 — 底部切换按钮)
└── TerminalPanel (新建 — VSCode 风格底部覆盖层)
```

### 3.1 现有组件变更

| 组件 | 变更 |
|------|------|
| `AIChatSidebar.tsx` | 内部使用 `AgentChatContent` 渲染聊天内容，自身仅负责 toggle 和浮动面板逻辑 |
| `WebsiteEditorPage.tsx` | Agent 面板内容从 `AIChatSidebar` 改为 `AgentChatContent`，新增 Terminal 相关组件 |

---

## 4. 新组件详细设计

### 4.1 `AgentChatContent.tsx`

从 `AIChatSidebar` 提取的纯聊天内容组件。

**Props:**
```typescript
interface AgentChatContentProps {
  topicId: string;
}
```

**职责:**
- 消息列表渲染（用户 + 助手）
- 输入框 + 发送按钮
- 工具执行状态展示（摘要级）
- 清空聊天
- 聊天历史 localStorage 持久化

**不包含:**
- 浮动按钮 / toggle 状态
- fixed 定位 / 覆盖层
- 侧边栏 header

**布局:** 使用 `flex flex-col` 直接填充父容器，`flex-1` 占满可用空间。

**实现要点:** 将 `AIChatSidebar` 中第 110-195 行的内容提取为独立组件，保留所有消息渲染、输入处理、localStorage 逻辑。

---

### 4.2 `TerminalPanel.tsx`

VSCode 风格底部终端覆盖层。

**交互行为:**
- 默认隐藏（`display: none`）
- 通过 `TerminalToggle` 切换显示/隐藏
- 顶部有 header 栏：`>_ Terminal` + 最小化/关闭按钮
- 支持拖拽 header 调整终端高度（最小 150px，最大 50vh）
- 拖拽使用原生 `mousedown` + `mousemove` + `mouseup` 事件，不引入新依赖
- 拖拽时实时调整 xterm 容器高度，并调用 `fitAddon.fit()`
- 关闭面板时保存当前高度到 localStorage，下次打开恢复

**布局:**
```tsx
// 固定在编辑器底部，通过 CSS transform 控制显示
<div className="fixed bottom-0 left-0 right-0 z-30 bg-zinc-900 border-t border-zinc-700">
  <div className="flex items-center justify-between px-3 py-1 bg-zinc-800 border-b border-zinc-700 cursor-row-resize">
    <span className="text-zinc-400 text-xs">>_ Terminal</span>
    <div>
      <button onClick={onMinimize}>−</button>
      <button onClick={onClose}>✕</button>
    </div>
  </div>
  <div ref={terminalRef} className="h-full p-2" />  {/* xterm container */}
</div>
```

**WebContainer 连接:**
- 面板首次打开时通过 `useWebContainer` 获取实例
- 调用 `spawn('bash')` 或 `spawn('sh')` 启动交互式 shell
- `term.onData(data => process.input.write(data))` 处理用户输入
- `process.output.pipeTo(new WritableStream({ write: data => term.write(data) }))` 处理输出
- 关闭面板时终止 shell 进程

**技术栈:**
- `xterm` - 终端核心渲染
- `xterm-addon-fit` - 自适应容器尺寸
- `xterm-addon-web-links` - URL 识别与点击

---

### 4.3 `TerminalToggle.tsx`

底部右侧切换按钮。

**样式:**
- 固定在编辑器底部右侧（`fixed bottom-3 right-20 z-40`）
- 类似 VSCode 的底部状态栏按钮
- 显示终端状态：运行中（绿色圆点）/ 已关闭（灰色）
- 点击切换终端显示/隐藏

---

### 4.4 `useTerminal.ts`

封装 Terminal 生命周期的 React hook。

```typescript
interface UseTerminalOptions {
  enabled: boolean;       // 是否显示面板
  containerRef: RefObject<HTMLDivElement>;
}

interface TerminalHandle {
  open: () => void;
  close: () => void;
  resize: () => void;
  isOpen: boolean;
  isRunning: boolean;
}

function useTerminal(options: UseTerminalOptions): TerminalHandle;
```

**职责:**
- 管理 xterm 实例的创建和销毁
- 启动/终止 WebContainer shell 进程
- 处理 resize（容器尺寸变化时调用 `fitAddon.fit()`）
- 管理进程引用，支持外部（如 Agent）复用同一 shell

**进程管理策略:**
- 每个终端会话对应一个 shell 进程
- 关闭面板时 `process.kill()` 终止进程
- 重新打开面板时启动新 shell（状态不保留）
- 如果 WebContainer 尚未就绪（`!isReady`），终端显示等待提示

---

### 4.5 `run_command` Agent Tool

新增 Agent 工具，允许 Agent 在终端中执行命令。

**Tool 定义:**
```typescript
{
  name: 'run_command',
  description: 'Execute a shell command in the project terminal',
  parameters: {
    command: string,   // 完整命令字符串，如 'npm install lodash'
    timeout?: number,  // 超时毫秒数，默认 30000
  }
}
```

**执行流程:**
1. Agent 调用 `run_command({ command: 'npm install lodash' })`
2. Tool 解析命令为 `cmd` + `args`
3. 通过 WebContainer `spawn(cmd, args)` 执行
4. 输出通过 `WritableStream` 收集
5. 命令执行完成或超时后返回结果
6. 输出同时写入 Terminal 面板（如果终端已打开）

**安全性约束:**
- 白名单模式：仅允许安全命令（npm, node, npx, ls, cat, mkdir, rm, echo）
- 超时保护：默认 30 秒超时，防止长时间运行的命令阻塞
- 单次执行：不支持交互式对话（stdin 为空），仅执行并捕获 stdout/stderr

---

## 5. 数据流

### 5.1 用户交互终端

```
TerminalToggle click
  → setTerminalOpen(true)
  → TerminalPanel 渲染
  → useTerminal.open()
    → new Terminal() + fitAddon
    → webcontainer.spawn('sh')
    → 连接 onData ↔ process.input
    → 连接 process.output ↔ term.write()
```

### 5.2 Agent run_command

```
Agent 输出 tool_call: run_command({ command: 'npm install' })
  → runCommand tool 执行
  → webcontainer.spawn('npm', ['install'])
  → 输出收集到 buffer
  → 同时 term.write(buffer) 到 Terminal 面板
  → 进程 exit 或 timeout
  → 返回 { stdout, stderr, exitCode } 给 Agent
```

---

## 6. 新增依赖

| 包 | 版本 | 用途 |
|----|------|------|
| `xterm` | `^5.3.0` | 终端核心渲染 |
| `xterm-addon-fit` | `^0.8.0` | 自适应容器尺寸 |
| `xterm-addon-web-links` | `^0.9.0` | URL 点击支持 |

---

## 7. 影响文件清单

### 新建文件

| 文件 | 说明 |
|------|------|
| `frontend/src/components/AgentChatContent.tsx` | 纯聊天内容组件 |
| `frontend/src/components/TerminalPanel.tsx` | 终端面板组件 |
| `frontend/src/components/TerminalToggle.tsx` | 终端切换按钮 |
| `frontend/src/hooks/useTerminal.ts` | Terminal 生命周期 hook |
| `frontend/src/agent/tools/runCommand.ts` | run_command 工具实现 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `frontend/src/components/AIChatSidebar.tsx` | 内部使用 `AgentChatContent`，移除重复的聊天逻辑 |
| `frontend/src/pages/WebsiteEditorPage.tsx` | Agent 面板使用 `AgentChatContent`，新增 Terminal 相关组件 |
| `frontend/src/agent/toolRegistry.ts` | 注册 `run_command` 工具 |
| `frontend/package.json` | 新增 xterm 依赖 |

---

## 8. 错误处理

### 8.1 WebContainer 不可用

- 终端面板显示："WebContainer 未初始化，请等待项目加载完成"
- 禁止输入命令
- `run_command` tool 返回错误："Terminal not available"

### 8.2 命令执行失败

- 终端正常显示 stderr 输出
- `run_command` 返回 `{ stdout, stderr, exitCode }` 给 Agent
- Agent 自行判断是否需要重试或报错

### 8.3 终端崩溃

- xterm 异常时自动重建实例
- 显示 "Terminal 已重置" 提示
- 保留最近的输出缓冲区（最后 1000 行）

### 8.4 命令超时

- 超过 timeout 时 `process.kill()` 终止进程
- 终端显示 "[Command timed out after ${timeout}ms]"
- `run_command` 返回超时错误给 Agent

---

## 9. 测试策略

### 9.1 组件测试

- `AgentChatContent`：消息渲染、输入发送、localStorage 持久化
- `TerminalPanel`：打开/关闭、resize、header 交互

### 9.2 集成测试

- `useTerminal`：WebContainer spawn 连接、输入输出回显
- `run_command`：命令执行、输出收集、超时处理

### 9.3 端到端测试

- 打开终端 → 输入命令 → 验证输出
- Agent 调用 run_command → 验证 Terminal 显示 → 验证 Agent 收到结果
- Terminal resize → xterm 自适应

---

## 10. 实现优先级

| 优先级 | 内容 | 理由 |
|--------|------|------|
| **P0** | `AgentChatContent.tsx` + 面板修复 | 解决空框问题 |
| **P0** | `TerminalPanel.tsx` + `useTerminal.ts` + xterm 依赖 | 核心终端能力 |
| **P1** | `run_command` tool + toolRegistry 注册 | Agent 命令行能力 |
| **P2** | Terminal resize 拖拽 | 用户体验 |
| **P3** | xterm-addon-web-links | URL 点击增强 |
