import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalRecoverySnapshot, parseLocalRecoverySnapshot, useEditorStore } from './useEditorStore';

const getPresignMock = vi.hoisted(() => vi.fn());
const createTarballMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
const wcGetProjectSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock('../agent/webcontainer', () => ({
  wcGetProjectSnapshot: wcGetProjectSnapshotMock,
}));

vi.mock('../services/api', () => ({
  topicGitApi: {
    getPresign: getPresignMock,
  },
}));

vi.mock('../utils/tarUtils', () => ({
  createTarball: createTarballMock,
}));

vi.mock('./useToastStore', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.stubGlobal('fetch', fetchMock);
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
});

function resetEditorStore(files: Record<string, string> = {}) {
  useEditorStore.setState({
    files: {},
    fileTree: [],
    openFiles: [],
    activeFile: null,
    fileRevision: 0,
    lastSavedRevision: 0,
    hasUnsavedChanges: false,
    lastSavedAt: null,
    lastLocalBackupAt: null,
    previewMode: 'page',
  });
  useEditorStore.getState().loadSnapshot(files);
  useEditorStore.setState({
    fileRevision: files && Object.keys(files).length > 0 ? 1 : 0,
    lastSavedRevision: files && Object.keys(files).length > 0 ? 1 : 0,
    hasUnsavedChanges: false,
  });
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useEditorStore project projection', () => {
  beforeEach(() => {
    resetEditorStore({
      'src/App.tsx': 'app',
      'src/lib/util.ts': 'util',
      'README.md': 'readme',
    });
  });

  it('increments fileRevision only when projected file content changes', () => {
    const initialRevision = useEditorStore.getState().fileRevision;

    useEditorStore.getState().setFileContent('src/App.tsx', 'app');
    expect(useEditorStore.getState().fileRevision).toBe(initialRevision);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);

    useEditorStore.getState().setFileContent('src/App.tsx', 'updated');

    expect(useEditorStore.getState().files['src/App.tsx']).toBe('updated');
    expect(useEditorStore.getState().fileRevision).toBe(initialRevision + 1);
    expect(useEditorStore.getState().lastSavedRevision).toBe(initialRevision);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('updates open tabs and active file when deleting a file or directory', () => {
    useEditorStore.getState().openFile('src/App.tsx');
    useEditorStore.getState().openFile('src/lib/util.ts');

    useEditorStore.getState().deleteFile('src/lib');

    expect(useEditorStore.getState().files).toEqual({
      'src/App.tsx': 'app',
      'README.md': 'readme',
    });
    expect(useEditorStore.getState().openFiles).toEqual(['src/App.tsx']);
    expect(useEditorStore.getState().activeFile).toBe('src/App.tsx');

    useEditorStore.getState().deleteFile('src/App.tsx');

    expect(useEditorStore.getState().openFiles).toEqual([]);
    expect(useEditorStore.getState().activeFile).toBeNull();
    expect(useEditorStore.getState().previewMode).toBe('page');
  });

  it('updates projected paths, open tabs, and active file when moving a file or directory', () => {
    useEditorStore.getState().openFile('src/lib/util.ts');

    useEditorStore.getState().renameFile('src/lib', 'src/shared');

    expect(useEditorStore.getState().files).toEqual({
      'src/App.tsx': 'app',
      'src/shared/util.ts': 'util',
      'README.md': 'readme',
    });
    expect(useEditorStore.getState().openFiles).toEqual(['src/shared/util.ts']);
    expect(useEditorStore.getState().activeFile).toBe('src/shared/util.ts');
  });

  it('replaces snapshots, resets dirty state, and aligns saved revision', () => {
    useEditorStore.getState().setFileContent('src/App.tsx', 'dirty');
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);

    useEditorStore.getState().loadSnapshot({ 'src/main.ts': 'main' });

    expect(useEditorStore.getState().files).toEqual({ 'src/main.ts': 'main' });
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
    expect(useEditorStore.getState().lastSavedRevision).toBe(useEditorStore.getState().fileRevision);
    expect(useEditorStore.getState().openFiles).toEqual([]);
    expect(useEditorStore.getState().activeFile).toBeNull();
  });

  it('normalizes and clones replacement snapshots', () => {
    const files = { './src/App.tsx': 'app' };

    useEditorStore.getState().loadSnapshot(files);
    files['./src/App.tsx'] = 'mutated outside store';

    expect(useEditorStore.getState().files).toEqual({ 'src/App.tsx': 'app' });
    expect(useEditorStore.getState().fileTree[0]?.path).toBe('src');
  });

  it('marks the current file revision as saved', () => {
    useEditorStore.getState().setFileContent('src/App.tsx', 'updated');
    const revision = useEditorStore.getState().fileRevision;

    useEditorStore.getState().markSaved();

    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
    expect(useEditorStore.getState().lastSavedRevision).toBe(revision);
    expect(useEditorStore.getState().lastSavedAt).toBeInstanceOf(Date);
  });
});

describe('useEditorStore.saveToOSS', () => {
  beforeEach(() => {
    resetEditorStore({
      'src/index.ts': 'console.log("hello");',
    });
    useEditorStore.setState({
      hasUnsavedChanges: false,
      lastSavedAt: null,
      lastLocalBackupAt: null,
    });

    getPresignMock.mockReset();
    createTarballMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    fetchMock.mockReset();

    wcGetProjectSnapshotMock.mockReset();
    wcGetProjectSnapshotMock.mockImplementation(async () => ({ ...useEditorStore.getState().files }));
    createTarballMock.mockReturnValue(new Uint8Array([1, 2, 3]));
    getPresignMock.mockResolvedValue({ url: 'https://upload.example.com/blob' });
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
  });

  it('uploads even when the dirty flag is already clear if force is set', async () => {
    const result = await useEditorStore.getState().saveToOSS('topic-1', '手动保存', { force: true });

    expect(result).toBe(true);
    expect(getPresignMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('skips upload and returns true when there are no unsaved changes and force is not set', async () => {
    const result = await useEditorStore.getState().saveToOSS('topic-1', '手动保存');

    expect(result).toBe(true);
    expect(getPresignMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('does not call toast.success or toast.error', async () => {
    await useEditorStore.getState().saveToOSS('topic-1', '手动保存', { force: true });

    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('backs up and uploads the same rescan-synchronized snapshot', async () => {
    const setItemMock = vi.mocked(localStorage.setItem);
    setItemMock.mockClear();

    useEditorStore.getState().replaceProjectFiles({
      'src/index.ts': 'console.log("hello");',
      'src/generated.ts': 'export const generated = true;',
    }, { markUnsaved: true });
    const revision = useEditorStore.getState().fileRevision;

    const result = await useEditorStore.getState().saveToOSS('topic-1', undefined);

    expect(result).toBe(true);
    const expectedSnapshot = {
      'src/index.ts': 'console.log("hello");',
      'src/generated.ts': 'export const generated = true;',
    };
    expect(createTarballMock).toHaveBeenCalledWith(expectedSnapshot);
    expect(setItemMock).toHaveBeenCalledWith(
      'local-backup-topic-1',
      expect.any(String),
    );
    const backupPayload = JSON.parse(setItemMock.mock.calls[0][1]);
    expect(backupPayload.files).toEqual(expectedSnapshot);
    expect(useEditorStore.getState().lastSavedRevision).toBe(revision);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
  });

  it('rescans WebContainer before saving files created outside the editor projection', async () => {
    const setItemMock = vi.mocked(localStorage.setItem);
    setItemMock.mockClear();
    wcGetProjectSnapshotMock.mockResolvedValueOnce({
      'src/index.ts': 'console.log("hello");',
      'src/terminal.ts': 'export const terminal = true;',
    });

    const result = await useEditorStore.getState().saveToOSS('topic-1');

    const expectedSnapshot = {
      'src/index.ts': 'console.log("hello");',
      'src/terminal.ts': 'export const terminal = true;',
    };
    expect(result).toBe(true);
    expect(createTarballMock).toHaveBeenCalledWith(expectedSnapshot);
    const backupPayload = JSON.parse(setItemMock.mock.calls[0][1]);
    expect(backupPayload.files).toEqual(expectedSnapshot);
    expect(useEditorStore.getState().files).toEqual(expectedSnapshot);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
  });

  it('does not mark edits made during upload as saved', async () => {
    let resolveFetch: ((value: { ok: boolean; status: number }) => void) | undefined;
    fetchMock.mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve;
    }));

    useEditorStore.getState().replaceProjectFiles({
      'src/index.ts': 'console.log("before upload");',
    }, { markUnsaved: true });
    const uploadedRevision = useEditorStore.getState().fileRevision;

    const savePromise = useEditorStore.getState().saveToOSS('topic-1');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    useEditorStore.getState().setFileContent('src/index.ts', 'console.log("during upload");');
    const latestRevision = useEditorStore.getState().fileRevision;

    resolveFetch?.({ ok: true, status: 200 });
    const result = await savePromise;

    expect(result).toBe(true);
    expect(useEditorStore.getState().lastSavedRevision).toBe(uploadedRevision);
    expect(useEditorStore.getState().fileRevision).toBe(latestRevision);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('returns false for an empty save snapshot', async () => {
    resetEditorStore();

    const result = await useEditorStore.getState().saveToOSS('topic-1', '手动保存', { force: true });

    expect(result).toBe(false);
    expect(createTarballMock).not.toHaveBeenCalled();
    expect(getPresignMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('local recovery snapshots', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    });
  });

  it('parses legacy raw snapshots', () => {
    const snapshot = parseLocalRecoverySnapshot(JSON.stringify({ 'src/app.ts': 'console.log("legacy");' }));

    expect(snapshot).toEqual({
      files: { 'src/app.ts': 'console.log("legacy");' },
      timestamp: 0,
    });
  });

  it('parses structured snapshots with timestamps', () => {
    const snapshot = parseLocalRecoverySnapshot(JSON.stringify({
      files: { 'src/app.ts': 'console.log("structured");' },
      timestamp: 123,
    }));

    expect(snapshot).toEqual({
      files: { 'src/app.ts': 'console.log("structured");' },
      timestamp: 123,
    });
  });

  it('preserves empty structured snapshots', () => {
    const snapshot = parseLocalRecoverySnapshot(JSON.stringify({
      files: {},
      timestamp: 123,
    }));

    expect(snapshot).toEqual({
      files: {},
      timestamp: 123,
    });
  });

  it('falls back to legacy extraction when files is a literal file name', () => {
    const snapshot = parseLocalRecoverySnapshot(JSON.stringify({
      files: 'literal file content',
      'src/app.ts': 'other',
    }));

    expect(snapshot).toEqual({
      files: {
        files: 'literal file content',
        'src/app.ts': 'other',
      },
      timestamp: 0,
    });
  });

  it('prefers the newest local backup over an older snapshot', () => {
    const getItemMock = vi.mocked(localStorage.getItem);
    getItemMock.mockImplementation((key: string) => {
      if (key === 'snapshot-topic-1') {
        return JSON.stringify({
          files: { 'src/app.ts': 'console.log("snapshot");' },
          timestamp: 100,
        });
      }

      if (key === 'local-backup-topic-1') {
        return JSON.stringify({
          files: { 'src/app.ts': 'console.log("backup");' },
          timestamp: 200,
        });
      }

      return null;
    });

    expect(getLocalRecoverySnapshot('topic-1')).toEqual({
      files: { 'src/app.ts': 'console.log("backup");' },
      timestamp: 200,
      source: 'local-backup',
    });
  });

  it('returns a local backup when no snapshot exists', () => {
    const getItemMock = vi.mocked(localStorage.getItem);
    getItemMock.mockImplementation((key: string) => {
      if (key === 'local-backup-topic-1') {
        return JSON.stringify({
          files: { 'src/app.ts': 'console.log("backup only");' },
          timestamp: 200,
        });
      }

      return null;
    });

    expect(getLocalRecoverySnapshot('topic-1')).toEqual({
      files: { 'src/app.ts': 'console.log("backup only");' },
      timestamp: 200,
      source: 'local-backup',
    });
  });
});
