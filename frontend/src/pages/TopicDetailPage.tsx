import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { toast } from '../stores/useToastStore';
import { LoadingOverlay, LoadingSpinner } from '../components/Loading';
import { topicApi, taskApi, resourceApi } from '../services/api';
import type { Topic, Resource, Task } from '@web-learn/shared';
import ResourceUpload from '../components/ResourceUpload';
import ResourceList from '../components/ResourceList';
import TaskCreate from '../components/TaskCreate';
import TaskList from '../components/TaskList';
import { EmptyState } from '../components/EmptyState';

function TopicDetailPage() {
  const { user } = useAuthStore();
  const { id } = useParams<{ id: string }>();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showTaskCreate, setShowTaskCreate] = useState(false);

  const isOwner = user?.role === 'teacher' && topic?.createdBy === user.id;

  const fetchResources = async () => {
    if (!id) return;
    setResourcesLoading(true);
    setResourcesError(null);
    try {
      const data = await resourceApi.getByTopic(id);
      setResources(data || []);
    } catch (err) {
      setResourcesError('暂时无法获取资源列表，请稍后重试。');
      console.error('Failed to fetch resources:', err);
    } finally {
      setResourcesLoading(false);
    }
  };

  const fetchTasks = async () => {
    if (!id) return;
    setTasksLoading(true);
    setTasksError(null);
    try {
      const data = await taskApi.getByTopic(id);
      setTasks(data || []);
    } catch (err) {
      setTasksError('暂时无法获取任务列表，请稍后重试。');
      console.error('Failed to fetch tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    const fetchTopic = async () => {
      if (!id) return;

      try {
        const data = await topicApi.getById(id);
        setTopic(data);
      } catch (err) {
        setError('获取专题详情失败');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopic();
  }, [id]);

  useEffect(() => {
    if (topic) {
      fetchResources();
      fetchTasks();
    }
  }, [topic?.id]);

  const handleUploadSuccess = (resource: Resource) => {
    setResources((prev) => [resource, ...prev]);
    setShowUpload(false);
  };

  const handleTaskCreated = (task: Task) => {
    setTasks((prev) => [task, ...prev]);
    setShowTaskCreate(false);
  };

  const handleSubmissionSuccess = () => {
    toast.success('提交成功');
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (!confirm('确定要删除这个资源吗？')) return;

    try {
      await resourceApi.delete(resourceId);
      setResources((prev) => prev.filter((r) => r.id !== resourceId));
      toast.success('资源已删除');
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error('删除失败: ' + (err.response?.data?.error || '未知错误'));
    }
  };

  const handleStatusChange = async (newStatus: 'draft' | 'published' | 'closed') => {
    if (!topic) return;

    setActionLoading(true);
    try {
      const updated = await topicApi.updateStatus(topic.id, { status: newStatus });
      setTopic(updated);
      toast.success('状态更新成功');
    } catch (err) {
      toast.error('更新状态失败');
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

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

  if (loading) {
    return <LoadingOverlay message="加载中..." />;
  }

  if (error || !topic) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 px-4">
          <Link to="/topics" className="text-blue-600 hover:text-blue-500 mb-4 inline-block">
            ← 返回专题列表
          </Link>
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">出错了</h2>
            <p className="text-gray-600">{error || '专题不存在'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link to="/topics" className="text-blue-600 hover:text-blue-500 mb-2 inline-block">
            ← 返回专题列表
          </Link>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{topic.title}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(topic.status)}`}>
                  {getStatusText(topic.status)}
                </span>
              </div>
              <p className="text-gray-500">
                创建于 {new Date(topic.createdAt).toLocaleString('zh-CN')}
              </p>
            </div>
            {isOwner && (
              <div className="flex gap-2 w-full sm:w-auto">
                {topic.status === 'draft' && (
                  <button
                    onClick={() => handleStatusChange('published')}
                    disabled={actionLoading}
                    className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
                  >
                    发布专题
                  </button>
                )}
                {topic.status === 'published' && (
                  <button
                    onClick={() => handleStatusChange('closed')}
                    disabled={actionLoading}
                    className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
                  >
                    关闭专题
                  </button>
                )}
                {topic.status === 'closed' && (
                  <button
                    onClick={() => handleStatusChange('published')}
                    disabled={actionLoading}
                    className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
                  >
                    重新发布
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">专题描述</h2>
              {topic.description ? (
                <div className="text-gray-700 whitespace-pre-wrap">{topic.description}</div>
              ) : (
                <p className="text-gray-500">暂无描述</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900">学习资源</h2>
                {isOwner && (
                  <button
                    onClick={() => setShowUpload(!showUpload)}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                  >
                    {showUpload ? '取消上传' : '上传资源'}
                  </button>
                )}
              </div>

              {showUpload && isOwner && (
                <ResourceUpload
                  topicId={topic.id}
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={(uploadError) => toast.error(uploadError)}
                />
              )}

              {resourcesLoading ? (
                <div className="bg-white shadow rounded-lg p-6 flex items-center justify-center">
                  <LoadingSpinner size="md" className="mr-2" />
                  <span className="text-gray-600">加载资源中...</span>
                </div>
              ) : resourcesError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-600 font-medium">资源加载失败</p>
                  <p className="text-red-500 text-sm mt-1">{resourcesError}</p>
                  <button
                    type="button"
                    onClick={fetchResources}
                    className="mt-3 inline-flex items-center px-3 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    重试加载资源
                  </button>
                </div>
              ) : (
                <ResourceList
                  resources={resources}
                  canDelete={isOwner}
                  onDelete={handleDeleteResource}
                />
              )}
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900">任务列表</h2>
                {isOwner && (
                  <button
                    onClick={() => setShowTaskCreate(!showTaskCreate)}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                  >
                    {showTaskCreate ? '取消创建' : '创建任务'}
                  </button>
                )}
              </div>

              {showTaskCreate && isOwner && (
                <TaskCreate
                  topicId={topic.id}
                  onTaskCreated={handleTaskCreated}
                  onCancel={() => setShowTaskCreate(false)}
                />
              )}

              {tasksLoading ? (
                <div className="bg-white shadow rounded-lg p-6 flex items-center justify-center">
                  <LoadingSpinner size="md" className="mr-2" />
                  <span className="text-gray-600">加载任务中...</span>
                </div>
              ) : tasksError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-600 font-medium">任务加载失败</p>
                  <p className="text-red-500 text-sm mt-1">{tasksError}</p>
                  <button
                    type="button"
                    onClick={fetchTasks}
                    className="mt-3 inline-flex items-center px-3 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    重试加载任务
                  </button>
                </div>
              ) : (
                <TaskList
                  tasks={tasks}
                  canCreate={isOwner}
                  isTeacher={user?.role === 'teacher'}
                  onSubmissionSuccess={handleSubmissionSuccess}
                />
              )}
            </div>
          </div>

          <div className="space-y-6">
            {user?.role === 'student' && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-md font-semibold text-gray-900 mb-4">学生入口</h3>
                <div className="space-y-3">
                  <Link
                    to="/my-submissions"
                    className="block rounded-md border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">我的提交</div>
                    <p className="text-sm text-gray-500 mt-1">查看你提交过的任务记录与当前状态。</p>
                  </Link>
                  <Link
                    to="/my-feedback"
                    className="block rounded-md border border-gray-200 px-4 py-3 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">我的反馈</div>
                    <p className="text-sm text-gray-500 mt-1">集中查看教师已返回的评分和反馈意见。</p>
                  </Link>
                </div>
              </div>
            )}

            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-md font-semibold text-gray-900 mb-4">专题信息</h3>
              <div className="space-y-3">
                {topic.deadline && (
                  <div>
                    <span className="text-sm text-gray-500">截止时间</span>
                    <p className="text-gray-900">{new Date(topic.deadline).toLocaleDateString('zh-CN')}</p>
                  </div>
                )}
                <div>
                  <span className="text-sm text-gray-500">创建时间</span>
                  <p className="text-gray-900">{new Date(topic.createdAt).toLocaleString('zh-CN')}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">更新时间</span>
                  <p className="text-gray-900">{new Date(topic.updatedAt).toLocaleString('zh-CN')}</p>
                </div>
              </div>
            </div>

            {!resourcesLoading && !resourcesError && resources.length === 0 && (
              <EmptyState
                icon="document"
                title="暂时还没有学习资源"
                description={isOwner ? '可以先上传资料，帮助学生开展学习。' : '教师暂未上传资源，请稍后再来查看。'}
              />
            )}

            {!tasksLoading && !tasksError && tasks.length === 0 && (
              <EmptyState
                icon="task"
                title="暂时还没有任务"
                description={isOwner ? '创建一个任务，方便学生开始提交作业。' : '教师暂未布置任务，请稍后再来查看。'}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TopicDetailPage;
