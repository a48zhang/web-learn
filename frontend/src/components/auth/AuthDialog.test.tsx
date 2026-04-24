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

  it('moves focus into the dialog and restores it on close', async () => {
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    trigger.textContent = 'open auth';
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender, unmount } = render(
      <AuthDialog isOpen mode="login" onClose={onClose}>
        <button type="button">继续</button>
      </AuthDialog>
    );

    const actionButton = screen.getByRole('button', { name: '继续' });

    await vi.waitFor(() => {
      expect(actionButton).toHaveFocus();
    });

    rerender(
      <AuthDialog isOpen={false} mode="login" onClose={onClose}>
        <button type="button">继续</button>
      </AuthDialog>
    );

    await vi.waitFor(() => {
      expect(trigger).toHaveFocus();
    });

    unmount();
    trigger.remove();
  });

  it('closes on escape and traps tab navigation within the dialog', async () => {
    const onClose = vi.fn();

    render(
      <AuthDialog isOpen mode="register" onClose={onClose}>
        <button type="button">第一个操作</button>
        <button type="button">第二个操作</button>
      </AuthDialog>
    );

    const firstAction = screen.getByRole('button', { name: '第一个操作' });
    const secondAction = screen.getByRole('button', { name: '第二个操作' });

    await vi.waitFor(() => {
      expect(firstAction).toHaveFocus();
    });

    firstAction.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(secondAction).toHaveFocus();

    secondAction.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(firstAction).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
