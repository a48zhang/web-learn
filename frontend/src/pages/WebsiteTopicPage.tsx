import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Topic } from '@web-learn/shared';
import { topicApi } from '../services/api';
import { LoadingOverlay } from '../components/Loading';
import { getApiErrorMessage } from '../utils/errors';
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';
import type { BreadcrumbSegment } from '../components/layout/LayoutMetaContext';
import { useIframeWithTimeout } from '../hooks/useIframeWithTimeout';

function WebsiteTopicPage() {
  const { id } = useParams<{ id: string }>();
  const { setMeta } = useLayoutMeta();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullScreen, setFullScreen] = useState(false);

  const {
    iframeLoading,
    iframeError,
    iframeKey,
    handleLoad,
    handleError,
    handleReload,
  } = useIframeWithTimeout(15_000, topic?.websiteUrl ?? undefined);

  const handleReloadIframe = handleReload;

  useEffect(() => {
    const segments: BreadcrumbSegment[] = [
      { label: '首页', to: '/dashboard' },
      { label: '专题列表', to: '/topics' },
      { label: '网站专题' },
      ...(topic ? [{ label: topic.title }] : [{ label: '专题详情...' }]),
    ];
    setMeta({
      pageTitle: topic ? topic.title : '网站专题',
      breadcrumbSegments: segments,
      sideNavSlot: null,
    });
  }, [topic, setMeta]);

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
      <div className="px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6 text-gray-700">{error || '专题不存在'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className={`${fullScreen ? 'max-w-none' : 'max-w-6xl'} mx-auto space-y-4`}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{topic.title}</h1>
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
            <div className="relative">
              {iframeLoading && !iframeError && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-200 overflow-hidden z-10">
                  <div className="h-full bg-blue-500 animate-pulse w-1/2" />
                </div>
              )}
              {iframeError ? (
                <div className="h-[50vh] flex flex-col items-center justify-center gap-4 text-gray-500">
                  <p className="text-lg">网站加载失败</p>
                  <p className="text-sm text-gray-400">请检查网站地址或稍后再试</p>
                  <button
                    type="button"
                    onClick={handleReloadIframe}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 text-sm transition-colors"
                  >
                    重新加载
                  </button>
                </div>
              ) : (
                <iframe
                  key={iframeKey}
                  title={topic.title}
                  src={topic.websiteUrl}
                  className={`w-full border-0 ${fullScreen ? 'h-[calc(100vh-140px)]' : 'h-[75vh]'}`}
                  onLoad={handleLoad}
                  onError={handleError}
                />
              )}
            </div>
          ) : (
            <div className="h-[50vh] flex items-center justify-center text-gray-500">
              请先上传网站代码
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WebsiteTopicPage;
