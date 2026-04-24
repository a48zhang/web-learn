import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegisterPage from './RegisterPage';

const registerMock = vi.hoisted(() => vi.fn());
const successMock = vi.hoisted(() => vi.fn());
const errorMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ isLoading: false }));

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
    successMock.mockReset();
    errorMock.mockReset();
    authState.isLoading = false;
  });

  it('renders register mode labels through the shared auth surface', () => {
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RegisterPage />
      </MemoryRouter>
    );

    expect(container.firstChild).toHaveClass('bg-slate-950');
    expect(screen.getByText('Join Web Learn')).toBeInTheDocument();
    expect(screen.getByText('创建账户，直接开始使用')).toBeInTheDocument();

    const heading = screen.getByRole('heading', { name: '创建新账户', level: 1 });
    const authCard = heading.closest('div[class*="glass-surface"]');

    expect(authCard).toHaveClass('glass-surface', 'rounded-panel', 'shadow-panel');
    expect(authCard).toContainElement(screen.getByRole('link', { name: '登录已有账户' }));
    expect(authCard).toContainElement(screen.getByRole('button', { name: '注册' }).closest('form'));
  });

  it('submits registration successfully', async () => {
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
  });

  it('uses a dark spinner color while loading', () => {
    authState.isLoading = true;

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RegisterPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: '注册中...' }).querySelector('svg')).toHaveClass('text-slate-950');
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
  });
});
