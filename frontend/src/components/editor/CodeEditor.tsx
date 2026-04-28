import { useCallback, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '../../stores/useEditorStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { writeProjectFile } from '../../services/projectFileService';
import { toast } from '../../stores/useToastStore';

export default function CodeEditor() {
  const { activeFile, files } = useEditorStore();
  const { theme } = useThemeStore();
  const isExternalChange = useRef(false);
  const writeSequenceByFile = useRef<Record<string, number>>({});
  const writeQueueByFile = useRef<Record<string, Promise<void>>>({});

  const handleChange = useCallback(async (value: string | undefined) => {
    if (activeFile && value !== undefined) {
      if (isExternalChange.current && value === (files[activeFile] ?? '')) {
        isExternalChange.current = false;
        return;
      }

      const filePath = activeFile;
      const sequence = (writeSequenceByFile.current[filePath] ?? 0) + 1;
      writeSequenceByFile.current[filePath] = sequence;

      const previousWrite = writeQueueByFile.current[filePath] ?? Promise.resolve();
      const queuedWrite = previousWrite
        .catch(() => undefined)
        .then(() => writeProjectFile(filePath, value, {
          shouldCommit: () => writeSequenceByFile.current[filePath] === sequence,
        }));
      writeQueueByFile.current[filePath] = queuedWrite;

      try {
        await queuedWrite;
      } catch (error) {
        console.error('File save failed:', error);
        if (writeSequenceByFile.current[filePath] === sequence) {
          toast.error('保存文件失败，请稍后重试');
        }
      }
    }
    isExternalChange.current = false;
  }, [activeFile, files]);

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
