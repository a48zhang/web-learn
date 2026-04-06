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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav onMenuClick={() => setDrawerOpen(true)} />
      <BreadcrumbBar segments={meta.breadcrumbSegments} />
      <div className="flex flex-1">
        <LeftNav isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
          {meta.sideNavSlot}
        </LeftNav>
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
