import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeState = vi.hoisted(() => ({
  executes: new Map<string, (args: Record<string, unknown>) => Promise<unknown>>(),
}));

const registerToolMock = vi.hoisted(() => vi.fn((_name: string, _definition: unknown, execute: (args: Record<string, unknown>) => Promise<unknown>) => {
  executeState.executes.set(_name, execute);
}));

const appendOutputMock = vi.hoisted(() => vi.fn());
const wcSpawnCommandMock = vi.hoisted(() => vi.fn());
const tryStartDevServerMock = vi.hoisted(() => vi.fn());
const projectFileServiceMock = vi.hoisted(() => {
  const state = {
    files: {} as Record<string, string>,
    webContainerFiles: {} as Record<string, string>,
  };

  return {
    state,
    createProjectFile: vi.fn(async (path: string, content: string) => {
      state.files[path] = content;
      state.webContainerFiles[path] = content;
    }),
    writeProjectFile: vi.fn(async (path: string, content: string) => {
      state.files[path] = content;
      state.webContainerFiles[path] = content;
    }),
    listProjectFiles: vi.fn(async () => Object.keys(state.files)),
    rescanProjectFiles: vi.fn(async () => {
      const previous = JSON.stringify(state.files);
      state.files = { ...state.webContainerFiles };
      return {
        changed: previous !== JSON.stringify(state.files),
        files: { ...state.files },
      };
    }),
  };
});

vi.mock('../toolRegistry', () => ({
  registerTool: registerToolMock,
}));

vi.mock('../../stores/useTerminalStore', () => ({
  useTerminalStore: {
    getState: () => ({
      appendOutput: appendOutputMock,
    }),
  },
}));

vi.mock('../webcontainer', () => ({
  wcSpawnCommand: wcSpawnCommandMock,
}));

vi.mock('../../services/projectFileService', () => ({
  createProjectFile: projectFileServiceMock.createProjectFile,
  writeProjectFile: projectFileServiceMock.writeProjectFile,
  listProjectFiles: projectFileServiceMock.listProjectFiles,
  rescanProjectFiles: projectFileServiceMock.rescanProjectFiles,
}));

vi.mock('../../hooks/useWebContainer', () => ({
  tryStartDevServer: tryStartDevServerMock,
}));

import { parseCommand } from './runCommand';
import './listFiles';
import './createFile';
import './writeFile';

describe('parseCommand', () => {
  it('parses quoted arguments and escapes', () => {
    expect(parseCommand('echo "hello world" \'lone text\' foo\\ bar ""')).toEqual([
      'echo',
      'hello world',
      'lone text',
      'foo bar',
      '',
    ]);
  });

  it('parses backslash escapes inside double quotes', () => {
    expect(parseCommand('node -e "console.log(\\"x\\")"')).toEqual([
      'node',
      '-e',
      'console.log("x")',
    ]);
  });

  it('throws on unterminated quotes and dangling escapes', () => {
    expect(() => parseCommand('echo "hello')).toThrow(/unterminated double quote/i);
    expect(() => parseCommand("echo 'hello")).toThrow(/unterminated single quote/i);
    expect(() => parseCommand('echo hello\\')).toThrow(/unterminated escape sequence/i);
  });
});

describe('run_command', () => {
  beforeEach(() => {
    appendOutputMock.mockClear();
    tryStartDevServerMock.mockClear();
    wcSpawnCommandMock.mockReset();
    projectFileServiceMock.createProjectFile.mockClear();
    projectFileServiceMock.writeProjectFile.mockClear();
    projectFileServiceMock.listProjectFiles.mockClear();
    projectFileServiceMock.rescanProjectFiles.mockClear();
    projectFileServiceMock.state.files = {};
    projectFileServiceMock.state.webContainerFiles = {};
    wcSpawnCommandMock.mockImplementation(async (_command: string, _args: string[], options?: { onOutput?: (data: string) => void }) => {
      options?.onOutput?.('hello world\n');
      return { output: 'hello world\n', exitCode: 0 };
    });
  });

  it('passes quoted arguments through to wcSpawnCommand and prints the quoted header', async () => {
    const execute = executeState.executes.get('run_command');
    if (!execute) {
      throw new Error('run_command tool was not registered');
    }

    const result = await execute({ command: 'echo "hello world"' });

    expect(wcSpawnCommandMock).toHaveBeenCalledWith('echo', ['hello world'], {
      onOutput: expect.any(Function),
    });
    expect(projectFileServiceMock.rescanProjectFiles).toHaveBeenCalledWith();
    expect(appendOutputMock).toHaveBeenNthCalledWith(1, '\r\n[agent] $ echo "hello world"\r\n');
    expect(appendOutputMock).toHaveBeenCalledWith('hello world\n');
    expect(appendOutputMock).toHaveBeenLastCalledWith('\r\n[agent] exited with code 0\r\n');
    expect(result).toEqual({ content: 'hello world\n' });
  });

  it('returns a validation error for whitespace-only commands', async () => {
    const execute = executeState.executes.get('run_command');
    if (!execute) {
      throw new Error('run_command tool was not registered');
    }

    const result = await execute({ command: '   ' });

    expect(result).toEqual({
      content: 'command is required and must be a string',
      isError: true,
    });
    expect(wcSpawnCommandMock).not.toHaveBeenCalled();
    expect(projectFileServiceMock.rescanProjectFiles).not.toHaveBeenCalled();
  });

  it('returns an error for non-zero exits with the exit code and output', async () => {
    const execute = executeState.executes.get('run_command');
    if (!execute) {
      throw new Error('run_command tool was not registered');
    }

    wcSpawnCommandMock.mockResolvedValueOnce({ output: 'tests failed\n', exitCode: 1 });

    const result = await execute({ command: 'npm test' });

    expect(result).toEqual({
      content: 'Command exited with code 1\ntests failed\n',
      isError: true,
    });
    expect(projectFileServiceMock.rescanProjectFiles).toHaveBeenCalledWith();
  });

  it('returns a clear rescan error after a successful command if refresh fails', async () => {
    const execute = executeState.executes.get('run_command');
    if (!execute) {
      throw new Error('run_command tool was not registered');
    }

    projectFileServiceMock.rescanProjectFiles.mockRejectedValueOnce(new Error('snapshot unavailable'));

    const result = await execute({ command: 'echo ok' });

    expect(result).toEqual({
      content: 'Command completed, but failed to rescan project files: snapshot unavailable',
      isError: true,
    });
  });

  it('preserves command error context when the follow-up rescan also fails', async () => {
    const execute = executeState.executes.get('run_command');
    if (!execute) {
      throw new Error('run_command tool was not registered');
    }

    wcSpawnCommandMock.mockResolvedValueOnce({ output: 'bad args\n', exitCode: 2 });
    projectFileServiceMock.rescanProjectFiles.mockRejectedValueOnce(new Error('snapshot unavailable'));

    const result = await execute({ command: 'node bad.js' });

    expect(result).toEqual({
      content: 'Command exited with code 2\nbad args\n\nFailed to rescan project files after command: snapshot unavailable',
      isError: true,
    });
  });

  it('returns a run error and writes a terminal failure line for unterminated quotes', async () => {
    const execute = executeState.executes.get('run_command');
    if (!execute) {
      throw new Error('run_command tool was not registered');
    }

    const result = await execute({ command: 'echo "hello' });

    expect(result).toEqual({
      content: expect.stringMatching(/unterminated double quote/i),
      isError: true,
    });
    expect(wcSpawnCommandMock).not.toHaveBeenCalled();
    expect(projectFileServiceMock.rescanProjectFiles).not.toHaveBeenCalled();
    expect(appendOutputMock).toHaveBeenCalledWith(
      expect.stringMatching(/\r\n\[agent\] command failed: .*unterminated double quote/i),
    );
  });

  it('rescans command-created files so list_files can see them', async () => {
    const runCommand = executeState.executes.get('run_command');
    const listFiles = executeState.executes.get('list_files');
    if (!runCommand || !listFiles) {
      throw new Error('run_command and list_files tools were not registered');
    }

    projectFileServiceMock.state.files = { 'src/App.tsx': 'app' };
    projectFileServiceMock.state.webContainerFiles = { 'src/App.tsx': 'app' };
    wcSpawnCommandMock.mockImplementationOnce(async (_command: string, _args: string[], options?: { onOutput?: (data: string) => void }) => {
      projectFileServiceMock.state.webContainerFiles['src/generated.ts'] = 'export const generated = true;\n';
      options?.onOutput?.('generated\n');
      return { output: 'generated\n', exitCode: 0 };
    });

    await expect(listFiles({})).resolves.toEqual({
      content: JSON.stringify(['src/App.tsx']),
    });
    await expect(runCommand({ command: 'node scripts/generate.js' })).resolves.toEqual({
      content: 'generated\n',
    });
    await expect(listFiles({})).resolves.toEqual({
      content: JSON.stringify(['src/App.tsx', 'src/generated.ts']),
    });
    expect(projectFileServiceMock.rescanProjectFiles).toHaveBeenCalledWith();
  });

  it('rescans after a spawned command throws so generated files are still discovered', async () => {
    const runCommand = executeState.executes.get('run_command');
    const listFiles = executeState.executes.get('list_files');
    if (!runCommand || !listFiles) {
      throw new Error('run_command and list_files tools were not registered');
    }

    projectFileServiceMock.state.files = { 'src/App.tsx': 'app' };
    projectFileServiceMock.state.webContainerFiles = { 'src/App.tsx': 'app' };
    wcSpawnCommandMock.mockImplementationOnce(async () => {
      projectFileServiceMock.state.webContainerFiles['src/generated.ts'] = 'export const generated = true;\n';
      throw new Error('Command timed out');
    });

    await expect(runCommand({ command: 'node scripts/generate.js' })).resolves.toEqual({
      content: 'Command timed out',
      isError: true,
    });
    await expect(listFiles({})).resolves.toEqual({
      content: JSON.stringify(['src/App.tsx', 'src/generated.ts']),
    });
    expect(projectFileServiceMock.rescanProjectFiles).toHaveBeenCalledWith();
  });
});

describe('create_file', () => {
  beforeEach(() => {
    projectFileServiceMock.createProjectFile.mockClear();
    projectFileServiceMock.state.files = {};
    projectFileServiceMock.state.webContainerFiles = {};
  });

  it('rejects provided non-string content without coercing it', async () => {
    const execute = executeState.executes.get('create_file');
    if (!execute) {
      throw new Error('create_file tool was not registered');
    }

    const result = await execute({ path: 'src/data.json', content: { ok: true } });

    expect(result).toEqual({
      content: 'content must be a string when provided',
      isError: true,
    });
    expect(projectFileServiceMock.createProjectFile).not.toHaveBeenCalled();
  });

  it('returns an error when the target file already exists', async () => {
    const execute = executeState.executes.get('create_file');
    if (!execute) {
      throw new Error('create_file tool was not registered');
    }
    projectFileServiceMock.createProjectFile.mockRejectedValueOnce(new Error('File already exists: src/App.tsx'));

    const result = await execute({ path: 'src/App.tsx', content: 'new' });

    expect(result).toEqual({
      content: 'Failed to create src/App.tsx: File already exists: src/App.tsx',
      isError: true,
    });
  });
});

describe('write_file', () => {
  beforeEach(() => {
    tryStartDevServerMock.mockClear();
    projectFileServiceMock.writeProjectFile.mockClear();
    projectFileServiceMock.state.files = {};
    projectFileServiceMock.state.webContainerFiles = {};
  });

  it('starts the dev server after writing package.json', async () => {
    const execute = executeState.executes.get('write_file');
    if (!execute) {
      throw new Error('write_file tool was not registered');
    }

    await expect(execute({ path: 'package.json', content: '{"scripts":{}}\n' })).resolves.toEqual({
      content: 'Successfully wrote 15 bytes to package.json',
    });
    expect(projectFileServiceMock.writeProjectFile).toHaveBeenCalledWith('package.json', '{"scripts":{}}\n');
    expect(tryStartDevServerMock).toHaveBeenCalledTimes(1);
  });
});
