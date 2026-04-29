import { useRef, useState, useCallback, useEffect } from 'react';
import { WebContainer } from '@webcontainer/api';
import { useTerminalStore } from '../stores/useTerminalStore';
import { PROJECT_ROOT, setWebContainerInstance, wcResetProject } from '../agent/webcontainer';

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;
let devServerStarted = false;
let currentTopicId: string | null = null;
let currentSessionId = 0;
let currentProjectSnapshotSignature: string | null = null;
let pendingProjectSnapshotSignature: string | null = null;
let devServerStartedSessionId: number | null = null;
let projectInitChain: Promise<void> = Promise.resolve();
// Fix #4: use Set to deduplicate listeners
const serverReadyListeners = new Set<(url: string) => void>();

type WebContainerProcessHandle = {
  output: ReadableStream<string>;
  exit: Promise<number>;
  kill: () => void;
};

let devProcess: WebContainerProcessHandle | null = null;
let devProcessSessionId: number | null = null;
let devProcessKilled = false;
let installProcess: WebContainerProcessHandle | null = null;
let installProcessSessionId: number | null = null;
let serverReadyUnsubscribe: (() => void) | null = null;
const WEBCONTAINER_BOOT_OPTIONS = { coep: 'credentialless' as const };

function getDevServerPort(sessionId: number): number {
  return 5173 + sessionId;
}

function createProjectSnapshotSignature(files: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(files).sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
  );
}

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
    const nextBootPromise = WebContainer.boot(WEBCONTAINER_BOOT_OPTIONS).then(async (wc) => {
      setWebContainerInstance(wc);
      // Fix #1: fire-and-forget registry setup — don't block the critical path
      void setupNpmRegistry(wc).catch((err) => {
        const message = err instanceof Error ? err.message : 'unknown error';
        appendTerminalOutput(`[npm config] failed: ${message}\r\n`);
      });
      return wc;
    }).catch((err) => {
      if (bootPromise === nextBootPromise) {
        bootPromise = null;
      }
      throw err;
    });
    bootPromise = nextBootPromise;
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
  currentTopicId: string | null;
  sessionId: number;
  isReady: boolean;
  previewUrl: string | null;
  error: string | null;
};

let wcStatus: WCStatus = {
  currentTopicId: null,
  sessionId: 0,
  isReady: false,
  previewUrl: null,
  error: null,
};
const wcStatusListeners = new Set<(s: WCStatus) => void>();

function setWcStatus(partial: Partial<WCStatus>): void {
  wcStatus = { ...wcStatus, ...partial };
  for (const listener of wcStatusListeners) {
    listener(wcStatus);
  }
}

export function tryStartDevServer(): void {
  void startDevServerInternal(currentSessionId);
}

async function startDevServerInternal(sessionId: number): Promise<void> {
  if (!webcontainerInstance || devServerStartedSessionId === sessionId) return;
  const wc = webcontainerInstance;
  const devServerPort = getDevServerPort(sessionId);
  devServerStartedSessionId = sessionId;
  devServerStarted = true;
  if (sessionId === currentSessionId && wcStatus.error) {
    setWcStatus({ error: null });
  }

  try {
    writeTerminalHeader('npm install');
    const process = await wc.spawn('npm', ['install'], { cwd: PROJECT_ROOT });
    if (sessionId !== currentSessionId) {
      process.kill();
      if (devServerStartedSessionId === sessionId) {
        devServerStartedSessionId = null;
        devServerStarted = false;
      }
      return;
    }
    installProcess = process;
    installProcessSessionId = sessionId;
    pipeProcessOutput('npm install', process.output);
    const installExitCode = await process.exit;
    appendTerminalOutput(`[npm install] exited with code ${installExitCode}\r\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    appendTerminalOutput(`[npm install] failed: ${message}\r\n`);
    console.warn('npm install failed, continuing anyway:', err);
  } finally {
    if (installProcessSessionId === sessionId) {
      installProcess = null;
      installProcessSessionId = null;
    }
  }

  if (sessionId !== currentSessionId) {
    if (devServerStartedSessionId === sessionId) {
      devServerStartedSessionId = null;
      devServerStarted = false;
    }
    return;
  }

  try {
    writeTerminalHeader('npm run dev');
    const process = await wc.spawn(
      'npm',
      ['run', 'dev', '--', '--host', 'localhost', '--port', String(devServerPort)],
      { cwd: PROJECT_ROOT }
    );

    if (sessionId !== currentSessionId) {
      process.kill();
      if (devServerStartedSessionId === sessionId) {
        devServerStartedSessionId = null;
        devServerStarted = false;
      }
      return;
    }

    devProcess = process;
    devProcessSessionId = sessionId;
    devProcessKilled = false;
    pipeProcessOutput('npm run dev', process.output);

    if (serverReadyUnsubscribe) {
      serverReadyUnsubscribe();
      serverReadyUnsubscribe = null;
    }
    serverReadyUnsubscribe = wc.on('server-ready', (port: number, url: string) => {
      if (
        sessionId !== currentSessionId ||
        devProcessSessionId !== sessionId ||
        !devProcess ||
        devProcessKilled ||
        port !== devServerPort
      ) {
        return;
      }
      setWcStatus({ previewUrl: url, error: null });
      for (const listener of serverReadyListeners) {
        listener(url);
      }
    });

    void process.exit.then(() => {
      if (devProcess === process) {
        devProcess = null;
        devProcessSessionId = null;
        devProcessKilled = false;
        if (devServerStartedSessionId === sessionId) {
          devServerStartedSessionId = null;
          devServerStarted = false;
        }
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    appendTerminalOutput(`[npm run dev] failed: ${message}\r\n`);
    if (sessionId === currentSessionId) {
      setWcStatus({ error: message });
      devServerStartedSessionId = null;
      devServerStarted = false;
    }
    console.error('Failed to start dev server:', err);
  }
}

export function onServerReady(callback: (url: string) => void): () => void {
  serverReadyListeners.add(callback);
  return () => {
    serverReadyListeners.delete(callback);
  };
}

export { devServerStarted };

async function ensureWebContainerInstance(): Promise<WebContainer> {
  if (!webcontainerInstance) {
    if (bootPromise) {
      webcontainerInstance = await bootPromise;
    } else {
      // Fallback: should not happen if bootWebContainer was called eagerly
      webcontainerInstance = await WebContainer.boot(WEBCONTAINER_BOOT_OPTIONS);
    }
    setWebContainerInstance(webcontainerInstance);
  }
  return webcontainerInstance;
}

function stopCurrentDevProcess(): void {
  if (serverReadyUnsubscribe) {
    serverReadyUnsubscribe();
    serverReadyUnsubscribe = null;
  }

  if (devProcess) {
    try {
      devProcessKilled = true;
      devProcess.kill();
    } catch (err) {
      console.warn('Failed to stop WebContainer dev process:', err);
    }
  }

  if (installProcess) {
    try {
      installProcess.kill();
    } catch (err) {
      console.warn('Failed to stop WebContainer install process:', err);
    }
  }

  devProcess = null;
  devProcessSessionId = null;
  devProcessKilled = false;
  installProcess = null;
  installProcessSessionId = null;
  devServerStartedSessionId = null;
  devServerStarted = false;
}

export function __resetUseWebContainerForTests(): void {
  stopCurrentDevProcess();
  webcontainerInstance = null;
  bootPromise = null;
  currentTopicId = null;
  currentSessionId = 0;
  currentProjectSnapshotSignature = null;
  pendingProjectSnapshotSignature = null;
  projectInitChain = Promise.resolve();
  serverReadyListeners.clear();
  wcStatus = {
    currentTopicId: null,
    sessionId: 0,
    isReady: false,
    previewUrl: null,
    error: null,
  };
  wcStatusListeners.clear();
}

export function useWebContainer() {
  const [status, setStatus] = useState(wcStatus);
  const isInitializing = useRef(false);

  const setStatusFromGlobal = useCallback(() => {
    setStatus(wcStatus);
  }, []);

  const initProject = useCallback(async (topicId: string, initialFiles?: Record<string, string>) => {
    const files = initialFiles ?? {};
    const snapshotSignature = createProjectSnapshotSignature(files);
    if (
      currentTopicId === topicId &&
      currentProjectSnapshotSignature === snapshotSignature &&
      wcStatus.isReady &&
      !wcStatus.error
    ) {
      return;
    }
    if (
      isInitializing.current &&
      currentTopicId === topicId &&
      pendingProjectSnapshotSignature === snapshotSignature
    ) {
      return;
    }

    const snapshotChanged = currentProjectSnapshotSignature !== snapshotSignature;
    const topicChanged = currentTopicId !== topicId;
    const sessionId = currentSessionId + 1;
    currentSessionId = sessionId;
    currentTopicId = topicId;
    pendingProjectSnapshotSignature = snapshotSignature;

    if (topicChanged || snapshotChanged) {
      stopCurrentDevProcess();
    }

    isInitializing.current = true;
    setWcStatus({
      currentTopicId: topicId,
      sessionId,
      isReady: false,
      previewUrl: null,
      error: null,
    });

    const runSession = async () => {
      try {
        // Fix #2: always await bootPromise if set; never double-boot
        await ensureWebContainerInstance();

        if (sessionId !== currentSessionId) return;

        // Fix #1: setupNpmRegistry removed from here — already fire-and-forget in bootWebContainer
        await wcResetProject(files, () => sessionId === currentSessionId);

        if (sessionId !== currentSessionId) return;

        currentProjectSnapshotSignature = snapshotSignature;
        setWcStatus({ isReady: true });

        // If package.json exists, install deps and start dev server
        if (files['package.json']) {
          void startDevServerInternal(sessionId);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'WebContainer initialization failed';
        if (sessionId === currentSessionId) {
          setWcStatus({ error: message });
        }
        console.error('WebContainer error:', err);
      } finally {
        if (sessionId === currentSessionId) {
          pendingProjectSnapshotSignature = null;
          isInitializing.current = false;
        }
      }
    };

    const previousInit = projectInitChain;
    const nextInit = previousInit.then(runSession, runSession);
    projectInitChain = nextInit.catch(() => undefined);
    await nextInit;
  }, []);

  const init = useCallback(async (initialFiles?: Record<string, string>) => {
    await initProject(currentTopicId ?? 'default', initialFiles);
  }, [initProject]);

  useEffect(() => {
    wcStatusListeners.add(setStatusFromGlobal);

    return () => {
      wcStatusListeners.delete(setStatusFromGlobal);
    };
  }, [setStatusFromGlobal]);

  const { currentTopicId: statusTopicId, sessionId, isReady, previewUrl, error } = status;

  return {
    currentTopicId: statusTopicId,
    sessionId,
    isReady,
    previewUrl,
    error,
    init,
    initProject,
    getInstance: () => webcontainerInstance,
  };
}
