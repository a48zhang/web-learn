import { useEffect, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
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
import CodeEditor from '../components/editor/CodeEditor';
import AgentChatContent from '../components/AgentChatContent';
import AgentPanelHeaderRight from '../components/editor/AgentPanelHeaderRight';
import TerminalPanel from '../components/TerminalPanel';
import TerminalToggle from '../components/TerminalToggle';
import PreviewPanel from '../components/editor/PreviewPanel';
import PreviewPanelHeaderRight from '../components/editor/PreviewPanelHeaderRight';
import { bootWebContainer, useWebContainer } from '../hooks/useWebContainer';
import { useAutoSave } from '../hooks/useAutoSave';
import { useEditorStore } from '../stores/useEditorStore';

function WebsiteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { setMeta } = useLayoutMeta();
  const { user } = useAuthStore();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [previewReloadKey, setPreviewReloadKey] = useState(0);

  const {
    isReady,
    previewUrl,
    error: wcError,
    init: initWC,
    deleteFile: deleteFileWC,
  } = useWebContainer();

  const { openFile, getAllFiles, loadSnapshot, deleteFile } = useEditorStore();
  const { save: autoSave } = useAutoSave(id ?? '');

  const handleRefreshPreview = useCallback(() => {
    setPreviewReloadKey((prev) => prev + 1);
  }, []);

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
            if (Object.keys(files).length > 0) {
              loadSnapshot(files);
              loaded = true;
            }
          } else {
            console.warn('[OSS download] Response not OK:', response.status, response.statusText);
          }
        } catch (ossError) {
          console.error('[OSS download] Failed to load files from OSS:', ossError);
        }

        // Fallback to localStorage cache
        if (!loaded) {
          const raw = localStorage.getItem(`snapshot-${id}`);
          if (raw) {
            const snapshot = JSON.parse(raw);
            if (snapshot && Object.keys(snapshot).length > 0) {
              loadSnapshot(snapshot);
              console.log('[localStorage] Loaded snapshot from cache');
            } else {
              console.warn('[localStorage] Cache is empty — editor will start with no files');
            }
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
    setShowEditor(true);
  }, [openFile]);

  const handleCloseEditor = useCallback(() => {
    setShowEditor(false);
  }, []);

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
    <div className="min-h-0 h-full flex flex-col bg-[#1e1e1e]">
      <div className="flex-1 overflow-hidden">
        <EditorPanelGroup
          panels={[
            {
              id: 'file-tree',
              minSize: 15,
              defaultSize: 20,
              collapsible: true,
              header: (
                <div className="flex items-center justify-between w-full">
                  <span>{showEditor ? '代码编辑器' : '文件树'}</span>
                  {showEditor && (
                    <button
                      onClick={handleCloseEditor}
                      className="text-zinc-400 hover:text-white text-xs"
                    >
                      返回文件树
                    </button>
                  )}
                </div>
              ),
              content: showEditor ? <CodeEditor /> : <FileTree onOpenFile={handleOpenFile} onDeleteFile={handleDeleteFile} />,
            },
            {
              id: 'agent-chat',
              minSize: 20,
              defaultSize: 25,
              collapsible: true,
              header: 'Agent 对话',
              headerRight: <AgentPanelHeaderRight />,
              content: <AgentChatContent topicId={id ?? ''} agentType="building" />,
            },
            {
              id: 'preview',
              minSize: 30,
              defaultSize: 55,
              collapsible: false,
              header: '应用预览',
              headerRight: <PreviewPanelHeaderRight previewUrl={previewUrl} onRefresh={handleRefreshPreview} />,
              content: (
                <PreviewPanel
                  previewUrl={previewUrl}
                  isReady={isReady}
                  error={wcError}
                  onRefresh={handleRefreshPreview}
                  externalReloadKey={previewReloadKey}
                />
              ),
            },
          ]}
        />
      </div>

      <TerminalToggle />
      <TerminalPanel />
    </div>
  );
}

export default WebsiteEditorPage;
