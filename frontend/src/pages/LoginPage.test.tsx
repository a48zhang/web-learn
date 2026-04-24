import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage';

const loginMock = vi.hoisted(() => vi.fn());
const successMock = vi.hoisted(() => vi.fn());
const errorMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ isLoading: false }));

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: () => ({
    login: loginMock,
    isLoading: authState.isLoading,
  }),
}));

vi.mock('../stores/useToastStore', () => ({
  toast: {
    success: successMock,
    error: errorMock,
  },
}));

describe('LoginPage', () => {
  beforeEach(() => {
    loginMock.mockReset();
    successMock.mockReset();
    errorMock.mockReset();
    authState.isLoading = false;
  });

  it('renders a standalone login form inside the shared auth card', () => {
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(container.firstChild).toHaveClass('bg-slate-950');

    const heading = screen.getByRole('heading', { name: '登录您的账户', level: 1 });
    const authCard = heading.closest('div[class*="glass-surface"]');

    expect(authCard).toHaveClass('glass-surface', 'rounded-panel', 'shadow-panel');
    expect(authCard).toContainElement(screen.getByRole('link', { name: '注册新账户' }));
    expect(authCard).toContainElement(screen.getByRole('button', { name: '登录' }).closest('form'));
  });

  it('uses a dark spinner color while loading', () => {
    authState.isLoading = true;

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: '登录中...' }).querySelector('svg')).toHaveClass('text-slate-950');
  });

  it('submits credentials and shows success feedback', async () => {
    loginMock.mockResolvedValue(undefined);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'teacher@example.com' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('teacher@example.com', 'secret123');
    });
    expect(successMock).toHaveBeenCalledWith('登录成功！');
    expect(errorMock).not.toHaveBeenCalled();
  });

  it('shows backend error feedback when login fails', async () => {
    loginMock.mockRejectedValue({
      response: {
        data: {
          error: '邮箱或密码错误',
        },
      },
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'teacher@example.com' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(screen.getByText('邮箱或密码错误')).toBeInTheDocument();
    });
    expect(errorMock).toHaveBeenCalledWith('邮箱或密码错误');
    expect(successMock).not.toHaveBeenCalled();
  });
});
