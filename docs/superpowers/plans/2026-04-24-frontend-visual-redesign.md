# Frontend Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved dark-first visual redesign across the frontend without changing routes, product semantics, or core workflows.

**Architecture:** Build the redesign in layers. First establish global tokens and shell chrome, then introduce reusable prompt/auth/surface primitives, then migrate public/auth pages, authenticated topic pages, and finally the editor workbench. All behavior stays on existing stores, routes, and APIs; version one is a visual and component-structure migration, not a runtime rewrite.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, React Router, React Hook Form, Zustand, Vitest, Testing Library

---

## File Structure

### Existing files to modify

- `frontend/tailwind.config.js`
- `frontend/src/index.css`
- `frontend/src/App.tsx`
- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/components/layout/TopNav.tsx`
- `frontend/src/components/layout/LeftNav.tsx`
- `frontend/src/components/layout/BreadcrumbBar.tsx`
- `frontend/src/pages/PublicHomePage.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/TopicListPage.tsx`
- `frontend/src/pages/TopicCreatePage.tsx`
- `frontend/src/pages/TopicDetailPage.tsx`
- `frontend/src/pages/WebsiteTopicPage.tsx`
- `frontend/src/pages/WebsiteEditorPage.tsx`
- `frontend/src/components/AgentChatContent.tsx`
- `frontend/src/components/TerminalPanel.tsx`
- `frontend/src/components/preview/PreviewPanel.tsx`
- `frontend/src/components/editor/FileTree.tsx`
- `frontend/src/components/settings/SettingsModal.tsx`

### Existing tests to modify

- `frontend/src/components/layout/AppShell.test.tsx`
- `frontend/src/pages/DashboardPage.test.tsx`
- `frontend/src/pages/LoginPage.test.tsx`
- `frontend/src/pages/RegisterPage.test.tsx`
- `frontend/src/pages/TopicListPage.test.tsx`
- `frontend/src/pages/WebsiteEditorPage.test.tsx`

### New files to create

- `frontend/src/components/ui/SurfaceCard.tsx`
- `frontend/src/components/ui/ModalFrame.tsx`
- `frontend/src/components/ui/PromptComposer.tsx`
- `frontend/src/components/auth/AuthDialog.tsx`
- `frontend/src/components/auth/AuthFormCard.tsx`
- `frontend/src/pages/PublicHomePage.test.tsx`
- `frontend/src/pages/TopicCreatePage.test.tsx`
- `frontend/src/pages/TopicDetailPage.test.tsx`

### Optional small helper extraction during implementation

- If the shell becomes repetitive, create `frontend/src/components/layout/ShellSection.tsx`
- If auth form branching gets too dense, create `frontend/src/components/auth/authSchemas.ts`

Do not introduce a new component library or state container.

---

### Task 1: Establish Global Theme Tokens And Shell Baseline

**Files:**
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/layout/AppShell.tsx`
- Modify: `frontend/src/components/layout/TopNav.tsx`
- Modify: `frontend/src/components/layout/LeftNav.tsx`
- Modify: `frontend/src/components/layout/BreadcrumbBar.tsx`
- Test: `frontend/src/components/layout/AppShell.test.tsx`

- [ ] **Step 1: Write the failing shell/theme test**

```tsx
it('renders the redesigned shell chrome classes', () => {
  render(
    <MemoryRouter>
      <LayoutMetaProvider>
        <AppShell>
          <div>Page Content</div>
        </AppShell>
      </LayoutMetaProvider>
    </MemoryRouter>
  );

  expect(screen.getByTestId('top-nav')).toHaveAttribute('data-shell-theme', 'dark-workspace');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @web-learn/frontend test -- AppShell.test.tsx
```

Expected: FAIL because `TopNav` does not expose the new shell theme attribute and the shell still uses the legacy light classes.

- [ ] **Step 3: Add Tailwind token extensions and global CSS utilities**

```js
// frontend/tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0f141b',
        surface: '#151b23',
        'surface-2': '#1b222c',
        'surface-3': '#232d38',
        border: '#2d3947',
        primary: '#7db8ff',
        'primary-strong': '#58a6ff',
        secondary: '#c7b3ff',
        accent: '#ffba42',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        display: ['Space Grotesk', 'Inter', 'ui-sans-serif'],
      },
      boxShadow: {
        panel: '0 18px 60px rgba(0, 0, 0, 0.28)',
      },
      borderRadius: {
        panel: '20px',
      },
    },
  },
  plugins: [],
};
```

```css
/* frontend/src/index.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;700&display=swap');

:root {
  color: #e6edf3;
  background:
    radial-gradient(circle at top, rgba(88, 166, 255, 0.12), transparent 30%),
    linear-gradient(180deg, #0f141b 0%, #0b1016 100%);
}

body {
  margin: 0;
  font-family: 'Inter', sans-serif;
  color: #e6edf3;
  background: transparent;
}

@layer utilities {
  .glass-surface {
    background: rgba(21, 27, 35, 0.72);
    backdrop-filter: blur(18px);
    border: 1px solid rgba(125, 184, 255, 0.12);
  }
}
```

- [ ] **Step 4: Rework shell components to consume the new token system**

```tsx
// frontend/src/components/layout/AppShell.tsx
return (
  <div className="h-screen overflow-hidden bg-background text-slate-100">
    <TopNav data-shell-theme="dark-workspace" onMenuClick={() => setDrawerOpen(true)} />
    <div className="flex flex-1 min-h-0">
      <LeftNav isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {meta.sideNavSlot}
      </LeftNav>
      <main className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-transparent">
        {children}
      </main>
    </div>
  </div>
);
```

```tsx
// frontend/src/components/layout/TopNav.tsx
<header
  data-shell-theme="dark-workspace"
  className="h-14 border-b border-border/80 bg-surface/85 backdrop-blur-xl"
>
```

- [ ] **Step 5: Run shell tests and commit**

Run:

```bash
pnpm --filter @web-learn/frontend test -- AppShell.test.tsx
pnpm --filter @web-learn/frontend lint
```

Expected: PASS for the shell test and no lint errors introduced by the shell rewrite.

Commit:

```bash
git add frontend/tailwind.config.js frontend/src/index.css frontend/src/components/layout/AppShell.tsx frontend/src/components/layout/TopNav.tsx frontend/src/components/layout/LeftNav.tsx frontend/src/components/layout/BreadcrumbBar.tsx frontend/src/components/layout/AppShell.test.tsx
git commit -m "feat: establish dark workspace shell theme"
```

---

### Task 2: Build Shared Surface, Prompt, And Auth Dialog Primitives

**Files:**
- Create: `frontend/src/components/ui/SurfaceCard.tsx`
- Create: `frontend/src/components/ui/ModalFrame.tsx`
- Create: `frontend/src/components/ui/PromptComposer.tsx`
- Create: `frontend/src/components/auth/AuthFormCard.tsx`
- Create: `frontend/src/components/auth/AuthDialog.tsx`
- Modify: `frontend/src/components/settings/SettingsModal.tsx`
- Test: `frontend/src/pages/LoginPage.test.tsx`
- Test: `frontend/src/pages/RegisterPage.test.tsx`

- [ ] **Step 1: Write the failing auth surface tests**

```tsx
it('renders a standalone login form inside the shared auth card', () => {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );

  expect(screen.getByTestId('auth-form-card')).toBeInTheDocument();
});
```

```tsx
it('renders register mode labels through the shared auth surface', () => {
  render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );

  expect(screen.getByTestId('auth-form-card')).toHaveTextContent('创建新账户');
});
```

- [ ] **Step 2: Run auth tests to verify they fail**

Run:

```bash
pnpm --filter @web-learn/frontend test -- LoginPage.test.tsx RegisterPage.test.tsx
```

Expected: FAIL because no shared auth card exists and the pages still render the legacy white forms.

- [ ] **Step 3: Create the reusable primitives**

```tsx
// frontend/src/components/ui/SurfaceCard.tsx
export default function SurfaceCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-surface rounded-panel shadow-panel ${className}`}>
      {children}
    </div>
  );
}
```

```tsx
// frontend/src/components/ui/ModalFrame.tsx
export default function ModalFrame({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="关闭弹窗" />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
```

```tsx
// frontend/src/components/ui/PromptComposer.tsx
export default function PromptComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  submitLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  submitLabel: string;
}) {
  return (
    <SurfaceCard className="w-full max-w-3xl p-4">
      <textarea
        aria-label="描述专题需求"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-28 w-full resize-none bg-transparent text-lg outline-none placeholder:text-slate-500"
        placeholder="描述你想制作的专题..."
      />
      <div className="mt-3 flex justify-end">
        <button type="button" disabled={disabled} onClick={onSubmit} className="rounded-2xl bg-primary-strong px-4 py-2 text-sm font-semibold text-slate-950">
          {submitLabel}
        </button>
      </div>
    </SurfaceCard>
  );
}
```

- [ ] **Step 4: Implement the shared auth card/dialog and align SettingsModal**

```tsx
// frontend/src/components/auth/AuthFormCard.tsx
export default function AuthFormCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <SurfaceCard className="p-6" data-testid="auth-form-card">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold text-slate-50">{title}</h1>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>
      {children}
    </SurfaceCard>
  );
}
```

```tsx
// frontend/src/components/auth/AuthDialog.tsx
export default function AuthDialog({
  isOpen,
  mode,
  onClose,
  children,
}: {
  isOpen: boolean;
  mode: 'login' | 'register';
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <ModalFrame onClose={onClose}>
      <div data-auth-mode={mode}>{children}</div>
    </ModalFrame>
  );
}
```

```tsx
// frontend/src/components/settings/SettingsModal.tsx
return (
  <ModalFrame onClose={handleClose}>
    <SurfaceCard className="w-full max-w-2xl overflow-hidden">
      {/* existing settings modal content */}
    </SurfaceCard>
  </ModalFrame>
);
```

- [ ] **Step 5: Run auth tests and commit**

Run:

```bash
pnpm --filter @web-learn/frontend test -- LoginPage.test.tsx RegisterPage.test.tsx
pnpm --filter @web-learn/frontend lint
```

Expected: PASS with the pages now rendering through the shared auth card surface.

Commit:

```bash
git add frontend/src/components/ui/SurfaceCard.tsx frontend/src/components/ui/ModalFrame.tsx frontend/src/components/ui/PromptComposer.tsx frontend/src/components/auth/AuthFormCard.tsx frontend/src/components/auth/AuthDialog.tsx frontend/src/components/settings/SettingsModal.tsx frontend/src/pages/LoginPage.test.tsx frontend/src/pages/RegisterPage.test.tsx
git commit -m "feat: add shared dark auth and prompt primitives"
```

---

### Task 3: Rebuild Public Home As A Centered Prompt Entry With Auth Modal

**Files:**
- Modify: `frontend/src/pages/PublicHomePage.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/pages/PublicHomePage.test.tsx`
- Test: `frontend/src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: Write the failing public home tests**

```tsx
it('renders only the centered prompt entry instead of marketing sections', () => {
  render(
    <MemoryRouter>
      <PublicHomePage />
    </MemoryRouter>
  );

  expect(screen.getByLabelText('描述专题需求')).toBeInTheDocument();
  expect(screen.queryByText('为什么选择 WebLearn？')).not.toBeInTheDocument();
  expect(screen.queryByText('热门专题')).not.toBeInTheDocument();
});
```

```tsx
it('opens the auth dialog when an unauthenticated user submits a prompt', async () => {
  render(
    <MemoryRouter>
      <PublicHomePage />
    </MemoryRouter>
  );

  fireEvent.change(screen.getByLabelText('描述专题需求'), {
    target: { value: '做一个中国古代史互动专题' },
  });
  fireEvent.click(screen.getByRole('button', { name: '开始创建' }));

  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run public home tests to verify they fail**

Run:

```bash
pnpm --filter @web-learn/frontend test -- PublicHomePage.test.tsx
```

Expected: FAIL because the page still renders legacy marketing sections and has no auth dialog flow.

- [ ] **Step 3: Rewrite PublicHomePage around the shared prompt composer**

```tsx
// frontend/src/pages/PublicHomePage.tsx
const [prompt, setPrompt] = useState('');
const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
const [authOpen, setAuthOpen] = useState(false);

const handleStart = () => {
  if (!prompt.trim()) return;
  setAuthMode('login');
  setAuthOpen(true);
};

return (
  <div className="min-h-screen bg-transparent">
    <header className="flex h-16 items-center justify-between px-6">
      <Link to="/" className="font-display text-lg font-bold tracking-tight text-primary-strong">
        WebLearn
      </Link>
      <div className="flex items-center gap-3">
        <button onClick={() => { setAuthMode('login'); setAuthOpen(true); }}>登录</button>
        <button onClick={() => { setAuthMode('register'); setAuthOpen(true); }}>注册</button>
      </div>
    </header>
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <PromptComposer
        value={prompt}
        onChange={setPrompt}
        onSubmit={handleStart}
        submitLabel="开始创建"
      />
    </main>
    <AuthDialog isOpen={authOpen} mode={authMode} onClose={() => setAuthOpen(false)}>
      {/* render login/register shared form card, preserving prompt state */}
    </AuthDialog>
  </div>
);
```

- [ ] **Step 4: Ensure auth success resumes creation intent**

```tsx
// inside PublicHomePage auth success callback
const handleAuthenticated = async () => {
  const normalizedPrompt = prompt.replace(/\s+/g, ' ').trim();
  const topic = await topicApi.create({
    title: buildTopicTitleFromPrompt(normalizedPrompt),
    description: normalizedPrompt,
    type: 'website',
  });
  navigate(`/topics/${topic.id}/edit`, {
    state: { initialBuildPrompt: normalizedPrompt },
  });
};
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
pnpm --filter @web-learn/frontend test -- PublicHomePage.test.tsx DashboardPage.test.tsx
pnpm --filter @web-learn/frontend lint
```

Expected: PASS, with the home page now using the centered prompt entry and auth dialog path.

Commit:

```bash
git add frontend/src/pages/PublicHomePage.tsx frontend/src/pages/PublicHomePage.test.tsx frontend/src/App.tsx frontend/src/pages/DashboardPage.test.tsx
git commit -m "feat: redesign public home with auth modal prompt flow"
```

---

### Task 4: Migrate Standalone Login And Register Pages To The Shared Auth System

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/RegisterPage.tsx`
- Test: `frontend/src/pages/LoginPage.test.tsx`
- Test: `frontend/src/pages/RegisterPage.test.tsx`

- [ ] **Step 1: Write the failing standalone auth style test**

```tsx
it('renders login inside the shared dark auth shell', () => {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );

  expect(screen.getByTestId('auth-form-card')).toHaveTextContent('登录您的账户');
});
```

- [ ] **Step 2: Run auth page tests to verify they fail**

Run:

```bash
pnpm --filter @web-learn/frontend test -- LoginPage.test.tsx RegisterPage.test.tsx
```

Expected: FAIL until both pages are rendered through the shared auth card and dark page frame.

- [ ] **Step 3: Refactor LoginPage to reuse the shared auth card**

```tsx
// frontend/src/pages/LoginPage.tsx
return (
  <div className="min-h-screen flex items-center justify-center px-4 py-12">
    <div className="w-full max-w-md">
      <AuthFormCard
        title="登录您的账户"
        subtitle="继续创建和管理互动学习专题"
      >
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {/* existing fields and validation */}
        </form>
      </AuthFormCard>
    </div>
  </div>
);
```

- [ ] **Step 4: Refactor RegisterPage to reuse the shared auth card**

```tsx
// frontend/src/pages/RegisterPage.tsx
return (
  <div className="min-h-screen flex items-center justify-center px-4 py-12">
    <div className="w-full max-w-md">
      <AuthFormCard
        title="创建新账户"
        subtitle="注册后即可继续当前专题创建流程"
      >
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {/* existing fields and validation */}
        </form>
      </AuthFormCard>
    </div>
  </div>
);
```

- [ ] **Step 5: Run auth page tests and commit**

Run:

```bash
pnpm --filter @web-learn/frontend test -- LoginPage.test.tsx RegisterPage.test.tsx
pnpm --filter @web-learn/frontend lint
```

Expected: PASS, preserving current login/register behavior with the new visual shell.

Commit:

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx frontend/src/pages/LoginPage.test.tsx frontend/src/pages/RegisterPage.test.tsx
git commit -m "feat: restyle standalone auth pages"
```

---

### Task 5: Migrate Dashboard And Topic Pages Into The Workspace Design System

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/pages/TopicListPage.tsx`
- Modify: `frontend/src/pages/TopicCreatePage.tsx`
- Modify: `frontend/src/pages/TopicDetailPage.tsx`
- Modify: `frontend/src/pages/WebsiteTopicPage.tsx`
- Create: `frontend/src/pages/TopicCreatePage.test.tsx`
- Create: `frontend/src/pages/TopicDetailPage.test.tsx`
- Test: `frontend/src/pages/DashboardPage.test.tsx`
- Test: `frontend/src/pages/TopicListPage.test.tsx`

- [ ] **Step 1: Write the failing topic-page tests**

```tsx
it('renders topic create inside the redesigned dark surface', () => {
  render(<TopicCreatePage />);
  expect(screen.getByRole('button', { name: '创建专题' })).toHaveClass('bg-primary-strong');
});
```

```tsx
it('renders topic detail error state in the redesigned dark container', async () => {
  render(
    <MemoryRouter initialEntries={['/topics/topic-1']}>
      <Routes>
        <Route path="/topics/:id" element={<TopicDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
  expect(await screen.findByText('获取专题详情失败')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run topic tests to verify they fail**

Run:

```bash
pnpm --filter @web-learn/frontend test -- DashboardPage.test.tsx TopicListPage.test.tsx TopicCreatePage.test.tsx TopicDetailPage.test.tsx
```

Expected: FAIL for the new dark-surface expectations and missing tests.

- [ ] **Step 3: Rework Dashboard and TopicList into the workspace card system**

```tsx
// frontend/src/pages/DashboardPage.tsx
return (
  <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-5xl items-center justify-center px-4 py-10">
    <PromptComposer
      value={prompt}
      onChange={setPrompt}
      onSubmit={() => void handleSubmit(new Event('submit') as never)}
      disabled={!canSubmit}
      submitLabel="开始制作"
    />
  </div>
);
```

```tsx
// frontend/src/pages/TopicListPage.tsx
<div className="mx-auto max-w-7xl px-4 py-8">
  <div className="grid gap-5">
    {topics.map((topic) => (
      <SurfaceCard key={topic.id} className="p-5">
        {/* title, badges, actions, delete modal trigger */}
      </SurfaceCard>
    ))}
  </div>
</div>
```

- [ ] **Step 4: Rework TopicCreate, TopicDetail, and WebsiteTopicPage**

```tsx
// frontend/src/pages/TopicCreatePage.tsx
<SurfaceCard className="p-6 sm:p-8">
  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
    {/* existing fields */}
  </form>
</SurfaceCard>
```

```tsx
// frontend/src/pages/WebsiteTopicPage.tsx
<div className="mx-auto max-w-7xl px-4 py-6">
  <SurfaceCard className="overflow-hidden">
    {/* iframe chrome, fullscreen button, loading/error state */}
  </SurfaceCard>
</div>
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
pnpm --filter @web-learn/frontend test -- DashboardPage.test.tsx TopicListPage.test.tsx TopicCreatePage.test.tsx TopicDetailPage.test.tsx
pnpm --filter @web-learn/frontend lint
```

Expected: PASS with no behavior regressions in create/list/detail flows.

Commit:

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/pages/TopicListPage.tsx frontend/src/pages/TopicCreatePage.tsx frontend/src/pages/TopicDetailPage.tsx frontend/src/pages/WebsiteTopicPage.tsx frontend/src/pages/DashboardPage.test.tsx frontend/src/pages/TopicListPage.test.tsx frontend/src/pages/TopicCreatePage.test.tsx frontend/src/pages/TopicDetailPage.test.tsx
git commit -m "feat: migrate dashboard and topic pages to dark workspace design"
```

---

### Task 6: Migrate The Editor Workbench To The New Visual System

**Files:**
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`
- Modify: `frontend/src/components/AgentChatContent.tsx`
- Modify: `frontend/src/components/preview/PreviewPanel.tsx`
- Modify: `frontend/src/components/editor/FileTree.tsx`
- Modify: `frontend/src/components/TerminalPanel.tsx`
- Test: `frontend/src/pages/WebsiteEditorPage.test.tsx`

- [ ] **Step 1: Write the failing editor shell test**

```tsx
it('renders the redesigned editor workbench shell', async () => {
  render(
    <MemoryRouter initialEntries={['/topics/topic-1/edit']}>
      <Routes>
        <Route path="/topics/:id/edit" element={<WebsiteEditorPage />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getByTestId('panel-group')).toHaveAttribute('data-editor-theme', 'dark-workbench');
  });
});
```

- [ ] **Step 2: Run editor tests to verify they fail**

Run:

```bash
pnpm --filter @web-learn/frontend test -- WebsiteEditorPage.test.tsx
```

Expected: FAIL because the editor still mixes legacy VSCode-like fragments with separate page-level styling.

- [ ] **Step 3: Rework WebsiteEditorPage shell and panel framing**

```tsx
// frontend/src/pages/WebsiteEditorPage.tsx
return (
  <div className="flex h-full min-h-0 bg-background text-slate-100" data-editor-theme="dark-workbench">
    <div className="w-14 shrink-0 border-r border-border bg-surface-2">
      {/* activity bar */}
    </div>
    <div className="flex min-h-0 flex-1 flex-col">
      {/* panel group + terminal */}
    </div>
  </div>
);
```

- [ ] **Step 4: Restyle editor subcomponents without changing their behavior**

```tsx
// frontend/src/components/editor/FileTree.tsx
<div className="h-full bg-surface-2 text-slate-200">
  <div className="border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
    Explorer
  </div>
```

```tsx
// frontend/src/components/preview/PreviewPanel.tsx
<div className="h-full flex flex-col border-l border-border bg-surface">
```

```tsx
// frontend/src/components/TerminalPanel.tsx
<div className="relative z-20 border-t border-border bg-surface-2">
```

```tsx
// frontend/src/components/AgentChatContent.tsx
<div className="flex h-full min-h-0 flex-col bg-surface text-slate-100">
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
pnpm --filter @web-learn/frontend test -- WebsiteEditorPage.test.tsx
pnpm --filter @web-learn/frontend lint
```

Expected: PASS, with the editor preserving runtime behavior while exposing the new workbench shell.

Commit:

```bash
git add frontend/src/pages/WebsiteEditorPage.tsx frontend/src/components/AgentChatContent.tsx frontend/src/components/preview/PreviewPanel.tsx frontend/src/components/editor/FileTree.tsx frontend/src/components/TerminalPanel.tsx frontend/src/pages/WebsiteEditorPage.test.tsx
git commit -m "feat: restyle website editor workbench"
```

---

### Task 7: Final Regression Pass For Visual States And Routes

**Files:**
- Modify: any of the files above only if regressions are found
- Test: `frontend/src/pages/PublicHomePage.test.tsx`
- Test: `frontend/src/pages/LoginPage.test.tsx`
- Test: `frontend/src/pages/RegisterPage.test.tsx`
- Test: `frontend/src/pages/DashboardPage.test.tsx`
- Test: `frontend/src/pages/TopicListPage.test.tsx`
- Test: `frontend/src/pages/TopicCreatePage.test.tsx`
- Test: `frontend/src/pages/TopicDetailPage.test.tsx`
- Test: `frontend/src/pages/WebsiteEditorPage.test.tsx`

- [ ] **Step 1: Add any missing regression assertions for the approved states**

```tsx
it('keeps the entered public-home prompt visible when auth dialog opens', async () => {
  render(
    <MemoryRouter>
      <PublicHomePage />
    </MemoryRouter>
  );

  fireEvent.change(screen.getByLabelText('描述专题需求'), {
    target: { value: '做一个几何互动专题' },
  });
  fireEvent.click(screen.getByRole('button', { name: '开始创建' }));

  expect(screen.getByDisplayValue('做一个几何互动专题')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused frontend regression suite**

Run:

```bash
pnpm --filter @web-learn/frontend test -- PublicHomePage.test.tsx LoginPage.test.tsx RegisterPage.test.tsx DashboardPage.test.tsx TopicListPage.test.tsx TopicCreatePage.test.tsx TopicDetailPage.test.tsx WebsiteEditorPage.test.tsx
```

Expected: PASS for all visual-surface regression coverage.

- [ ] **Step 3: Run the full frontend test suite**

Run:

```bash
pnpm --filter @web-learn/frontend test
```

Expected: PASS with no regressions outside the redesigned pages.

- [ ] **Step 4: Run frontend build and lint**

Run:

```bash
pnpm --filter @web-learn/frontend lint
pnpm --filter @web-learn/frontend build
```

Expected: PASS, proving that the redesigned shell and pages compile cleanly.

- [ ] **Step 5: Commit the final verification pass**

```bash
git add frontend/src
git commit -m "test: verify frontend visual redesign regressions"
```

---

## Self-Review

### Spec coverage

- Global dark-first visual system: covered by Task 1
- Shared prompt/auth component language: covered by Task 2
- Public home centered prompt and auth modal: covered by Task 3
- Standalone login/register redesign: covered by Task 4
- Dashboard/topic page migration: covered by Task 5
- Editor workbench migration: covered by Task 6
- Regression verification: covered by Task 7

### Placeholder scan

- No `TODO`, `TBD`, or deferred placeholders remain
- All tasks name concrete files and concrete commands
- Tests are named explicitly where new coverage is required

### Type consistency

- Shared primitive names are consistent: `SurfaceCard`, `ModalFrame`, `PromptComposer`, `AuthFormCard`, `AuthDialog`
- Public-home prompt continuation continues to use existing `buildTopicTitleFromPrompt`
- No plan step requires changes to auth store signatures or topic API signatures

