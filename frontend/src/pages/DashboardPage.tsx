import { useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';

function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { setMeta } = useLayoutMeta();

  useEffect(() => {
    setMeta({
      pageTitle: '控制台',
      breadcrumbSegments: [
        { label: '首页', to: '/dashboard' },
        { label: '控制台' },
      ],
      sideNavSlot: null,
    });
  }, [setMeta]);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">控制台</h1>
          <p className="text-gray-600 mt-1">
            欢迎，{user?.username}（{user?.role === 'teacher' ? '教师' : '学生'}）
          </p>
        </div>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {user?.role === 'teacher' && (
            <>
              <div className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">创建专题</h2>
                <p className="text-gray-600 mb-4">创建新的学习专题并发布给学生</p>
                <button
                  onClick={() => navigate('/topics/create')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                  开始创建
                </button>
              </div>
              <div className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">我的专题</h2>
                <p className="text-gray-600 mb-4">查看和管理已创建的专题</p>
                <button
                  onClick={() => navigate('/topics')}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                  查看专题
                </button>
              </div>
            </>
          )}

          {user?.role === 'student' && (
            <>
              <div className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">浏览专题</h2>
                <p className="text-gray-600 mb-4">浏览公开专题与知识内容</p>
                <button
                  onClick={() => navigate('/topics')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                  去浏览
                </button>
              </div>
            </>
          )}

          <div className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">账户设置</h2>
            <p className="text-gray-600 mb-4">更新您的个人资料和偏好设置</p>
            <button className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
              设置
            </button>
          </div>
        </div>

        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">最近活动</h2>
          <div className="text-gray-500 text-center py-8">
            暂无活动记录
          </div>
        </div>
    </div>
  );
}

export default DashboardPage;
