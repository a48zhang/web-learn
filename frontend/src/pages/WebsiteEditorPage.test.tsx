import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WebsiteEditorPage from './WebsiteEditorPage';

const getByIdMock = vi.hoisted(() => vi.fn());
const getPresignMock = vi.hoisted(() => vi.fn());
const extractTarballMock = vi.hoisted(() => vi.fn());
const setMetaMock = vi.hoisted(() => vi.fn());
const loadSnapshotMock = vi.hoisted(() => vi.fn());
const getAllFilesMock = vi.hoisted(() => vi.fn());
const openFileMock = vi.hoisted(() => vi.fn());
const deleteFileMock = vi.hoisted(() => vi.fn());
const bootWebContainerMock = vi.hoisted(() => vi.fn());
const initWebContainerMock = vi.hoisted(() => vi.fn());
const useAutoSaveMock = vi.hoisted(() => vi.fn());
const useAuthStoreMock = vi.hoisted(() => vi.fn());
const useWebContainerMock = vi.hoisted(() => vi.fn());

vi.mock('../services/api', () => ({
  topicApi: {
    getById: getByIdMock,
  },
  topicGitApi: {
    getPresign: getPresignMock,
  },
}));

vi.mock('../utils/tarUtils', () => ({
  extractTarball: extractTarballMock,
}));

vi.mock('../components/layout/LayoutMetaContext', () => ({
  useLayoutMeta: () => ({ setMeta: setMetaMock }),
}));

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: useAuthStoreMock,
}));

vi.mock('../stores/useEditorStore', () => ({
  getLocalRecoverySnapshot: vi.fn(),
  useEditorStore: () => ({
    openFile: openFileMock,
    getAllFiles: getAllFilesMock,
    loadSnapshot: loadSnapshotMock,
    deleteFile: deleteFileMock,
  }),
}));

vi.mock('../hooks/useWebContainer', () => ({
  bootWebContainer: bootWebContainerMock,
  useWebContainer: useWebContainerMock,
}));

vi.mock('../hooks/useAutoSave', () => ({
  useAutoSave: useAutoSaveMock,
}));

vi.mock('../components/Loading', () => ({
  LoadingOverlay: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock('../components/layout/LayoutMetaContext', () => ({
  useLayoutMeta: () => ({ setMeta: setMetaMock }),
}));

vi.mock('../components/editor/EditorActions', () => ({
  default: () => null,
}));

vi.mock('../components/editor/ResizablePanel', () => ({
  EditorPanelGroup: ({ panels }: { panels: Array<{ id: string }> }) => (
    <div data-testid="panel-group">{panels.map((panel) => panel.id).join(',')}</div>
  ),
}));

vi.mock('../components/editor/FileTree', () => ({
  default: () => null,
}));

vi.mock('../components/editor/CodeEditor', () => ({
  default: () => null,
}));

vi.mock('../components/AgentChatContent', () => ({
  default: () => null,
}));

vi.mock('../components/editor/AgentPanelHeaderRight', () => ({
  default: () => null,
}));

vi.mock('../components/editor/PreviewPanelHeaderRight', () => ({
  default: () => null,
}));

vi.mock('../components/TerminalPanel', () => ({
  default: () => null,
}));

vi.mock('../components/TerminalToggle', () => ({
  default: () => null,
}));

vi.mock('../components/preview/PreviewPanel', () => ({
  PreviewPanel: () => null,
}));

describe('WebsiteEditorPage', () => {
  beforeEach(() => {
    getByIdMock.mockReset();
    getPresignMock.mockReset();
    extractTarballMock.mockReset();
    setMetaMock.mockReset();
    loadSnapshotMock.mockReset();
    getAllFilesMock.mockReset();
    openFileMock.mockReset();
    deleteFileMock.mockReset();
    bootWebContainerMock.mockReset();
    initWebContainerMock.mockReset();
    useAutoSaveMock.mockReset();
    useAuthStoreMock.mockReset();
    useWebContainerMock.mockReset();

    getAllFilesMock.mockReturnValue({});
    useAutoSaveMock.mockReturnValue({ save: vi.fn() });
    useAuthStoreMock.mockReturnValue({ user: { id: 1, role: 'admin' } });
    useWebContainerMock.mockReturnValue({
      isReady: true,
      previewUrl: null,
      error: null,
      init: initWebContainerMock,
      deleteFile: deleteFileMock,
    });
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    });
  });

  it('loads an empty OSS snapshot without falling back to local cache', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 'topic-1',
      title: '专题',
      createdBy: '1',
      editors: [],
    });
    getPresignMock.mockResolvedValueOnce({ url: 'https://example.com/download.tgz' });
    extractTarballMock.mockResolvedValueOnce({});
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response);

    render(
      <MemoryRouter initialEntries={['/topics/topic-1/edit']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/topics/:id/edit" element={<WebsiteEditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(loadSnapshotMock).toHaveBeenCalledWith({});
    });

    expect(localStorage.getItem).not.toHaveBeenCalled();
  });
});
