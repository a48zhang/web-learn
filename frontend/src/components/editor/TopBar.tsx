import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  const navigate = useNavigate();
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
    <div className="h-9 bg-[#2d2d2d] sm:bg-[#181818] border-b border-[#2b2b2b] flex items-center justify-between px-3 text-sm sticky top-0 z-10 shrink-0 select-none">

      {/* MAC / VSCODE TITLE BAR LEFT */}
      <div className="flex items-center justify-center gap-1.5 flex-row group">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-[#333333] transition-colors text-[#cccccc] cursor-pointer outline-none"
          title="Back to Dashboard"
        >
          <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <span className="text-[#cccccc] text-[12px] ml-1 tracking-wide font-medium flex items-center">
          WebEditor Pro
        </span>
      </div>

      {/* VSCODE TITLE BAR CENTER */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center justify-center pointer-events-none">
        <span className="text-[#858585] text-[11px] px-16 h-6 rounded-md bg-[#232323] border border-[#2b2b2b] flex items-center justify-center tracking-wide font-mono">
          Project ID - {id}
        </span>
      </div>

      {/* ACTIONS RIGHT */}
      <div className="flex items-center gap-2">
        <SaveIndicator topicId={id ?? ''} />

        <button
          type="button"
          onClick={onRefreshPreview}
          className="text-[#cccccc] hover:text-white w-6 h-6 flex items-center justify-center rounded shadow-sm border border-transparent hover:bg-[#333333] transition-colors outline-none mx-1"
          title="刷新预览"
        >
          <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {onPublish && (
          <button
            type="button"
            onClick={onPublish}
            className="text-[#cccccc] hover:text-white px-2 py-1 rounded hover:bg-[#333333] text-xs transition-colors"
            title="Publish"
          >
            Publish
          </button>
        )}
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="text-[#cccccc] hover:text-white px-2 py-1 rounded hover:bg-[#333333] text-xs transition-colors"
            title="Share"
          >
            Share
          </button>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-[#007acc] hover:bg-[#005f9e] text-white px-3 py-[3px] rounded-sm text-[11px] font-medium transition-colors outline-none shadow flex items-center justify-center min-w-[50px] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving' : 'Save'}
        </button>
      </div>
    </div>
  );
}
