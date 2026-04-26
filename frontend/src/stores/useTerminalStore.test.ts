import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTerminalStore } from './useTerminalStore';

describe('useTerminalStore terminal output bus', () => {
  const cleanups: Array<() => void> = [];

  beforeEach(() => {
    useTerminalStore.getState().clearOutputBuffer();
    useTerminalStore.setState({ isOpen: false, height: 250 });
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('appends output to a bounded buffer', () => {
    useTerminalStore.getState().appendOutput('hello');
    useTerminalStore.getState().appendOutput(' world');

    expect(useTerminalStore.getState().outputBuffer).toBe('hello world');
  });

  it('ignores empty output chunks', () => {
    useTerminalStore.getState().appendOutput('');

    expect(useTerminalStore.getState().outputBuffer).toBe('');
  });

  it('truncates old buffered output when the buffer exceeds the limit', () => {
    const longChunk = 'x'.repeat(70 * 1024);

    useTerminalStore.getState().appendOutput(longChunk);

    const buffer = useTerminalStore.getState().outputBuffer;
    expect(buffer.length).toBe(64 * 1024);
    expect(buffer).toBe(longChunk.slice(-64 * 1024));
  });

  it('writes new chunks to every registered sink', () => {
    const firstSink = vi.fn();
    const secondSink = vi.fn();

    cleanups.push(useTerminalStore.getState().registerSink(firstSink));
    cleanups.push(useTerminalStore.getState().registerSink(secondSink));
    useTerminalStore.getState().appendOutput('chunk');

    expect(firstSink).toHaveBeenCalledWith('chunk');
    expect(secondSink).toHaveBeenCalledWith('chunk');
  });

  it('keeps fanout and buffering working when a sink throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const throwingSink = vi.fn(() => {
      throw new Error('sink failed');
    });
    const healthySink = vi.fn();

    cleanups.push(useTerminalStore.getState().registerSink(throwingSink));
    cleanups.push(useTerminalStore.getState().registerSink(healthySink));

    try {
      expect(() => useTerminalStore.getState().appendOutput('chunk')).not.toThrow();
      expect(healthySink).toHaveBeenCalledWith('chunk');
      expect(useTerminalStore.getState().outputBuffer).toBe('chunk');
      expect(warnSpy).toHaveBeenCalledWith(
        'Terminal output sink failed:',
        expect.any(Error),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not write to a sink after unregister', () => {
    const sink = vi.fn();
    const unregister = useTerminalStore.getState().registerSink(sink);
    cleanups.push(unregister);

    unregister();
    cleanups.splice(cleanups.indexOf(unregister), 1);
    useTerminalStore.getState().appendOutput('after-close');

    expect(sink).not.toHaveBeenCalled();
  });

  it('clears only the output buffer', () => {
    const sink = vi.fn();
    cleanups.push(useTerminalStore.getState().registerSink(sink));
    useTerminalStore.getState().appendOutput('old');

    useTerminalStore.getState().clearOutputBuffer();
    useTerminalStore.getState().appendOutput('new');

    expect(useTerminalStore.getState().outputBuffer).toBe('new');
    expect(sink).toHaveBeenLastCalledWith('new');
  });
});
