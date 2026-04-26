import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegisterPage from './RegisterPage';

const registerMock = vi.hoisted(() => vi.fn());
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
    register: registerMock,
    isLoading: authState.isLoading,
  }),
}));

vi.mock('../stores/useToastStore', () => ({
  toast: {
    success: successMock,
    error: errorMock,
  },
}));

describe('RegisterPage', () => {
  beforeEach(() => {
    registerMock.mockReset();
    navigateMock.mockReset();
    successMock.mockReset();
    errorMock.mockReset();
    authState.isLoading = false;
  });

  it('renders the registration form with the login cross-link', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RegisterPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: '创建新账户', level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByLabelText('邮箱地址')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByLabelText('确认密码')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '登录已有账户' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('button', { name: '注册' })).toBeEnabled();
  });

  it('submits registration successfully and navigates to dashboard', async () => {
    registerMock.mockResolvedValue(undefined);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith('alice', 'alice@example.com', 'secret123');
    });
    expect(successMock).toHaveBeenCalledWith('注册成功！');
    expect(errorMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
  });

  it('shows a disabled loading state while auth is in progress', () => {
    authState.isLoading = true;

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RegisterPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: '注册中...' })).toBeDisabled();
  });

  it('shows confirm password validation and blocks submission', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'different123' } });
    fireEvent.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => {
      expect(screen.getByText('两次输入的密码不一致')).toBeInTheDocument();
    });
    expect(registerMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('shows backend error feedback when registration fails', async () => {
    registerMock.mockRejectedValue({
      response: {
        data: {
          error: '邮箱已被使用',
        },
      },
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => {
      expect(screen.getByText('邮箱已被使用')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('邮箱已被使用');
    expect(errorMock).toHaveBeenCalledWith('邮箱已被使用');
    expect(successMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
