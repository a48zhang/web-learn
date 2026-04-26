import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage';

const loginMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());
const successMock = vi.hoisted(() => vi.fn());
const errorMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ isLoading: false }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

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
    navigateMock.mockReset();
    successMock.mockReset();
    errorMock.mockReset();
    authState.isLoading = false;
  });

  it('renders the login form with the register cross-link', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: '登录您的账户', level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText('邮箱地址')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '注册新账户' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('button', { name: '登录' })).toBeEnabled();
  });

  it('shows a disabled loading state while auth is in progress', () => {
    authState.isLoading = true;

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: '登录中...' })).toBeDisabled();
  });

  it('submits credentials, shows success feedback, and navigates to dashboard', async () => {
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
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
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
    expect(screen.getByRole('alert')).toHaveTextContent('邮箱或密码错误');
    expect(errorMock).toHaveBeenCalledWith('邮箱或密码错误');
    expect(successMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
