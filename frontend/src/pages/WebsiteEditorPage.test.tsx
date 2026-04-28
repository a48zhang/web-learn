import { act, render, waitFor } from '@testing-library/react';
import { useEffect, useState, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WebsiteEditorPage from './WebsiteEditorPage';

const getByIdMock = vi.hoisted(() => vi.fn());
const getPresignMock = vi.hoisted(() => vi.fn());
const extractTarballMock = vi.hoisted(() => vi.fn());
const setMetaMock = vi.hoisted(() => vi.fn());
const loadSnapshotMock = vi.hoisted(() => vi.fn());
const saveToOSSMock = vi.hoisted(() => vi.fn());
const getLocalRecoverySnapshotMock = vi.hoisted(() => vi.fn());
const getAllFilesMock = vi.hoisted(() => vi.fn());
const openFileMock = vi.hoisted(() => vi.fn());
const deleteFileMock = vi.hoisted(() => vi.fn());
const bootWebContainerMock = vi.hoisted(() => vi.fn());
const initWebContainerMock = vi.hoisted(() => vi.fn());
const initProjectWebContainerMock = vi.hoisted(() => vi.fn());
const wcResetProjectMock = vi.hoisted(() => vi.fn());
const useAutoSaveMock = vi.hoisted(() => vi.fn());
const useAuthStoreMock = vi.hoisted(() => vi.fn());
const useWebContainerMock = vi.hoisted(() => vi.fn());
const agentChatContentMock = vi.hoisted(() => vi.fn());
const locationProbeMock = vi.hoisted(() => vi.fn());
const previewPanelMock = vi.hoisted(() => vi.fn());

const mockReactSeed = vi.hoisted(() =>
  Object.freeze({
    'package.json': '{}',
    'src/App.tsx': 'export default function App() {}',
  })
);

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
  getLocalRecoverySnapshot: getLocalRecoverySnapshotMock,
  useEditorStore: () => ({
    openFile: openFileMock,
    getAllFiles: getAllFilesMock,
    loadSnapshot: loadSnapshotMock,
    deleteFile: deleteFileMock,
    saveToOSS: saveToOSSMock,
  }),
}));

vi.mock('../templates/reactSeed', () => ({
  reactSeed: mockReactSeed,
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
  EditorPanelGroup: ({
    panels,
  }: {
    panels: Array<{ id: string; content?: ReactNode }>;
  }) => (
    <div data-testid="panel-group">
      {panels.map((panel) => (
        <div key={panel.id} data-panel-id={panel.id}>
          {panel.content}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../components/editor/FileTree', () => ({
  default: () => null,
}));

vi.mock('../components/editor/CodeEditor', () => ({
  default: () => null,
}));

vi.mock('../components/AgentChatContent', () => ({
  default: (props: unknown) => {
    agentChatContentMock(props);
    return null;
  },
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
  PreviewPanel: (props: unknown) => {
    previewPanelMock(props);
    return null;
  },
}));

function LocationStateProbe() {
  const location = useLocation();
  locationProbeMock(location.state);
  return null;
}

let navigateFromTest: ((path: string) => void) | null = null;

function NavigationProbe() {
  const navigate = useNavigate();
  useEffect(() => {
    navigateFromTest = (path: string) => navigate(path);
    return () => {
      navigateFromTest = null;
    };
  }, [navigate]);
  return null;
}

describe('WebsiteEditorPage', () => {
  beforeEach(() => {
    getByIdMock.mockReset();
    getPresignMock.mockReset();
    extractTarballMock.mockReset();
    setMetaMock.mockReset();
    loadSnapshotMock.mockReset();
    saveToOSSMock.mockReset().mockResolvedValue(undefined);
    getLocalRecoverySnapshotMock.mockReset();
    getAllFilesMock.mockReset();
    openFileMock.mockReset();
    deleteFileMock.mockReset();
    bootWebContainerMock.mockReset();
    initWebContainerMock.mockReset();
    initProjectWebContainerMock.mockReset();
    wcResetProjectMock.mockReset();
    useAutoSaveMock.mockReset();
    useAuthStoreMock.mockReset();
    useWebContainerMock.mockReset();
    agentChatContentMock.mockReset();
    locationProbeMock.mockReset();
    previewPanelMock.mockReset();
    navigateFromTest = null;

    getAllFilesMock.mockReturnValue({});
    useAutoSaveMock.mockReturnValue({ save: vi.fn() });
    useAuthStoreMock.mockReturnValue({ user: { id: 1, role: 'admin' } });
    useWebContainerMock.mockReturnValue({
      isReady: true,
      previewUrl: null,
      error: null,
      init: initWebContainerMock,
      initProject: initProjectWebContainerMock,
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

  it('passes dashboard prompt state into the agent and clears router state after consumption', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 'topic-1',
      title: '专题',
      createdBy: '1',
      editors: [],
    });
    getPresignMock.mockRejectedValueOnce(new Error('presign failed'));

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/topics/topic-1/edit', state: { initialBuildPrompt: '做一个物理专题' } },
        ]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <LocationStateProbe />
        <Routes>
          <Route path="/topics/:id/edit" element={<WebsiteEditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(agentChatContentMock).toHaveBeenCalled();
    });

    expect(agentChatContentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        topicId: 'topic-1',
        agentType: 'building',
        initialPrompt: '做一个物理专题',
      })
    );

    const lastCall = agentChatContentMock.mock.calls.at(-1)?.[0] as
      | { onInitialPromptConsumed?: () => void }
      | undefined;

    expect(lastCall?.onInitialPromptConsumed).toEqual(expect.any(Function));
    await act(async () => {
      lastCall?.onInitialPromptConsumed?.();
    });

    await waitFor(() => {
      expect(locationProbeMock).toHaveBeenLastCalledWith(null);
    });
  });

  it('seeds with reactSeed when OSS download fails and no local recovery snapshot exists', async () => {
    let editorFiles: Record<string, string> = {};
    getByIdMock.mockResolvedValueOnce({
      id: 'topic-seed',
      title: 'New Topic',
      createdBy: '1',
      editors: [],
    });
    getPresignMock.mockRejectedValueOnce(new Error('presign failed'));
    getLocalRecoverySnapshotMock.mockReturnValueOnce(undefined);
    saveToOSSMock.mockResolvedValueOnce(undefined);
    loadSnapshotMock.mockImplementation((files: Record<string, string>) => {
      editorFiles = files;
    });
    getAllFilesMock.mockImplementation(() => editorFiles);

    render(
      <MemoryRouter
        initialEntries={['/topics/topic-seed/edit']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/topics/:id/edit" element={<WebsiteEditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(loadSnapshotMock).toHaveBeenCalledWith(mockReactSeed);
    });

    await waitFor(() => {
      expect(saveToOSSMock).toHaveBeenCalledWith('topic-seed', 'Initial project scaffold', {
        force: true,
      });
    });
    expect(initProjectWebContainerMock).toHaveBeenCalledWith('topic-seed', mockReactSeed);
    expect(initProjectWebContainerMock.mock.invocationCallOrder[0]).toBeLessThan(
      saveToOSSMock.mock.invocationCallOrder[0]
    );
  });

  it('skips seed when OSS files exist', async () => {
    const ossFiles = { 'src/existing.ts': 'content' };
    getByIdMock.mockResolvedValueOnce({
      id: 'topic-oss',
      title: 'Existing Topic',
      createdBy: '1',
      editors: [],
    });
    getPresignMock.mockResolvedValueOnce({ url: 'https://example.com/download.tgz' });
    extractTarballMock.mockResolvedValueOnce(ossFiles);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response);

    render(
      <MemoryRouter
        initialEntries={['/topics/topic-oss/edit']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/topics/:id/edit" element={<WebsiteEditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(loadSnapshotMock).toHaveBeenCalledWith(ossFiles);
    });

    expect(loadSnapshotMock).not.toHaveBeenCalledWith(mockReactSeed);
    expect(saveToOSSMock).not.toHaveBeenCalled();
  });

  it('skips seed when local recovery snapshot exists', async () => {
    const localFiles = { 'src/local.ts': 'content' };
    getByIdMock.mockResolvedValueOnce({
      id: 'topic-local',
      title: 'Local Topic',
      createdBy: '1',
      editors: [],
    });
    getPresignMock.mockRejectedValueOnce(new Error('presign failed'));
    getLocalRecoverySnapshotMock.mockReturnValueOnce({
      files: localFiles,
      timestamp: 123,
      source: 'auto',
    });

    render(
      <MemoryRouter
        initialEntries={['/topics/topic-local/edit']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/topics/:id/edit" element={<WebsiteEditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(loadSnapshotMock).toHaveBeenCalledWith(localFiles);
    });

    expect(loadSnapshotMock).not.toHaveBeenCalledWith(mockReactSeed);
    expect(saveToOSSMock).not.toHaveBeenCalled();
  });

  it('passes initialBuildPrompt to AgentChatContent after seed bootstrap', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 'topic-seed-prompt',
      title: 'Seed Prompt Topic',
      createdBy: '1',
      editors: [],
    });
    getPresignMock.mockRejectedValueOnce(new Error('presign failed'));
    getLocalRecoverySnapshotMock.mockReturnValueOnce(undefined);
    saveToOSSMock.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/topics/topic-seed-prompt/edit',
            state: { initialBuildPrompt: 'build a portfolio site' },
          },
        ]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/topics/:id/edit" element={<WebsiteEditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify seed was applied
    await waitFor(() => {
      expect(loadSnapshotMock).toHaveBeenCalledWith(mockReactSeed);
    });

    // Verify the prompt still reaches AgentChatContent in the seed bootstrap scenario
    await waitFor(() => {
      expect(agentChatContentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          topicId: 'topic-seed-prompt',
          agentType: 'building',
          initialPrompt: 'build a portfolio site',
        })
      );
    });
  });

  it('resets the WebContainer project and preview when switching topics', async () => {
    const topicAFiles = { 'src/A.ts': 'export const a = 1;' };
    const topicBFiles = { 'src/B.ts': 'export const b = 2;' };
    let editorFiles: Record<string, string> = {};

    getByIdMock.mockImplementation(async (topicId: string) => ({
      id: topicId,
      title: topicId,
      createdBy: '1',
      editors: [],
    }));
    getPresignMock.mockRejectedValue(new Error('presign failed'));
    getLocalRecoverySnapshotMock.mockImplementation((topicId: string) => ({
      files: topicId === 'topic-a' ? topicAFiles : topicBFiles,
      timestamp: 123,
      source: 'auto',
    }));
    loadSnapshotMock.mockImplementation((files: Record<string, string>) => {
      editorFiles = files;
    });
    getAllFilesMock.mockImplementation(() => editorFiles);
    useWebContainerMock.mockImplementation(() => {
      const [previewUrl, setPreviewUrl] = useState<string | null>(null);

      return {
        isReady: true,
        previewUrl,
        error: null,
        init: initWebContainerMock,
        initProject: (topicId: string, files: Record<string, string>) => {
          initProjectWebContainerMock(topicId, files);
          wcResetProjectMock(files);
          setPreviewUrl(topicId === 'topic-a' ? 'http://topic-a.test' : null);
        },
        deleteFile: deleteFileMock,
      };
    });

    render(
      <MemoryRouter
        initialEntries={['/topics/topic-a/edit']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <NavigationProbe />
        <Routes>
          <Route path="/topics/:id/edit" element={<WebsiteEditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(wcResetProjectMock).toHaveBeenCalledWith(topicAFiles);
    });
    await waitFor(() => {
      expect(previewPanelMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ previewUrl: 'http://topic-a.test' })
      );
    });

    await act(async () => {
      navigateFromTest?.('/topics/topic-b/edit');
    });

    await waitFor(() => {
      expect(wcResetProjectMock).toHaveBeenCalledWith(topicBFiles);
    });

    const lastResetFiles = wcResetProjectMock.mock.calls.at(-1)?.[0];
    expect(lastResetFiles).toEqual(topicBFiles);
    expect(lastResetFiles).not.toHaveProperty('src/A.ts');
    expect(initProjectWebContainerMock.mock.calls).not.toContainEqual([
      'topic-b',
      expect.objectContaining({ 'src/A.ts': topicAFiles['src/A.ts'] }),
    ]);
    await waitFor(() => {
      expect(previewPanelMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ previewUrl: null })
      );
    });
  });
});
