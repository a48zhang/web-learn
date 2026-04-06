import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('../components/layout/LayoutMetaContext', () => ({
  useLayoutMeta: () => ({ setMeta: vi.fn() }),
}));

describe('TopicListPage', () => {
  beforeEach(() => {
    getAllMock.mockReset();
    authState.user = { role: 'teacher' };
  });

  it('shows a returned topic list with status and details', async () => {
    getAllMock.mockResolvedValueOnce([
      {
        id: 'topic-1',
        title: '算法专题',
        description: '图论与最短路',
        createdBy: 'teacher-1',
        status: 'published',
        type: 'knowledge',
        createdAt: '2026-04-10T00:00:00.000Z',
      },
    ]);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TopicListPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('算法专题')).toBeInTheDocument();
    });

    expect(screen.getByText('图论与最短路')).toBeInTheDocument();
    expect(screen.getByText('已发布')).toBeInTheDocument();
    expect(screen.getByText('知识库型')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看详情 →' })).toHaveAttribute('href', '/topics/topic-1');
  });

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

  it('shows an error state when the topic request fails', async () => {
    getAllMock.mockRejectedValueOnce(new Error('network failed'));

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TopicListPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('获取专题列表失败')).toBeInTheDocument();
    });
  });
});
