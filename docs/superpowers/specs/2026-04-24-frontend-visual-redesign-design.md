# Frontend Visual Redesign Design

**Date:** 2026-04-24

**Status:** Approved for planning

## Summary

This redesign upgrades the existing frontend into a unified dark-first visual system inspired by the visual language in `design-new.code`, while preserving the current product semantics, routes, features, and information architecture.

The redesign is visual-only. It does not add new product modules, new navigation destinations, new workflows, or new data requirements. The goal is to make the application feel like one coherent product instead of a mix of older light SaaS pages and newer dark editor surfaces.

## Goals

- Apply one consistent visual system across all first-party frontend pages.
- Strongly map the public home page and editor workspace to the approved design direction.
- Preserve existing Chinese product semantics and `WebLearn` positioning.
- Keep current route structure, creation flow, editor behavior, and topic management flows.
- Make authenticated work areas feel like a cohesive workspace rather than unrelated pages.

## Non-Goals

- No new community, telemetry, protocol, explore, or monitoring features.
- No changes to backend APIs, data models, or auth logic.
- No changes to route hierarchy or page responsibilities.
- No major refactor of agent runtime, editor runtime, preview runtime, or WebContainer behavior.
- No introduction of a new external design system dependency for the first version.

## Product Scope

This redesign covers the full frontend surface:

- `PublicHomePage`
- `LoginPage`
- `RegisterPage`
- `DashboardPage`
- `TopicListPage`
- `TopicDetailPage`
- `TopicCreatePage`
- `WebsiteEditorPage`
- shared shell and layout components

## Core Design Direction

The approved direction is a dark-first interface system derived from `design-new.code`, but localized to the current product instead of inheriting its English sci-fi branding.

The system should feel:

- focused
- technical
- high-contrast but not neon-heavy
- layered through surfaces and borders instead of large shadows
- restrained in motion

The system should not feel:

- like a marketing landing page
- like a playful consumer app
- like an infrastructure console with new product concepts not present today

## Brand and Language Rules

- Keep existing product semantics and Chinese UI language.
- Do not adopt `Astraeus`, `Aether Protocol`, or similar fictional brand wording from the source design.
- Reuse only the visual system, not the naming system.

## Visual System

### Color System

Adopt a dark surface hierarchy with a cold blue primary accent, using the design source as reference rather than copying page-local tokens literally.

Color roles:

- primary accent: blue for focus, active states, links, primary actions
- secondary accent: limited purple for supporting states
- tertiary accent: limited gold/amber for highlighted technical states
- background: deep neutral dark
- surface stack: 4-6 distinct dark layers for page background, cards, raised panels, panel headers, and overlays
- borders: thin, low-contrast cool borders instead of heavy shadows

### Typography

Use a three-layer type system:

- body UI font for standard reading and forms
- monospace font for technical labels, file paths, statuses, and terminal-adjacent UI
- display/label font for compact uppercase labels and section metadata

Typography should increase hierarchy clarity without making the public pages feel like a terminal.

### Shape and Material

- tighter radii than the current SaaS UI
- restrained glassmorphism for selected panels and overlays only
- low-emphasis shadows
- stronger dependence on borders, tonal contrast, and blur layering

### Motion

Use motion only for:

- focus transitions
- hover transitions
- modal appearance
- tab and panel state changes

Do not use decorative ambient animation as a core part of the first version.

## Page Intensity Model

Not every page should use the same visual density.

### High-Intensity Workspace Pages

These pages should lean closest to the design source:

- `DashboardPage`
- `TopicListPage`
- `TopicDetailPage`
- `TopicCreatePage`
- `WebsiteEditorPage`

They may use denser panel chrome, more explicit state bars, stronger layering, and more monospace metadata.

### Medium-Intensity Public/Auth Pages

These pages use the same token system but a lighter visual composition:

- `PublicHomePage`
- `LoginPage`
- `RegisterPage`

They should remain legible and conversion-friendly, not look like an operations console.

## Page-Level Design

### PublicHomePage

This page is not a traditional marketing landing page.

Approved structure:

- simplified top navigation
- a centered primary input as the only main-screen content
- no published topics section
- no product explanation section
- no feature introduction section
- no long-form landing page body

The public home page should function as a focused unauthenticated entry point.

When the user enters a prompt and triggers creation while unauthenticated:

- show an auth card modal on top of the same page
- do not navigate away first
- preserve the creation intent through authentication

### LoginPage and RegisterPage

Keep these as standalone routes, but redesign them as visual derivatives of the home/auth modal system.

Requirements:

- same dark-first token system
- centered auth card layout
- shared form component styling with the home-page auth modal
- stronger focus states, clearer field validation, consistent async states

They serve as direct-entry and fallback auth pages, even though the home page becomes the primary unauthenticated creation path.

### DashboardPage

This page should adopt the centered input-first composition from the approved home/dashboard design direction.

Requirements:

- the creation prompt remains the primary action
- surrounding chrome shifts from light empty page to dark workspace shell
- optional secondary state/help elements can appear, but they must not compete with the prompt

### TopicListPage

Keep the current topic listing behavior and actions, but redesign the page into the new workspace system.

Requirements:

- dark list or card presentation
- stronger status badges and action grouping
- unified hover, menu, and destructive action styling
- no new information modules

### TopicDetailPage

Preserve current content and actions, but reorganize visual hierarchy with clearer sections, metadata presentation, and action grouping under the new system.

### TopicCreatePage

Keep the current creation flow and fields, but move the page into the new design language with revised cards, form sections, action rows, and focus states.

### WebsiteEditorPage

This page should map strongly to the editor/workbench designs from `design-new.code`.

Requirements:

- unified dark workbench shell
- coherent activity bar, file tree, AI panel, preview panel, and terminal styling
- consistent panel headers, tabs, states, and empty/loading/error visuals
- preserve current editor layout logic and runtime behavior as much as possible

Impacted editor-area components include:

- shell/layout wrappers
- file tree
- agent chat content
- preview panel
- terminal panel
- panel headers and toolbar affordances

## Component System and Ownership

The redesign should be implemented in four layers.

### Layer 1: Global Tokens

Primary ownership:

- `frontend/tailwind.config.js`
- `frontend/src/index.css`

Responsibilities:

- color roles
- typography tokens
- radii
- border treatments
- shadows
- background layers
- scrollbar styling
- shared animation timing
- reusable utility classes for glass/surface treatments where justified

### Layer 2: Shell Components

Primary ownership:

- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/components/layout/TopNav.tsx`
- `frontend/src/components/layout/LeftNav.tsx`
- related breadcrumb and layout meta components

Responsibilities:

- top bar styling
- shell spacing
- page background framing
- drawer/sidebar visuals
- breadcrumb/action row integration

### Layer 3: Reusable Visual Primitives

These should be introduced only where repetition is high enough to justify them.

Likely primitives:

- primary input container
- dark card/panel
- modal auth card
- badge styles
- button variants
- panel header bar
- tab styles
- empty state container

### Layer 4: Page Implementations

Pages should compose the system rather than redefining it.

Responsibilities:

- arrange content
- apply existing behavior
- use the shared shell and primitive language consistently

## Interaction and State Requirements

This redesign must cover live states, not only static layouts.

### Public Home

Must define visuals for:

- default
- hover
- focus
- filled input
- submitting
- unauthenticated prompt trigger
- auth modal open

### Auth

Must define visuals for:

- login/register mode
- field validation
- submitting
- error state
- success transition back to creation flow

### Workspace Pages

Must define visuals for:

- loading
- empty
- error
- hover
- active
- destructive action confirmation

### Editor

Must define visuals for:

- active activity bar item
- selected file
- active tab
- AI running state
- preview unavailable state
- terminal open/closed state
- panel switching state

## Accessibility and Responsiveness

The redesign must remain usable on smaller viewports and meet basic accessibility expectations.

Requirements:

- visible focus states on all interactive elements
- icon-only controls must remain identifiable
- text contrast must remain strong enough in the dark system
- modal auth card must be usable on mobile
- public home centered input must remain usable on mobile
- shell navigation and drawers must not break small screens
- editor can remain desktop-first, but small-screen rendering must degrade safely instead of collapsing visually

## Architecture Constraints

- Keep existing route structure from `frontend/src/App.tsx`
- Preserve `LayoutMetaContext` responsibilities
- Avoid broad runtime refactors in editor logic
- Prefer visual refactoring over behavior refactoring for version one

## Source Mapping From design-new.code

Reference mapping:

- first page: public home visual basis
- dashboard/projects pages: authenticated shell and topic-management visual basis
- editor pages: website editor visual basis

Independent auth pages are not explicitly present in the source design, so login and register pages should be derived from the home/auth modal language rather than copied from a source page.

## Validation Criteria

The redesign is successful when:

1. The frontend reads as one cohesive product rather than mixed generations of UI.
2. Public home becomes a centered-input entry page with auth modal flow.
3. No new product features or information architecture are introduced.
4. Authenticated pages share one workspace visual language.
5. The editor area feels like one integrated workbench.

## Implementation Sequence

Recommended execution order:

1. global tokens and shared shell
2. public home and auth modal system
3. standalone login/register pages
4. dashboard
5. topic pages
6. editor workspace
7. visual cleanup and consistency pass

## Risks

- Over-translating the source design may accidentally introduce foreign product semantics.
- Public/auth pages may become too heavy if treated like workspace pages.
- Editor restyling may regress usability if panel contrast and active states are not carefully tuned.
- Without central tokens, the redesign will fragment quickly.

## Open Decisions Resolved

- Scope: full frontend coverage
- Product language: keep current Chinese semantics
- Change type: visual-only
- Public home structure: centered input only
- Public home secondary sections: removed
- Unauthenticated creation handling: auth card modal instead of immediate route redirect

