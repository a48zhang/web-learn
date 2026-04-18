import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WebsiteTopicPage from './WebsiteTopicPage';

const getByIdMock = vi.hoisted(() => vi.fn());

vi.mock('../services/api', () => ({
  topicApi: {
    getById: getByIdMock,
  },
}));

vi.mock('../components/layout/LayoutMetaContext', () => ({
  useLayoutMeta: () => ({ setMeta: vi.fn() }),
}));

vi.mock('../hooks/useIframeWithTimeout', () => ({
  useIframeWithTimeout: () => ({
    iframeLoading: false,
    iframeError: false,
    iframeKey: 'test',
    handleLoad: vi.fn(),
    handleError: vi.fn(),
    handleReload: vi.fn(),
  }),
}));

describe('WebsiteTopicPage', () => {
  beforeEach(() => {
    getByIdMock.mockReset();
  });

  it('shows the learning agent trigger on website topic page', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 'topic-1',
      title: '学习专题',
      type: 'website',
      websiteUrl: 'https://example.com',
    });

    render(
      <MemoryRouter initialEntries={['/topics/topic-1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/topics/:id" element={<WebsiteTopicPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('学习专题')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: '学习助手' })).toBeInTheDocument();
  });
});
