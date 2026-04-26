import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setWebContainerInstance, wcSpawnCommand } from './webcontainer';

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
