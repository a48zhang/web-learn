import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTerminalStore } from './useTerminalStore';

describe('useTerminalStore terminal output bus', () => {
  beforeEach(() => {
    useTerminalStore.getState().clearOutputBuffer();
    useTerminalStore.setState({ isOpen: false, height: 250 });
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

    useTerminalStore.getState().registerSink(firstSink);
    useTerminalStore.getState().registerSink(secondSink);
    useTerminalStore.getState().appendOutput('chunk');

    expect(firstSink).toHaveBeenCalledWith('chunk');
    expect(secondSink).toHaveBeenCalledWith('chunk');
  });

  it('continues fanout when one sink throws', () => {
    const brokenSink = vi.fn(() => {
      throw new Error('sink failed');
    });
    const healthySink = vi.fn();

    const unregisterBroken = useTerminalStore.getState().registerSink(brokenSink);
    const unregisterHealthy = useTerminalStore.getState().registerSink(healthySink);

    try {
      expect(() => useTerminalStore.getState().appendOutput('chunk')).not.toThrow();
      expect(brokenSink).toHaveBeenCalledWith('chunk');
      expect(healthySink).toHaveBeenCalledWith('chunk');
    } finally {
      unregisterBroken();
      unregisterHealthy();
    }
  });

  it('does not write to a sink after unregister', () => {
    const sink = vi.fn();
    const unregister = useTerminalStore.getState().registerSink(sink);

    unregister();
    useTerminalStore.getState().appendOutput('after-close');

    expect(sink).not.toHaveBeenCalled();
  });

  it('clears only the output buffer', () => {
    const sink = vi.fn();
    useTerminalStore.getState().registerSink(sink);
    useTerminalStore.getState().appendOutput('old');

    useTerminalStore.getState().clearOutputBuffer();
    useTerminalStore.getState().appendOutput('new');

    expect(useTerminalStore.getState().outputBuffer).toBe('new');
    expect(sink).toHaveBeenLastCalledWith('new');
  });
});
