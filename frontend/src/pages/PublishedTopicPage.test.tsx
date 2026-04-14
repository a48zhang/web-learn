import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublishedTopicPage from './PublishedTopicPage';

const getByIdMock = vi.hoisted(() => vi.fn());
const getPresignMock = vi.hoisted(() => vi.fn());
const buildPublishedHtmlMock = vi.hoisted(() => vi.fn());

vi.mock('../services/api', () => ({
  topicApi: {
    getById: getByIdMock,
  },
  topicGitApi: {
    getPresign: getPresignMock,
  },
}));

vi.mock('../utils/rewriteAssetUrls', () => ({
  buildPublishedHtml: buildPublishedHtmlMock,
}));

describe('PublishedTopicPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getByIdMock.mockReset();
    getPresignMock.mockReset();
    buildPublishedHtmlMock.mockReset();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as typeof fetch);
  });

  it('renders iframe for published topic', async () => {
    getByIdMock.mockResolvedValueOnce({ id: 'topic-1', status: 'published' });
    getPresignMock.mockResolvedValueOnce({ url: 'https://example.com/published.tgz' });
    buildPublishedHtmlMock.mockResolvedValueOnce({ html: '<html><body>published</body></html>', blobUrls: [] });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response);

    render(
      <MemoryRouter initialEntries={['/p/topic-1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/p/:id" element={<PublishedTopicPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTitle('published-topic')).toBeInTheDocument();
    });
    expect(getPresignMock).toHaveBeenCalledWith('topic-1', 'publish');
  });

  it('renders unpublished state for non-published topic', async () => {
    getByIdMock.mockResolvedValueOnce({ id: 'topic-2', status: 'draft' });

    render(
      <MemoryRouter initialEntries={['/p/topic-2']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/p/:id" element={<PublishedTopicPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('该专题尚未发布')).toBeInTheDocument();
    });
    expect(getPresignMock).not.toHaveBeenCalled();
  });
});
