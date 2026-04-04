import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TopicDetailPage from './TopicDetailPage';

const topicApiMock = vi.hoisted(() => ({
  getById: vi.fn(),
}));

vi.mock('../services/api', () => ({
  topicApi: topicApiMock,
}));

vi.mock('./KnowledgeTopicPage', () => ({
  default: () => <div>Knowledge Topic Page</div>,
}));

vi.mock('./WebsiteTopicPage', () => ({
  default: () => <div>Website Topic Page</div>,
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
  });

  it('renders knowledge page for knowledge topics', async () => {
    topicApiMock.getById.mockResolvedValueOnce({
      id: 'topic-1',
      type: 'knowledge',
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TopicDetailPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Knowledge Topic Page')).toBeInTheDocument();
    });
  });

  it('renders website page for website topics', async () => {
    topicApiMock.getById.mockResolvedValueOnce({
      id: 'topic-1',
      type: 'website',
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TopicDetailPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Website Topic Page')).toBeInTheDocument();
    });
  });

  it('shows load error when request fails', async () => {
    topicApiMock.getById.mockRejectedValueOnce(new Error('boom'));

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TopicDetailPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('获取专题详情失败')).toBeInTheDocument();
    });
  });
});
