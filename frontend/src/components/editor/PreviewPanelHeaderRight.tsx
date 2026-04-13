interface PreviewPanelHeaderRightProps {
  previewUrl: string | null;
  onRefresh: () => void;
}

export default function PreviewPanelHeaderRight({ previewUrl, onRefresh }: PreviewPanelHeaderRightProps) {
  return (
    <div className="flex items-center justify-end px-2 h-full gap-2">
      {previewUrl && (
        <a 
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#007acc] hover:text-[#3794ff] truncate max-w-[200px]"
          title="在新标签页中打开"
        >
          {previewUrl}
        </a>
      )}
      <button
        onClick={onRefresh}
        className="text-[#858585] hover:text-white w-6 h-6 flex items-center justify-center rounded hover:bg-[#333333] transition-colors outline-none"
        title="刷新预览"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  );
}
