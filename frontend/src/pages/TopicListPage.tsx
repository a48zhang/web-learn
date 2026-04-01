import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { LoadingOverlay } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
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
    return <LoadingOverlay message="加载中..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <Link to="/dashboard" className="text-blue-600 hover:text-blue-500 mb-2 inline-block">
              ← 返回控制台
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              {user?.role === 'teacher' ? '我的专题' : '可用专题'}
            </h1>
          </div>
          {user?.role === 'teacher' && (
            <button
              onClick={() => navigate('/topics/create')}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
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

        <div className="space-y-4">
          {topics.length === 0 ? (
            user?.role === 'teacher' ? (
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
              <EmptyState
                icon="folder"
                title="暂无可用专题"
                description="教师还没有发布任何专题，请稍后再来查看"
              />
            )
          ) : (
            topics.map((topic) => (
              <div key={topic.id} className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start sm:items-center gap-3 mb-2 flex-wrap">
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
                        <span>截止时间: {new Date(topic.deadline).toLocaleDateString('zh-CN')}</span>
                      )}
                    </div>
                  </div>
                  <div className="sm:ml-4 flex-shrink-0">
                    <Link
                      to={`/topics/${topic.id}`}
                      className="text-blue-600 hover:text-blue-500 font-medium inline-block"
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
