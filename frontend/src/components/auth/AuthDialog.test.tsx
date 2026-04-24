import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AuthDialog from './AuthDialog';

describe('AuthDialog', () => {
  it('gives the dialog element an accessible name based on mode', () => {
    render(
      <AuthDialog isOpen mode="login" onClose={vi.fn()}>
        <div>dialog content</div>
      </AuthDialog>
    );

    expect(screen.getByRole('dialog', { name: '登录对话框' })).toBeInTheDocument();
  });

  it('forwards close interactions through the modal frame', () => {
    const onClose = vi.fn();

    render(
      <AuthDialog isOpen mode="register" onClose={onClose}>
        <div>dialog content</div>
      </AuthDialog>
    );

    fireEvent.click(screen.getByRole('button', { name: '关闭弹窗' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
