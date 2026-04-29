import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetUseWebContainerForTests,
  bootWebContainer,
  tryStartDevServer,
  useWebContainer,
} from './useWebContainer';

const wcResetProjectMock = vi.hoisted(() => vi.fn());
const setWebContainerInstanceMock = vi.hoisted(() => vi.fn());
const bootMock = vi.hoisted(() => vi.fn());
const appendOutputMock = vi.hoisted(() => vi.fn());

vi.mock('@webcontainer/api', () => ({
  WebContainer: {
    boot: bootMock,
  },
}));

vi.mock('../agent/webcontainer', () => ({
  PROJECT_ROOT: '/home/project',
  setWebContainerInstance: setWebContainerInstanceMock,
  wcResetProject: wcResetProjectMock,
}));

vi.mock('../stores/useEditorStore', () => ({
  useEditorStore: () => ({
    setFileContent: vi.fn(),
  }),
}));

vi.mock('../stores/useTerminalStore', () => ({
  useTerminalStore: {
    getState: () => ({
      appendOutput: appendOutputMock,
    }),
  },
}));

function closedOutputStream(): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.close();
    },
  });
}

function createProcess(exit: Promise<number> = Promise.resolve(0)) {
  return {
    output: closedOutputStream(),
    exit,
    kill: vi.fn(),
  };
}

describe('useWebContainer topic sessions', () => {
  beforeEach(() => {
    __resetUseWebContainerForTests();
    wcResetProjectMock.mockReset();
    setWebContainerInstanceMock.mockReset();
    bootMock.mockReset();
    appendOutputMock.mockReset();
  });

  afterEach(() => {
    __resetUseWebContainerForTests();
  });

  it('clears a failed boot promise so a later boot can retry', async () => {
    const wc = { spawn: vi.fn() };
    bootMock
      .mockRejectedValueOnce(new Error('boot failed'))
      .mockResolvedValueOnce(wc);

    await expect(bootWebContainer()).rejects.toThrow('boot failed');
    await expect(bootWebContainer()).resolves.toBe(wc);

    expect(bootMock).toHaveBeenCalledTimes(2);
    expect(setWebContainerInstanceMock).toHaveBeenCalledWith(wc);
  });

  it('does not reset the project for a stale init session after a topic switch', async () => {
    let resolveBoot!: (value: unknown) => void;
    bootMock.mockReturnValue(
      new Promise((resolve) => {
        resolveBoot = resolve;
      })
    );
    wcResetProjectMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWebContainer());

    let topicAInit!: Promise<void>;
    let topicBInit!: Promise<void>;
    await act(async () => {
      topicAInit = result.current.initProject('topic-a', { 'src/A.ts': 'a' });
      topicBInit = result.current.initProject('topic-b', { 'src/B.ts': 'b' });
    });

    await act(async () => {
      resolveBoot({
        spawn: vi.fn(),
      });
      await topicAInit;
      await topicBInit;
    });

    expect(wcResetProjectMock).toHaveBeenCalledTimes(1);
    expect(wcResetProjectMock).toHaveBeenCalledWith({ 'src/B.ts': 'b' }, expect.any(Function));
  });

  it('resets the project when the same topic is initialized with changed files', async () => {
    bootMock.mockResolvedValue({
      spawn: vi.fn(),
    });
    wcResetProjectMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWebContainer());

    await act(async () => {
      await result.current.initProject('topic-a', { 'src/App.ts': 'old' });
    });
    expect(result.current.isReady).toBe(true);

    await act(async () => {
      await result.current.initProject('topic-a', { 'src/App.ts': 'new' });
    });

    expect(wcResetProjectMock).toHaveBeenCalledTimes(2);
    expect(wcResetProjectMock).toHaveBeenNthCalledWith(1, { 'src/App.ts': 'old' }, expect.any(Function));
    expect(wcResetProjectMock).toHaveBeenNthCalledWith(2, { 'src/App.ts': 'new' }, expect.any(Function));
    expect(result.current.currentTopicId).toBe('topic-a');
    expect(result.current.isReady).toBe(true);
    expect(result.current.previewUrl).toBeNull();
  });

  it('does not apply an in-flight reset after a newer topic session starts', async () => {
    bootMock.mockResolvedValue({
      spawn: vi.fn(),
    });
    const appliedSnapshots: Record<string, string>[] = [];
    let resolveTopicAReset!: () => void;

    wcResetProjectMock.mockImplementation((files: Record<string, string>, shouldContinue?: () => boolean) => {
      if (files['src/A.ts']) {
        return new Promise<void>((resolve) => {
          resolveTopicAReset = () => {
            if (!shouldContinue || shouldContinue()) {
              appliedSnapshots.push(files);
            }
            resolve();
          };
        });
      }

      if (!shouldContinue || shouldContinue()) {
        appliedSnapshots.push(files);
      }
      return Promise.resolve();
    });

    const { result } = renderHook(() => useWebContainer());

    let topicAInit!: Promise<void>;
    await act(async () => {
      topicAInit = result.current.initProject('topic-a', { 'src/A.ts': 'a' });
      await vi.waitFor(() => {
        expect(wcResetProjectMock).toHaveBeenCalledWith(
          { 'src/A.ts': 'a' },
          expect.any(Function)
        );
      });
    });

    let topicBInit!: Promise<void>;
    await act(async () => {
      topicBInit = result.current.initProject('topic-b', { 'src/B.ts': 'b' });
      resolveTopicAReset();
      await topicAInit;
      await topicBInit;
    });

    expect(appliedSnapshots).toEqual([{ 'src/B.ts': 'b' }]);
  });

  it('ignores stale server-ready events after switching topics before the new dev process is active', async () => {
    const serverReadyCallbacks: Array<(port: number, url: string) => void> = [];
    const topicAInstall = createProcess();
    const topicADev = createProcess(new Promise<number>(() => undefined));
    const topicBInstall = createProcess(new Promise<number>(() => undefined));
    const spawn = vi
      .fn()
      .mockResolvedValueOnce(topicAInstall)
      .mockResolvedValueOnce(topicADev)
      .mockResolvedValueOnce(topicBInstall);

    bootMock.mockResolvedValue({
      spawn,
      on: vi.fn((_event: 'server-ready', callback: (port: number, url: string) => void) => {
        serverReadyCallbacks.push(callback);
        return vi.fn();
      }),
    });
    wcResetProjectMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWebContainer());

    await act(async () => {
      await result.current.initProject('topic-a', { 'package.json': '{"scripts":{"dev":"vite"}}' });
    });

    await waitFor(() => {
      expect(serverReadyCallbacks).toHaveLength(1);
    });

    act(() => {
      serverReadyCallbacks[0](5174, 'http://topic-a.test');
    });
    expect(result.current.previewUrl).toBe('http://topic-a.test');

    await act(async () => {
      await result.current.initProject('topic-b', { 'package.json': '{"scripts":{"dev":"vite"}}' });
    });

    act(() => {
      serverReadyCallbacks[0](5174, 'http://stale-topic-a.test');
    });

    expect(topicADev.kill).toHaveBeenCalledTimes(1);
    expect(result.current.currentTopicId).toBe('topic-b');
    expect(result.current.previewUrl).toBeNull();
    expect(spawn).toHaveBeenCalledTimes(3);
  });

  it('ignores an old session server-ready event on its old port after the new dev process is active', async () => {
    const serverReadyCallbacks: Array<(port: number, url: string) => void> = [];
    const topicAInstall = createProcess();
    const topicADev = createProcess(new Promise<number>(() => undefined));
    const topicBInstall = createProcess();
    const topicBDev = createProcess(new Promise<number>(() => undefined));
    const spawn = vi
      .fn()
      .mockResolvedValueOnce(topicAInstall)
      .mockResolvedValueOnce(topicADev)
      .mockResolvedValueOnce(topicBInstall)
      .mockResolvedValueOnce(topicBDev);

    bootMock.mockResolvedValue({
      spawn,
      on: vi.fn((_event: 'server-ready', callback: (port: number, url: string) => void) => {
        serverReadyCallbacks.push(callback);
        return vi.fn();
      }),
    });
    wcResetProjectMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWebContainer());

    await act(async () => {
      await result.current.initProject('topic-a', { 'package.json': '{"scripts":{"dev":"vite"}}' });
    });

    await waitFor(() => {
      expect(serverReadyCallbacks).toHaveLength(1);
    });

    await act(async () => {
      await result.current.initProject('topic-b', { 'package.json': '{"scripts":{"dev":"vite"}}' });
    });

    await waitFor(() => {
      expect(serverReadyCallbacks).toHaveLength(2);
    });

    act(() => {
      serverReadyCallbacks[1](5174, 'http://stale-topic-a.test');
    });
    expect(result.current.previewUrl).toBeNull();

    act(() => {
      serverReadyCallbacks[1](5175, 'http://topic-b.test');
    });
    expect(result.current.previewUrl).toBe('http://topic-b.test');
  });

  it('clears the started flag and current error after npm run dev spawn fails so tryStartDevServer can retry', async () => {
    const serverReadyCallbacks: Array<(port: number, url: string) => void> = [];
    const spawn = vi
      .fn()
      .mockResolvedValueOnce(createProcess())
      .mockRejectedValueOnce(new Error('dev spawn failed'))
      .mockResolvedValueOnce(createProcess())
      .mockResolvedValueOnce(createProcess(new Promise<number>(() => undefined)));

    bootMock.mockResolvedValue({
      spawn,
      on: vi.fn((_event: 'server-ready', callback: (port: number, url: string) => void) => {
        serverReadyCallbacks.push(callback);
        return vi.fn();
      }),
    });
    wcResetProjectMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWebContainer());

    await act(async () => {
      await result.current.initProject('topic-a', { 'package.json': '{"scripts":{"dev":"vite"}}' });
    });

    await waitFor(() => {
      expect(spawn).toHaveBeenCalledTimes(2);
    });
    expect(result.current.error).toBe('dev spawn failed');

    act(() => {
      tryStartDevServer();
    });

    await waitFor(() => {
      expect(spawn).toHaveBeenCalledTimes(4);
    });

    act(() => {
      serverReadyCallbacks[0](5174, 'http://retry-success.test');
    });
    expect(result.current.previewUrl).toBe('http://retry-success.test');
    expect(result.current.error).toBeNull();
  });

  it('kills a stale in-flight npm install and does not let it block the next topic reset', async () => {
    const topicAInstall = createProcess(new Promise<number>(() => undefined));
    const spawn = vi.fn().mockResolvedValueOnce(topicAInstall);
    const resetFiles: Record<string, string>[] = [];

    bootMock.mockResolvedValue({
      spawn,
      on: vi.fn(() => vi.fn()),
    });
    wcResetProjectMock.mockImplementation((files: Record<string, string>) => {
      resetFiles.push(files);
      return Promise.resolve();
    });

    const { result } = renderHook(() => useWebContainer());

    await act(async () => {
      await result.current.initProject('topic-a', { 'package.json': '{"scripts":{"dev":"vite"}}' });
    });

    await waitFor(() => {
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.initProject('topic-b', { 'src/B.ts': 'b' });
    });

    expect(topicAInstall.kill).toHaveBeenCalledTimes(1);
    expect(resetFiles).toEqual([
      { 'package.json': '{"scripts":{"dev":"vite"}}' },
      { 'src/B.ts': 'b' },
    ]);
    expect(result.current.currentTopicId).toBe('topic-b');
    expect(result.current.isReady).toBe(true);
  });

  it('kills npm install if its spawn resolves after the session becomes stale', async () => {
    let resolveTopicAInstall!: (process: ReturnType<typeof createProcess>) => void;
    const topicAInstallPromise = new Promise<ReturnType<typeof createProcess>>((resolve) => {
      resolveTopicAInstall = resolve;
    });
    const topicAInstall = createProcess(new Promise<number>(() => undefined));
    const spawn = vi.fn().mockReturnValueOnce(topicAInstallPromise);

    bootMock.mockResolvedValue({
      spawn,
      on: vi.fn(() => vi.fn()),
    });
    wcResetProjectMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWebContainer());

    await act(async () => {
      await result.current.initProject('topic-a', { 'package.json': '{"scripts":{"dev":"vite"}}' });
    });

    await waitFor(() => {
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.initProject('topic-b', { 'src/B.ts': 'b' });
      resolveTopicAInstall(topicAInstall);
    });

    await waitFor(() => {
      expect(topicAInstall.kill).toHaveBeenCalledTimes(1);
    });
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(result.current.currentTopicId).toBe('topic-b');
    expect(result.current.previewUrl).toBeNull();
  });
});
