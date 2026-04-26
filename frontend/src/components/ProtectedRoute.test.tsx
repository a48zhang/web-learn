import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProtectedRoute from './ProtectedRoute';

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
  user: null as null | { role: 'admin' | 'user' },
}));

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: () => authState,
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.isLoading = false;
    authState.user = null;
  });

  it('renders children when the user is authenticated', () => {
    authState.isAuthenticated = true;
    authState.user = { role: 'user' };

    render(
      <MemoryRouter
        initialEntries={['/protected']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Route</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Login Route')).not.toBeInTheDocument();
  });

  it('shows the loading state while auth status is resolving', () => {
    authState.isLoading = true;

    render(
      <MemoryRouter
        initialEntries={['/protected']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Route</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('加载中...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Login Route')).not.toBeInTheDocument();
  });

  it('redirects to login when the user is not authenticated', async () => {
    render(
      <MemoryRouter
        initialEntries={['/protected']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Route</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Login Route')).toBeInTheDocument();
    });
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects users without the required role to dashboard', async () => {
    authState.isAuthenticated = true;
    authState.user = { role: 'user' };

    render(
      <MemoryRouter
        initialEntries={['/admin-only']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/admin-only"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <div>Admin Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<div>Dashboard Route</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard Route')).toBeInTheDocument();
    });
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });
});
