import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { topicApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import type { Topic } from '@web-learn/shared';
import { LoadingOverlay } from '../components/Loading';
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';

function PublicHomePage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const { setMeta } = useLayoutMeta();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMeta({
      pageTitle: 'WebLearn - 互动式学习平台',
      breadcrumbSegments: [],
      sideNavSlot: null,
    });
  }, [setMeta]);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const data = await topicApi.getAll();
        setTopics(data.filter(t => t.status === 'published').slice(0, 6));
      } catch {
        // Silently fail — page still shows hero section
      } finally {
        setLoading(false);
      }
    };
    fetchTopics();
  }, []);

  // Redirect authenticated users to dashboard
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            WebLearn
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            创建、发布和浏览互动式学习专题。教师可以轻松搭建网站型专题，学生能够沉浸式地探索知识。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="bg-white text-blue-600 font-semibold px-6 py-3 rounded-md hover:bg-blue-50 transition-colors"
            >
              免费注册
            </Link>
            <Link
              to="/login"
              className="border-2 border-white text-white font-semibold px-6 py-3 rounded-md hover:bg-white/10 transition-colors"
            >
              登录
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
            为什么选择 WebLearn？
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                所见即所得编辑器
              </h3>
              <p className="text-gray-600">
                内置代码编辑器和实时预览，AI 助手辅助生成网页，无需外部工具。
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                AI 学习助手
              </h3>
              <p className="text-gray-600">
                每个专题都配有 AI 助手，帮助学生理解内容、解答疑问。
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                完全公开浏览
              </h3>
              <p className="text-gray-600">
                无需注册即可浏览已发布的专题内容，先体验后注册。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Published Topics Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              热门专题
            </h2>
            <Link
              to="/topics"
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              查看全部 →
            </Link>
          </div>

          {loading ? (
            <LoadingOverlay message="加载专题中..." />
          ) : topics.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              暂无已发布的专题
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topics.map((topic) => (
                <Link
                  key={topic.id}
                  to={`/topics/${topic.id}`}
                  className="block bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {topic.title}
                  </h3>
                  {topic.description && (
                    <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                      {topic.description}
                    </p>
                  )}
                  <span className="text-xs text-gray-500">
                    {new Date(topic.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            准备好开始了吗？
          </h2>
          <p className="text-gray-600 mb-6">
            免费创建账户，开始搭建你的互动学习专题。
          </p>
          <button
            onClick={() => navigate('/register')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-md transition-colors"
          >
            立即注册
          </button>
        </div>
      </section>
    </div>
  );
}

export default PublicHomePage;
