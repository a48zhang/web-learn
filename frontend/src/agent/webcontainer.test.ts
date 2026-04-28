import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PROJECT_ROOT,
  setWebContainerInstance,
  wcCreateFile,
  wcDeleteFile,
  wcGetProjectSnapshot,
  wcListFiles,
  wcMoveFile,
  wcOnFileChange,
  wcResetProject,
  wcSpawnCommand,
  wcWriteFile,
} from './webcontainer';

function createDirent(name: string, type: 'file' | 'directory') {
  return {
    name,
    isDirectory: () => type === 'directory',
    isFile: () => type === 'file',
  };
}

function createMemoryFs(initialFiles: Record<string, string> = {}) {
  const files = new Map<string, string>();
  const dirs = new Set<string>([PROJECT_ROOT]);

  function normalize(path: string): string {
    return path.replace(/\/+$/, '') || '/';
  }

  function parentDir(path: string): string {
    return normalize(path.substring(0, path.lastIndexOf('/')));
  }

  function ensureParents(path: string): void {
    let current = parentDir(path);
    while (current && current !== '/') {
      dirs.add(current);
      current = parentDir(current);
    }
  }

  function addFile(path: string, content: string): void {
    files.set(normalize(path), content);
    ensureParents(path);
  }

  for (const [path, content] of Object.entries(initialFiles)) {
    addFile(path, content);
  }

  return {
    hasFile(path: string) {
      return files.has(normalize(path));
    },
    snapshot() {
      return Object.fromEntries(files);
    },
    fs: {
      async mkdir(path: string) {
        dirs.add(normalize(path));
        ensureParents(path);
      },
      async writeFile(path: string, content: string) {
        addFile(path, content);
      },
      async readFile(path: string) {
        const content = files.get(normalize(path));
        if (content === undefined) {
          throw new Error(`File not found: ${path}`);
        }
        return content;
      },
      async readdir(path: string) {
        const dir = normalize(path);
        const prefix = `${dir}/`;
        const entries = new Map<string, 'file' | 'directory'>();

        for (const filePath of files.keys()) {
          if (!filePath.startsWith(prefix)) {
            continue;
          }
          const [name, ...rest] = filePath.slice(prefix.length).split('/');
          entries.set(name, rest.length > 0 ? 'directory' : 'file');
        }

        for (const dirPath of dirs) {
          if (dirPath === dir || !dirPath.startsWith(prefix)) {
            continue;
          }
          const [name] = dirPath.slice(prefix.length).split('/');
          entries.set(name, 'directory');
        }

        return Array.from(entries, ([name, type]) => createDirent(name, type));
      },
      async rm(path: string) {
        const target = normalize(path);
        const prefix = `${target}/`;
        for (const filePath of Array.from(files.keys())) {
          if (filePath === target || filePath.startsWith(prefix)) {
            files.delete(filePath);
          }
        }
        for (const dirPath of Array.from(dirs)) {
          if (dirPath === target || dirPath.startsWith(prefix)) {
            dirs.delete(dirPath);
          }
        }
      },
      async rename(oldPath: string, newPath: string) {
        const oldTarget = normalize(oldPath);
        const newTarget = normalize(newPath);
        const oldPrefix = `${oldTarget}/`;

        if (files.has(oldTarget)) {
          const content = files.get(oldTarget)!;
          files.delete(oldTarget);
          addFile(newTarget, content);
          return;
        }

        for (const filePath of Array.from(files.keys())) {
          if (filePath.startsWith(oldPrefix)) {
            const content = files.get(filePath)!;
            files.delete(filePath);
            addFile(`${newTarget}/${filePath.slice(oldPrefix.length)}`, content);
          }
        }
      },
    },
  };
}

describe('wcSpawnCommand', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for trailing output after exit and clears its timeout', async () => {
    const onOutput = vi.fn();
    const kill = vi.fn();
    const spawn = vi.fn().mockResolvedValue({
      output: new ReadableStream<string>({
        start(controller) {
          controller.enqueue('hello ');
          setTimeout(() => {
            controller.enqueue('world');
            controller.close();
          }, 10);
        },
      }),
      exit: new Promise<number>((resolve) => {
        setTimeout(() => resolve(0), 0);
      }),
      kill,
    });

    setWebContainerInstance({
      spawn,
    } as never);

    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const resultPromise = wcSpawnCommand('echo', [], {
      timeout: 1000,
      onOutput,
    });
    let settled = false;
    resultPromise.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(onOutput).toHaveBeenCalledWith('hello ');
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(10);

    await expect(resultPromise).resolves.toEqual({
      output: 'hello world',
      exitCode: 0,
    });
    expect(onOutput.mock.calls.map(([chunk]) => chunk)).toEqual(['hello ', 'world']);
    expect(kill).not.toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    clearTimeoutSpy.mockRestore();
  });
});

describe('WebContainer project files', () => {
  it('resets the project by removing stale files and writing the supplied snapshot', async () => {
    const memory = createMemoryFs({
      [`${PROJECT_ROOT}/src/stale.ts`]: 'old',
      [`${PROJECT_ROOT}/public/old.txt`]: 'old',
    });
    setWebContainerInstance({ fs: memory.fs } as never);

    await wcResetProject({
      'src/App.tsx': 'export default function App() {}',
      'package.json': '{"scripts":{}}',
    });

    expect(memory.hasFile(`${PROJECT_ROOT}/src/stale.ts`)).toBe(false);
    expect(memory.hasFile(`${PROJECT_ROOT}/public/old.txt`)).toBe(false);
    await expect(wcGetProjectSnapshot()).resolves.toEqual({
      'src/App.tsx': 'export default function App() {}',
      'package.json': '{"scripts":{}}',
    });
  });

  it('validates reset snapshot paths before removing existing project files', async () => {
    const memory = createMemoryFs({
      [`${PROJECT_ROOT}/src/existing.ts`]: 'keep',
    });
    setWebContainerInstance({ fs: memory.fs } as never);

    await expect(wcResetProject({
      [`${PROJECT_ROOT}/src/App.tsx`]: 'bad',
    })).rejects.toThrow('Project path must be project-root-relative, not absolute');

    expect(memory.hasFile(`${PROJECT_ROOT}/src/existing.ts`)).toBe(true);
  });

  it('returns a relative project snapshot and ignores generated directories', async () => {
    const memory = createMemoryFs({
      [`${PROJECT_ROOT}/src/App.tsx`]: 'app',
      [`${PROJECT_ROOT}/README.md`]: 'readme',
      [`${PROJECT_ROOT}/node_modules/react/index.js`]: 'react',
      [`${PROJECT_ROOT}/dist/assets/index.js`]: 'build',
      [`${PROJECT_ROOT}/.vite/deps/react.js`]: 'vite',
      [`${PROJECT_ROOT}/.git/config`]: 'git',
    });
    setWebContainerInstance({ fs: memory.fs } as never);

    const snapshot = await wcGetProjectSnapshot();

    expect(snapshot).toEqual({
      'src/App.tsx': 'app',
      'README.md': 'readme',
    });
    expect(Object.keys(snapshot).every((path) => !path.startsWith('/'))).toBe(true);
  });

  it('lists only files that belong to the persisted project snapshot', async () => {
    const memory = createMemoryFs({
      [`${PROJECT_ROOT}/src/App.tsx`]: 'app',
      [`${PROJECT_ROOT}/README.md`]: 'readme',
      [`${PROJECT_ROOT}/node_modules/react/index.js`]: 'react',
      [`${PROJECT_ROOT}/dist/assets/index.js`]: 'build',
      [`${PROJECT_ROOT}/.vite/deps/react.js`]: 'vite',
      [`${PROJECT_ROOT}/.git/config`]: 'git',
    });
    setWebContainerInstance({ fs: memory.fs } as never);

    await expect(wcListFiles()).resolves.toEqual([
      'src/App.tsx',
      'README.md',
    ]);
  });

  it('emits normalized project paths for write, create, delete, and move operations', async () => {
    const memory = createMemoryFs({
      [`${PROJECT_ROOT}/src/old.ts`]: 'old',
    });
    setWebContainerInstance({ fs: memory.fs } as never);
    const listener = vi.fn();
    const unsubscribe = wcOnFileChange(listener);

    await wcWriteFile('./src/App.tsx', 'app');
    await wcCreateFile('./src/New.tsx', 'new');
    await wcDeleteFile('./src/New.tsx');
    await wcMoveFile('./src/old.ts', './src/moved.ts');

    expect(listener.mock.calls.map(([path]) => path)).toEqual([
      'src/App.tsx',
      'src/New.tsx',
      'src/New.tsx',
      'src/old.ts',
      'src/moved.ts',
    ]);
    unsubscribe();
  });

  it('rejects absolute public paths', async () => {
    const memory = createMemoryFs();
    setWebContainerInstance({ fs: memory.fs } as never);

    await expect(wcWriteFile(`${PROJECT_ROOT}/src/App.tsx`, 'app')).rejects.toThrow(
      'Project path must be project-root-relative, not absolute'
    );
  });
});
