import { useState } from 'react';
import { toast } from '../../stores/useToastStore';
import PublishShareDialog from '../PublishShareDialog';
import SaveIndicator from './SaveIndicator';

interface EditorActionsProps {
  topicId: string;
  onRefreshPreview: () => void;
  onSave: () => Promise<boolean>;
}

export default function EditorActions({ topicId, onRefreshPreview, onSave }: EditorActionsProps) {
  const [saving, setSaving] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const ok = await onSave();
      toast.success(ok ? '保存成功' : '没有可保存的内容');
    } catch {
      toast.error('保存失败，文件未同步到云端');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setSaving(true);
    try {
      const ok = await onSave();
      if (!ok) {
        toast.warning('没有可发布的文件，请先添加内容');
        return;
      }
      setShowPublishDialog(true);
    } catch {
      toast.error('保存失败，请先解决网络问题');
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  const handlePublished = () => {
    setPublishing(false);
    toast.success('发布成功');
  };

  return (
    <div className="flex items-center justify-end gap-3 h-full">
      <div className="hidden sm:flex">
        <SaveIndicator topicId={topicId} />
      </div>

      <button
        type="button"
        onClick={onRefreshPreview}
        className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 w-8 h-8 flex items-center justify-center rounded-md border border-gray-300 dark:border-zinc-700 transition-colors outline-none"
        title="刷新预览 (Refresh Preview)"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      <button
        type="button"
        onClick={handlePublish}
        disabled={publishing || saving}
        className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center min-w-[60px]"
      >
        {saving && publishing ? '保存中...' : publishing ? '发布中...' : '发布'}
      </button>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || publishing}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center min-w-[70px]"
      >
        {saving && !publishing ? '保存中...' : '保存代码'}
      </button>

      {showPublishDialog && (
        <PublishShareDialog
          topicId={topicId}
          onClose={() => {
            setShowPublishDialog(false);
            setPublishing(false);
          }}
          onPublished={handlePublished}
        />
      )}
    </div>
  );
}
