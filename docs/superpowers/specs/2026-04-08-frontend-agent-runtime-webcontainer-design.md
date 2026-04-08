# Design: Frontend Agent Runtime with WebContainer Tools

## Problem

The current AI architecture splits agent responsibilities across frontend and backend:
- `AIChatSidebar.tsx` uses backend-driven tool-calling (`POST /api/ai/chat`)
- `AgentChat.tsx` uses frontend JSON parsing (`{ message, files }`) but not real tool-calling
- Backend `services/ai` contains topic/page-specific tools (`read_page`, `new_file`, `write_file`) and business-specific permissions (`learning` vs `building`, teacher-only checks)

This no longer matches the product direction.

The new direction is:
1. **Backend only keeps:** LLM API proxy, user-visible message persistence, and optional future tool endpoint scaffolding.
2. **Frontend implements the agent core:** tool-calling loop, tool execution, and run lifecycle.
3. **Tools are redesigned around WebContainer:** replace topic/page tools with file-system tools such as `list_files`, `read_file`, `write_file`, `create_file`, `delete_file`, and `move_file`.
4. **WebContainer is the source of truth:** frontend editor state becomes a UI projection/cache of WebContainer FS state.
5. **First version stores only user-visible messages:** `user` and `assistant`, not full tool event logs.

## Goals

- Move agent runtime ownership from backend to frontend.
- Simplify backend AI service into a generic LLM proxy plus chat history persistence.
- Replace topic/page tool semantics with WebContainer file tool semantics.
- Keep the current sidebar-style chat UI, but upgrade its internal state model to support agent runs and tool execution status.
- Avoid introducing partial or split ownership of tools across frontend/backend.

## Non-Goals

- No complete `run_command` subsystem in v1.
- No persistence of full tool execution logs in v1.
- No backend topic/page-specific AI business logic in v1.
- No permission model redesign inside the agent runtime; entering the editor implies edit permission.

## Architecture

### 1. Backend Responsibilities

Backend is reduced to three responsibilities only:

#### 1.1 LLM Proxy
A generic LLM endpoint that:
- authenticates the user
- accepts `messages`, `tools`, `tool_choice`, `stream`, and optional `model`
- forwards requests to the upstream OpenAI-compatible provider
- returns the raw chat completion or streaming chunks
- normalizes provider errors

Backend must **not**:
- understand `topic_id`, `building`, `learning`, `teacher`, `student`
- execute tools
- contain editor-specific file operations
- inject topic/page business logic into prompts or tool execution

#### 1.2 Message Persistence
Backend keeps APIs for loading/saving user-visible chat history.

Stored messages:
- `user`
- `assistant`

Not stored:
- tool call requests
- tool results
- streaming partials
- run lifecycle state

#### 1.3 Tool Endpoint Scaffolding
Backend may keep an extension point for future server-side tools, but v1 does not route any editor file tools through backend endpoints.

### 2. Frontend Responsibilities

Frontend owns the full agent runtime.

#### 2.1 Agent Runtime Layer
Add a dedicated runtime layer (e.g. `useAgentRuntime` / `useAgentSession`) that:
- starts an agent run from user input
- assembles current conversation state
- attaches the frontend tool definitions
- calls the backend LLM proxy
- parses `tool_calls`
- executes tools in the browser/WebContainer environment
- appends tool results into the temporary runtime message list
- loops until the model returns a final assistant message
- persists only user-visible messages

This runtime becomes the single place that controls an agent run.

#### 2.2 Tool Registry
Add a frontend tool registry that provides:
- stable tool definitions for the LLM (`name`, `description`, `parameters`)
- execute handlers
- a clean separation between tool protocol and WebContainer internals

The LLM should talk to stable tool names, not to raw WebContainer APIs.

### 3. Tool Design

#### 3.1 First-Version Tool Set
The initial tool set is file-system only:
- `list_files`
- `read_file`
- `write_file`
- `create_file`
- `delete_file`
- `move_file`

These tools are the public protocol exposed to the model.

#### 3.2 Tool Semantics
- `list_files`: return project file tree or a flat filtered path list
- `read_file`: return file content for a single path
- `write_file`: overwrite an existing file
- `create_file`: create a new file with optional initial content
- `delete_file`: remove a file
- `move_file`: rename or move a file path

#### 3.3 Not in v1
Do not implement a full `run_command` subsystem in v1.

Reason:
- long-running processes need lifecycle management
- command concurrency and cancellation need explicit design
- output streaming and truncation need UX and runtime rules
- command permissions/whitelisting need a separate safety model

If desired, a command tool may be scaffolded in code but should not be part of the first production tool set.

### 4. WebContainer as Source of Truth

This is a critical architectural rule.

#### 4.1 Single Source of Truth
WebContainer FS is the canonical source of file state.

Frontend editor store is only:
- a cache
- a UI projection
- an open-tab/selection state holder

It is no longer allowed to have file mutations that only touch Zustand state without updating WebContainer.

#### 4.2 Write Path
All file writes must follow this flow:

```text
Agent runtime / UI action
→ tool execute handler
→ WebContainer FS mutation
→ store refresh/sync
→ UI update
```

#### 4.3 Read Path
All file reads should come from WebContainer, then update the store cache if needed.

#### 4.4 Store Role After Refactor
`useEditorStore` should continue to manage:
- open files
- active file
- preview URL
- UI-level unsaved state if still needed
- cached file tree / cached file contents

But it should not be the canonical filesystem itself.

### 5. Chat UI

The current sidebar interaction model is kept.

#### 5.1 Preserved UX Shape
Keep the current sidebar-style assistant:
- collapsible side panel
- user and assistant messages
- input area at the bottom
- clear conversation action

#### 5.2 Internal Upgrade
Internally, the sidebar becomes an agent session UI instead of a plain chat UI.

The sidebar must display:
- user messages
- final assistant messages
- loading / thinking state
- current tool activity summary
- tool failure summary when a tool call fails

#### 5.3 Tool Visibility Level
In v1, tool execution visibility is **summary-only**.

Show examples like:
- “正在读取文件：src/App.tsx”
- “已写入 2 个文件”
- “工具执行失败：read_file”

Do not show full raw tool payloads or detailed logs in the main sidebar UI.

### 6. Message Model

#### 6.1 Persisted Messages
Persist only user-visible chat messages:
- `user`
- `assistant`

#### 6.2 Runtime-Only Messages / Events
Keep the following in memory only during a session:
- temporary tool call messages
- tool results
- run lifecycle state
- in-flight streaming content
- last tool error

#### 6.3 Session Recovery
Since v1 stores only visible messages, a page refresh restores the visible conversation but not the full tool execution history. This is acceptable for the first version.

### 7. Migration of Existing AI Code

#### 7.1 Backend AI Service
The current backend AI service should be simplified:
- remove backend tool execution loop
- remove topic/page tool definitions (`read_page`, `new_file`, `write_file`, etc.)
- remove `building` / `learning` AI branching
- remove teacher/student-specific AI permission logic
- keep provider config, auth, proxying, and persistence concerns only

#### 7.2 Frontend AI Components
The current frontend AI code should be consolidated:
- `AIChatSidebar.tsx` keeps the UI shell role
- runtime logic moves into a new agent runtime layer
- existing `AgentChat.tsx` ideas can be reused where useful, but the JSON `{ message, files }` protocol is replaced by real frontend tool-calling

#### 7.3 API Layer
Frontend API layer should stop using the old backend `/api/ai/chat` semantic contract.
It should instead call a generic LLM proxy endpoint that supports tool-calling parameters directly.

## Data Flow

### User Sends a Message

```text
Sidebar input
→ runtime starts run
→ runtime reads current visible messages
→ runtime attaches tool definitions
→ call backend LLM proxy
```

### If Model Returns Tool Calls

```text
runtime parses tool_calls
→ execute matching frontend tools
→ collect tool results
→ append runtime-only tool result messages
→ call backend LLM proxy again
```

### When Model Returns Final Assistant Message

```text
append assistant message to visible chat
→ persist user + assistant history
→ clear runtime-only tool state
```

## Error Handling

### Tool Errors
If a frontend tool fails:
- return a structured tool error back into the tool loop
- let the model recover if possible
- show a short user-facing summary in the sidebar

### LLM Errors
If the proxy/provider request fails:
- keep the user message in UI
- show a short assistant-side failure message or inline error state
- do not corrupt chat history persistence

### WebContainer Availability Errors
If WebContainer is unavailable or not initialized:
- block tool execution
- surface a clear summary message in the sidebar
- avoid partial writes to the editor store

## Testing Strategy

### Frontend
Test:
- runtime loop behavior with mocked tool calls
- tool registry execution mapping
- WebContainer adapter synchronization to store
- sidebar state transitions (thinking → tool running → final response)
- persistence of visible messages only

### Backend
Test:
- generic LLM proxy request/response forwarding
- auth behavior
- streaming proxy behavior
- message persistence APIs
- removal of old topic/page AI assumptions

## Final Boundaries

To avoid the previous ambiguity, the final ownership model is:

- **Frontend owns:** agent runtime, tools, tool loop, WebContainer execution, run state
- **Backend owns:** LLM proxying, auth, persistence, optional future extension scaffold
- **WebContainer owns:** real file system state
- **Editor store owns:** UI projection/cache only

This boundary is intentional and should not be blurred in implementation.
