import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { LoadingOverlay } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { topicApi } from '../services/api';
import type { Topic } from '@web-learn/shared';
import { toast } from '../stores/useToastStore';
import { getApiErrorMessage } from '../utils/errors';
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';

function TopicListPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { setMeta } = useLayoutMeta();

  useEffect(() => {
    setMeta({
      pageTitle: '专题列表',
      breadcrumbSegments: [
        { label: '首页', to: '/dashboard' },
        { label: '专题列表' },
      ],
      sideNavSlot: null,
    });
  }, [setMeta]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteTopic, setPendingDeleteTopic] = useState<Topic | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuTopicId, setOpenMenuTopicId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const data = await topicApi.getAll();
        setTopics(data);
      } catch {
        setError('获取专题列表失败');
      } finally {
        setLoading(false);
      }
    };

    fetchTopics();
  }, []);

  useEffect(() => {
    if (!openMenuTopicId) return;
    const handleClickOutside = () => setOpenMenuTopicId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuTopicId]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return '草稿';
      case 'published':
        return '已发布';
      case 'closed':
        return '已关闭';
      default:
        return status;
    }
  };

  const getTypeText = (type: string) => {
    return type === 'website' ? '网站型' : '知识库型';
  };

  const handleStatusChange = async (topicId: string, newStatus: 'draft' | 'published' | 'closed') => {
    const prevTopics = topics;
    setTopics(prev => prev.map(t => t.id === topicId ? { ...t, status: newStatus } : t));
    setOpenMenuTopicId(null);
    try {
      await topicApi.updateStatus(topicId, { status: newStatus });
      toast.success('状态已更新');
    } catch (err: unknown) {
      setTopics(prevTopics);
      toast.error(getApiErrorMessage(err, '更新状态失败'));
    }
  };

  const handleOpenDeleteDialog = (topic: Topic) => {
    setPendingDeleteTopic(topic);
    setDeleteDialogOpen(true);
  };

  const handleDeleteTopic = async () => {
    if (!pendingDeleteTopic) return;
    setDeleting(true);
    try {
      await topicApi.delete(pendingDeleteTopic.id);
      setTopics((prev) => prev.filter((topic) => topic.id !== pendingDeleteTopic.id));
      setDeleteDialogOpen(false);
      setPendingDeleteTopic(null);
      toast.success('专题已删除');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '删除专题失败'));
    } finally {
      setDeleting(false);
    }
  };

  const isTopicEditor = (topic: Topic) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return (topic.editors as string[] | undefined)?.includes(user.id.toString());
  };

  if (loading) {
    return <LoadingOverlay message="加载中..." />;
  }

  return (
    <>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              专题列表
            </h1>
          </div>
          <button
            onClick={() => navigate('/topics/create')}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            创建专题
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {topics.length === 0 ? (
            <EmptyState
              icon="folder"
              title="还没有专题"
              description="创建您的第一个专题，开始组织教学内容"
              action={{
                label: '创建专题',
                onClick: () => navigate('/topics/create'),
              }}
            />
          ) : (
            topics.map((topic) => (
              <div key={topic.id} className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start sm:items-center gap-3 flex-wrap">
                      <h2 className="text-xl font-semibold text-gray-900">
                        <Link to={`/topics/${topic.id}`} className="hover:text-blue-600">
                          {topic.title}
                        </Link>
                      </h2>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(topic.status)}`}>
                        {getStatusText(topic.status)}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {getTypeText(topic.type)}
                      </span>
                    </div>
                    {topic.description && (
                      <p className="text-gray-600 mb-3 line-clamp-2">{topic.description}</p>
                    )}
                    <div className="text-sm text-gray-500">创建时间: {new Date(topic.createdAt).toLocaleDateString('zh-CN')}</div>
                  </div>
                  <div className="sm:ml-4 flex-shrink-0 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <Link
                      to={`/topics/${topic.id}`}
                      className="w-full sm:w-auto text-blue-600 hover:text-blue-500 font-medium inline-block text-center"
                    >
                      查看详情 →
                    </Link>
                    {isTopicEditor(topic) && (
                      <>
                        <Link
                          to={`/topics/${topic.id}/edit`}
                          className="w-full sm:w-auto text-green-600 hover:text-green-500 font-medium inline-block text-center"
                        >
                          编辑专题 →
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteDialog(topic)}
                          className="w-full sm:w-auto text-red-600 hover:text-red-500 font-medium text-center"
                        >
                          删除专题 →
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuTopicId(openMenuTopicId === topic.id ? null : topic.id);
                            }}
                            className="p-1 text-gray-500 hover:text-gray-700 rounded"
                            aria-label="更多操作"
                          >
                            ⋯
                          </button>
                          {openMenuTopicId === topic.id && (
                            <div
                              className="absolute right-0 top-8 bg-white shadow-lg rounded-md border border-gray-200 z-10 min-w-[120px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {topic.status === 'draft' && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(topic.id, 'published')}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  发布
                                </button>
                              )}
                              {topic.status === 'published' && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(topic.id, 'closed')}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  关闭
                                </button>
                              )}
                              {topic.status === 'closed' && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(topic.id, 'published')}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  重新发布
                                </button>
                              )}
                              {(topic.status === 'published' || topic.status === 'closed') && (
                                <button
                                  type="button"
                                  onClick={() => { setOpenMenuTopicId(null); navigate(`/topics/${topic.id}/edit`); }}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  编辑
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => { setOpenMenuTopicId(null); handleOpenDeleteDialog(topic); }}
                                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                删除
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {deleteDialogOpen && pendingDeleteTopic && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">删除专题</h3>
            <p className="text-sm text-gray-600">
              确认删除"{pendingDeleteTopic.title}"？该操作会删除专题及其页面内容。
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setPendingDeleteTopic(null);
                }}
                className="px-3 py-1.5 text-sm rounded border border-gray-300"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteTopic}
                disabled={deleting}
                className="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TopicListPage;
