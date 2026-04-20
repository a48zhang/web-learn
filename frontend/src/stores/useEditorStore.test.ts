import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from './useEditorStore';

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
