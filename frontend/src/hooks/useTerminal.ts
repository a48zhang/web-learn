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
  const [isOpen, setIsOpen] = useState(false);
  const isInitializing = useRef(false);

  const open = useCallback(() => {
    if (!isReady || !containerRef.current) return;
    if (isInitializing.current) return;
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
      terminalRef.current?.write(data);
    });

    const wc = getInstance();
    if (wc) {
      wc.spawn('bash', [], { cwd: '/home/project' }).then(async (process) => {
        processRef.current = process;

        process.output.pipeTo(
          new WritableStream({
            write: (data) => terminal.write(data),
          })
        );

        const inputWriter = process.input.getWriter();
        terminal.onData((data) => {
          inputWriter.write(data);
        });
      }).catch((err: Error) => {
        terminal.writeln(`\x1b[31mFailed to start shell: ${err.message}\x1b[0m\r\n`);
      });
    } else {
      terminal.writeln('\x1b[33mWebContainer not available.\x1b[0m\r\n');
    }

    setIsOpen(true);
    isInitializing.current = false;
  }, [isReady, containerRef, getInstance]);

  const close = useCallback(() => {
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
      fitAddonRef.current = null;
    }
    setIsOpen(false);
  }, []);

  const resize = useCallback(() => {
    if (fitAddonRef.current && terminalRef.current) {
      fitAddonRef.current.fit();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (unregisterSinkRef.current) {
        unregisterSinkRef.current();
        unregisterSinkRef.current = null;
      }
      if (terminalRef.current) {
        terminalRef.current.dispose();
      }
    };
  }, []);

  return { open, close, resize, isOpen, isReady, visible };
}
