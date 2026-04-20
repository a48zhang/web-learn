import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditorActions from './EditorActions';

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../../stores/useToastStore', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('../PublishShareDialog', () => ({
  default: ({ topicId }: { topicId: string }) => <div data-testid="publish-dialog">{topicId}</div>,
}));

vi.mock('./SaveIndicator', () => ({
  default: () => <div data-testid="save-indicator" />,
}));

describe('EditorActions', () => {
  beforeEach(() => {
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('shows a success toast when manual save resolves true', async () => {
    const onSave = vi.fn().mockResolvedValue(true);

    render(<EditorActions topicId="topic-1" onRefreshPreview={vi.fn()} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: '保存代码' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(toastSuccessMock).toHaveBeenCalledWith('保存成功');
    });

    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('shows a save error toast when manual save resolves false', async () => {
    const onSave = vi.fn().mockResolvedValue(false);

    render(<EditorActions topicId="topic-1" onRefreshPreview={vi.fn()} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: '保存代码' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(toastErrorMock).toHaveBeenCalledWith('保存失败，文件未同步到云端');
    });

    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it('shows a save error toast and keeps publish dialog closed when publish save resolves false', async () => {
    const onSave = vi.fn().mockResolvedValue(false);

    render(<EditorActions topicId="topic-1" onRefreshPreview={vi.fn()} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: '发布' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(toastErrorMock).toHaveBeenCalledWith('保存失败，请先解决网络问题');
    });

    expect(screen.queryByTestId('publish-dialog')).not.toBeInTheDocument();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});
