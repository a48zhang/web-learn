import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalRecoverySnapshot, parseLocalRecoverySnapshot, useEditorStore } from './useEditorStore';

const getPresignMock = vi.hoisted(() => vi.fn());
const createTarballMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

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

describe('useEditorStore.saveToOSS', () => {
  beforeEach(() => {
    useEditorStore.getState().loadSnapshot({
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
});
