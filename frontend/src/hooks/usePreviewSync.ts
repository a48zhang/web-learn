import { useEffect } from 'react';
import { useEditorStore } from '../stores/useEditorStore';

export function usePreviewSync() {
  const { activeFile, files, setActivePreviewContent } = useEditorStore();

  useEffect(() => {
    if (!activeFile) {
      setActivePreviewContent(null);
      return;
    }

    if (activeFile in files) {
      setActivePreviewContent(files[activeFile] ?? '');
    } else {
      setActivePreviewContent(null);
    }
  }, [activeFile, files, setActivePreviewContent]);

  return null;
}
