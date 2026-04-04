import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Topic } from '@web-learn/shared';
import { topicApi } from '../services/api';
import { LoadingOverlay } from '../components/Loading';
import { getApiErrorMessage } from '../utils/errors';

function WebsiteTopicPage() {
  const { id } = useParams<{ id: string }>();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    const fetchTopic = async () => {
      if (!id) return;
      try {
        const data = await topicApi.getById(id);
        if (data.type !== 'website') {
          setError('该专题不是网站类型');
          return;
        }
        setTopic(data);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, '加载专题失败'));
      } finally {
        setLoading(false);
      }
    };
    fetchTopic();
  }, [id]);

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
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className={`${fullScreen ? 'max-w-none' : 'max-w-6xl'} mx-auto space-y-4`}>
        <div className="flex items-center justify-between">
          <div>
            <Link to="/topics" className="text-blue-600 hover:text-blue-500">
              ← 返回专题列表
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">{topic.title}</h1>
          </div>
          <button
            type="button"
            onClick={() => setFullScreen((v) => !v)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2 text-sm"
          >
            {fullScreen ? '退出全屏' : '全屏预览'}
          </button>
        </div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {topic.websiteUrl ? (
            <iframe
              title={topic.title}
              src={topic.websiteUrl}
              className={`w-full border-0 ${fullScreen ? 'h-[calc(100vh-140px)]' : 'h-[75vh]'}`}
            />
          ) : (
            <div className="h-[50vh] flex items-center justify-center text-gray-500">
              暂未上传网站内容
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WebsiteTopicPage;
