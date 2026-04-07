import { useEffect, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Topic, AgentFileOperation } from '@web-learn/shared';
import { topicApi, topicFileApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import { toast } from '../stores/useToastStore';
import { getApiErrorMessage } from '../utils/errors';
import { LoadingOverlay } from '../components/Loading';
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';
import { getBaseBreadcrumbs } from '../utils/breadcrumbs';
import TopBar from '../components/editor/TopBar';
import { EditorPanelGroup } from '../components/editor/ResizablePanel';
import FileTree from '../components/editor/FileTree';
import CodeEditor from '../components/editor/CodeEditor';
import AgentChat from '../components/editor/AgentChat';
import PreviewPanel from '../components/editor/PreviewPanel';
import { useWebContainer } from '../hooks/useWebContainer';
import { useEditorStore } from '../stores/useEditorStore';
import { useChatStore } from '../stores/useChatStore';

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
    writeFile: wcWriteFile,
    deleteFile: deleteFileWC,
  } = useWebContainer();

  const { setFileContent, openFile, getAllFiles, loadSnapshot, deleteFile } = useEditorStore();
  const { setMessages } = useChatStore();

  const canEdit = user?.role === 'teacher' && topic?.createdBy === user.id;

  // Load topic and restore snapshot
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const topicData = await topicApi.getById(id);
        setTopic(topicData);

        // Try to restore files from snapshot
        const snapshot = await topicFileApi.loadSnapshot(id);
        if (snapshot && Object.keys(snapshot).length > 0) {
          loadSnapshot(snapshot);
        }
        if (topicData.chatHistory && Array.isArray(topicData.chatHistory)) {
          setMessages(topicData.chatHistory);
        }

        setMeta({
          pageTitle: `编辑：${topicData.title}`,
          breadcrumbSegments: [
            ...getBaseBreadcrumbs(),
            { label: topicData.title, to: `/topics/${topicData.id}` },
            { label: '编辑' },
          ],
          sideNavSlot: null,
        });
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, '加载编辑器失败'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, setMeta, loadSnapshot, setMessages]);

  // Initialize WebContainer once topic is loaded
  useEffect(() => {
    if (!topic || !id) return;
    const currentFiles = getAllFiles();
    initWC(Object.keys(currentFiles).length > 0 ? currentFiles : undefined);
  }, [topic, id, initWC, getAllFiles]);

  // Apply files from Agent response
  const handleApplyFiles = useCallback(async (operations: AgentFileOperation[]) => {
    for (const op of operations) {
      if (op.action === 'create' || op.action === 'update') {
        if (op.content !== undefined) {
          setFileContent(op.path, op.content);
          await wcWriteFile(op.path, op.content);
        }
      }
    }
    toast.success(`已应用 ${operations.length} 个文件更改`);
  }, [setFileContent, wcWriteFile]);

  const handleOpenFile = useCallback((path: string) => {
    openFile(path);
    setShowEditor(true);
  }, [openFile]);

  const handleCloseEditor = useCallback(() => {
    setShowEditor(false);
  }, []);

  const handleRefreshPreview = useCallback(() => {
    setPreviewReloadKey((prev) => prev + 1);
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
    <div className="h-screen flex flex-col bg-zinc-900">
      {/* Top Bar */}
      <TopBar onRefreshPreview={handleRefreshPreview} />

      {/* Main Editor Area */}
      <div className="flex-1 overflow-hidden">
        <EditorPanelGroup
          panels={[
            {
              id: 'file-tree',
              minSize: 15,
              defaultSize: 18,
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
              defaultSize: 28,
              collapsible: true,
              header: 'Agent 对话',
              content: <AgentChat onApplyFiles={handleApplyFiles} />,
            },
            {
              id: 'preview',
              minSize: 30,
              collapsible: false,
              header: '应用预览',
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
    </div>
  );
}

export default WebsiteEditorPage;
