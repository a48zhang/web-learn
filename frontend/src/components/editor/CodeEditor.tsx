import { useCallback, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '../../stores/useEditorStore';
import { useWebContainer } from '../../hooks/useWebContainer';

export default function CodeEditor() {
  const { activeFile, files, setFileContent, openFiles, closeFile, setActiveFile } = useEditorStore();
  const { syncFile } = useWebContainer();
  const isExternalChange = useRef(false);

  const handleChange = useCallback(async (value: string | undefined) => {
    if (activeFile && value !== undefined && !isExternalChange.current) {
      setFileContent(activeFile, value);
      await syncFile(activeFile, value);
    }
    isExternalChange.current = false;
  }, [activeFile, setFileContent, syncFile]);

  // Mark as external change when active file switches
  useEffect(() => {
    isExternalChange.current = true;
  }, [activeFile]);

  const getLanguage = (filename: string): string => {
    if (filename.endsWith('.html')) return 'html';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
    if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
    if (filename.endsWith('.json')) return 'json';
    if (filename.endsWith('.md')) return 'markdown';
    return 'plaintext';
  };

  if (!activeFile) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-900 text-zinc-500 text-sm">
        双击文件树中的文件打开编辑器
      </div>
    );
  }

  const content = files[activeFile] || '';

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Tab bar */}
      <div className="flex items-center bg-zinc-800 border-b border-zinc-700 overflow-x-auto shrink-0">
        {openFiles.map((path) => {
          const name = path.split('/').pop() || path;
          const isActive = path === activeFile;
          return (
            <div
              key={path}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer border-r border-zinc-700 shrink-0 ${
                isActive ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-700'
              }`}
              onClick={() => setActiveFile(path)}
            >
              <span>{name}</span>
              <button
                className="ml-1 text-zinc-500 hover:text-white"
                onClick={(e) => { e.stopPropagation(); closeFile(path); }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          theme="vs-dark"
          path={activeFile}
          defaultLanguage={getLanguage(activeFile)}
          value={content}
          onChange={handleChange}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            padding: { top: 8 },
          }}
        />
      </div>
    </div>
  );
}
