import { useEffect, useState } from 'react';

interface PagePreviewProps {
  previewUrl: string | null;
  isReady: boolean;
  error: string | null;
  onRefresh?: () => void;
  reloadKey?: number;
}

export function PagePreview({ previewUrl, isReady, error, onRefresh, reloadKey }: PagePreviewProps) {
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    if (typeof reloadKey === 'number') {
      setIframeKey((current) => current + 1);
    }
  }, [reloadKey]);

  const handleReload = () => {
    if (onRefresh) {
      onRefresh();
      return;
    }
    setIframeKey((current) => current + 1);
  };

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#1e1e1e] text-[#cccccc] p-6">
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
      <div className="h-full w-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p>WebContainer 初始化中...</p>
        </div>
      </div>
    );
  }

  if (!previewUrl) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-500">
        <p>请先运行项目以查看预览</p>
      </div>
    );
  }

  return (
    <iframe
      key={iframeKey}
      src={previewUrl}
      className="h-full w-full border-0"
      title="Page Preview"
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
    />
  );
}
