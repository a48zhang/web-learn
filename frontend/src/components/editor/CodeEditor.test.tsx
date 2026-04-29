import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CodeEditor from './CodeEditor';
import { useEditorStore } from '../../stores/useEditorStore';

type WriteOptions = {
  shouldCommit?: () => boolean;
};

type PendingWrite = {
  path: string;
  content: string;
  options?: WriteOptions;
  resolve: () => void;
  reject: (error: Error) => void;
};

const pendingWrites = vi.hoisted((): PendingWrite[] => []);
const writeProjectFileMock = vi.hoisted(() => vi.fn());
const monacoMockState = vi.hoisted((): {
  onChange: ((value: string | undefined) => void) | null;
} => ({ onChange: null }));

vi.mock('@monaco-editor/react', () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string | undefined) => void;
  }) => {
    monacoMockState.onChange = onChange;
    return <textarea aria-label="code editor" value={value} readOnly />;
  },
}));

vi.mock('../../services/projectFileService', () => ({
  writeProjectFile: writeProjectFileMock,
}));

function resetEditorStore() {
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
}

async function resolveWrite(index: number) {
  const pending = pendingWrites[index];
  if (!pending) {
    throw new Error(`No pending write at index ${index}`);
  }

  await act(async () => {
    if (!pending.options?.shouldCommit || pending.options.shouldCommit()) {
      useEditorStore.getState().setFileContent(pending.path, pending.content);
    }
    pending.resolve();
  });
}

describe('CodeEditor', () => {
  beforeEach(() => {
    pendingWrites.length = 0;
    writeProjectFileMock.mockReset();
    writeProjectFileMock.mockImplementation((path: string, content: string, options?: WriteOptions) => (
      new Promise<void>((resolve, reject) => {
        pendingWrites.push({ path, content, options, resolve, reject });
      })
    ));
    resetEditorStore();
  });

  it('serializes rapid edits and commits only the latest saved content', async () => {
    render(<CodeEditor />);

    await act(async () => {});

    const onChange = monacoMockState.onChange;
    if (!onChange) {
      throw new Error('Monaco onChange was not captured');
    }

    act(() => {
      onChange('initial content');
    });
    expect(writeProjectFileMock).not.toHaveBeenCalled();

    act(() => {
      onChange('older content');
      onChange('newer content');
    });

    await waitFor(() => {
      expect(writeProjectFileMock).toHaveBeenCalledTimes(1);
    });
    expect(pendingWrites.map((write) => write.content)).toEqual(['older content']);

    await resolveWrite(0);

    expect(useEditorStore.getState().files['src/app.ts']).toBe('initial content');
    expect(screen.getByLabelText('code editor')).toHaveValue('initial content');

    await waitFor(() => {
      expect(writeProjectFileMock).toHaveBeenCalledTimes(2);
    });
    expect(pendingWrites.map((write) => write.content)).toEqual(['older content', 'newer content']);

    await resolveWrite(1);

    expect(useEditorStore.getState().files['src/app.ts']).toBe('newer content');
    expect(screen.getByLabelText('code editor')).toHaveValue('newer content');
  });
});
