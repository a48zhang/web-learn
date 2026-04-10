import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useEditorStore } from '../../stores/useEditorStore';
import { useAgentStore } from '../../stores/useAgentStore';
import { toast } from '../../stores/useToastStore';
import { topicGitApi } from '../../services/api';
import { createTarball } from '../../utils/tarUtils';
import SaveIndicator from './SaveIndicator';

interface TopBarProps {
  onRefreshPreview: () => void;
  onPublish?: () => void;
  onShare?: () => void;
}

export default function TopBar({ onRefreshPreview, onPublish, onShare }: TopBarProps) {
  const { id } = useParams<{ id: string }>();
  const { getAllFiles, markSaved } = useEditorStore();
  const visibleMessages = useAgentStore((s) => s.visibleMessages);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const files = getAllFiles();
      const tarball = createTarball(files);
      const { url } = await topicGitApi.getPresign(id, 'upload');

      const response = await fetch(url, {
        method: 'PUT',
        body: new Blob([tarball], { type: 'application/gzip' }),
      });

      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

      // Cache locally for fast restore without re-downloading
      localStorage.setItem(`snapshot-${id}`, JSON.stringify(files));
      localStorage.setItem(`chat-history-${id}`, JSON.stringify(visibleMessages));

      markSaved();
      toast.success('保存成功');
    } catch {
      toast.error('保存失败，文件未同步到云端');
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
