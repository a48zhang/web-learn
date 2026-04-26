import { useRef, useState, useCallback, useEffect } from 'react';
import { WebContainer } from '@webcontainer/api';
import { useEditorStore } from '../stores/useEditorStore';
import { useTerminalStore } from '../stores/useTerminalStore';
import { setWebContainerInstance } from '../agent/webcontainer';

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;
let devServerStarted = false;
// Fix #4: use Set to deduplicate listeners
const serverReadyListeners = new Set<(url: string) => void>();

function appendTerminalOutput(data: string): void {
  useTerminalStore.getState().appendOutput(data);
}

function writeTerminalHeader(label: string): void {
  appendTerminalOutput(`\r\n[${label}]\r\n`);
}

function pipeProcessOutput(label: string, output: ReadableStream<string>): void {
  output
    .pipeTo(
      new WritableStream({
        write: appendTerminalOutput,
      })
    )
    .catch((err) => {
      const message = err instanceof Error ? err.message : 'unknown stream error';
      appendTerminalOutput(`[${label}] output stream failed: ${message}\r\n`);
    });
}

export function bootWebContainer(): Promise<WebContainer> {
  if (!bootPromise) {
    bootPromise = WebContainer.boot().then(async (wc) => {
      setWebContainerInstance(wc);
      // Fix #1: fire-and-forget registry setup — don't block the critical path
      void setupNpmRegistry(wc).catch((err) => {
        const message = err instanceof Error ? err.message : 'unknown error';
        appendTerminalOutput(`[npm config] failed: ${message}\r\n`);
      });
      return wc;
    });
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
    // blocked for certain reasons
    return;
    writeTerminalHeader('npm config set registry');
    const proc = await wc.spawn(
      'npm',
      ['config', 'set', 'registry', 'https://registry.npmmirror.com'],
      { cwd: '/home/project' }
    );
    pipeProcessOutput('npm config', proc.output);
    await proc.exit;
    appendTerminalOutput('[npm config] registry set to https://registry.npmmirror.com\r\n');
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
    writeTerminalHeader('npm install');
    const installProcess = await webcontainerInstance.spawn('npm', ['install'], { cwd: '/home/project' });
    pipeProcessOutput('npm install', installProcess.output);
    const installExitCode = await installProcess.exit;
    appendTerminalOutput(`[npm install] exited with code ${installExitCode}\r\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    appendTerminalOutput(`[npm install] failed: ${message}\r\n`);
    console.warn('npm install failed, continuing anyway:', err);
  }

  try {
    writeTerminalHeader('npm run dev');
    const devProcess = await webcontainerInstance.spawn('npm', ['run', 'dev', '--', '--host', 'localhost', '--port', '5173'], { cwd: '/home/project' });
    pipeProcessOutput('npm run dev', devProcess.output);

    webcontainerInstance.on('server-ready', (_port: number, url: string) => {
      for (const listener of serverReadyListeners) {
        listener(url);
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    appendTerminalOutput(`[npm run dev] failed: ${message}\r\n`);
    console.error('Failed to start dev server:', err);
  }
}

export function onServerReady(callback: (url: string) => void): void {
  serverReadyListeners.add(callback);
}

export { devServerStarted };

export function useWebContainer() {
  const [status, setStatus] = useState(wcStatus);
  const { setFileContent } = useEditorStore();
  const isInitializing = useRef(false);

  const statusRef = useRef(status);
  statusRef.current = status;

  const setStatusFromGlobal = useCallback(() => {
    setStatus(wcStatus);
  }, []);

  const init = useCallback(async (initialFiles?: Record<string, string>) => {
    if (isInitializing.current) return;
    isInitializing.current = true;
    setWcStatus({ error: null });

    try {
      // Fix #2: always await bootPromise if set; never double-boot
      if (!webcontainerInstance) {
        if (bootPromise) {
          webcontainerInstance = await bootPromise;
        } else {
          // Fallback: should not happen if bootWebContainer was called eagerly
          webcontainerInstance = await WebContainer.boot();
        }
        setWebContainerInstance(webcontainerInstance);
      }

      // Fix #1: setupNpmRegistry removed from here — already fire-and-forget in bootWebContainer

      // Fix #3: pre-compute unique directories, mkdir first (no races), then write files
      const wc = webcontainerInstance;
      const files = initialFiles || {};
      const entries = Object.entries(files);
      const dirs = [...new Set(
        entries
          .map(([path]) => {
            const resolved = path.startsWith('/') ? path : `/home/project/${path}`;
            const dir = resolved.substring(0, resolved.lastIndexOf('/'));
            return dir || null;
          })
          .filter((d): d is string => d != null)
      )];

      // mkdir all directories in parallel
      if (dirs.length > 0) {
        await Promise.all(dirs.map((d) => wc.fs.mkdir(d, { recursive: true })));
      }

      // write all files in parallel (directories already exist)
      if (entries.length > 0) {
        await Promise.all(
          entries.map(async ([path, content]) => {
            const resolved = path.startsWith('/') ? path : `/home/project/${path}`;
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

  // Fix #4: register server-ready listener in useEffect with cleanup
  useEffect(() => {
    wcStatusListeners.add(setStatusFromGlobal);

    const handleServerReady = (url: string) => {
      setWcStatus({ previewUrl: url });
    };
    serverReadyListeners.add(handleServerReady);

    return () => {
      wcStatusListeners.delete(setStatusFromGlobal);
      serverReadyListeners.delete(handleServerReady);
    };
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
