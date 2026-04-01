import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TopicDetailPage from './TopicDetailPage';

const authState = vi.hoisted(() => ({
  user: { id: 'student-1', role: 'student' as const },
}));

const topicApiMock = vi.hoisted(() => ({
  getById: vi.fn(),
  updateStatus: vi.fn(),
}));

const taskApiMock = vi.hoisted(() => ({
  getByTopic: vi.fn(),
}));

const resourceApiMock = vi.hoisted(() => ({
  getByTopic: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: () => authState,
}));

vi.mock('../stores/useToastStore', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../services/api', () => ({
  topicApi: topicApiMock,
  taskApi: taskApiMock,
  resourceApi: resourceApiMock,
}));

vi.mock('../components/ResourceUpload', () => ({ default: () => <div>Resource Upload</div> }));
vi.mock('../components/ResourceList', () => ({
  default: ({ resources }: { resources: unknown[] }) => <div>资源数量：{resources.length}</div>,
}));
vi.mock('../components/TaskCreate', () => ({ default: () => <div>Task Create</div> }));
vi.mock('../components/TaskList', () => ({
  default: ({ tasks }: { tasks: unknown[] }) => <div>任务数量：{tasks.length}</div>,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'topic-1' }),
  };
});

describe('TopicDetailPage', () => {
  beforeEach(() => {
    topicApiMock.getById.mockReset();
    topicApiMock.updateStatus.mockReset();
    taskApiMock.getByTopic.mockReset();
    resourceApiMock.getByTopic.mockReset();
    resourceApiMock.delete.mockReset();
  });

  it('loads topic resources and tasks successfully', async () => {
    topicApiMock.getById.mockResolvedValueOnce({
      id: 'topic-1',
      title: '专题一',
      description: '专题描述',
      createdBy: 'teacher-1',
      status: 'published',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    });
    taskApiMock.getByTopic.mockResolvedValueOnce([
      {
        id: 'task-1',
        title: '第一次作业',
      },
    ]);
    resourceApiMock.getByTopic.mockResolvedValueOnce([{ id: 'res-1', title: '讲义' }]);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TopicDetailPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('专题一')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('资源数量：1')).toBeInTheDocument();
    });
    expect(screen.getByText('任务数量：1')).toBeInTheDocument();
    expect(screen.queryByText('出错了')).not.toBeInTheDocument();
  });

  it('shows resource and task retry actions when the section request fails', async () => {
    topicApiMock.getById.mockResolvedValueOnce({
      id: 'topic-1',
      title: '专题一',
      description: '专题描述',
      createdBy: 'teacher-1',
      status: 'published',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    });
    resourceApiMock.getByTopic
      .mockRejectedValueOnce(new Error('resources failed'))
      .mockResolvedValueOnce([{ id: 'res-1', title: '讲义' }]);
    taskApiMock.getByTopic
      .mockRejectedValueOnce(new Error('tasks failed'))
      .mockResolvedValueOnce([{ id: 'task-1', title: '第一次作业' }]);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TopicDetailPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('资源加载失败')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '重试加载资源' })).toBeInTheDocument();
    expect(screen.getByText('任务加载失败')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试加载任务' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重试加载资源' }));
    fireEvent.click(screen.getByRole('button', { name: '重试加载任务' }));

    await waitFor(() => {
      expect(screen.getByText('资源数量：1')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('任务数量：1')).toBeInTheDocument();
    });
  });

  it('keeps empty resources distinct from failure states', async () => {
    topicApiMock.getById.mockResolvedValueOnce({
      id: 'topic-1',
      title: '专题一',
      description: '专题描述',
      createdBy: 'teacher-1',
      status: 'published',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    });
    taskApiMock.getByTopic.mockResolvedValueOnce([]);
    resourceApiMock.getByTopic.mockResolvedValueOnce([]);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TopicDetailPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('资源数量：0')).toBeInTheDocument();
    });
    expect(screen.getByText('任务数量：0')).toBeInTheDocument();
    expect(screen.queryByText('资源加载失败')).not.toBeInTheDocument();
    expect(screen.queryByText('任务加载失败')).not.toBeInTheDocument();
  });

  it('shows the page-level error state when topic loading fails', async () => {
    topicApiMock.getById.mockRejectedValueOnce(new Error('topic failed'));

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TopicDetailPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('出错了')).toBeInTheDocument();
    });
    expect(screen.getByText('获取专题详情失败')).toBeInTheDocument();
  });
});
