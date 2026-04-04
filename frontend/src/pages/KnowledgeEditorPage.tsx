import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import type { Topic, TopicPage, TopicPageTreeNode } from '@web-learn/shared';
import { topicApi, pageApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import { toast } from '../stores/useToastStore';
import PageTreeEditor from '../components/PageTreeEditor';
import AIChatSidebar from '../components/AIChatSidebar';
import { getApiErrorMessage } from '../utils/errors';
import { LoadingOverlay } from '../components/Loading';
import { flattenPages, findNode } from '../utils/treeUtils';

function KnowledgeEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [pages, setPages] = useState<TopicPageTreeNode[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<TopicPage | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createParentPageId, setCreateParentPageId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeletePageId, setPendingDeletePageId] = useState<string | null>(null);
  const [switchingPage, setSwitchingPage] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autosaveNotice, setAutosaveNotice] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const latestContentRef = useRef(content);
  const [lastSavedContent, setLastSavedContent] = useState('');

  const canEdit = user?.role === 'teacher' && topic?.createdBy === user.id;

  const refreshPages = useCallback(async (topicId: string, selectedId?: string | null) => {
    const tree = await pageApi.getByTopic(topicId);
    setPages(tree);
    if (tree.length === 0) {
      setSelectedPageId(null);
      setCurrentPage(null);
      setContent('');
      latestContentRef.current = '';
      setLastSavedContent('');
      return;
    }
    const flattened = flattenPages(tree);
    const selected = selectedId ? flattened.find((p) => p.id === selectedId) : null;
    const target = selected || flattened[0];
    setSelectedPageId(target.id);
    const detail = await pageApi.getById(target.id);
    setCurrentPage(detail);
    setContent(detail.content || '');
    latestContentRef.current = detail.content || '';
    setLastSavedContent(detail.content || '');
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const topicData = await topicApi.getById(id);
        if (topicData.type !== 'knowledge') {
          setError('该专题不是知识库类型');
          setLoading(false);
          return;
        }
        setTopic(topicData);
        await refreshPages(id, null);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, '加载编辑器失败'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, refreshPages]);

  const selectedPageTitle = useMemo(() => {
    if (!selectedPageId) return '';
    return findNode(pages, selectedPageId)?.title || '';
  }, [pages, selectedPageId]);

  const handleSelectPage = async (pageId: string) => {
    setSelectedPageId(pageId);
    setSwitchingPage(true);
    try {
      const detail = await pageApi.getById(pageId);
      setCurrentPage(detail);
      setContent(detail.content || '');
      latestContentRef.current = detail.content || '';
      setLastSavedContent(detail.content || '');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '加载页面失败'));
    } finally {
      setSwitchingPage(false);
    }
  };

  const openCreateDialog = (parentPageId?: string | null) => {
    setCreateParentPageId(parentPageId || null);
    setCreateTitle('');
    setCreateDialogOpen(true);
  };

  const handleCreatePage = async () => {
    if (!id || !canEdit || !createTitle.trim()) return;
    try {
      const page = await pageApi.create(id, {
        title: createTitle.trim(),
        content: '',
        parent_page_id: createParentPageId,
      });
      setCreateDialogOpen(false);
      await refreshPages(id, page.id);
      setSelectedPageId(page.id);
      setCurrentPage(page);
      setContent(page.content || '');
      latestContentRef.current = page.content || '';
      setLastSavedContent(page.content || '');
      setAutosaveNotice(null);
      toast.success('页面已创建');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '创建页面失败'));
    }
  };

  const openDeleteDialog = (pageId: string) => {
    setPendingDeletePageId(pageId);
    setDeleteDialogOpen(true);
  };

  const handleDeletePage = async () => {
    if (!id || !canEdit) return;
    if (!pendingDeletePageId) return;
    try {
      await pageApi.delete(pendingDeletePageId);
      setDeleteDialogOpen(false);
      setPendingDeletePageId(null);
      await refreshPages(id, null);
      toast.success('页面已删除');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '删除页面失败'));
    }
  };

  const handleReorder = async () => {
    if (!id || !canEdit) return;
    try {
      const flattened = flattenPages(pages);
      await pageApi.reorder(id, {
        pages: flattened.map((page, index) => ({
          id: page.id,
          order: index,
          parent_page_id: page.parentPageId ?? null,
        })),
      });
      await refreshPages(id, selectedPageId);
      toast.success('页面顺序已更新');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '更新顺序失败'));
    }
  };

  const handleSave = async () => {
    if (!currentPage || !canEdit) return;
    setSaving(true);
    try {
      const updated = await pageApi.update(currentPage.id, { content });
      setCurrentPage(updated);
      setContent(updated.content || '');
      latestContentRef.current = updated.content || '';
      setLastSavedContent(updated.content || '');
      setAutosaveNotice('已手动保存');
      toast.success('保存成功');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    latestContentRef.current = content;
  }, [content]);

  useEffect(() => {
    if (!canEdit || !currentPage) return;
    if (content === lastSavedContent) return;

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(async () => {
      if (!currentPage) return;
      setAutoSaving(true);
      try {
        const updated = await pageApi.update(currentPage.id, { content: latestContentRef.current });
        setCurrentPage(updated);
        setContent(updated.content || '');
        latestContentRef.current = updated.content || '';
        setLastSavedContent(updated.content || '');
        setAutosaveNotice(`自动保存于 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
      } catch (err: unknown) {
        toast.error(getApiErrorMessage(err, '自动保存失败'));
      } finally {
        setAutoSaving(false);
      }
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [canEdit, content, currentPage, lastSavedContent]);

  if (loading) {
    return <LoadingOverlay message="加载编辑器中..." />;
  }

  if (error || !topic) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <Link to="/topics" className="text-blue-600 hover:text-blue-500">
            ← 返回专题列表
          </Link>
          <div className="bg-white rounded-lg shadow p-6 mt-4 text-gray-700">{error || '专题不存在'}</div>
        </div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <Link to={`/topics/${topic.id}`} className="text-blue-600 hover:text-blue-500">
            ← 返回专题
          </Link>
          <div className="bg-white rounded-lg shadow p-6 mt-4 text-gray-700">你没有编辑该专题的权限</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" data-color-mode="light">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-col gap-2">
          <Link to={`/topics/${topic.id}`} className="text-blue-600 hover:text-blue-500">
            ← 返回专题
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">编辑专题：{topic.title}</h1>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <aside className="lg:col-span-1 bg-white rounded-lg shadow p-3 h-[calc(100vh-180px)] overflow-y-auto">
            <PageTreeEditor
              pages={pages}
              selectedPageId={selectedPageId}
              onSelectPage={handleSelectPage}
              onCreatePage={openCreateDialog}
              onDeletePage={openDeleteDialog}
              deletingPageId={pendingDeletePageId}
            />
            <button
              type="button"
              onClick={handleReorder}
              className="mt-3 w-full bg-gray-700 hover:bg-gray-800 text-white rounded px-3 py-1.5 text-sm"
            >
              同步当前顺序
            </button>
          </aside>
          <main className="lg:col-span-3 bg-white rounded-lg shadow p-4 h-[calc(100vh-180px)] overflow-y-auto space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{selectedPageTitle || '未选择页面'}</h2>
              <div className="flex items-center gap-2">
                {switchingPage && <span className="text-xs text-gray-500">页面切换中...</span>}
                {autoSaving && <span className="text-xs text-gray-500">自动保存中...</span>}
                {!autoSaving && autosaveNotice && <span className="text-xs text-gray-500">{autosaveNotice}</span>}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!currentPage || saving || autoSaving}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
            {currentPage ? (
              <MDEditor
                value={content}
                onChange={(next) => setContent(next || '')}
                height={520}
                preview="edit"
                visiableDragbar={false}
              />
            ) : (
              <p className="text-sm text-gray-500">请先创建页面</p>
            )}
          </main>
        </div>
      </div>
      {id && <AIChatSidebar topicId={id} agentType="building" />}
      {createDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">创建页面</h3>
            <input
              type="text"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="请输入页面标题"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateDialogOpen(false)}
                className="px-3 py-1.5 text-sm rounded border border-gray-300"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreatePage}
                disabled={!createTitle.trim()}
                className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">删除页面</h3>
            <p className="text-sm text-gray-600">删除会级联删除子页面，确认继续？</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setPendingDeletePageId(null);
                }}
                className="px-3 py-1.5 text-sm rounded border border-gray-300"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeletePage}
                className="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 text-white"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KnowledgeEditorPage;
