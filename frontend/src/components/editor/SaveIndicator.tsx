import { useEffect, useState } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';

interface SaveIndicatorProps {
  topicId: string;
}

function SaveIndicator({ topicId: _topicId }: SaveIndicatorProps) {
  const { hasUnsavedChanges, lastSavedAt } = useEditorStore();
  const [, setTick] = useState(0);

  // Refresh relative time display every 30 seconds
  useEffect(() => {
    if (!lastSavedAt) return;
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, [lastSavedAt]);

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
