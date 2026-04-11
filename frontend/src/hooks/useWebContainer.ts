import { useRef, useState, useCallback } from 'react';
import { WebContainer } from '@webcontainer/api';
import { useEditorStore } from '../stores/useEditorStore';
import { setWebContainerInstance } from '../agent/webcontainer';

let webcontainerInstance: WebContainer | null = null;

export function useWebContainer() {
  const [isReady, setIsReady] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { setFileContent } = useEditorStore();
  const isInitializing = useRef(false);

  const writeFile = useCallback(async (path: string, content: string) => {
    if (!webcontainerInstance) return;
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir) {
      await webcontainerInstance.fs.mkdir(dir, { recursive: true });
    }
    await webcontainerInstance.fs.writeFile(path, content);
  }, []);

  const deleteFileWC = useCallback(async (path: string) => {
    if (!webcontainerInstance) return;
    try {
      await webcontainerInstance.fs.rm(path, { recursive: true, force: true });
    } catch (err) {
      console.warn('Failed to delete file in WebContainer:', err);
    }
  }, []);

  const syncFile = useCallback(async (path: string, content: string) => {
    await writeFile(path, content);
    setFileContent(path, content);
  }, [writeFile, setFileContent]);

  const init = useCallback(async (initialFiles?: Record<string, string>) => {
    if (isInitializing.current) return;
    isInitializing.current = true;
    setError(null);

    try {
      if (!webcontainerInstance) {
        webcontainerInstance = await WebContainer.boot();
        setWebContainerInstance(webcontainerInstance);
      }

      // Write initial files
      const files = initialFiles || {};
      for (const [path, content] of Object.entries(files)) {
        await writeFile(path, content);
      }

      setIsReady(true);

      // If package.json exists, install deps and start dev server
      if (files['package.json']) {
        const installProcess = await webcontainerInstance.spawn('npm', ['install']);
        installProcess.output.pipeTo(
          new WritableStream({ write: (data) => console.log('[npm]', data) })
        );
        await installProcess.exit;
      }

      // Start dev server
      const devProcess = await webcontainerInstance.spawn('npm', ['run', 'dev', '--', '--host', 'localhost', '--port', '5173']);
      devProcess.output.pipeTo(
        new WritableStream({ write: (data) => console.log('[dev]', data) })
      );

      // Wait for server to be ready
      webcontainerInstance.on('server-ready', (_port: number, url: string) => {
        setPreviewUrl(url);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'WebContainer initialization failed';
      setError(message);
      console.error('WebContainer error:', err);
    } finally {
      isInitializing.current = false;
    }
  }, [writeFile]);

  return {
    isReady,
    previewUrl,
    error,
    init,
    writeFile,
    deleteFile: deleteFileWC,
    syncFile,
    getInstance: () => webcontainerInstance,
  };
}
