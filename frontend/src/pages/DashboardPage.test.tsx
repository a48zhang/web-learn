import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage';

const navigateMock = vi.hoisted(() => vi.fn());
const logoutMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  user: { username: 'alice', role: 'student' as const },
  logout: logoutMock,
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

describe('DashboardPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    logoutMock.mockReset();
    authState.user = { username: 'alice', role: 'student' };
  });

  it('shows student quick actions for topics, submissions, and feedback', () => {
    render(<DashboardPage />);

    expect(screen.getByText('控制台')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '去浏览' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看提交' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看反馈' })).toBeInTheDocument();
  });

  it('navigates to the student submission and feedback pages from quick actions', () => {
    render(<DashboardPage />);

    fireEvent.click(screen.getByRole('button', { name: '查看提交' }));
    fireEvent.click(screen.getByRole('button', { name: '查看反馈' }));

    expect(navigateMock).toHaveBeenCalledWith('/my-submissions');
    expect(navigateMock).toHaveBeenCalledWith('/my-feedback');
  });
});
