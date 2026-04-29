# External LLM API Gateway Frontend Streaming Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI responses stream end-to-end from the external OpenAI-compatible provider through `ai-service`, `gateway`, and `frontend`, so the user can see incremental assistant output in the UI instead of waiting for one buffered JSON response.

**Spec:** `docs/superpowers/specs/2026-04-23-external-llmapi-gateway-frontend-streaming-design.md`

**Current Status:** The codebase is only partially wired for streaming. `frontend/src/services/llmApi.ts` sends `stream: !!onStream`, but it does not consume streamed chunks; `frontend/src/agent/useAgentRuntime.ts` passes `undefined` as the stream callback; `services/ai/src/services/aiService.ts` forces `stream: false`; `services/ai/src/controllers/aiController.ts` always returns `res.json(...)`; `services/gateway/src/proxyManager.ts` applies `proxyTimeout: 30000` to every proxied route.

**Architecture:** Keep the existing OpenAI-compatible `/api/ai/chat/completions` endpoint and add an opt-in `stream: true` SSE path. Preserve the current non-streaming JSON path for compatibility. The frontend should assemble streamed deltas back into a final `ChatCompletion` object so the current tool-calling loop can remain intact.

**Tech Stack:** Express, `http-proxy-middleware`, OpenAI SDK, SSE, React hooks, Zustand, Jest, Vitest, TypeScript.

---

## File Scope

- Modify `services/ai/src/services/aiService.ts`: support both non-streaming and streaming calls to the external provider.
- Modify `services/ai/src/controllers/aiController.ts`: validate `stream`, branch between JSON and SSE responses, and abort upstream on disconnect.
- Modify `services/ai/tests/ai.test.ts`: add controller coverage for SSE, `[DONE]`, invalid `stream`, and non-stream compatibility.
- Modify `services/gateway/src/proxyManager.ts`: make proxy timeout route-aware so `/api/ai` can stream without the current 30s cutoff.
- Create `services/gateway/tests/proxyManager.test.ts`: cover AI route timeout behavior and existing user-context header forwarding.
- Modify `frontend/src/services/llmApi.ts`: consume streamed chunks, emit text deltas via `onStream`, and assemble a final completion object.
- Create `frontend/src/services/llmApi.test.ts`: cover text streaming, tool-call chunk assembly, and fallback non-stream behavior.
- Modify `frontend/src/agent/useAgentRuntime.ts`: pass an `onStream` callback, update one assistant message incrementally, and keep tool execution after full message assembly.
- Modify `frontend/src/agent/useAgentRuntime.test.ts`: cover incremental UI updates and post-stream tool execution.

## Task 1: `ai-service` Adds Real SSE Streaming

**Files:**
- Modify: `services/ai/src/services/aiService.ts`
- Modify: `services/ai/src/controllers/aiController.ts`
- Modify: `services/ai/tests/ai.test.ts`

- [ ] Add failing tests for `stream: true`, `[DONE]`, invalid non-boolean `stream`, and preserved JSON behavior when `stream` is omitted or `false`.
- [ ] Extend `chatWithLLM(...)` to accept `{ stream?: boolean, signal?: AbortSignal }` and call the OpenAI SDK with either streaming or non-streaming params.
- [ ] In `aiController.chat`, validate `stream` explicitly before calling the service.
- [ ] For `stream: true`, set SSE headers, flush headers if supported, forward each provider chunk as `data: <json>\n\n`, append `data: [DONE]\n\n`, and end the response cleanly.
- [ ] If the browser disconnects, abort the upstream request.
- [ ] If an error occurs before streaming starts, return normal JSON 500; if it occurs after headers are sent, emit an SSE error payload and close the stream.

**Exit Criteria:**
- `POST /api/ai/chat/completions` with `stream: true` returns `text/event-stream`.
- Existing JSON callers still receive a normal `chat.completion` object.

## Task 2: Gateway Becomes Streaming-Friendly

**Files:**
- Modify: `services/gateway/src/proxyManager.ts`
- Create: `services/gateway/tests/proxyManager.test.ts`

- [ ] Add route-aware proxy creation so AI routes can use a streaming-friendly timeout policy while all other routes keep the current default.
- [ ] Keep `changeOrigin`, path rewriting, and forwarded user headers unchanged.
- [ ] Expose or structure proxy creation so timeout configuration can be tested without black-boxing the entire app.
- [ ] Add tests that assert `/api/ai` gets the special timeout and non-AI routes remain on `30000`.

**Exit Criteria:**
- AI streaming requests are not terminated by the current 30-second gateway timeout.
- Existing service proxy behavior does not regress for other routes.

## Task 3: Frontend `llmApi` Actually Consumes Streams

**Files:**
- Modify: `frontend/src/services/llmApi.ts`
- Create: `frontend/src/services/llmApi.test.ts`

- [ ] Keep the current `chatWithTools(messages, tools, onStream, model)` API surface.
- [ ] If `onStream` is absent, continue using the non-streaming request path and return a normal completion.
- [ ] If `onStream` is provided, request `stream: true`, iterate the stream, emit assistant text deltas to `onStream`, and assemble the final `ChatCompletion`.
- [ ] Correctly assemble partial `delta.tool_calls`, especially split function arguments across multiple chunks.
- [ ] Fail loudly on malformed or interrupted streams rather than silently returning an incomplete completion.

**Exit Criteria:**
- `chatWithTools(..., onStream)` yields incremental text and still resolves to a final completion compatible with the existing runtime.

## Task 4: Agent Runtime Streams One Visible Assistant Message

**Files:**
- Modify: `frontend/src/agent/useAgentRuntime.ts`
- Modify: `frontend/src/agent/useAgentRuntime.test.ts`

- [ ] Pass a real stream callback into `chatWithTools(...)` inside the tool loop.
- [ ] When the first assistant text delta arrives, create one assistant message in the visible conversation.
- [ ] Append later deltas to that same message instead of creating duplicates.
- [ ] Do not render partial tool-call UI during chunk assembly.
- [ ] After the final completion is assembled, keep the existing tool execution loop, persistence, and BuildAgent OSS save logic unchanged.
- [ ] Ensure streaming failures set `runState.error` while preserving any already-rendered partial assistant content.

**Exit Criteria:**
- The user sees assistant text appear incrementally during generation.
- Tool calls still execute only after the full assistant message has been reconstructed.

## Recommended Execution Order

- [ ] Land `ai-service` tests and implementation first, because the frontend cannot validate end-to-end streaming until the backend emits real SSE.
- [ ] Update gateway timeout behavior second, because otherwise long generations may still fail in integration even after backend SSE exists.
- [ ] Implement frontend stream assembly third, with focused unit tests for chunk parsing and tool-call assembly.
- [ ] Update agent runtime last, because it depends on the frontend API client returning an assembled completion while streaming UI deltas.

## Verification

- [ ] Run `services/ai/tests/ai.test.ts` and confirm both streaming and non-streaming modes pass.
- [ ] Run gateway proxy tests and verify `/api/ai` timeout policy differs from non-AI routes.
- [ ] Run frontend tests for `llmApi` and `useAgentRuntime`.
- [ ] Perform one manual end-to-end chat in the browser and confirm:
  - assistant text appears incrementally,
  - long generations do not die at 30 seconds,
  - tool calls still render and execute after the streamed response completes.

## Risks

- [ ] Partial `tool_calls[].function.arguments` assembly is the easiest place to introduce subtle bugs; cover it with chunk-level tests before wiring the UI.
- [ ] If gateway proxying buffers or times out, backend SSE alone will not solve the user-visible issue.
- [ ] If runtime message updates are not carefully scoped, streaming can create duplicate assistant messages or overwrite tool-state UI.
