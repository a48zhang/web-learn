import { useCallback, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '../../stores/useEditorStore';
import { useWebContainer } from '../../hooks/useWebContainer';
import { useThemeStore } from '../../stores/useThemeStore';

export default function CodeEditor() {
  const { activeFile, files, setFileContent } = useEditorStore();
  const { syncFile } = useWebContainer();
  const { theme } = useThemeStore();
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
    return null;
  }

  const content = files[activeFile] || '';

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800">
      {/* Editor */}
      <div className="flex-1 min-h-0 bg-white dark:bg-zinc-900">
        <Editor
          height="100%"
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
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
