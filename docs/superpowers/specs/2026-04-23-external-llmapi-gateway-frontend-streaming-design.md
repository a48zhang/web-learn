# External LLM API Gateway Frontend Streaming Design

## Goal

让 AI 对话响应从外部 OpenAI-compatible LLM 真正流式传输到浏览器：

`external LLM -> ai-service -> gateway -> frontend llmApi -> agent runtime -> UI`

实现后，用户应当在前端看到逐步增长的 assistant 文本，而不是等待一个被缓冲完成的 JSON 响应。

## Problem Statement

当前链路表面上已经出现了 `stream` 相关接口，但实际上仍然是阻塞式返回：

- `services/ai/src/services/aiService.ts` 固定发送 `stream: false`。
- `services/ai/src/controllers/aiController.ts` 总是等待完整 completion 后 `res.json(...)`。
- `services/gateway/src/proxyManager.ts` 为所有代理统一设置 `proxyTimeout: 30000`。
- `frontend/src/services/llmApi.ts` 在有 `onStream` 时会发送 `stream: true`，但没有消费流。
- `frontend/src/agent/useAgentRuntime.ts` 当前调用 `chatWithTools(...)` 时传入的是 `undefined` stream callback。

结果是：

- 长回复在 30 秒内没有任何下行字节时，gateway 可能先超时。
- 前端只能在完整响应结束后更新 assistant 文本。
- 代码已经出现“半接通”的流式接口，容易让后续实现误判现状。

## Non-Goals

- 不改成 WebSocket。
- 不引入新的消息持久化模型。
- 不在后端流式执行工具调用；工具仍然在前端 assembled 完整 assistant message 后执行。
- 不重构 service discovery、auth 或 provider 配置体系。

## Design Principles

- 保持 OpenAI-compatible `/api/ai/chat/completions` 端点不变。
- `stream: true` 为 opt-in，新老客户端可并存。
- 非流式 JSON 行为必须保持兼容。
- 后端尽量转发 provider 原始 chunk，不在 `ai-service` 里做复杂重组。
- 前端负责把 chunk 组装回现有 runtime 可消费的 `ChatCompletion` 结构。

## End-to-End Design

## `ai-service`

`chatWithLLM(...)` 改成双模式：

- `stream: false | undefined`：返回完整 `ChatCompletion`。
- `stream: true`：返回 provider stream 对象。

controller 根据 `req.body.stream === true` 分支：

非流式分支：

- 保留现有消息校验。
- 调用 non-streaming path。
- 返回 `res.json(completion)`。

流式分支：

- 先校验 `stream` 必须是 `boolean` 或未提供。
- 设置 SSE headers：
  - `Content-Type: text/event-stream; charset=utf-8`
  - `Cache-Control: no-cache, no-transform`
  - `Connection: keep-alive`
  - `X-Accel-Buffering: no`
- 逐个 chunk 转发为 `data: <json>\n\n`
- 正常结束时写入 `data: [DONE]\n\n`
- 浏览器断开时中止上游请求
- 若 headers 已发出后才报错，则输出 SSE error payload 并结束，而不是再切回 JSON

## Gateway

gateway 的核心目标不是“理解 SSE”，而是不要把仍在正常工作的 AI streaming 请求 30 秒杀掉。

设计要求：

- `/api/ai` 相关路由使用 streaming-friendly timeout。
- 非 AI 路由继续维持当前默认超时策略。
- 继续透传用户上下文 headers。
- 不引入额外响应缓冲。

推荐实现方式：

- 将 proxy options 变成 route-aware。
- 对 AI route 使用 `proxyTimeout: 0` 或明显更长的 AI 专用超时值。

## Frontend `llmApi`

`chatWithTools(messages, tools, onStream, model)` 继续沿用当前签名。

行为分成两条路径：

- 无 `onStream`：走非流式请求，返回完整 completion。
- 有 `onStream`：请求 `stream: true`，消费 SDK stream，并组装最终 completion。

前端 stream assembler 需要处理：

- `delta.content`
- `delta.tool_calls`
- 分片到多个 chunk 的 `tool_calls[n].function.arguments`
- `finish_reason`
- 缺失字段和空 chunk

最终返回值需要维持现有 runtime 所依赖的结构：

```ts
{
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: string | null,
        tool_calls?: [...]
      },
      finish_reason: string | null,
    },
  ],
}
```

## Agent Runtime

`frontend/src/agent/useAgentRuntime.ts` 应开始传入真实的 `onStream` callback。

UI 行为要求：

- 第一个文本 chunk 到达时创建一个 assistant 可见消息。
- 后续 chunk 追加到同一条 assistant 消息。
- 工具调用尚未组装完成前，不渲染半成品 tool cards。
- assembled 完整 completion 后，再进入现有 tool loop。

稳定性要求：

- 保持现有持久化时机。
- 保持 BuildAgent 文件变更后的 OSS 保存逻辑。
- 保持错误状态写入 `runState.error`。
- 如果流式中途失败，已渲染的 assistant 部分文本不应被抹掉。

## API Compatibility

必须保持兼容的内容：

- 不带 `stream` 的既有调用方
- `stream: false` 的显式调用
- 现有 `messages` / `tools` / `tool_choice` / `model` 请求结构
- 现有 JWT 鉴权与 gateway 用户上下文透传
- 依赖完整 completion mock 的现有前端测试

## Error Handling

错误处理分两层：

- stream 开始前：仍返回普通 JSON 错误响应
- stream 开始后：输出 SSE error payload，再输出 `[DONE]` 或直接结束连接

这样可以避免 response 已进入 SSE 模式后再混用 JSON。

## Testing Strategy

### `ai-service`

- `stream: true` 返回 `text/event-stream`
- 多 chunk 被转发成多段 `data: ...`
- 正常结束包含 `[DONE]`
- 非布尔 `stream` 返回 400
- 非流式路径继续返回 JSON completion
- streaming 前后两种错误路径都被覆盖

### Gateway

- AI route 拿到特殊 timeout
- 非 AI route 保持默认 timeout
- 用户上下文 header forwarding 不回归

### Frontend `llmApi`

- 非流式调用保持原行为
- 文本 chunk 能持续触发 `onStream`
- tool call 的 name / arguments 可跨 chunk 正确组装
- 流中断或 malformed chunk 会抛出可诊断错误

### Agent Runtime

- `chatWithTools` 收到 `onStream`
- UI 在 completion 返回前已出现 assistant 文本
- tool 只在最终 completion assembled 后执行
- 运行失败时部分文本保留、错误态可见

## Risks

- 最容易出错的是 `tool_calls[].function.arguments` 的拼接。
- 仅改 `ai-service` 不能解决 gateway 30 秒超时问题。
- runtime 若直接 `addVisibleMessage` 多次，容易生成重复 assistant 消息。
- 不同 provider 的 chunk 字段可能略有差异，前端组装逻辑必须防御式处理。

## Rollout Guidance

- 先落 backend SSE，再处理 gateway timeout，再接 frontend assembler，最后接 runtime UI。
- 每一层都保留 non-streaming fallback，避免一次性切断现有调用链。
- 手工联调时优先验证“长响应超过 30 秒仍不断流”和“tool call 仍能在最终消息后执行”。
