import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Topic, TopicPage, TopicPageTreeNode } from '@web-learn/shared';
import { topicApi, pageApi } from '../services/api';
import { LoadingOverlay } from '../components/Loading';
import PageTreeNav from '../components/PageTreeNav';
import AIChatSidebar from '../components/AIChatSidebar';
import { toast } from '../stores/useToastStore';
import { getApiErrorMessage } from '../utils/errors';
import { findFirstPage, findNode, findNodePath } from '../utils/treeUtils';
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';
import type { BreadcrumbSegment } from '../components/layout/LayoutMetaContext';
import { getBaseBreadcrumbs } from '../utils/breadcrumbs';

function KnowledgeTopicPage() {
  const { id } = useParams<{ id: string }>();
  const { setMeta } = useLayoutMeta();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [pages, setPages] = useState<TopicPageTreeNode[]>([]);
  const [currentPage, setCurrentPage] = useState<TopicPage | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const [topicData, pageTree] = await Promise.all([topicApi.getById(id), pageApi.getByTopic(id)]);
        setTopic(topicData);
        setPages(pageTree);
        const first = findFirstPage(pageTree);
        if (first) {
          setSelectedPageId(first.id);
          const detail = await pageApi.getById(first.id);
          setCurrentPage(detail);
        } else {
          setCurrentPage(null);
          setSelectedPageId(null);
        }
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, '加载专题失败'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const pageTitle = useMemo(() => {
    if (!selectedPageId) return '';
    const node = findNode(pages, selectedPageId);
    return node?.title || '';
  }, [pages, selectedPageId]);

  const handleSelectPage = useCallback(async (pageId: string) => {
    setSelectedPageId(pageId);
    setPageLoading(true);
    try {
      const page = await pageApi.getById(pageId);
      setCurrentPage(page);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '加载页面失败'));
    } finally {
      setPageLoading(false);
    }
  }, []);

  // Inject PageTreeNav into the layout's left nav slot
  useEffect(() => {
    setMeta({
      sideNavSlot: (
        <div className="h-full overflow-y-auto p-3">
          <PageTreeNav pages={pages} selectedPageId={selectedPageId} onSelectPage={handleSelectPage} />
        </div>
      ),
    });
  }, [pages, selectedPageId, handleSelectPage, setMeta]);

  // Clean up sideNavSlot on unmount
  useEffect(() => {
    return () => {
      setMeta({ sideNavSlot: null });
    };
  }, [setMeta]);

  // Dynamic breadcrumbs
  useEffect(() => {
    if (!topic) {
      setMeta({
        pageTitle: '专题详情...',
        breadcrumbSegments: [
          ...getBaseBreadcrumbs(),
          { label: '知识库专题' },
          { label: '专题详情...' },
        ],
      });
      return;
    }

    const staticSegments: BreadcrumbSegment[] = [
      ...getBaseBreadcrumbs(),
      { label: '知识库专题' },
      { label: topic.title, to: `/topics/${topic.id}` },
    ];

    if (selectedPageId && pages.length > 0) {
      const path = findNodePath(pages, selectedPageId);
      const currentPageNode = path ? path[path.length - 1] : null;
      if (currentPageNode) {
        setMeta({
          pageTitle: currentPageNode.title,
          breadcrumbSegments: [...staticSegments, { label: currentPageNode.title }],
        });
        return;
      }
    }

    setMeta({
      pageTitle: topic.title,
      breadcrumbSegments: staticSegments,
    });
  }, [topic, pages, selectedPageId, setMeta]);

  if (loading) return <LoadingOverlay message="加载专题中..." />;

  if (error || !topic) {
    return (
      <div className="px-4 py-6">
        <div className="bg-white rounded-lg shadow p-6 text-gray-700">{error || '专题不存在'}</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{topic.title}</h1>
        {topic.description && <p className="text-gray-600 mt-2">{topic.description}</p>}
      </div>
      <div className="bg-white rounded-lg shadow h-[calc(100vh-200px)] overflow-y-auto p-6">
        {pageLoading ? (
          <p className="text-gray-500">页面加载中...</p>
        ) : currentPage ? (
          <>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{pageTitle || currentPage.title}</h2>
            <div className="prose prose-lg max-w-3xl mx-auto prose-pre:bg-gray-900 prose-pre:text-gray-100">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {currentPage.content || ''}
              </ReactMarkdown>
            </div>
          </>
        ) : (
          <p className="text-gray-500">暂无页面内容</p>
        )}
      </div>
      {id && <AIChatSidebar topicId={id} agentType="learning" />}
    </div>
  );
}

export default KnowledgeTopicPage;
