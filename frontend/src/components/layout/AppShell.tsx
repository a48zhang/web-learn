import { useState } from 'react';
import { useLayoutMeta } from './LayoutMetaContext';
import TopNav from './TopNav';
import BreadcrumbBar from './BreadcrumbBar';
import LeftNav from './LeftNav';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { meta } = useLayoutMeta();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const actions = meta.actions ?? [];
  const hasTopBarContent =
    meta.breadcrumbSegments.length > 0 ||
    actions.length > 0 ||
    meta.topBarRightSlot;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-slate-100">
      <TopNav onMenuClick={() => setDrawerOpen(true)} />
      {hasTopBarContent && (
        <div className="glass-surface relative z-10 shrink-0 border-x-0 border-b border-t-0 px-4 py-3 shadow-panel">
          <BreadcrumbBar segments={meta.breadcrumbSegments} />
          {(meta.topBarRightSlot || actions.length > 0) && (
            <div className="mt-3 flex items-center justify-end gap-2">
              {meta.topBarRightSlot}
              {!meta.topBarRightSlot && actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="rounded-full border border-border bg-surface-3 px-3 py-1.5 text-sm font-medium text-slate-100 transition-colors hover:border-primary/50 hover:bg-surface-2"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="relative z-0 flex min-h-0 flex-1 overflow-hidden">
        <LeftNav isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
          {meta.sideNavSlot}
        </LeftNav>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-transparent">
          {children}
        </main>
      </div>
    </div>
  );
}
