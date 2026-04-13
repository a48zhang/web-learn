import { useEffect, useState } from 'react';
import { toast } from '../stores/useToastStore';
import { publishTopic, type PublishPhase } from '../utils/publishPipeline';

interface PublishShareDialogProps {
  topicId: string;
  onClose: () => void;
  onPublished: (shareLink: string, publishedUrl: string) => void;
}

type DialogPhase = PublishPhase | 'success' | 'error';

export default function PublishShareDialog({ topicId, onClose, onPublished }: PublishShareDialogProps) {
  const [phase, setPhase] = useState<DialogPhase>('building');
  const [error, setError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [publishedUrl, setPublishedUrl] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const result = await publishTopic(topicId, (p) => setPhase(p));
        setShareLink(result.shareLink);
        setPublishedUrl(result.publishedUrl);
        setPhase('success');
        onPublished(result.shareLink, result.publishedUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setPhase('error');
      }
    };
    void run();
  }, [onPublished, topicId]);

  const handleRetry = async () => {
    setError(null);
    setPhase('building');
    try {
      const result = await publishTopic(topicId, (p) => setPhase(p));
      setShareLink(result.shareLink);
      setPublishedUrl(result.publishedUrl);
      setPhase('success');
      onPublished(result.shareLink, result.publishedUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPhase('error');
    }
  };

  const handleCopyLink = async () => {
    const link = shareLink || `${window.location.origin}/p/${topicId}`;
    await navigator.clipboard.writeText(link);
    toast.success('链接已复制到剪贴板');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[#252526] border border-[#3c3c3c] rounded-lg shadow-xl w-[420px] max-w-[90vw] p-5 space-y-4">
        <h3 className="text-[14px] font-semibold text-white">发布专题</h3>

        {(phase === 'building' || phase === 'uploading') && (
          <div className="flex items-center gap-3 text-zinc-300 text-[13px]">
            <svg className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{phase === 'building' ? '正在构建项目...' : '正在上传并发布...'}</span>
          </div>
        )}

        {phase === 'success' && (
          <div className="space-y-3">
            <div className="text-green-400 text-[13px] flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              发布成功！
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareLink || `${window.location.origin}/p/${topicId}`}
                className="flex-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded px-2 py-1.5 text-[12px] text-zinc-300"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-[12px] bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded"
              >
                复制
              </button>
            </div>
            {publishedUrl && (
              <a href={publishedUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs">
                打开发布地址
              </a>
            )}
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-3">
            <div className="text-red-400 text-[13px]">发布失败：{error}</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRetry}
                className="text-[12px] bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded"
              >
                重试
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-[12px] bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-3 py-1.5 rounded"
              >
                关闭
              </button>
            </div>
          </div>
        )}

        {phase === 'success' && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="text-[12px] bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-3 py-1.5 rounded"
            >
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
