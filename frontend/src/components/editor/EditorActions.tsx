import { useState } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import { useAgentStore } from '../../stores/useAgentStore';
import { toast } from '../../stores/useToastStore';
import { topicGitApi } from '../../services/api';
import { createTarball } from '../../utils/tarUtils';
import PublishShareDialog from '../PublishShareDialog';
import SaveIndicator from './SaveIndicator';

interface EditorActionsProps {
  topicId: string;
  onRefreshPreview: () => void;
}

export default function EditorActions({ topicId, onRefreshPreview }: EditorActionsProps) {
  const { getAllFiles, markSaved } = useEditorStore();
  const visibleMessages = useAgentStore((s) => s.visibleMessages);
  const [saving, setSaving] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const files = getAllFiles();
      const tarball = createTarball(files);
      const { url } = await topicGitApi.getPresign(topicId, 'upload');

      const response = await fetch(url, {
        method: 'PUT',
        body: new Blob([tarball], { type: 'application/gzip' }),
      });

      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

      localStorage.setItem(`snapshot-${topicId}`, JSON.stringify(files));
      localStorage.setItem(`chat-history-${topicId}`, JSON.stringify(visibleMessages));

      markSaved();
      toast.success('保存成功');
    } catch {
      toast.error('保存失败，文件未同步到云端');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = () => {
    setPublishing(true);
    setShowPublishDialog(true);
  };

  const handlePublished = () => {
    setPublishing(false);
    markSaved();
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
        disabled={publishing}
        className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center min-w-[60px]"
      >
        发布
      </button>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || publishing}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center min-w-[70px]"
      >
        {saving ? '保存中...' : '保存代码'}
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
