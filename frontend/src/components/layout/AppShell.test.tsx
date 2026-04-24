import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AppShell from './AppShell';
import { LayoutMetaProvider, useLayoutMeta } from './LayoutMetaContext';

const { logout } = vi.hoisted(() => ({
  logout: vi.fn(),
}));

vi.mock('../../stores/useAuthStore', () => ({
  useAuthStore: (selector: (state: {
    user: null;
    logout: typeof logout;
    isAuthenticated: boolean;
  }) => unknown) => selector({
    user: null,
    logout,
    isAuthenticated: false,
  }),
}));

function LayoutMetaFixture() {
  const { setMeta } = useLayoutMeta();

  useEffect(() => {
    setMeta({
      breadcrumbSegments: [
        { label: '控制台', to: '/dashboard' },
        { label: '专题列表' },
      ],
      actions: [
        { label: '刷新', onClick: vi.fn() },
      ],
    });
  }, [setMeta]);

  return null;
}

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
    const { container } = render(
      <MemoryRouter>
        <LayoutMetaProvider>
          <LayoutMetaFixture />
          <AppShell>
            <div>Page Content</div>
          </AppShell>
        </LayoutMetaProvider>
      </MemoryRouter>
    );

    expect(container.firstChild).toHaveClass('bg-background', 'text-slate-100');
    expect(screen.getByTestId('top-nav')).toHaveClass('glass-surface', 'h-14', 'border-b', 'border-border/80');
    expect(screen.getByRole('main')).toHaveClass('bg-transparent');
    expect(screen.getByText('专题列表')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刷新' })).toHaveClass('bg-surface-3', 'border-border');
  });

  it('does not render left nav when sideNavSlot is null', () => {
    const { container } = render(
      <MemoryRouter>
        <LayoutMetaProvider>
          <AppShell>
            <div>Content</div>
          </AppShell>
        </LayoutMetaProvider>
      </MemoryRouter>
    );

    expect(container.querySelector('aside')).toBeNull();
  });
});
