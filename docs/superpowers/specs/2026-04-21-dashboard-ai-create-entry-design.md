# Dashboard AI Create Entry Design

## Goal

Replace the logged-in dashboard's three action cards and recent activity block with a focused AI-style search input. Submitting a prompt creates a website topic immediately and opens the editor with the building agent already working from that prompt.

## Current State

`frontend/src/pages/DashboardPage.tsx` currently shows:

- A welcome card.
- Three cards: create topic, topic list, account settings.
- A recent activity empty state.
- A settings modal controlled locally in the dashboard.

Topic creation currently happens on `frontend/src/pages/TopicCreatePage.tsx`: the user fills title and description, `topicApi.create()` creates a `website` topic, and the app navigates to `/topics/:id/edit`.

Inside the editor, `frontend/src/pages/WebsiteEditorPage.tsx` renders `AgentChatContent` with `agentType="building"`. `AgentChatContent` starts the building agent only when the user manually sends a message.

## Approved UX

The dashboard becomes a minimal first screen inspired by the simple glass search input style of `https://meoo.com/`, adapted to Web Learn rather than copied.

The page should:

- Remove the three cards and the recent activity block.
- Use a centered, search-style input instead of a tall textarea.
- Keep the visual treatment light: white/blue background, translucent glass input surface, soft shadow, restrained copy.
- Avoid extra explanatory text below the input.
- Keep only essential copy, such as `想做什么学习专题？` and `描述你想制作的专题...`.
- Keep navigation to topic list and settings outside the main action area, such as existing top navigation or future shell navigation.

## Creation Behavior

When the user submits a non-empty prompt:

1. Normalize the prompt by trimming leading/trailing whitespace and collapsing internal whitespace.
2. Generate the topic title from the first 30 characters of the normalized prompt.
3. If the prompt is longer than 30 characters, append `...` to the title.
4. Create a topic through `topicApi.create({ title, description: prompt, type: 'website' })`.
5. Navigate to `/topics/:id/edit` with router state containing the original prompt.
6. On the editor page, read that router state and pass it into the building agent panel.
7. Once the editor has loaded the topic and hydrated the conversation, automatically send the prompt to the building agent once.
8. Clear the router state after consuming it so reloads or back/forward navigation do not re-run the initial prompt.

The full prompt remains available as the topic description. The title is only a short list-friendly label.

## Component Boundaries

`DashboardPage` owns the first-screen create experience:

- Input state.
- Loading and error states.
- Prompt-to-title helper.
- Topic creation request.
- Navigation into the editor with initial prompt state.

`WebsiteEditorPage` owns route-state bridging:

- Reads `location.state.initialBuildPrompt`.
- Passes it to `AgentChatContent`.
- Replaces the current history entry with cleared state after consumption.

`AgentChatContent` owns automatic initial agent execution:

- Adds optional `initialPrompt` and `onInitialPromptConsumed` props.
- Hydrates the persisted conversation as it already does.
- Starts `runAgentLoop(initialPrompt, model)` exactly once for that mounted topic/agent session.
- Respects the existing `runState.isRunning` guard and does not double-submit while a run is active.

## Error Handling

Dashboard topic creation failure should show an inline message near the input using `getApiErrorMessage(err, '创建专题失败')`. The input remains available so the user can retry without losing the prompt.

Submitting an empty or whitespace-only prompt does nothing. While a topic is being created, the submit button is disabled and the input can remain readable.

If automatic agent startup fails after the editor opens, the existing `AgentChatContent` run-state error display handles it.

## Accessibility And Responsiveness

The search input must be a real form control with:

- A visible or screen-reader label.
- Enter-to-submit behavior.
- A disabled submit button when empty or creating.
- No text overflow inside the input or button on mobile.

The first screen should fit comfortably on desktop and mobile. The input should stay search-bar height, not become a tall composer.

## Testing

Frontend tests should cover:

- Dashboard no longer renders the old quick-action cards or recent activity block.
- Dashboard renders the AI create form.
- Empty prompt does not call `topicApi.create`.
- Submitting a prompt calls `topicApi.create` with generated title, full description, and `type: 'website'`.
- Successful creation navigates to `/topics/:id/edit` with `initialBuildPrompt` in route state.
- Creation failures show an inline error.
- `AgentChatContent` auto-runs a provided `initialPrompt` once after hydration and calls the consume callback.

Existing editor tests should remain green.

## Out Of Scope

- Replacing the existing `/topics/create` route.
- Removing top-navigation entries.
- Adding prompt templates, tools, modes, file upload, or skills controls.
- Changing backend topic APIs.
- Persisting the initial prompt outside the existing topic description and agent conversation.

## Self-Review

- No placeholders remain.
- The scope is one frontend flow and does not require backend changes.
- The title rule is explicit: normalized first 30 characters plus `...` when truncated.
- The automatic agent startup is single-use and tied to router state consumption to avoid repeated runs.
