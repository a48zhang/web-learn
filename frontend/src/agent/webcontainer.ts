import { WebContainer } from '@webcontainer/api';

let wcInstance: WebContainer | null = null;

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
  try {
    const content = await wc.fs.readFile(path, 'utf-8');
    return content;
  } catch {
    throw new Error(`File not found: ${path}`);
  }
}

export async function wcWriteFile(path: string, content: string): Promise<void> {
  const wc = await getWebContainer();
  const dir = path.substring(0, path.lastIndexOf('/'));
  if (dir) {
    await wc.fs.mkdir(dir, { recursive: true });
  }
  await wc.fs.writeFile(path, content);
}

export async function wcCreateFile(path: string, content = ''): Promise<void> {
  const wc = await getWebContainer();
  const dir = path.substring(0, path.lastIndexOf('/'));
  if (dir) {
    await wc.fs.mkdir(dir, { recursive: true });
  }
  await wc.fs.writeFile(path, content);
}

export async function wcDeleteFile(path: string): Promise<void> {
  const wc = await getWebContainer();
  await wc.fs.rm(path, { recursive: true, force: true });
}

export async function wcMoveFile(oldPath: string, newPath: string): Promise<void> {
  const wc = await getWebContainer();
  const dir = newPath.substring(0, newPath.lastIndexOf('/'));
  if (dir) {
    await wc.fs.mkdir(dir, { recursive: true });
  }
  await wc.fs.rename(oldPath, newPath);
}

export async function wcListFiles(rootPath = '.'): Promise<string[]> {
  const wc = await getWebContainer();
  const files: string[] = [];

  async function walk(dir: string) {
    const entries = await wc.fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = dir === '.' ? entry.name : `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') {
          await walk(fullPath);
        }
      } else {
        files.push(fullPath);
      }
    }
  }

  await walk(rootPath);
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
  options?: { timeout?: number; onOutput?: (data: string) => void }
): Promise<SpawnResult> {
  const wc = await getWebContainer();

  const output: string[] = [];
  const timeout = options?.timeout ?? 30000;

  if (!SAFE_COMMANDS.has(command)) {
    throw new Error(`Command "${command}" is not in the allowed command list`);
  }

  const process = await wc.spawn(command, args);

  process.output.pipeTo(
    new WritableStream({
      write: (data) => {
        output.push(data);
        if (options?.onOutput) {
          options.onOutput(data);
        }
      },
    })
  );

  const exitPromise = process.exit;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      process.kill();
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);
  });

  const exitCode = await Promise.race([exitPromise, timeoutPromise]);

  return {
    output: output.join(''),
    exitCode,
  };
}
