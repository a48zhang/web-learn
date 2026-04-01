import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { topicApi } from '../services/api';
import type { Topic } from '@web-learn/shared';

function TopicDetailPage() {
  const { user } = useAuthStore();
  const { id } = useParams<{ id: string }>();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isOwner = user?.role === 'teacher' && topic?.createdBy === user.id;

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

  const handleStatusChange = async (newStatus: 'draft' | 'published' | 'closed') => {
    if (!topic) return;

    setActionLoading(true);
    try {
      const updated = await topicApi.updateStatus(topic.id, { status: newStatus });
      setTopic(updated);
    } catch (err) {
      alert('更新状态失败');
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
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
      <div className="max-w-7xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="mb-6">
          <Link to="/topics" className="text-blue-600 hover:text-blue-500 mb-2 inline-block">
            ← 返回专题列表
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{topic.title}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(topic.status)}`}>
                  {getStatusText(topic.status)}
                </span>
              </div>
              <p className="text-gray-500">
                创建于 {new Date(topic.createdAt).toLocaleString()}
              </p>
            </div>
            {isOwner && (
              <div className="flex gap-2">
                {topic.status === 'draft' && (
                  <button
                    onClick={() => handleStatusChange('published')}
                    disabled={actionLoading}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
                  >
                    发布专题
                  </button>
                )}
                {topic.status === 'published' && (
                  <button
                    onClick={() => handleStatusChange('closed')}
                    disabled={actionLoading}
                    className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
                  >
                    关闭专题
                  </button>
                )}
                {topic.status === 'closed' && (
                  <button
                    onClick={() => handleStatusChange('published')}
                    disabled={actionLoading}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
                  >
                    重新发布
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">专题描述</h2>
              {topic.description ? (
                <div className="text-gray-700 whitespace-pre-wrap">{topic.description}</div>
              ) : (
                <p className="text-gray-500">暂无描述</p>
              )}
            </div>

            {/* Resources (Placeholder) */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">学习资源</h2>
              <div className="text-gray-500 text-center py-8">
                资源模块开发中...
              </div>
            </div>

            {/* Tasks (Placeholder) */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">任务列表</h2>
              <div className="text-gray-500 text-center py-8">
                任务模块开发中...
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Info Card */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-md font-semibold text-gray-900 mb-4">专题信息</h3>
              <div className="space-y-3">
                {topic.deadline && (
                  <div>
                    <span className="text-sm text-gray-500">截止时间</span>
                    <p className="text-gray-900">{new Date(topic.deadline).toLocaleDateString()}</p>
                  </div>
                )}
                <div>
                  <span className="text-sm text-gray-500">创建时间</span>
                  <p className="text-gray-900">{new Date(topic.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">更新时间</span>
                  <p className="text-gray-900">{new Date(topic.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TopicDetailPage;
