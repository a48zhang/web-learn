import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { topicFileApi } from '../../services/api';
import { useEditorStore } from '../../stores/useEditorStore';
import { useChatStore } from '../../stores/useChatStore';
import { toast } from '../../stores/useToastStore';
import SaveIndicator from './SaveIndicator';

interface TopBarProps {
  onRefreshPreview: () => void;
  onPublish?: () => void;
  onShare?: () => void;
}

export default function TopBar({ onRefreshPreview, onPublish, onShare }: TopBarProps) {
  const { id } = useParams<{ id: string }>();
  const { getAllFiles, markSaved } = useEditorStore();
  const { messages } = useChatStore();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const files = getAllFiles();
      await topicFileApi.saveSnapshot(id, files);
      markSaved();
      await topicFileApi.saveChatHistory(id, messages as any[]);
      toast.success('保存成功');
    } catch {
      toast.error('保存失败，请检查网络连接');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-10 bg-zinc-900 border-b border-zinc-700 flex items-center justify-between px-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-zinc-400 font-medium">网站编辑器</span>
      </div>
      <div className="flex items-center gap-2">
        <SaveIndicator topicId={id ?? ''} />
        <button
          type="button"
          onClick={onRefreshPreview}
          className="text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-zinc-700 text-xs"
          title="刷新预览"
        >
          刷新预览
        </button>
        {onPublish && (
          <button
            type="button"
            onClick={onPublish}
            className="text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-zinc-700 text-xs"
            title="发布到网站"
          >
            发布到网站
          </button>
        )}
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-zinc-700 text-xs"
            title="分享链接"
          >
            分享链接
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
