import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { topicApi, topicGitApi } from '../services/api';
import { buildPublishedHtml } from '../utils/rewriteAssetUrls';
import AIChatSidebar from '../components/AIChatSidebar';

export default function PublishedTopicPage() {
  const { id } = useParams<{ id: string }>();
  const [srcdoc, setSrcdoc] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'unpublished'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!id) {
      setStatus('error');
      setErrorMessage('无效专题 ID');
      return;
    }

    // Revoke previous Blob URLs when navigating to a different topic
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        const topic = await topicApi.getById(id);
        if (topic.status !== 'published') {
          setStatus('unpublished');
          return;
        }

        const { url } = await topicGitApi.getPresign(id, 'publish');
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Download failed: ${response.status}`);
        }

        const result = await buildPublishedHtml(await response.arrayBuffer());
        blobUrlsRef.current = result.blobUrls;
        setSrcdoc(result.html);
        setStatus('ready');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : '加载失败');
        setStatus('error');
      }
    };

    void load();
  }, [id]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
        <div className="text-center text-zinc-400">
          <svg className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-[14px]">加载中...</p>
        </div>
      </div>
    );
  }

  if (status === 'unpublished') {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
        <div className="text-center text-zinc-400 max-w-md px-6">
          <p className="text-lg mb-2">该专题尚未发布</p>
          <a href="/" className="text-blue-400 hover:text-blue-300 text-sm">返回首页</a>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
        <div className="text-center text-zinc-400 max-w-md px-6">
          <p className="text-lg mb-2">加载失败</p>
          <p className="text-sm text-zinc-500 mb-4">{errorMessage}</p>
          <a href="/" className="text-blue-400 hover:text-blue-300 text-sm">返回首页</a>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex flex-col bg-[#1e1e1e]">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#3c3c3c] bg-[#252526]">
          <a href="/" className="text-[13px] text-zinc-400 hover:text-white transition-colors">
            ← 返回首页
          </a>
        </div>
        <iframe
          title="published-topic"
          className="w-full flex-1 bg-white"
          sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
          srcDoc={srcdoc ?? ''}
        />
      </div>
      {id && <AIChatSidebar topicId={id} agentType="learning" title="学习助手" />}
    </>
  );
}
