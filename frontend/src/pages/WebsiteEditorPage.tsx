import { useEffect, useCallback, useState, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiFolder } from 'react-icons/fi';
// removed ImperativePanelHandle due to version mismatch using any
import type { Topic } from '@web-learn/shared';
import { topicApi, topicGitApi } from '../services/api';
import { extractTarball } from '../utils/tarUtils';
import { useAuthStore } from '../stores/useAuthStore';
import { toast } from '../stores/useToastStore';
import { getApiErrorMessage } from '../utils/errors';
import { LoadingOverlay } from '../components/Loading';
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';
import { getBaseBreadcrumbs } from '../utils/breadcrumbs';
import EditorActions from '../components/editor/EditorActions';
import { EditorPanelGroup } from '../components/editor/ResizablePanel';
import FileTree from '../components/editor/FileTree';
import AgentChatContent from '../components/AgentChatContent';
import AgentPanelHeaderRight from '../components/editor/AgentPanelHeaderRight';
import PreviewPanelHeaderRight from '../components/editor/PreviewPanelHeaderRight';
import TerminalPanel from '../components/TerminalPanel';
import TerminalToggle from '../components/TerminalToggle';
// 替换为新的预览面板
import { PreviewPanel } from '../components/preview/PreviewPanel';
import { bootWebContainer, useWebContainer } from '../hooks/useWebContainer';
import { useAutoSave } from '../hooks/useAutoSave';
import { getLocalRecoverySnapshot, useEditorStore } from '../stores/useEditorStore';

type EditorLocationState = {
  initialBuildPrompt?: unknown;
};

function WebsiteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { setMeta } = useLayoutMeta();
  const { user } = useAuthStore();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewReloadKey, setPreviewReloadKey] = useState(0);

  const fileTreePanelRef = useRef<any>(null);
  const [isFileTreeCollapsed, setIsFileTreeCollapsed] = useState(true);

  const toggleFileTree = () => {
    const panel = fileTreePanelRef.current;
    if (panel) {
      if (isFileTreeCollapsed) {
        panel.expand();
      } else {
        panel.collapse();
      }
    }
  };

  const {
    isReady,
    previewUrl,
    error: wcError,
    init: initWC,
    deleteFile: deleteFileWC,
  } = useWebContainer();

  const { openFile, getAllFiles, loadSnapshot, deleteFile } = useEditorStore();
  const { save: autoSave } = useAutoSave(id ?? '');
  const locationState = location.state as EditorLocationState | null;
  const initialBuildPrompt =
    typeof locationState?.initialBuildPrompt === 'string' ? locationState.initialBuildPrompt : undefined;

  const handleRefreshPreview = useCallback(() => {
    setPreviewReloadKey((prev) => prev + 1);
  }, []);

  const handleInitialPromptConsumed = useCallback(() => {
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, navigate]);

  // Eager boot — starts WebContainer immediately, independent of topic data
  useEffect(() => {
    bootWebContainer();
  }, []);

  // Editors-based permission: admin, creator, or editor
  const canEdit =
    user?.role === 'admin' ||
    (topic && user?.id && (topic.createdBy === user.id.toString() || topic.editors?.includes(user.id.toString())));

  // Load topic — try OSS first, then localStorage cache fallback
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const topicData = await topicApi.getById(id);
        setTopic(topicData);

        // Try loading from OSS first
        let loaded = false;
        try {
          const { url } = await topicGitApi.getPresign(id, 'download');
          const response = await fetch(url);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const files = await extractTarball(buffer);
            loadSnapshot(files);
            loaded = true;
          } else {
            console.warn('[OSS download] Response not OK:', response.status, response.statusText);
          }
        } catch (ossError) {
          console.error('[OSS download] Failed to load files from OSS:', ossError);
        }

        // Fallback to localStorage cache
        if (!loaded) {
          const snapshot = getLocalRecoverySnapshot(id);
          if (snapshot) {
            loadSnapshot(snapshot.files);
            console.log(`[localStorage] Loaded ${snapshot.source} recovery snapshot from cache`);
          } else {
            console.warn('[localStorage] No cached snapshot found — editor will start with no files');
          }
        }

        setMeta({
          pageTitle: `编辑：${topicData.title}`,
          breadcrumbSegments: [
            ...getBaseBreadcrumbs(),
            { label: topicData.title, to: `/topics/${topicData.id}` },
            { label: '编辑' },
          ],
          sideNavSlot: null,
          topBarRightSlot: <EditorActions topicId={id} onRefreshPreview={handleRefreshPreview} onSave={autoSave} />,
        });
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, '加载编辑器失败'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Cleanup topBarRightSlot when component unmounts
    return () => {
      setMeta({ topBarRightSlot: undefined });
    };
  }, [id, setMeta, loadSnapshot, handleRefreshPreview]);

  // Initialize WebContainer once topic is loaded
  useEffect(() => {
    if (!topic || !id) return;
    const currentFiles = getAllFiles();
    initWC(Object.keys(currentFiles).length > 0 ? currentFiles : undefined);
  }, [topic, id, initWC, getAllFiles]);

  const handleOpenFile = useCallback((path: string) => {
    openFile(path);
  }, [openFile]);

  const handleDeleteFile = useCallback(async (path: string) => {
    try {
      await deleteFileWC(path);
      deleteFile(path);
    } catch (error) {
      console.error('File deletion failed:', error);
      toast.error('删除文件失败，请稍后重试');
    }
  }, [deleteFile, deleteFileWC]);

  if (loading) {
    return <LoadingOverlay message="加载编辑器中..." />;
  }

  if (error || !topic) {
    return (
      <div className="px-4 py-6">
        <div className="bg-white rounded-lg shadow p-6 text-gray-700">{error || '专题不存在'}</div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="px-4 py-6">
        <div className="bg-white rounded-lg shadow p-6 text-gray-700">你没有编辑该专题的权限</div>
      </div>
    );
  }

  return (
    <div className="min-h-0 h-full flex bg-white dark:bg-[#1e1e1e]">
      {/* NEW: Left Activity Bar */}
      <div className="w-12 shrink-0 bg-gray-50 dark:bg-[#333333] flex flex-col items-center py-3 z-10 border-r border-gray-200 dark:border-[#2b2b2b]">
        <button
          onClick={toggleFileTree}
          className={`p-2 rounded-md transition-colors ${isFileTreeCollapsed ? 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#2b2b2b]' : 'text-blue-600 dark:text-white bg-blue-50 dark:bg-[#2b2b2b]'}`}
          title="文件资源管理器"
        >
          <FiFolder size={22} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden min-h-0">
          <EditorPanelGroup
            panels={[
              {
                id: 'file-tree',
                minSize: '15%',
                maxSize: '40%',
                defaultSize: '0%',
                collapsible: true,
                onResize: (size) => setIsFileTreeCollapsed(size < 5),
                panelRef: fileTreePanelRef,
                header: (
                  <div className="flex items-center justify-between w-full">
                    <span>文件资源管理器</span>
                  </div>
                ),
                content: <FileTree onOpenFile={handleOpenFile} onDeleteFile={handleDeleteFile} />,
              },
              {
                id: 'agent-chat',
                minSize: '20%',
                maxSize: '60%',
                defaultSize: '45%',
                collapsible: true,
                header: 'Agent 对话',
                headerRight: <AgentPanelHeaderRight />,
                content: (
                  <AgentChatContent
                    topicId={id ?? ''}
                    agentType="building"
                    initialPrompt={initialBuildPrompt}
                    onInitialPromptConsumed={handleInitialPromptConsumed}
                  />
                ),
              },
              {
                id: 'preview',
                minSize: '20%',
                maxSize: '80%',
                defaultSize: '55%',
                collapsible: true,
                header: '工作区',
                headerRight: <PreviewPanelHeaderRight previewUrl={previewUrl} onRefresh={handleRefreshPreview} />,
                content: (
                  <PreviewPanel
                    previewUrl={previewUrl}
                    isReady={isReady}
                    error={wcError}
                    onRefresh={handleRefreshPreview}
                    reloadKey={previewReloadKey}
                  />
                ),
              },
            ]}
          />
        </div>

        <TerminalToggle />
        <TerminalPanel />
      </div>
    </div>
  );
}

export default WebsiteEditorPage;
