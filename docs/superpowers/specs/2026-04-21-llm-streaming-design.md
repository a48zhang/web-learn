# LLM Streaming Design

## Goal

Make LLM chat requests truly stream from the external OpenAI-compatible provider through `ai-service`, the gateway, the browser API client, and the Agent UI. The fix should prevent long generations from failing because no complete JSON response arrives before gateway/proxy timeouts, while preserving the current non-streaming JSON path for compatibility.

## Current Root Cause

The current chain is blocking:

`Agent UI -> frontend llmApi -> gateway -> ai-service -> external LLM`

Observed code path:

- `services/ai/src/services/aiService.ts` builds `ChatCompletionCreateParamsNonStreaming` with `stream: false`.
- `services/ai/src/controllers/aiController.ts` waits for `chatWithLLM(...)` to finish, then sends one `res.json(completion)`.
- `services/gateway/src/proxyManager.ts` sets `proxyTimeout: 30000` for proxied service calls.
- `frontend/src/services/llmApi.ts` has an `onStream` argument, but current callers pass `undefined`; even if a caller passed it, the helper does not consume stream chunks.
- `frontend/src/agent/useAgentRuntime.ts` updates visible assistant output only after a complete response arrives.

That means long LLM generations can sit silent for more than 30 seconds. The gateway can time out before the app receives any response bytes.

## Architectural Decisions

- **Project structure:** Keep the existing layer-first service structure for this change. This is a targeted cross-boundary fix inside existing files, not a service restructure.
- **API style:** Keep OpenAI-compatible `/api/ai/chat/completions`; add real `stream: true` behavior to the same endpoint.
- **Streaming method:** Use Server-Sent Events in OpenAI chat-completions format: `data: <json>\n\n` chunks and terminal `data: [DONE]\n\n`.
- **Frontend API client:** Keep the existing `chatWithTools(...)` surface, but make the `onStream` path truly consume streamed chunks and assemble a final `ChatCompletion` for existing Agent loop compatibility.
- **Agent execution model:** Stream assistant text into the UI in real time, but execute tool calls only after each LLM response message is fully assembled. This keeps the current tool loop, persistence, and OSS save logic stable.
- **Auth:** Keep existing JWT/internal auth behavior. Streaming requests use the same endpoint and headers as non-streaming requests.
- **Error handling:** Preserve JSON errors before streaming starts; after streaming starts, emit an SSE error chunk/event and close the stream.

## Backend Design

### `ai-service`

`chatWithLLM` should support both modes:

- `stream: false` or omitted: return the same `OpenAI.Chat.Completions.ChatCompletion` object as today.
- `stream: true`: return the provider's stream object without buffering it into a full completion.

The controller should branch on `req.body.stream === true`.

For non-streaming:

- Validate request exactly as today.
- Call the non-streaming service path.
- Return `res.json(completion)`.

For streaming:

- Validate request exactly as today.
- Set streaming headers:
  - `Content-Type: text/event-stream; charset=utf-8`
  - `Cache-Control: no-cache, no-transform`
  - `Connection: keep-alive`
  - `X-Accel-Buffering: no`
- Flush headers when supported.
- Iterate provider chunks with `for await`.
- Write each chunk as OpenAI-style SSE:
  - `res.write(\`data: ${JSON.stringify(chunk)}\n\n\`)`
- On normal completion, write `data: [DONE]\n\n` and end.
- If the client disconnects, abort the upstream provider request if the OpenAI SDK/API supports an abort signal.
- If the provider throws before headers are sent, return JSON 500.
- If the provider throws after headers are sent, write an SSE error payload and then `data: [DONE]\n\n`.

Request validation should also validate `stream` when present:

- `stream` may be `true`, `false`, or omitted.
- Any other type returns 400.

### Gateway

The gateway proxy must not kill legitimate LLM streaming calls after 30 seconds.

For `/api/ai` route targets:

- Increase or disable `proxyTimeout` for AI requests. The preferred behavior is no proxy timeout for active streaming responses, while still allowing the app/service to enforce its own limits.
- Avoid response buffering. The proxy should forward chunked transfer as chunks arrive.
- Keep `changeOrigin` and user context header forwarding unchanged.

This can be implemented with route-aware proxy options:

- Default service proxies can keep existing timeout behavior.
- AI route proxies use an AI-specific timeout such as `0` or a much larger configured value.

## Frontend Design

### `llmApi`

`chatWithTools` should become genuinely dual-mode:

- Without `onStream`: current behavior, `stream: false`, return full `ChatCompletion`.
- With `onStream`: send `stream: true`, consume the SDK stream, call `onStream` for useful text deltas, and assemble a final `ChatCompletion`.

The stream assembler must handle:

- `delta.content` string chunks.
- `delta.tool_calls`, including partial function arguments split across chunks.
- `finish_reason`.
- Missing or empty chunk fields safely.

The assembled result should match the shape used by `useAgentRuntime`:

```ts
{
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: assembledContent || null,
        tool_calls: assembledToolCalls,
      },
      finish_reason,
    },
  ],
}
```

If there are no tool calls, `tool_calls` may be omitted or an empty array, matching existing OpenAI SDK behavior used in the app.

### Agent Runtime

`useAgentRuntime` should pass an `onStream` callback when calling `chatWithTools`.

Streaming UI behavior:

- When the first assistant content delta arrives, create or update an assistant visible message.
- Append subsequent content deltas to that same assistant message.
- Tool call chunks should not render as incomplete tool cards.
- Once the full streamed message is assembled, existing tool handling continues:
  - If there are tool calls, render tool cards and execute tools as today.
  - If there are no tool calls, finish the current LLM loop as today.

Important stability rules:

- Conversation persistence still happens after the agent loop completes.
- BuildAgent OSS save still happens after successful file mutation tools.
- Existing context compression behavior remains before LLM request start.
- Errors during streaming should set `runState.error` and leave any already streamed assistant content visible.

## Compatibility

The existing non-streaming path must remain compatible with:

- Tests and integrations that POST without `stream`.
- Existing OpenAI-compatible request shape for `messages`, `tools`, `tool_choice`, and `model`.
- Existing auth behavior and rate limits.
- Existing agent tests that mock `chatWithTools` with full completions.

The new streaming path should be opt-in from the request body and frontend call path. This avoids breaking consumers that expect a JSON completion response.

## Timeout Behavior

Streaming fixes the user-facing timeout issue because the browser receives response bytes as soon as the provider emits chunks. However, streaming is not a substitute for all timeout policy.

Expected behavior:

- Gateway should not terminate active AI streaming requests at 30 seconds.
- If the provider stalls before emitting any bytes, the request may still need an explicit upstream timeout policy in a future hardening task.
- If the browser disconnects, backend should stop forwarding and release upstream resources.

## Testing

### `ai-service`

Add tests for:

- Non-streaming requests still return JSON completions.
- `stream: true` sets `text/event-stream`.
- Streaming endpoint forwards multiple provider chunks as `data: <json>\n\n`.
- Streaming endpoint ends with `data: [DONE]\n\n`.
- Invalid `stream` type returns 400.
- Provider error before headers returns JSON 500.
- Provider error after streaming starts sends an SSE error payload and closes.

### Gateway

Add tests for:

- AI route proxies use streaming-friendly timeout options.
- Non-AI route proxies keep default timeout behavior.
- User context headers are still forwarded.

### Frontend API Client

Add tests for:

- Non-streaming `chatWithTools` still returns full completion.
- Streaming text chunks call `onStream` incrementally and return an assembled completion.
- Streaming tool call chunks assemble function name and partial arguments correctly.
- Stream errors reject with a useful error.

### Agent Runtime

Add tests for:

- Agent runtime passes `onStream` to `chatWithTools`.
- Text chunks update the visible assistant message before the final completion returns.
- Tool calls still execute only after the full streamed message is assembled.
- Final conversation persistence remains after the loop completes.

## Out Of Scope

- Switching from SSE to WebSocket.
- Streaming tool execution progress from backend; tool execution remains frontend-side as today.
- Changing model/provider configuration.
- Changing conversation persistence data models.
- Reworking gateway service discovery.
- Adding full browser E2E coverage in this spec. A future E2E can verify the complete user flow once the streaming implementation lands.

## Risks And Mitigations

- **Partial tool call assembly is easy to get wrong.** Mitigate with focused tests for split `tool_calls[n].function.arguments` chunks.
- **Gateway buffering could hide streaming.** Mitigate by testing proxy options and using SSE/no-transform headers from `ai-service`.
- **Duplicate assistant messages during streaming.** Mitigate by keeping one active assistant message per LLM response and updating it in place.
- **Provider SDK stream shape may vary.** Mitigate by handling absent fields defensively and preserving raw chunks in backend SSE rather than transforming provider chunks there.
- **Client disconnects can leak upstream requests.** Mitigate with request close handling and abort signaling where supported.

## Self-Review

- Scope covers the full chain requested: backend provider call, service response, gateway proxying, frontend API client, and Agent UI/runtime.
- Non-streaming compatibility remains explicit.
- The design avoids executing incomplete tool calls.
- Timeout root cause is addressed at both streaming response and gateway proxy layers.
- No backend database or conversation schema changes are required.
