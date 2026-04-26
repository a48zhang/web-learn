import { useRef, useState, useCallback, useEffect } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { useWebContainer } from './useWebContainer';
import { useTerminalStore } from '../stores/useTerminalStore';

import 'xterm/css/xterm.css';

interface UseTerminalOptions {
  visible: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useTerminal({ visible, containerRef }: UseTerminalOptions) {
  const { isReady, getInstance } = useWebContainer();

  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const processRef = useRef<{ kill: () => void; exit: Promise<unknown> } | null>(null);
  const unregisterSinkRef = useRef<(() => void) | null>(null);
  const openSessionRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const isInitializing = useRef(false);

  const cleanupTerminalSession = useCallback(() => {
    openSessionRef.current += 1;
    isInitializing.current = false;

    if (unregisterSinkRef.current) {
      unregisterSinkRef.current();
      unregisterSinkRef.current = null;
    }

    if (processRef.current) {
      processRef.current.kill();
      processRef.current = null;
    }

    if (terminalRef.current) {
      terminalRef.current.dispose();
      terminalRef.current = null;
    }

    fitAddonRef.current = null;
  }, []);

  const open = useCallback(() => {
    if (!isReady || !containerRef.current) return;
    if (terminalRef.current || isInitializing.current) return;

    const sessionId = ++openSessionRef.current;
    isInitializing.current = true;

    const container = containerRef.current;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#18181b',
        foreground: '#d4d4d8',
        cursor: '#d4d4d8',
        selectionBackground: '#3b3b4f',
        black: '#18181b',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#d4d4d8',
        brightBlack: '#3f3f46',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#fafafa',
      },
    });
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(container);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const { outputBuffer, registerSink } = useTerminalStore.getState();
    if (outputBuffer) {
      terminal.write(outputBuffer);
    }
    unregisterSinkRef.current = registerSink((data) => {
      if (openSessionRef.current === sessionId && terminalRef.current === terminal) {
        terminal.write(data);
      }
    });

    const wc = getInstance();
    if (wc) {
      wc.spawn('bash', [], { cwd: '/home/project' }).then(async (process) => {
        if (openSessionRef.current !== sessionId || terminalRef.current !== terminal) {
          process.kill();
          return;
        }

        processRef.current = process;

        process.output.pipeTo(
          new WritableStream({
            write: (data) => {
              if (openSessionRef.current === sessionId && terminalRef.current === terminal) {
                terminal.write(data);
              }
            },
          })
        ).catch((err: unknown) => {
          if (openSessionRef.current === sessionId && terminalRef.current === terminal) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            terminal.writeln(`\x1b[31mShell output stopped: ${message}\x1b[0m\r\n`);
          }
        });

        const inputWriter = process.input.getWriter();
        terminal.onData((data) => {
          inputWriter.write(data);
        });
      }).catch((err: unknown) => {
        if (openSessionRef.current === sessionId && terminalRef.current === terminal) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          terminal.writeln(`\x1b[31mFailed to start shell: ${message}\x1b[0m\r\n`);
        }
      }).finally(() => {
        if (openSessionRef.current === sessionId) {
          isInitializing.current = false;
        }
      });
    } else {
      terminal.writeln('\x1b[33mWebContainer not available.\x1b[0m\r\n');
      isInitializing.current = false;
    }

    setIsOpen(true);
  }, [isReady, containerRef, getInstance]);

  const close = useCallback(() => {
    cleanupTerminalSession();
    setIsOpen(false);
  }, [cleanupTerminalSession]);

  const resize = useCallback(() => {
    if (fitAddonRef.current && terminalRef.current) {
      fitAddonRef.current.fit();
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupTerminalSession();
    };
  }, [cleanupTerminalSession]);

  return { open, close, resize, isOpen, isReady, visible };
}
