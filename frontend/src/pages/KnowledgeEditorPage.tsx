import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
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
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';
import type { BreadcrumbSegment } from '../components/layout/LayoutMetaContext';
import { getBaseBreadcrumbs } from '../utils/breadcrumbs';

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

  type PreviewMode = 'edit' | 'live' | 'preview';
  const [previewMode, setPreviewMode] = useState<PreviewMode>('edit');

  const { setMeta } = useLayoutMeta();

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

  const handleSelectPage = useCallback(async (pageId: string) => {
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
  }, []);

  const openCreateDialog = useCallback((parentPageId?: string | null) => {
    setCreateParentPageId(parentPageId || null);
    setCreateTitle('');
    setCreateDialogOpen(true);
  }, []);

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

  const openDeleteDialog = useCallback((pageId: string) => {
    setPendingDeletePageId(pageId);
    setDeleteDialogOpen(true);
  }, []);

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

  const handleReorder = useCallback(async () => {
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
  }, [id, canEdit, pages, selectedPageId, refreshPages]);

  const handleSave = useCallback(async () => {
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
  }, [currentPage, canEdit, content]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (currentPage && canEdit && !saving && !autoSaving && content !== lastSavedContent) {
          handleSave();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setPreviewMode(prev => prev === 'edit' ? 'preview' : 'edit');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, canEdit, saving, autoSaving, content, lastSavedContent, handleSave]);

  useEffect(() => {
    const segments: BreadcrumbSegment[] = [
      ...getBaseBreadcrumbs(),
      ...(topic ? [{ label: topic.title, to: `/topics/${topic.id}` }] : [{ label: '编辑中...' }]),
      { label: '编辑' },
    ];
    setMeta({
      pageTitle: topic ? `编辑：${topic.title}` : '编辑中...',
      breadcrumbSegments: segments,
    });
  }, [topic, setMeta]);

  useEffect(() => {
    if (!topic) return;
    setMeta({
      sideNavSlot: (
        <div className="h-full overflow-y-auto p-3 flex flex-col">
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
        </div>
      ),
    });
  }, [topic, pages, selectedPageId, pendingDeletePageId, setMeta, handleSelectPage, openCreateDialog, openDeleteDialog, handleReorder]);

  useEffect(() => {
    return () => {
      setMeta({ sideNavSlot: null });
    };
  }, [setMeta]);

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
    <div className="px-4 py-6 h-full" data-color-mode="light">
      <main className="bg-white rounded-lg shadow p-4 h-[calc(100vh-200px)] overflow-y-auto space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{selectedPageTitle || '未选择页面'}</h2>
          <div className="flex items-center gap-2">
            {switchingPage && <span className="text-xs text-gray-500">页面切换中...</span>}
            {autoSaving && <span className="text-xs text-gray-500">自动保存中...</span>}
            {!autoSaving && autosaveNotice && <span className="text-xs text-gray-500">{autosaveNotice}</span>}
            <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
              {(['edit', 'live', 'preview'] as PreviewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  className={`px-2 py-1 ${previewMode === mode ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  {mode === 'edit' ? '编辑' : mode === 'live' ? '分栏' : '预览'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!currentPage || saving || autoSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {saving ? '保存中...' : autoSaving ? '自动保存中...' : content === lastSavedContent && lastSavedContent !== '' ? '已保存 ✓' : '保存'}
            </button>
          </div>
        </div>
        {currentPage ? (
          <MDEditor
            value={content}
            onChange={(next) => setContent(next || '')}
            height={520}
            preview={previewMode}
            visiableDragbar={false}
          />
        ) : (
          <p className="text-sm text-gray-500">请先创建页面</p>
        )}
      </main>
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
