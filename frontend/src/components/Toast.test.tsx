import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastContainer } from './Toast';

describe('ToastContainer', () => {
  it('renders a toast notification', () => {
    render(
      <ToastContainer
        toasts={[
          {
            id: 'toast-1',
            type: 'success',
            message: '操作成功',
          },
        ]}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('操作成功')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
  });
});
