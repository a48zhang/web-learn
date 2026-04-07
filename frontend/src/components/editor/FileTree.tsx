import { useState } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import type { FileTreeNode } from '@web-learn/shared';
import { FiPlus } from 'react-icons/fi';

function getFileIcon(filename: string): string {
  if (filename.endsWith('.html') || filename.endsWith('.htm')) return '📄';
  if (filename.endsWith('.css')) return '🎨';
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return '📜';
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return '📘';
  if (filename.endsWith('.json')) return '⚙️';
  if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.svg')) return '🖼️';
  if (filename.endsWith('.md')) return '📝';
  return '📄';
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
        className="group flex items-center gap-1 px-2 py-0.5 text-sm hover:bg-zinc-800 cursor-pointer text-zinc-300"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onOpenFile(node.path)}
        title={node.path}
      >
        <span className="text-xs shrink-0">{getFileIcon(node.name)}</span>
        <span className="truncate flex-1">{node.name}</span>
        <button
          className="hidden group-hover:flex text-zinc-500 hover:text-red-400 ml-1 shrink-0"
          onClick={handleDelete}
          title="删除"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-0.5 text-sm hover:bg-zinc-800 cursor-pointer text-zinc-400"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-xs shrink-0">{expanded ? '📂' : '📁'}</span>
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
    <div className="h-full flex flex-col bg-zinc-900 text-zinc-300">
      <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-700">
        <span className="text-xs font-medium uppercase tracking-wide">文件</span>
        <button onClick={handleNewFile} className="text-zinc-400 hover:text-white p-1" title="新建文件">
          <FiPlus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
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
