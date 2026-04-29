import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FileTree from './FileTree';
import { useEditorStore } from '../../stores/useEditorStore';

const createProjectFileMock = vi.hoisted(() => vi.fn());
const deleteProjectPathMock = vi.hoisted(() => vi.fn());
const moveProjectPathMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/projectFileService', () => ({
  createProjectFile: createProjectFileMock,
  deleteProjectPath: deleteProjectPathMock,
  moveProjectPath: moveProjectPathMock,
}));

vi.mock('../../stores/useToastStore', () => ({
  toast: {
    error: toastErrorMock,
  },
}));

function resetEditorStore() {
  useEditorStore.getState().loadSnapshot({
    'src/app.ts': 'initial content',
  });
  useEditorStore.setState({
    openFiles: ['src/app.ts'],
    activeFile: 'src/app.ts',
    fileRevision: 0,
    lastSavedRevision: 0,
    hasUnsavedChanges: false,
    lastSavedAt: null,
    lastLocalBackupAt: null,
  });
}

describe('FileTree', () => {
  beforeEach(() => {
    createProjectFileMock.mockReset();
    deleteProjectPathMock.mockReset();
    moveProjectPathMock.mockReset();
    toastErrorMock.mockReset();
    resetEditorStore();
  });

  it('shows an error and does not mutate the store when file creation fails', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('src/new.ts');
    createProjectFileMock.mockRejectedValue(new Error('create failed'));

    render(<FileTree onOpenFile={vi.fn()} />);

    fireEvent.click(screen.getByTitle('新建文件'));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('新建文件失败，请稍后重试');
    });

    expect(createProjectFileMock).toHaveBeenCalledWith('src/new.ts', '');
    expect(useEditorStore.getState().files).toEqual({
      'src/app.ts': 'initial content',
    });
  });

  it('shows an error and does not mutate the store when file deletion fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    deleteProjectPathMock.mockRejectedValue(new Error('delete failed'));

    render(<FileTree onOpenFile={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '删除 app.ts' }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('删除文件失败，请稍后重试');
    });

    expect(deleteProjectPathMock).toHaveBeenCalledWith('src/app.ts');
    expect(useEditorStore.getState().files).toEqual({
      'src/app.ts': 'initial content',
    });
    expect(useEditorStore.getState().activeFile).toBe('src/app.ts');
    expect(useEditorStore.getState().openFiles).toEqual(['src/app.ts']);
  });

  it('renames files through the project file service', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('src/renamed.ts');
    moveProjectPathMock.mockResolvedValue(undefined);

    render(<FileTree onOpenFile={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '重命名 app.ts' }));

    await waitFor(() => {
      expect(moveProjectPathMock).toHaveBeenCalledWith('src/app.ts', 'src/renamed.ts');
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('shows an error and does not mutate the store when file rename fails', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('src/renamed.ts');
    moveProjectPathMock.mockRejectedValue(new Error('rename failed'));

    render(<FileTree onOpenFile={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '重命名 app.ts' }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('重命名失败，请稍后重试');
    });

    expect(moveProjectPathMock).toHaveBeenCalledWith('src/app.ts', 'src/renamed.ts');
    expect(useEditorStore.getState().files).toEqual({
      'src/app.ts': 'initial content',
    });
  });
});
