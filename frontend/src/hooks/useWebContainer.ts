import { useRef, useState, useCallback, useEffect } from 'react';
import { WebContainer } from '@webcontainer/api';
import { useEditorStore } from '../stores/useEditorStore';
import { setWebContainerInstance } from '../agent/webcontainer';

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;
let devServerStarted = false;
const serverReadyListeners: Array<(url: string) => void> = [];

export function bootWebContainer(): Promise<WebContainer> {
  if (!bootPromise) {
    bootPromise = WebContainer.boot();
  }
  return bootPromise;
}

function isInChina(): boolean {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    tz === 'Asia/Shanghai' ||
    tz === 'Asia/Chongqing' ||
    tz === 'Asia/Harbin' ||
    tz === 'Asia/Urumqi'
  );
}

async function setupNpmRegistry(wc: WebContainer): Promise<void> {
  if (isInChina()) {
    const proc = await wc.spawn(
      'npm',
      ['config', 'set', 'registry', 'https://registry.npmmirror.com'],
      { cwd: '/home/project' }
    );
    await proc.exit;
    console.log('[WC] Set npm registry to npmmirror.com');
  }
}

export type WCStatus = {
  isReady: boolean;
  previewUrl: string | null;
  error: string | null;
};

let wcStatus: WCStatus = { isReady: false, previewUrl: null, error: null };
const wcStatusListeners = new Set<(s: WCStatus) => void>();

function setWcStatus(partial: Partial<WCStatus>): void {
  wcStatus = { ...wcStatus, ...partial };
  for (const listener of wcStatusListeners) {
    listener(wcStatus);
  }
}

export function tryStartDevServer(): void {
  void startDevServerInternal();
}

async function startDevServerInternal(): Promise<void> {
  if (!webcontainerInstance || devServerStarted) return;
  devServerStarted = true;

  try {
    const installProcess = await webcontainerInstance.spawn('npm', ['install'], { cwd: '/home/project' });
    installProcess.output.pipeTo(
      new WritableStream({ write: (data) => console.log('[npm]', data) })
    );
    await installProcess.exit;
  } catch (err) {
    console.warn('npm install failed, continuing anyway:', err);
  }

  try {
    const devProcess = await webcontainerInstance.spawn('npm', ['run', 'dev', '--', '--host', 'localhost', '--port', '5173'], { cwd: '/home/project' });
    devProcess.output.pipeTo(
      new WritableStream({ write: (data) => console.log('[dev]', data) })
    );

    webcontainerInstance.on('server-ready', (_port: number, url: string) => {
      for (const listener of serverReadyListeners) {
        listener(url);
      }
    });
  } catch (err) {
    console.error('Failed to start dev server:', err);
  }
}

export function onServerReady(callback: (url: string) => void): void {
  serverReadyListeners.push(callback);
}

export { devServerStarted };

export function useWebContainer() {
  const [status, setStatus] = useState(wcStatus);
  const { setFileContent } = useEditorStore();
  const isInitializing = useRef(false);

  // Subscribe to global WC status
  const statusRef = useRef(status);
  statusRef.current = status;

  // Sync on mount/subsequent renders
  const setStatusFromGlobal = useCallback(() => {
    setStatus(wcStatus);
  }, []);

  const init = useCallback(async (initialFiles?: Record<string, string>) => {
    if (isInitializing.current) return;
    isInitializing.current = true;
    setWcStatus({ error: null });

    // Register server-ready listener before any dev server starts
    onServerReady((url) => {
      setWcStatus({ previewUrl: url });
    });

    try {
      if (!webcontainerInstance) {
        webcontainerInstance = await (bootPromise || WebContainer.boot());
        setWebContainerInstance(webcontainerInstance);
      }

      await setupNpmRegistry(webcontainerInstance);

      // Write initial files in parallel batches
      const wc = webcontainerInstance;
      const files = initialFiles || {};
      const entries = Object.entries(files);
      const BATCH_SIZE = 20;
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async ([path, content]) => {
            const resolved = path.startsWith('/') ? path : `/home/project/${path}`;
            const dir = resolved.substring(0, resolved.lastIndexOf('/'));
            if (dir) await wc.fs.mkdir(dir, { recursive: true });
            await wc.fs.writeFile(resolved, content);
          })
        );
      }

      setWcStatus({ isReady: true });

      // If package.json exists, install deps and start dev server
      if (files['package.json']) {
        await startDevServerInternal();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'WebContainer initialization failed';
      setWcStatus({ error: message });
      console.error('WebContainer error:', err);
    } finally {
      isInitializing.current = false;
    }
  }, []);

  const writeFile = useCallback(async (path: string, content: string) => {
    if (!webcontainerInstance) return;
    const resolved = path.startsWith('/') ? path : `/home/project/${path}`;
    const dir = resolved.substring(0, resolved.lastIndexOf('/'));
    if (dir) {
      await webcontainerInstance.fs.mkdir(dir, { recursive: true });
    }
    await webcontainerInstance.fs.writeFile(resolved, content);
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

  // Subscribe to global status changes on mount
  useEffect(() => {
    wcStatusListeners.add(setStatusFromGlobal);
    return () => { wcStatusListeners.delete(setStatusFromGlobal); };
  }, [setStatusFromGlobal]);

  const { isReady, previewUrl, error } = status;

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
