import { useEffect } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';

interface SaveIndicatorProps {
  topicId: string;
}

function SaveIndicator({ topicId }: SaveIndicatorProps) {
  const { hasUnsavedChanges, lastSavedAt, markSaved, getAllFiles } = useEditorStore();

  // Auto-save when changes are made (debounced)
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const timer = setTimeout(async () => {
      const files = getAllFiles();
      try {
        const { topicFileApi } = await import('../../services/api');
        await topicFileApi.saveSnapshot(topicId, files);
        markSaved();
      } catch {
        // Auto-save failed silently — user can retry manually
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, topicId, getAllFiles, markSaved]);

  // Navigation warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const formatLastSaved = (date: Date | null) => {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return '刚刚';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} 分钟前`;
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  // NOTE: Manual save is in TopBar's existing save button.
  // This component is status-only to avoid duplication.

  return (
    <div className="flex items-center gap-2 text-xs">
      {hasUnsavedChanges ? (
        <span className="flex items-center gap-1 text-amber-400">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          未保存
        </span>
      ) : lastSavedAt ? (
        <span className="flex items-center gap-1 text-green-400">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
          已保存 · {formatLastSaved(lastSavedAt)}
        </span>
      ) : (
        <span className="text-zinc-500">无未保存的更改</span>
      )}
    </div>
  );
}

export default SaveIndicator;
