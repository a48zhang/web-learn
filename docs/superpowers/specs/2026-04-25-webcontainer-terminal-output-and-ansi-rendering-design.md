# Design: WebContainer Terminal Output And ANSI Result Rendering

> 创建时间：2026-04-25
> 目标：把 WebContainer 命令输出导入编辑器终端，并让 agent 对话中的 bash/npm ANSI 输出可读。

---

## 1. 问题诊断

当前 WebContainer 输出有两条割裂路径：

- `useWebContainer` 中 `npm install` 和 `npm run dev` 的输出直接 `console.log` 到 F12 控制台。
- `run_command` 收集 WebContainer process output 后作为 tool result 返回给 agent 对话。
- `TerminalPanel` 只显示用户打开终端后启动的交互式 `bash` 输出。

结果：

1. 用户看不到 install/dev 的实时输出，只能打开浏览器控制台排查。
2. agent 执行命令时，输出不会实时进入前端终端。
3. 对话中的 tool result 会直接显示 ANSI 控制序列，例如 `␛[1G␛[0K␛[1mnpm␛[22m ...`，阅读体验差。

---

## 2. 目标

- WebContainer install/dev/run_command 输出进入前端 `TerminalPanel`。
- F12 控制台不再承载主要命令输出；只保留必要错误日志。
- 终端未打开时缓存最近输出，打开后回放。
- agent 对话里的 tool result 渲染为可读终端 transcript。
- 支持常见 ANSI SGR 样式：粗体、前景色、重置。
- 清理光标控制/清行类序列：例如 `ESC[1G`、`ESC[0K`。
- 同时支持真实 ESC 字符 `\x1b` 和可见符号 `␛`。

---

## 3. 非目标

- 不实现完整终端模拟器。完整 ANSI 终端语义继续由 xterm 承担。
- 不改变 agent tool 可用范围。
- 不改变 `run_command` 的命令白名单。
- 不改变 `MAX_TOOL_LOOPS = 1000`。
- 不改变 WebContainer boot/install/dev 生命周期。
- 不把终端输出持久化到后端。

---

## 4. 架构

### 4.1 输出分层

```
WebContainer process output
  ├─ raw stream → Terminal output bus → xterm TerminalPanel
  └─ collected text → agent tool result → ANSI transcript renderer
```

同一份输出有两个展示形态：

- **TerminalPanel:** 原始输出交给 xterm，尽量保留真实终端效果。
- **AgentChatContent:** 渲染为轻量 transcript，移除控制字符，保留可读颜色/粗体。

### 4.2 Terminal output bus

`useTerminalStore` 增加终端输出 bus：

```typescript
interface TerminalSink {
  write(data: string): void;
}

appendOutput(data: string): void;
registerSink(sink: TerminalSink): () => void;
clearOutputBuffer(): void;
```

行为：

- 输出 bus 维护一个 bounded buffer，例如最近 64KB。
- 如果终端已打开，立即写入 xterm。
- 如果终端未打开，只写入 buffer。
- TerminalPanel 打开时注册 sink，并回放 buffer。
- TerminalPanel 关闭时 unregister sink，但不清空 buffer。

### 4.3 输出来源

以下输出应写入 terminal output bus：

- `setupNpmRegistry` 的 npm config 输出。
- `npm install` 输出。
- `npm run dev` 输出。
- `run_command` 输出。

建议加轻量前缀：

```text
[install] ...
[dev] ...
[agent] $ npm test
...
```

前缀写入终端即可，不必进入 tool result。tool result 保持命令真实 stdout/stderr 内容，避免影响模型判断。

### 4.4 Agent result ANSI rendering

新增纯 UI 工具：

```typescript
renderTerminalTranscript(raw: string): TerminalSegment[]
TerminalOutput({ value, state })
```

支持：

- ESC 字符：`\x1b[31m`
- 可见 ESC 符号：`␛[31m`
- SGR:
  - `0` reset
  - `1` bold
  - `22` normal intensity
  - `30-37`, `90-97` foreground colors
  - `39` default foreground
- 清理非文本控制：
  - `ESC[1G`
  - `ESC[0K`
  - 其他 CSI 光标/清屏序列可直接丢弃

不支持完整行编辑状态机。对 `\r` 的处理采用 transcript 策略：

- `\r\n` 保持为换行。
- 单独 `\r` 视为当前进度行覆盖，可转为 `\n` 或丢弃前一个未完成进度片段。第一版优先简单可读：归一为 `\n` 后折叠多余空行。

---

## 5. 详细设计

### 5.1 Terminal store

扩展 `frontend/src/stores/useTerminalStore.ts`：

- `outputBuffer: string`
- `appendOutput(data: string): void`
- `registerSink(sink: (data: string) => void): () => void`
- `clearOutputBuffer(): void`

实现约束：

- buffer 限制 64KB 或 128KB。
- 多个 sink 同时存在时都收到输出。
- `appendOutput` 接受空字符串时 no-op。

### 5.2 Terminal hook

修改 `useTerminal`：

- 打开 xterm 后注册 sink。
- 注册时先回放 `outputBuffer`。
- WebContainer 交互式 `bash` 的输出也可以继续直接写 xterm。
- 如果希望 bash 输出也进入 buffer，可作为后续优化；第一版不强求。

注意：

- 避免每次 React render 重复注册 sink。
- close 时必须 unregister。
- dispose terminal 前先清理 sink。

### 5.3 WebContainer output routing

修改 `useWebContainer`：

- 将 install/dev `process.output.pipeTo` 的 write 从 `console.log` 改为 `appendOutput`。
- 可保留 `console.warn/error` 用于异常对象，而不是每条命令输出。
- install/dev 输出加前缀或起始 header，例如：

```text

[npm install]
...

[npm run dev]
...
```

### 5.4 run_command output routing

修改 `wcSpawnCommand` 或 `runCommand` tool：

- 命令开始时写入：

```text

[agent] $ <command args...>
```

- process output 每 chunk 写 terminal bus。
- 同时继续收集 output 作为 tool result。
- timeout/exit code 也写入 terminal bus。

保持：

- tool result 仍返回给 LLM。
- 命令白名单不变。
- cwd 行为按现有实现或 filestore hardening 计划另行处理。

### 5.5 ANSI transcript renderer

新增：

- `frontend/src/utils/ansiTranscript.ts`
- `frontend/src/utils/ansiTranscript.test.ts`
- `frontend/src/components/ui/TerminalOutput.tsx`

`ansiTranscript.ts` 输出结构：

```typescript
interface TerminalSegment {
  text: string;
  bold?: boolean;
  color?: 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'gray' | 'default';
}
```

`TerminalOutput.tsx`：

- 使用 `<pre>` 保持空白和换行。
- 对 segment 应用 className。
- 对长内容使用 `max-h` + scroll。
- 保持当前 tool result 的 dark panel 样式。

### 5.6 AgentChatContent integration

替换 tool result 渲染：

```tsx
<TerminalOutput value={tool.result} state={tool.state} />
```

参数 JSON 仍保持普通 `<pre>`。

---

## 6. 测试策略

### Unit tests

- `useTerminalStore`:
  - append 输出进入 buffer。
  - buffer 超限截断旧内容。
  - registered sink 收到新输出。
  - unregister 后不再收到输出。

- `ansiTranscript`:
  - strips `␛[1G␛[0K`。
  - strips `\x1b[1G\x1b[0K`。
  - renders `\x1b[31merror\x1b[39m` as red segment.
  - handles bold `\x1b[1mnpm\x1b[22m`。
  - preserves plain text.

- `TerminalOutput`:
  - renders cleaned text, not raw escape glyphs.
  - applies error-state styling.

### Integration-style tests

- `useWebContainer` install/dev output calls terminal store append.
- `run_command` output calls terminal store append and still returns result content.
- AgentChatContent renders command output without visible `␛[...` sequences.

---

## 7. Rollout

1. Add output bus and terminal sink registration.
2. Route install/dev/run_command output to bus.
3. Add ANSI transcript parser and component.
4. Replace AgentChatContent tool result rendering.
5. Run focused frontend tests and typecheck.

---

## 8. Risks

- Terminal output can interleave with interactive bash output. This is acceptable for first version and mirrors shared terminal streams.
- A lightweight ANSI parser may not perfectly render progress bars. First version prioritizes readable logs over exact terminal emulation.
- Buffer replay can duplicate output if sink registration is not cleaned up correctly. Tests should cover register/unregister behavior.
