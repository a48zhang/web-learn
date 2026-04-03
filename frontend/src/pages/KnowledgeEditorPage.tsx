import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import type { Topic, TopicPage, TopicPageTreeNode } from '@web-learn/shared';
import { topicApi, pageApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import { toast } from '../stores/useToastStore';
import PageTreeEditor from '../components/PageTreeEditor';
import AIChatSidebar from '../components/AIChatSidebar';

function flattenPages(nodes: TopicPageTreeNode[]): TopicPageTreeNode[] {
  const result: TopicPageTreeNode[] = [];
  const walk = (node: TopicPageTreeNode) => {
    result.push(node);
    node.children
      .slice()
      .sort((a, b) => a.order - b.order)
      .forEach(walk);
  };
  nodes
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach(walk);
  return result;
}

function findNode(nodes: TopicPageTreeNode[], id: string): TopicPageTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

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

  const canEdit = user?.role === 'teacher' && topic?.createdBy === user.id;

  const refreshPages = async (topicId: string, keepSelected = true) => {
    const tree = await pageApi.getByTopic(topicId);
    setPages(tree);
    if (tree.length === 0) {
      setSelectedPageId(null);
      setCurrentPage(null);
      setContent('');
      return;
    }
    const flattened = flattenPages(tree);
    const selected = keepSelected && selectedPageId ? flattened.find((p) => p.id === selectedPageId) : null;
    const target = selected || flattened[0];
    setSelectedPageId(target.id);
    const detail = await pageApi.getById(target.id);
    setCurrentPage(detail);
    setContent(detail.content || '');
  };

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
        await refreshPages(id, false);
      } catch (err) {
        console.error(err);
        setError('加载编辑器失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const selectedPageTitle = useMemo(() => {
    if (!selectedPageId) return '';
    return findNode(pages, selectedPageId)?.title || '';
  }, [pages, selectedPageId]);

  const handleSelectPage = async (pageId: string) => {
    setSelectedPageId(pageId);
    const detail = await pageApi.getById(pageId);
    setCurrentPage(detail);
    setContent(detail.content || '');
  };

  const handleCreatePage = async (parentPageId?: string | null) => {
    if (!id || !canEdit) return;
    const title = window.prompt('请输入页面标题');
    if (!title?.trim()) return;
    try {
      const page = await pageApi.create(id, {
        title: title.trim(),
        content: '',
        parent_page_id: parentPageId || null,
      });
      await refreshPages(id, false);
      setSelectedPageId(page.id);
      setCurrentPage(page);
      setContent(page.content || '');
      toast.success('页面已创建');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '创建页面失败');
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!id || !canEdit) return;
    if (!window.confirm('确定删除该页面及其子页面？')) return;
    try {
      await pageApi.delete(pageId);
      await refreshPages(id, false);
      toast.success('页面已删除');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '删除页面失败');
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
      await refreshPages(id);
      toast.success('页面顺序已更新');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '更新顺序失败');
    }
  };

  const handleSave = async () => {
    if (!currentPage || !canEdit) return;
    setSaving(true);
    try {
      const updated = await pageApi.update(currentPage.id, { content });
      setCurrentPage(updated);
      setContent(updated.content || '');
      toast.success('保存成功');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">加载中...</p>
      </div>
    );
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
              onCreatePage={handleCreatePage}
              onDeletePage={handleDeletePage}
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
              <button
                type="button"
                onClick={handleSave}
                disabled={!currentPage || saving}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
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
    </div>
  );
}

export default KnowledgeEditorPage;
