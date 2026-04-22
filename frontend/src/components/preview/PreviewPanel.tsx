import { PagePreview } from './PagePreview';
import CodeEditor from '../editor/CodeEditor';
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
  const { previewMode, setPreviewMode, openFiles, activeFile, setActiveFile, closeFile } = useEditorStore();

  // 自动同步预览内容
  usePreviewSync();

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-gray-800">
      {/* Unified Tab bar */}
      <div className="flex items-center bg-gray-50 dark:bg-zinc-800 overflow-x-auto shrink-0 select-none border-b border-gray-200 dark:border-gray-800">
        <div
          className={`flex items-center gap-1 px-4 py-2 text-[13px] cursor-pointer border-r border-gray-200 dark:border-gray-800 border-b-2 shrink-0 transition-colors ${previewMode === 'page'
              ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 border-b-blue-600 dark:border-b-blue-400'
              : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 border-b-transparent'
            }`}
          onClick={() => setPreviewMode('page')}
        >
          <span>应用预览</span>
        </div>
        {openFiles.map((path) => {
          const name = path.split('/').pop() || path;
          const isActive = previewMode === 'code' && path === activeFile;
          return (
            <div
              key={path}
              className={`flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer border-r border-gray-200 dark:border-gray-800 border-b-2 shrink-0 transition-colors group ${isActive
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 border-b-blue-600 dark:border-b-blue-400'
                  : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 border-b-transparent'
                }`}
              onClick={() => {
                setActiveFile(path);
                setPreviewMode('code');
              }}
            >
              <span>{name}</span>
              <button
                className={`text-gray-400 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-white rounded w-5 h-5 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-600 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                onClick={(e) => { e.stopPropagation(); closeFile(path); }}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden bg-white dark:bg-zinc-900">
        {previewMode === 'page' ? (
          <PagePreview
            previewUrl={previewUrl}
            isReady={isReady}
            error={error}
            onRefresh={onRefresh}
            reloadKey={reloadKey}
          />
        ) : (
          <CodeEditor />
        )}
      </div>
    </div>
  );
}
