import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePreviewSync } from './usePreviewSync';
import { useEditorStore } from '../stores/useEditorStore';

describe('usePreviewSync', () => {
  beforeEach(() => {
    useEditorStore.setState({
      files: { 'src/app.ts': 'initial content' },
      fileTree: [],
      openFiles: ['src/app.ts'],
      activeFile: 'src/app.ts',
      fileRevision: 0,
      lastSavedRevision: 0,
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

  it('clears preview content when there is no active file', async () => {
    useEditorStore.setState({
      activeFile: null,
      activePreviewContent: 'previous content',
    });

    renderHook(() => usePreviewSync());

    await waitFor(() => {
      expect(useEditorStore.getState().activePreviewContent).toBeNull();
    });
  });

  it('clears preview content when the active file is deleted', async () => {
    renderHook(() => usePreviewSync());

    await waitFor(() => {
      expect(useEditorStore.getState().activePreviewContent).toBe('initial content');
    });

    act(() => {
      useEditorStore.setState({
        files: {},
        fileTree: [],
        openFiles: ['src/app.ts'],
        activeFile: 'src/app.ts',
      });
    });

    await waitFor(() => {
      expect(useEditorStore.getState().activePreviewContent).toBeNull();
    });
  });
});
