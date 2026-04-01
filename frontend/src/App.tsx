import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
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
import StudentSubmissionsPage from './pages/StudentSubmissionsPage';
import StudentFeedbackPage from './pages/StudentFeedbackPage';
import ProtectedRoute from './components/ProtectedRoute';

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
            element={
              <ProtectedRoute>
                <TopicListPage />
              </ProtectedRoute>
            }
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
            element={
              <ProtectedRoute>
                <TopicDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-submissions"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentSubmissionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-feedback"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentFeedbackPage />
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
