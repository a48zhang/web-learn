import type { WebContainer } from '@webcontainer/api';
import { normalizeProjectPath, toWcAbsolutePath } from '../utils/projectPaths';

let wcInstance: WebContainer | null = null;
const fileChangeListeners = new Set<(path: string) => void>();

export const PROJECT_ROOT = '/home/project';
const PROJECT_IGNORED_DIRS = new Set(['node_modules', 'dist', '.vite', '.git']);

function wcPath(path: string): string {
  return toWcAbsolutePath(normalizeProjectPath(path));
}

function relativeFromProjectRoot(path: string): string {
  if (path === PROJECT_ROOT) {
    return '';
  }
  return path.replace(`${PROJECT_ROOT}/`, '');
}

function dirname(path: string): string {
  return path.substring(0, path.lastIndexOf('/'));
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
  const normalizedPath = normalizeProjectPath(path);
  const resolved = toWcAbsolutePath(normalizedPath);
  const dir = dirname(resolved);
  if (dir) {
    await wc.fs.mkdir(dir, { recursive: true });
  }
  await wc.fs.writeFile(resolved, content);
  emitFileChange(normalizedPath);
}

export async function wcCreateFile(path: string, content = ''): Promise<void> {
  const wc = await getWebContainer();
  const normalizedPath = normalizeProjectPath(path);
  const resolved = toWcAbsolutePath(normalizedPath);
  const dir = dirname(resolved);
  if (dir) {
    await wc.fs.mkdir(dir, { recursive: true });
  }
  await wc.fs.writeFile(resolved, content);
  emitFileChange(normalizedPath);
}

export async function wcDeleteFile(path: string): Promise<void> {
  const wc = await getWebContainer();
  const normalizedPath = normalizeProjectPath(path);
  await wc.fs.rm(toWcAbsolutePath(normalizedPath), { recursive: true, force: true });
  emitFileChange(normalizedPath);
}

export async function wcMoveFile(oldPath: string, newPath: string): Promise<void> {
  const wc = await getWebContainer();
  const normalizedOldPath = normalizeProjectPath(oldPath);
  const normalizedNewPath = normalizeProjectPath(newPath);
  const newResolved = toWcAbsolutePath(normalizedNewPath);
  const dir = dirname(newResolved);
  if (dir) {
    await wc.fs.mkdir(dir, { recursive: true });
  }
  await wc.fs.rename(toWcAbsolutePath(normalizedOldPath), newResolved);
  emitFileChange(normalizedOldPath);
  emitFileChange(normalizedNewPath);
}

export async function wcListFiles(rootPath = '.'): Promise<string[]> {
  const wc = await getWebContainer();
  const files: string[] = [];
  const base = rootPath === '.' ? PROJECT_ROOT : wcPath(rootPath);

  async function walk(dir: string) {
    const entries = await wc.fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = dir === PROJECT_ROOT ? `${PROJECT_ROOT}/${entry.name}` : `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!PROJECT_IGNORED_DIRS.has(entry.name)) {
          await walk(fullPath);
        }
      } else {
        // Return relative paths
        files.push(relativeFromProjectRoot(fullPath));
      }
    }
  }

  await walk(base);
  return files;
}

export async function wcResetProject(files: Record<string, string>, shouldContinue: () => boolean = () => true): Promise<void> {
  const wc = await getWebContainer();
  const writePlan = Object.entries(files).map(([path, content]) => {
    const normalizedPath = normalizeProjectPath(path);
    const resolved = toWcAbsolutePath(normalizedPath);
    return { content, resolved };
  });

  if (!shouldContinue()) return;
  await wc.fs.mkdir(PROJECT_ROOT, { recursive: true });

  if (!shouldContinue()) return;
  const entries = await wc.fs.readdir(PROJECT_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!shouldContinue()) return;
    await wc.fs.rm(`${PROJECT_ROOT}/${entry.name}`, { recursive: true, force: true });
  }

  for (const { resolved, content } of writePlan) {
    if (!shouldContinue()) return;
    const dir = dirname(resolved);
    if (dir) {
      await wc.fs.mkdir(dir, { recursive: true });
    }
    if (!shouldContinue()) return;
    await wc.fs.writeFile(resolved, content);
  }
}

export async function wcGetProjectSnapshot(): Promise<Record<string, string>> {
  const wc = await getWebContainer();
  const snapshot: Record<string, string> = {};

  async function walk(dir: string) {
    const entries = await wc.fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && PROJECT_IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      const fullPath = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        snapshot[relativeFromProjectRoot(fullPath)] = await wc.fs.readFile(fullPath, 'utf-8');
      }
    }
  }

  await walk(PROJECT_ROOT);
  return snapshot;
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

  const process = await wc.spawn(command, args, { cwd: options?.cwd ?? PROJECT_ROOT });

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
