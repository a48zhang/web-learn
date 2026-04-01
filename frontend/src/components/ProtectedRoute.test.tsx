import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ProtectedRoute from './ProtectedRoute';

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
}));

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: () => authState,
}));

describe('ProtectedRoute', () => {
  it('redirects to login when the user is not authenticated', () => {
    authState.isAuthenticated = false;
    authState.isLoading = false;

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

    expect(screen.getByText('Login Route')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
