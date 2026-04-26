# React Seed Project Bootstrap Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every new website topic starts from one fixed, minimal React scaffold instead of an empty filesystem, so the building agent always edits an existing runnable project rooted at `/home/project` with `src/` at the top level.

**Current Product Decision:** Do not build a template marketplace, do not add template selection, and do not add an agent tool for applying templates. There is exactly one built-in seed scaffold. The scaffold must not introduce a `frontend/` directory; the project root contains `package.json`, `index.html`, and `src/*` directly.

**Architecture:** Keep the change frontend-only for the first version. `WebsiteEditorPage` already decides how to hydrate editor files from OSS or local recovery and already passes the file map into `useWebContainer.init(initialFiles)`. Add one built-in React seed file map and use it only when a topic has no OSS snapshot and no local recovery snapshot. After seeding, immediately persist the scaffold to OSS so subsequent sessions load the saved project instead of re-seeding. The building agent should be told that the React project already exists and should generally modify existing files instead of recreating the scaffold.

**Tech Stack:** React 18, TypeScript, Vite, existing WebContainer boot/init flow, Zustand editor store, existing topic OSS save flow, Vitest, Testing Library.

---

## File Scope

- Create `frontend/src/templates/reactSeed.ts`: export the fixed root-level seed file map for the minimal React project.
- Modify `frontend/src/pages/WebsiteEditorPage.tsx`: inject the seed only for empty topics, initialize WebContainer from that seed, and persist it once.
- Modify `frontend/src/agent/systemPrompts.ts`: tell the building agent that a base React scaffold already exists and it should usually edit rather than recreate project setup.
- Modify `frontend/src/pages/WebsiteEditorPage.test.tsx`: cover empty-topic seeding, non-empty-topic no-overwrite behavior, and route-state/build-agent compatibility after seeding.
- Optionally modify `frontend/src/stores/useEditorStore.ts` only if a small helper is needed for seed persistence flow; avoid widening scope unless tests force it.

## Seed Scaffold Requirements

- [ ] The seed project root must contain `package.json`, `index.html`, `tsconfig.json`, `vite.config.ts`, and `src/*` directly.
- [ ] The seed must not contain a `frontend/` directory.
- [ ] The seed should stay intentionally minimal: only enough files to boot a React app and give the agent a stable editing surface.
- [ ] Prefer deterministic dependency versions and include a lockfile if it improves WebContainer cold-start stability without adding maintenance noise.
- [ ] `src/App.tsx` and `src/index.css` should be simple, neutral starter content rather than product-specific UI.

## Task 1: Add A Fixed React Seed Module

**Files:**
- Create: `frontend/src/templates/reactSeed.ts`

- [ ] Export a `Record<string, string>` representing the exact root-level project file map.
- [ ] Include only the minimal scaffold files needed for `npm install` + `npm run dev` to work in WebContainer.
- [ ] Keep file paths root-relative, for example `package.json` and `src/main.tsx`, not `frontend/package.json` or `frontend/src/main.tsx`.
- [ ] Keep the contents generic enough that later build prompts can reshape the project freely.

**Exit Criteria:**
- One import provides the full default project snapshot for a brand-new topic.

## Task 2: Seed Empty Topics In `WebsiteEditorPage`

**Files:**
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`

- [ ] Keep the existing load order: topic metadata first, OSS snapshot second, local recovery fallback third.
- [ ] If OSS and local recovery both produce no files, load the built-in React seed into the editor store.
- [ ] Initialize WebContainer with the seed files so the preview starts from a runnable project instead of an empty directory.
- [ ] Persist the seeded files to OSS exactly once during this empty-topic bootstrap path.
- [ ] Do not overwrite existing OSS or local files under any circumstances.
- [ ] Preserve the current `initialBuildPrompt` flow so the building agent can begin working immediately after the scaffold is ready.

**Exit Criteria:**
- Opening a truly empty topic produces a runnable React project automatically.
- Opening a topic with existing files behaves exactly as before.

## Task 3: Tighten The Build Agent Prompt

**Files:**
- Modify: `frontend/src/agent/systemPrompts.ts`

- [ ] Update the building system prompt to state that the workspace already contains a basic React 18 + TypeScript + Vite scaffold.
- [ ] Instruct the agent to prefer editing existing files and only change project configuration when the request actually requires it.
- [ ] Keep the rest of the current building-agent behavior unchanged.

**Exit Criteria:**
- The agent stops treating every new session like a blank project bootstrap.

## Task 4: Add Regression Tests Around Seeding

**Files:**
- Modify: `frontend/src/pages/WebsiteEditorPage.test.tsx`

- [ ] Add a test where OSS download fails and no local recovery snapshot exists; assert the React seed is loaded and passed into WebContainer init.
- [ ] Add a test where OSS or local recovery already has files; assert the seed is not applied and existing files remain authoritative.
- [ ] Add or update a test to confirm `initialBuildPrompt` still reaches `AgentChatContent` after seed bootstrap.
- [ ] If seed persistence is implemented inside the page flow, assert it is called only for the empty-topic bootstrap path.

**Exit Criteria:**
- The seed path is covered and future editor changes cannot silently revert to blank-project startup.

## Recommended Execution Order

- [ ] Create the fixed seed module first so the bootstrap path has a concrete source of truth.
- [ ] Update `WebsiteEditorPage` second because that is the real product behavior change.
- [ ] Tighten the building prompt third to align agent behavior with the seeded workspace.
- [ ] Finish with targeted tests around empty and non-empty topic startup paths.

## Verification

- [ ] Run the `WebsiteEditorPage` frontend tests covering seed and non-seed flows.
- [ ] Run any directly affected agent prompt or editor tests if they fail due to changed assumptions.
- [ ] Manually create a brand-new topic and verify:
  - the file tree contains root files plus `src/*`,
  - WebContainer starts from the seeded project,
  - the initial build prompt still auto-runs,
  - re-opening the topic loads persisted files instead of seeding again.

## Risks

- [ ] If seed persistence is not done carefully, the topic may look initialized during the first session but fall back to blank on reopen.
- [ ] If the page seeds too early or too often, it can overwrite valid local recovery data; the empty-topic guard must stay strict.
- [ ] If the scaffold is too opinionated, the build agent will spend tokens undoing it; if it is too thin, the bootstrap win shrinks. Keep the first version minimal.
