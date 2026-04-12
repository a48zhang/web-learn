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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <TopNav onMenuClick={() => setDrawerOpen(true)} />
      <div className="px-4 py-2 flex items-center justify-between bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <BreadcrumbBar segments={meta.breadcrumbSegments} />
        {meta.actions && meta.actions.length > 0 && (
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {meta.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-1 min-h-0">
        <LeftNav isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
          {meta.sideNavSlot}
        </LeftNav>
        <main className="flex-1 min-w-0 min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
