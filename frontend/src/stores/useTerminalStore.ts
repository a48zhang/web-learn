import { create } from 'zustand';

const MAX_OUTPUT_BUFFER_LENGTH = 64 * 1024;

type TerminalSink = (data: string) => void;

interface TerminalState {
  isOpen: boolean;
  height: number;
  outputBuffer: string;
  setOpen: (open: boolean) => void;
  setHeight: (height: number) => void;
  appendOutput: (data: string) => void;
  registerSink: (sink: TerminalSink) => () => void;
  clearOutputBuffer: () => void;
}

function trimBuffer(buffer: string): string {
  if (buffer.length <= MAX_OUTPUT_BUFFER_LENGTH) return buffer;
  return buffer.slice(-MAX_OUTPUT_BUFFER_LENGTH);
}

export const useTerminalStore = create<TerminalState>((set) => {
  const sinks = new Set<TerminalSink>();

  return {
    isOpen: false,
    height: 250,
    outputBuffer: '',
    setOpen: (open) => set({ isOpen: open }),
    setHeight: (height) => set({ height }),
    appendOutput: (data) => {
      if (!data) return;

      set((state) => ({
        outputBuffer: trimBuffer(state.outputBuffer + data),
      }));

      for (const sink of sinks) {
        try {
          sink(data);
        } catch {
          // Keep fanout resilient if a sink fails.
        }
      }
    },
    registerSink: (sink) => {
      sinks.add(sink);
      return () => {
        sinks.delete(sink);
      };
    },
    clearOutputBuffer: () => set({ outputBuffer: '' }),
  };
});
