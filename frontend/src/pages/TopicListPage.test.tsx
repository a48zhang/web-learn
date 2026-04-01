import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TopicListPage from './TopicListPage';

const authState = vi.hoisted(() => ({
  user: { role: 'teacher' },
}));

const getAllMock = vi.hoisted(() => vi.fn());

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: () => authState,
}));

vi.mock('../services/api', () => ({
  topicApi: {
    getAll: getAllMock,
  },
}));

describe('TopicListPage', () => {
  it('shows the empty state when no topics are returned', async () => {
    getAllMock.mockResolvedValueOnce([]);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TopicListPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('还没有专题')).toBeInTheDocument();
    });

    const createButtons = screen.getAllByRole('button', { name: '创建专题' });
    expect(createButtons).toHaveLength(2);
    expect(screen.getByText('创建您的第一个专题，开始组织教学内容')).toBeInTheDocument();
  });
});
