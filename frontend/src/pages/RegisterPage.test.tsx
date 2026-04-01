import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import RegisterPage from './RegisterPage';

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: () => ({
    register: vi.fn(),
    isLoading: false,
  }),
}));

describe('RegisterPage', () => {
  it('renders the register form', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RegisterPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: '创建新账户' })).toBeInTheDocument();
    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByLabelText('邮箱地址')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByLabelText('确认密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '注册' })).toBeInTheDocument();
  });
});
