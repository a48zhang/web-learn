import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from './stores/useAuthStore';
import { useToastStore } from './stores/useToastStore';
import { ToastContainer } from './components/Toast';
import { LoadingOverlay } from './components/Loading';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TopicListPage from './pages/TopicListPage';
import TopicCreatePage from './pages/TopicCreatePage';
import TopicDetailPage from './pages/TopicDetailPage';
import KnowledgeEditorPage from './pages/KnowledgeEditorPage';
import WebsiteEditorPage from './pages/WebsiteEditorPage';
import ProtectedRoute from './components/ProtectedRoute';
import { topicApi } from './services/api';
import type { Topic } from '@web-learn/shared';

function App() {
  const { checkAuth, isLoading, isAuthenticated } = useAuthStore();
  const { toasts, removeToast } = useToastStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return <LoadingOverlay message="初始化中..." />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
            }
          />
          <Route
            path="/register"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />
            }
          />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/topics"
            element={<TopicListPage />}
          />
          <Route
            path="/topics/create"
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <TopicCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/topics/:id"
            element={<TopicDetailPage />}
          />
          <Route
            path="/topics/:id/edit"
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <TopicEditorRouter />
              </ProtectedRoute>
            }
          />

          {/* Default route */}
          <Route
            path="/"
            element={<Navigate to="/dashboard" replace />}
          />

          {/* 404 route */}
          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                  <p className="text-gray-600 mb-4">页面未找到</p>
                  <a
                    href="/dashboard"
                    className="text-blue-600 hover:text-blue-500 font-medium"
                  >
                    返回首页
                  </a>
                </div>
              </div>
            }
          />
        </Routes>
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </div>
    </BrowserRouter>
  );
}

export default App;

function TopicEditorRouter() {
  const { id } = useParams<{ id: string }>();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const fetchTopic = async () => {
      if (!id) return;
      try {
        const data = await topicApi.getById(id);
        setTopic(data);
        setFailed(false);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    };
    fetchTopic();
  }, [id]);

  if (loading) {
    return <LoadingOverlay message="加载中..." />;
  }

  if (!topic) {
    if (failed) {
      return <Navigate to="/topics" replace />;
    }
    return <Navigate to="/topics" replace />;
  }

  return topic.type === 'website' ? <WebsiteEditorPage /> : <KnowledgeEditorPage />;
}
