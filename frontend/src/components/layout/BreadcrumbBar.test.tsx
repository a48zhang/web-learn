import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import BreadcrumbBar from './BreadcrumbBar';

describe('BreadcrumbBar', () => {
  it('renders nothing when segments is empty', () => {
    const { container } = render(
      <MemoryRouter>
        <BreadcrumbBar segments={[]} />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a single segment as plain text (not a link)', () => {
    render(
      <MemoryRouter>
        <BreadcrumbBar segments={[{ label: '控制台' }]} />
      </MemoryRouter>
    );
    expect(screen.getByText('控制台')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '控制台' })).toBeNull();
  });

  it('renders clickable link for non-last segments', () => {
    render(
      <MemoryRouter>
        <BreadcrumbBar segments={[
          { label: '首页', to: '/dashboard' },
          { label: '控制台' },
        ]} />
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: '首页' });
    expect(link).toHaveAttribute('href', '/dashboard');
    expect(screen.getByText('控制台')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '控制台' })).toBeNull();
  });

  it('renders separator between segments', () => {
    render(
      <MemoryRouter>
        <BreadcrumbBar segments={[
          { label: '首页', to: '/dashboard' },
          { label: '专题列表', to: '/topics' },
          { label: '当前页' },
        ]} />
      </MemoryRouter>
    );
    expect(screen.getAllByText('/').length).toBeGreaterThanOrEqual(2);
  });
});
