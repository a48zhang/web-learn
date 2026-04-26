import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeState = vi.hoisted(() => ({
  execute: undefined as ((args: Record<string, unknown>) => Promise<unknown>) | undefined,
}));

const registerToolMock = vi.hoisted(() => vi.fn((_name: string, _definition: unknown, execute: (args: Record<string, unknown>) => Promise<unknown>) => {
  executeState.execute = execute;
}));

const appendOutputMock = vi.hoisted(() => vi.fn());
const wcSpawnCommandMock = vi.hoisted(() => vi.fn());

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

import { parseCommand } from './runCommand';

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
    wcSpawnCommandMock.mockReset();
    wcSpawnCommandMock.mockImplementation(async (_command: string, _args: string[], options?: { onOutput?: (data: string) => void }) => {
      options?.onOutput?.('hello world\n');
      return { output: 'hello world\n', exitCode: 0 };
    });
  });

  it('passes quoted arguments through to wcSpawnCommand and prints the quoted header', async () => {
    if (!executeState.execute) {
      throw new Error('run_command tool was not registered');
    }

    const result = await executeState.execute({ command: 'echo "hello world"' });

    expect(wcSpawnCommandMock).toHaveBeenCalledWith('echo', ['hello world'], {
      onOutput: expect.any(Function),
    });
    expect(appendOutputMock).toHaveBeenNthCalledWith(1, '\r\n[agent] $ echo "hello world"\r\n');
    expect(appendOutputMock).toHaveBeenCalledWith('hello world\n');
    expect(appendOutputMock).toHaveBeenLastCalledWith('\r\n[agent] exited with code 0\r\n');
    expect(result).toEqual({ content: 'hello world\n' });
  });

  it('returns a validation error for whitespace-only commands', async () => {
    if (!executeState.execute) {
      throw new Error('run_command tool was not registered');
    }

    const result = await executeState.execute({ command: '   ' });

    expect(result).toEqual({
      content: 'command is required and must be a string',
      isError: true,
    });
    expect(wcSpawnCommandMock).not.toHaveBeenCalled();
  });

  it('returns a run error and writes a terminal failure line for unterminated quotes', async () => {
    if (!executeState.execute) {
      throw new Error('run_command tool was not registered');
    }

    const result = await executeState.execute({ command: 'echo "hello' });

    expect(result).toEqual({
      content: expect.stringMatching(/unterminated double quote/i),
      isError: true,
    });
    expect(wcSpawnCommandMock).not.toHaveBeenCalled();
    expect(appendOutputMock).toHaveBeenCalledWith(
      expect.stringMatching(/\r\n\[agent\] command failed: .*unterminated double quote/i),
    );
  });
});
