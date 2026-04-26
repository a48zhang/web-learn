import { WebContainer } from '@webcontainer/api';

let wcInstance: WebContainer | null = null;
const fileChangeListeners = new Set<(path: string) => void>();

const WC_PROJECT_DIR = '/home/project';

function wcPath(path: string): string {
  if (path.startsWith('/')) return path;
  return `${WC_PROJECT_DIR}/${path}`;
}

function emitFileChange(path: string): void {
  for (const listener of fileChangeListeners) {
    listener(path);
  }
}

export async function getWebContainer(): Promise<WebContainer> {
  if (!wcInstance) {
    throw new Error('WebContainer is not initialized');
  }
  return wcInstance;
}

export function setWebContainerInstance(wc: WebContainer): void {
  wcInstance = wc;
}

export async function wcReadFile(path: string): Promise<string> {
  const wc = await getWebContainer();
  const resolved = wcPath(path);
  try {
    const content = await wc.fs.readFile(resolved, 'utf-8');
    return content;
  } catch {
    throw new Error(`File not found: ${path}`);
  }
}

export async function wcWriteFile(path: string, content: string): Promise<void> {
  const wc = await getWebContainer();
  const resolved = wcPath(path);
  const dir = resolved.substring(0, resolved.lastIndexOf('/'));
  if (dir) {
    await wc.fs.mkdir(dir, { recursive: true });
  }
  await wc.fs.writeFile(resolved, content);
  emitFileChange(path);
}

export async function wcCreateFile(path: string, content = ''): Promise<void> {
  const wc = await getWebContainer();
  const resolved = wcPath(path);
  const dir = resolved.substring(0, resolved.lastIndexOf('/'));
  if (dir) {
    await wc.fs.mkdir(dir, { recursive: true });
  }
  await wc.fs.writeFile(resolved, content);
  emitFileChange(path);
}

export async function wcDeleteFile(path: string): Promise<void> {
  const wc = await getWebContainer();
  await wc.fs.rm(wcPath(path), { recursive: true, force: true });
}

export async function wcMoveFile(oldPath: string, newPath: string): Promise<void> {
  const wc = await getWebContainer();
  const newResolved = wcPath(newPath);
  const dir = newResolved.substring(0, newResolved.lastIndexOf('/'));
  if (dir) {
    await wc.fs.mkdir(dir, { recursive: true });
  }
  await wc.fs.rename(wcPath(oldPath), newResolved);
}

export async function wcListFiles(rootPath = '.'): Promise<string[]> {
  const wc = await getWebContainer();
  const files: string[] = [];
  const base = rootPath === '.' ? WC_PROJECT_DIR : wcPath(rootPath);

  async function walk(dir: string) {
    const entries = await wc.fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = dir === WC_PROJECT_DIR ? entry.name : `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') {
          await walk(fullPath);
        }
      } else {
        // Return relative paths
        files.push(fullPath.replace(WC_PROJECT_DIR + '/', ''));
      }
    }
  }

  await walk(base);
  return files;
}

export interface SpawnResult {
  output: string;
  exitCode: number | null;
}

export const SAFE_COMMANDS = new Set([
  'npm', 'npx', 'node', 'ls', 'cat', 'mkdir', 'rm', 'echo', 'cp', 'mv',
]);

export async function wcSpawnCommand(
  command: string,
  args: string[] = [],
  options?: { timeout?: number; cwd?: string; onOutput?: (data: string) => void }
): Promise<SpawnResult> {
  const wc = await getWebContainer();

  const output: string[] = [];
  const timeout = options?.timeout ?? 30000;

  if (!SAFE_COMMANDS.has(command)) {
    throw new Error(`Command \"${command}\" is not in the allowed command list`);
  }

  const process = await wc.spawn(command, args, { cwd: options?.cwd ?? WC_PROJECT_DIR });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let pipeError: unknown;
  const outputDone = process.output.pipeTo(
    new WritableStream({
      write: (data) => {
        output.push(data);
        if (options?.onOutput) {
          options.onOutput(data);
        }
      },
    })
  ).catch((error: unknown) => {
    pipeError = error;
  });

  const exitPromise = process.exit;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      process.kill();
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);
  });

  try {
    const exitCode = await Promise.race([exitPromise, timeoutPromise]);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    await outputDone;
    if (pipeError) {
      throw pipeError instanceof Error ? pipeError : new Error('Command output stream failed');
    }

    return {
      output: output.join(''),
      exitCode,
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function wcOnFileChange(callback: (path: string) => void): () => void {
  fileChangeListeners.add(callback);
  return () => fileChangeListeners.delete(callback);
}
