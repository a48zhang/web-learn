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
