import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AppShell from './AppShell';
import { LayoutMetaProvider } from './LayoutMetaContext';

vi.mock('./TopNav', () => ({
  default: ({
    onMenuClick,
    'data-shell-theme': shellTheme,
  }: {
    onMenuClick: () => void;
    'data-shell-theme'?: string;
  }) => (
    <nav data-testid="top-nav" data-shell-theme={shellTheme}>
      <button onClick={onMenuClick}>Menu</button>
    </nav>
  ),
}));

vi.mock('./LeftNav', () => ({
  default: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    children ? <aside data-testid="left-nav" data-open={isOpen}>{children}</aside> : null,
}));

vi.mock('./BreadcrumbBar', () => ({
  default: ({ segments }: { segments: unknown[] }) =>
    segments.length > 0 ? <div data-testid="breadcrumb-bar" /> : null,
}));

vi.mock('../../stores/useAuthStore', () => ({
  useAuthStore: () => ({ user: null }),
}));

describe('AppShell', () => {
  it('renders children inside main content area', () => {
    render(
      <MemoryRouter>
        <LayoutMetaProvider>
          <AppShell>
            <div>Page Content</div>
          </AppShell>
        </LayoutMetaProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('Page Content')).toBeInTheDocument();
    expect(screen.getByTestId('top-nav')).toBeInTheDocument();
  });

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

  it('does not render left nav when sideNavSlot is null', () => {
    render(
      <MemoryRouter>
        <LayoutMetaProvider>
          <AppShell>
            <div>Content</div>
          </AppShell>
        </LayoutMetaProvider>
      </MemoryRouter>
    );
    expect(screen.queryByTestId('left-nav')).toBeNull();
  });
});
