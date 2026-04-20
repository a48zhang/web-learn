import { useEffect } from 'react';
import { useEditorStore } from '../stores/useEditorStore';
import { wcOnFileChange, wcReadFile } from '../agent/webcontainer';

export function usePreviewSync() {
  const { activeFile, files, setActivePreviewContent } = useEditorStore();

  useEffect(() => {
    if (!activeFile) {
      setActivePreviewContent(null);
      return;
    }

    if (activeFile in files) {
      setActivePreviewContent(files[activeFile] ?? '');
    }
  }, [activeFile, files, setActivePreviewContent]);

  useEffect(() => {
    if (!activeFile) return;

    // 监听文件变化
    const unsubscribe = wcOnFileChange(async (path) => {
      if (path === activeFile) {
        try {
          const content = await wcReadFile(path);
          setActivePreviewContent(content);
        } catch (e) {
          console.error('Failed to read file for preview:', e);
        }
      }
    });

    // 初始加载内容
    const loadInitialContent = async () => {
      try {
        const content = await wcReadFile(activeFile);
        setActivePreviewContent(content);
      } catch (e) {
        console.error('Failed to load initial preview content:', e);
      }
    };
    loadInitialContent();

    return unsubscribe;
  }, [activeFile, setActivePreviewContent]);

  return null;
}
