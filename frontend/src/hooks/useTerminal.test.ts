import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTerminal } from './useTerminal';

const terminalCtorMock = vi.hoisted(() => vi.fn());
const fitAddonCtorMock = vi.hoisted(() => vi.fn());
const webLinksAddonCtorMock = vi.hoisted(() => vi.fn());
const useWebContainerMock = vi.hoisted(() => vi.fn());
const registerSinkMock = vi.hoisted(() => vi.fn());
const useTerminalStoreGetStateMock = vi.hoisted(() => vi.fn());
let terminalInstance: any;

vi.mock('xterm', () => ({
  Terminal: terminalCtorMock,
}));

vi.mock('xterm-addon-fit', () => ({
  FitAddon: fitAddonCtorMock,
}));

vi.mock('xterm-addon-web-links', () => ({
  WebLinksAddon: webLinksAddonCtorMock,
}));

vi.mock('./useWebContainer', () => ({
  useWebContainer: useWebContainerMock,
}));

vi.mock('../stores/useTerminalStore', () => ({
  useTerminalStore: {
    getState: useTerminalStoreGetStateMock,
  },
}));

describe('useTerminal', () => {
  beforeEach(() => {
    terminalCtorMock.mockReset();
    fitAddonCtorMock.mockReset();
    webLinksAddonCtorMock.mockReset();
    useWebContainerMock.mockReset();
    registerSinkMock.mockReset();
    useTerminalStoreGetStateMock.mockReset();

    terminalInstance = {
      loadAddon: vi.fn(),
      open: vi.fn(),
      write: vi.fn(),
      writeln: vi.fn(),
      dispose: vi.fn(),
      onData: vi.fn(),
    };
    const fitAddonInstance = {
      fit: vi.fn(),
    };
    const webLinksAddonInstance = {};

    terminalCtorMock.mockImplementation(() => terminalInstance);
    fitAddonCtorMock.mockImplementation(() => fitAddonInstance);
    webLinksAddonCtorMock.mockImplementation(() => webLinksAddonInstance);

    registerSinkMock.mockReturnValue(() => {});
    useTerminalStoreGetStateMock.mockReturnValue({
      outputBuffer: '',
      registerSink: registerSinkMock,
    });
  });

  it('keeps open idempotent and registers only one sink', async () => {
    let resolveSpawn: (value: any) => void = () => {};
    const spawnPromise = new Promise<any>((resolve) => {
      resolveSpawn = resolve;
    });

    const processMock = {
      kill: vi.fn(),
      exit: Promise.resolve(),
      output: {
        pipeTo: vi.fn(() => Promise.resolve()),
      },
      input: {
        getWriter: vi.fn(() => ({
          write: vi.fn(),
        })),
      },
    };

    const spawnMock = vi.fn().mockReturnValue(spawnPromise);
    useWebContainerMock.mockReturnValue({
      isReady: true,
      getInstance: () => ({
        spawn: spawnMock,
      }),
    });

    const containerRef = { current: document.createElement('div') };
    const { result } = renderHook(() =>
      useTerminal({
        visible: true,
        containerRef,
      })
    );

    act(() => {
      result.current.open();
      result.current.open();
    });

    await act(async () => {
      resolveSpawn(processMock);
      await spawnPromise;
    });

    expect(terminalCtorMock).toHaveBeenCalledTimes(1);
    expect(registerSinkMock).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(processMock.output.pipeTo).toHaveBeenCalledTimes(1);
  });

  it('kills a late spawn after close and does not wire the disposed terminal', async () => {
    let resolveSpawn: (value: any) => void = () => {};

    const spawnPromise = new Promise<any>((resolve) => {
      resolveSpawn = resolve;
    });

    const processMock = {
      kill: vi.fn(),
      exit: Promise.resolve(),
      output: {
        pipeTo: vi.fn(),
      },
      input: {
        getWriter: vi.fn(() => ({
          write: vi.fn(),
        })),
      },
    };

    const spawnMock = vi.fn().mockReturnValue(spawnPromise);
    useWebContainerMock.mockReturnValue({
      isReady: true,
      getInstance: () => ({
        spawn: spawnMock,
      }),
    });

    const containerRef = { current: document.createElement('div') };
    const { result } = renderHook(() =>
      useTerminal({
        visible: true,
        containerRef,
      })
    );

    act(() => {
      result.current.open();
    });

    act(() => {
      result.current.close();
    });

    await act(async () => {
      resolveSpawn(processMock);
      await spawnPromise;
    });

    await waitFor(() => {
      expect(processMock.kill).toHaveBeenCalledTimes(1);
    });
    expect(processMock.output.pipeTo).not.toHaveBeenCalled();
    expect(processMock.input.getWriter).not.toHaveBeenCalled();
  });

  it('cleans up an attached process, unregisters the sink, and disposes the terminal', async () => {
    const unregisterSink = vi.fn();
    const processMock = {
      kill: vi.fn(),
      exit: Promise.resolve(),
      output: {
        pipeTo: vi.fn(() => Promise.resolve()),
      },
      input: {
        getWriter: vi.fn(() => ({
          write: vi.fn(),
        })),
      },
    };

    const spawnMock = vi.fn().mockResolvedValue(processMock);
    registerSinkMock.mockReturnValue(unregisterSink);
    useWebContainerMock.mockReturnValue({
      isReady: true,
      getInstance: () => ({
        spawn: spawnMock,
      }),
    });

    const containerRef = { current: document.createElement('div') };
    const { result, unmount } = renderHook(() =>
      useTerminal({
        visible: true,
        containerRef,
      })
    );

    act(() => {
      result.current.open();
    });

    await waitFor(() => {
      expect(processMock.output.pipeTo).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.close();
    });

    expect(unregisterSink).toHaveBeenCalledTimes(1);
    expect(processMock.kill).toHaveBeenCalledTimes(1);
    expect(terminalInstance.dispose).toHaveBeenCalledTimes(1);

    unmount();
  });
});
