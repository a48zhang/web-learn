import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Topic, TopicPage, TopicPageTreeNode } from '@web-learn/shared';
import { topicApi, pageApi } from '../services/api';
import { LoadingOverlay } from '../components/Loading';
import PageTreeNav from '../components/PageTreeNav';
import AIChatSidebar from '../components/AIChatSidebar';

function findFirstPage(nodes: TopicPageTreeNode[]): TopicPageTreeNode | null {
  const sorted = nodes.slice().sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return null;
  const first = sorted[0];
  if (first.children.length > 0) {
    return findFirstPage([first.children.slice().sort((a, b) => a.order - b.order)[0]]) || first;
  }
  return first;
}

function findInTree(nodes: TopicPageTreeNode[], id: string): TopicPageTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findInTree(node.children, id);
    if (found) return found;
  }
  return null;
}

function KnowledgeTopicPage() {
  const { id } = useParams<{ id: string }>();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [pages, setPages] = useState<TopicPageTreeNode[]>([]);
  const [currentPage, setCurrentPage] = useState<TopicPage | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const [topicData, pageTree] = await Promise.all([topicApi.getById(id), pageApi.getByTopic(id)]);
        if (topicData.type !== 'knowledge') {
          setError('该专题不是知识库类型');
          setLoading(false);
          return;
        }
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
      } catch (err) {
        console.error(err);
        setError('加载专题失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const pageTitle = useMemo(() => {
    if (!selectedPageId) return '';
    const node = findInTree(pages, selectedPageId);
    return node?.title || '';
  }, [pages, selectedPageId]);

  const handleSelectPage = async (pageId: string) => {
    setSelectedPageId(pageId);
    try {
      const page = await pageApi.getById(pageId);
      setCurrentPage(page);
    } catch (err) {
      console.error(err);
      setError('加载页面失败');
    }
  };

  if (loading) return <LoadingOverlay message="加载专题中..." />;

  if (error || !topic) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <Link to="/topics" className="text-blue-600 hover:text-blue-500">
            ← 返回专题列表
          </Link>
          <div className="bg-white rounded-lg shadow p-6 mt-4 text-gray-700">{error || '专题不存在'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div>
          <Link to="/topics" className="text-blue-600 hover:text-blue-500">
            ← 返回专题列表
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{topic.title}</h1>
          {topic.description && <p className="text-gray-600 mt-2">{topic.description}</p>}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <aside className="lg:col-span-1 bg-white rounded-lg shadow p-3 h-[calc(100vh-180px)] overflow-y-auto">
            <PageTreeNav pages={pages} selectedPageId={selectedPageId} onSelectPage={handleSelectPage} />
          </aside>
          <main className="lg:col-span-3 bg-white rounded-lg shadow p-6 h-[calc(100vh-180px)] overflow-y-auto">
            {currentPage ? (
              <>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{pageTitle || currentPage.title}</h2>
                <div className="prose max-w-none prose-pre:bg-gray-900 prose-pre:text-gray-100">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {currentPage.content || ''}
                  </ReactMarkdown>
                </div>
              </>
            ) : (
              <p className="text-gray-500">暂无页面内容</p>
            )}
          </main>
        </div>
      </div>
      {id && <AIChatSidebar topicId={id} agentType="learning" />}
    </div>
  );
}

export default KnowledgeTopicPage;
