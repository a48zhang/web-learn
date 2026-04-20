import { PagePreview } from './PagePreview';
import { CodePreview } from './CodePreview';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePreviewSync } from '@/hooks/usePreviewSync';

interface PreviewPanelProps {
  previewUrl: string | null;
  isReady: boolean;
  error: string | null;
  onRefresh?: () => void;
  reloadKey?: number;
}

export function PreviewPanel({ previewUrl, isReady, error, onRefresh, reloadKey }: PreviewPanelProps) {
  const { previewMode, setPreviewMode } = useEditorStore();

  // 自动同步预览内容
  usePreviewSync();

  return (
    <div className="h-full flex flex-col border-l border-gray-200 dark:border-gray-800">
      <div className="px-2 py-1 border-b border-gray-200 dark:border-gray-800">
        <div className="inline-flex rounded-md bg-gray-100 dark:bg-zinc-900 p-1">
          <button
            type="button"
            onClick={() => setPreviewMode('page')}
            className={`px-3 py-1 text-sm rounded-sm transition-colors ${
              previewMode === 'page'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            页面
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('code')}
            className={`px-3 py-1 text-sm rounded-sm transition-colors ${
              previewMode === 'code'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            代码
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {previewMode === 'page' ? (
          <PagePreview
            previewUrl={previewUrl}
            isReady={isReady}
            error={error}
            onRefresh={onRefresh}
            reloadKey={reloadKey}
          />
        ) : (
          <CodePreview />
        )}
      </div>
    </div>
  );
}
