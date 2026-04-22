import { useState } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import type { FileTreeNode } from '@web-learn/shared';
import { FiPlus, FiFile, FiFileText, FiCode, FiSettings, FiImage, FiEdit2, FiFolder, FiDroplet, FiArchive } from 'react-icons/fi';

function getFileIcon(filename: string): React.ReactNode {
  if (filename.endsWith('.html') || filename.endsWith('.htm')) return <FiFileText size={14} />;
  if (filename.endsWith('.css')) return <FiDroplet size={14} />;
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return <FiCode size={14} />;
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return <FiCode size={14} />;
  if (filename.endsWith('.json')) return <FiSettings size={14} />;
  if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.svg')) return <FiImage size={14} />;
  if (filename.endsWith('.md')) return <FiEdit2 size={14} />;
  return <FiFile size={14} />;
}

interface FileTreeProps {
  onOpenFile: (path: string) => void;
  onDeleteFile: (path: string) => void | Promise<void>;
}

function TreeNode({
  node,
  depth,
  onOpenFile,
  onDeleteFile,
}: {
  node: FileTreeNode;
  depth: number;
  onOpenFile: (path: string) => void;
  onDeleteFile: (path: string) => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确定删除 ${node.path} 吗？`)) {
      void Promise.resolve(onDeleteFile(node.path)).catch((error) => {
        console.error('Delete file callback failed:', error);
        // User-facing error toast is handled by parent component
      });
    }
  };

  if (node.type === 'file') {
    return (
      <div
        className="group flex items-center justify-between px-2 pr-4 py-[3px] text-[13px] hover:bg-[#2a2d2e] cursor-pointer text-[#cccccc] select-none tracking-wide"
        style={{ paddingLeft: `${depth * 14 + 14}px` }}
        onClick={() => onOpenFile(node.path)}
        title={node.path}
      >
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          <span className="shrink-0 text-[#858585]">{getFileIcon(node.name)}</span>
          <span className="truncate">{node.name}</span>
        </div>
        <button
          className="hidden group-hover:flex items-center justify-center text-[#858585] hover:bg-[#3d3d3d] hover:text-white p-[3px] rounded-md ml-2 shrink-0 transition-colors"
          onClick={handleDelete}
          title="删除"
          aria-label={`删除 ${node.name}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center gap-1.5 px-2 py-[3px] text-[13px] hover:bg-[#2a2d2e] cursor-pointer text-[#cccccc] font-medium tracking-wide select-none"
        style={{ paddingLeft: `${depth * 14 + 14}px` }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="shrink-0 text-zinc-400">{expanded ? <FiArchive size={14} /> : <FiFolder size={14} />}</span>
        <span className="truncate">{node.name}</span>
      </div>
      {expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onOpenFile={onOpenFile}
              onDeleteFile={onDeleteFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ onOpenFile, onDeleteFile }: FileTreeProps) {
  const { fileTree, createFile } = useEditorStore();

  const handleNewFile = () => {
    const name = prompt('输入文件名:');
    if (name) {
      createFile(name, '');
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-[#cccccc] select-none">
      <div className="flex items-center justify-between px-4 py-2 hover:bg-[#2a2d2e] cursor-pointer group">
        <div className="flex items-center gap-1.5 focus:outline-none">
          <svg className="w-3.5 h-3.5 text-[#cccccc]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#cccccc]">EXPLORER</span>
        </div>
        <button onClick={handleNewFile} className="text-[#cccccc] opacity-0 group-hover:opacity-100 hover:bg-[#3d3d3d] p-[4px] rounded-md transition-all" title="New File">
          <FiPlus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {fileTree.length > 0 ? (
          fileTree.map((node) => (
            <TreeNode key={node.path} node={node} depth={0} onOpenFile={onOpenFile} onDeleteFile={onDeleteFile} />
          ))
        ) : (
          <div className="p-4 text-xs text-zinc-500 text-center">
            暂无文件，请在对话中让Agent生成
          </div>
        )}
      </div>
    </div>
  );
}
