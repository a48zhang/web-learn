import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage';

const navigateMock = vi.hoisted(() => vi.fn());
const setMetaMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  user: { username: 'alice', role: 'user' as const },
}));

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: () => authState,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../components/layout/LayoutMetaContext', () => ({
  useLayoutMeta: () => ({ meta: {}, setMeta: setMetaMock }),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setMetaMock.mockReset();
    authState.user = { username: 'alice', role: 'user' };
  });

  it('shows dashboard quick actions for topics', () => {
    render(<DashboardPage />);

    expect(screen.getByText('控制台')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始创建' })).toBeInTheDocument();
  });

  it('navigates to topics from quick actions', () => {
    render(<DashboardPage />);

    fireEvent.click(screen.getByRole('button', { name: '查看专题' }));

    expect(navigateMock).toHaveBeenCalledWith('/topics');
  });
});
