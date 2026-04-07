import { useState } from 'react';

interface PreviewPanelProps {
  previewUrl: string | null;
  isReady: boolean;
  error: string | null;
  onRefresh: () => void;
}

export default function PreviewPanel({ previewUrl, isReady, error, onRefresh }: PreviewPanelProps) {
  const [iframeKey, setIframeKey] = useState(0);

  const handleReload = () => {
    setIframeKey((k) => k + 1);
    onRefresh();
  };

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-300 p-6">
        <p className="text-lg mb-2">WebContainer初始化失败</p>
        <p className="text-sm text-zinc-500 mb-4">请检查浏览器兼容性（不支持Safari等）</p>
        <button
          onClick={handleReload}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 text-sm"
        >
          重试
        </button>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-900 text-zinc-500">
        <div className="text-center">
          <div className="text-2xl mb-2">⏳</div>
          <p className="text-sm">WebContainer初始化中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-100 border-b border-zinc-200 shrink-0">
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <span>预览</span>
          {previewUrl && (
            <span className="text-zinc-400 truncate max-w-[200px]">{previewUrl}</span>
          )}
        </div>
        <button
          onClick={handleReload}
          className="text-zinc-500 hover:text-zinc-700 text-xs px-2 py-1 rounded hover:bg-zinc-200"
        >
          刷新
        </button>
      </div>
      {/* Iframe */}
      {previewUrl ? (
        <iframe
          key={iframeKey}
          src={previewUrl}
          className="flex-1 w-full border-0"
          title="Website Preview"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          暂无预览内容
        </div>
      )}
    </div>
  );
}
