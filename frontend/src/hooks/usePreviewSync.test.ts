import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreviewSync } from './usePreviewSync';
import { useEditorStore } from '../stores/useEditorStore';

const wcOnFileChangeMock = vi.hoisted(() => vi.fn());
const wcReadFileMock = vi.hoisted(() => vi.fn());

vi.mock('../agent/webcontainer', () => ({
  wcOnFileChange: wcOnFileChangeMock,
  wcReadFile: wcReadFileMock,
}));

describe('usePreviewSync', () => {
  beforeEach(() => {
    wcOnFileChangeMock.mockReset();
    wcReadFileMock.mockReset();
    wcOnFileChangeMock.mockReturnValue(() => {});
    wcReadFileMock.mockImplementation(async (path: string) => {
      const files = useEditorStore.getState().files;
      return files[path] ?? '';
    });

    useEditorStore.setState({
      files: { 'src/app.ts': 'initial content' },
      fileTree: [],
      openFiles: ['src/app.ts'],
      activeFile: 'src/app.ts',
      previewUrl: null,
      isWebContainerReady: false,
      hasUnsavedChanges: false,
      lastSavedAt: null,
      lastLocalBackupAt: null,
      previewMode: 'code',
      activePreviewContent: null,
    });
  });

  it('updates preview content when the active file is edited locally', async () => {
    renderHook(() => usePreviewSync());

    await waitFor(() => {
      expect(useEditorStore.getState().activePreviewContent).toBe('initial content');
    });

    act(() => {
      useEditorStore.getState().setFileContent('src/app.ts', 'updated content');
    });

    await waitFor(() => {
      expect(useEditorStore.getState().activePreviewContent).toBe('updated content');
    });
  });
});
