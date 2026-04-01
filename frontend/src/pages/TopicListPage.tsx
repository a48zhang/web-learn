import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { topicApi } from '../services/api';
import type { Topic } from '@web-learn/shared';

function TopicListPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const data = await topicApi.getAll();
        setTopics(data);
      } catch (err) {
        setError('获取专题列表失败');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopics();
  }, []);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <Link to="/dashboard" className="text-blue-600 hover:text-blue-500 mb-2 inline-block">
              ← 返回仪表盘
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              {user?.role === 'teacher' ? '我的专题' : '可用专题'}
            </h1>
          </div>
          {user?.role === 'teacher' && (
            <button
              onClick={() => navigate('/topics/create')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              创建专题
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Topic List */}
        <div className="space-y-4">
          {topics.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <p className="text-gray-500">暂无专题</p>
            </div>
          ) : (
            topics.map((topic) => (
              <div key={topic.id} className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl font-semibold text-gray-900">
                        <Link to={`/topics/${topic.id}`} className="hover:text-blue-600">
                          {topic.title}
                        </Link>
                      </h2>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(topic.status)}`}>
                        {getStatusText(topic.status)}
                      </span>
                    </div>
                    {topic.description && (
                      <p className="text-gray-600 mb-3 line-clamp-2">{topic.description}</p>
                    )}
                    <div className="text-sm text-gray-500">
                      {topic.deadline && (
                        <span>截止时间: {new Date(topic.deadline).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <Link
                      to={`/topics/${topic.id}`}
                      className="text-blue-600 hover:text-blue-500 font-medium"
                    >
                      查看详情 →
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default TopicListPage;
