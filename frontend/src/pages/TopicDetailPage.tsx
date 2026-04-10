import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { topicApi } from '../services/api';
import { LoadingOverlay } from '../components/Loading';
import WebsiteTopicPage from './WebsiteTopicPage';

function TopicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopic = async () => {
      if (!id) return;
      try {
        await topicApi.getById(id);
      } catch {
        setError('获取专题详情失败');
      } finally {
        setLoading(false);
      }
    };
    fetchTopic();
  }, [id]);

  if (loading) return <LoadingOverlay message="加载中..." />;

  if (error) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="bg-white rounded-lg shadow p-6 text-gray-700">{error}</div>
      </div>
    );
  }

  // All topics are now 'website' type — use WebsiteTopicPage
  return <WebsiteTopicPage />;
}

export default TopicDetailPage;
