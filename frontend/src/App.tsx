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
import WebsiteEditorPage from './pages/WebsiteEditorPage';
import PublicHomePage from './pages/PublicHomePage';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import { LayoutMetaProvider } from './components/layout/LayoutMetaContext';
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
      <LayoutMetaProvider>
        <Routes>
          {/* Public routes */}
          <Route
            path="/"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <PublicHomePage />
            }
          />
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

          {/* Protected routes wrapped with AppShell */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppShell>
                  <DashboardPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/topics"
            element={
              <AppShell>
                <TopicListPage />
              </AppShell>
            }
          />
          <Route
            path="/topics/create"
            element={
              <ProtectedRoute>
                <AppShell>
                  <TopicCreatePage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/topics/:id"
            element={
              <AppShell>
                <TopicDetailPage />
              </AppShell>
            }
          />
          <Route
            path="/topics/:id/edit"
            element={
              <ProtectedRoute>
                <AppShell>
                  <TopicEditorRouter />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* 404 route */}
          <Route
            path="*"
            element={
              <AppShell>
                <div className="flex items-center justify-center p-12">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                    <p className="text-gray-600 mb-4">页面未找到</p>
                    <a href="/dashboard" className="text-blue-600 hover:text-blue-500 font-medium">
                      返回首页
                    </a>
                  </div>
                </div>
              </AppShell>
            }
          />
        </Routes>
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </LayoutMetaProvider>
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

  if (!topic || failed) {
    return <Navigate to="/topics" replace />;
  }

  // All topics now use the website editor
  return <WebsiteEditorPage />;
}
