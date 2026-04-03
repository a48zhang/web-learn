import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Topic } from '@web-learn/shared';
import { topicApi } from '../services/api';
import { LoadingOverlay } from '../components/Loading';
import KnowledgeTopicPage from './KnowledgeTopicPage';
import WebsiteTopicPage from './WebsiteTopicPage';

function TopicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopic = async () => {
      if (!id) return;
      try {
        const data = await topicApi.getById(id);
        setTopic(data);
      } catch (err) {
        console.error(err);
        setError('获取专题详情失败');
      } finally {
        setLoading(false);
      }
    };
    fetchTopic();
  }, [id]);

  if (loading) return <LoadingOverlay message="加载中..." />;

  if (error || !topic) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-6 text-gray-700">{error || '专题不存在'}</div>
      </div>
    );
  }

  if (topic.type === 'website') {
    return <WebsiteTopicPage />;
  }
  return <KnowledgeTopicPage />;
}

export default TopicDetailPage;
