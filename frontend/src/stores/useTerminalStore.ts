import { create } from 'zustand';

interface TerminalState {
  isOpen: boolean;
  height: number;
  setOpen: (open: boolean) => void;
  setHeight: (height: number) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  isOpen: false,
  height: 250,
  setOpen: (open) => set({ isOpen: open }),
  setHeight: (height) => set({ height }),
}));
