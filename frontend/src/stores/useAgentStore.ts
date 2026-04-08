import { create } from 'zustand';
import type { AgentMessage, AgentRunState } from '@web-learn/shared';

interface AgentStoreState {
  visibleMessages: AgentMessage[];
  runState: AgentRunState;
  addVisibleMessage: (message: AgentMessage) => void;
  setRunState: (state: Partial<AgentRunState>) => void;
  clearRunState: () => void;
  setVisibleMessages: (messages: AgentMessage[]) => void;
}

const initialRunState: AgentRunState = {
  isRunning: false,
  currentToolName: null,
  currentToolPath: null,
  error: null,
};

export const useAgentStore = create<AgentStoreState>((set) => ({
  visibleMessages: [],
  runState: initialRunState,

  addVisibleMessage: (message) =>
    set((state) => ({ visibleMessages: [...state.visibleMessages, message] })),

  setRunState: (partial) =>
    set((state) => ({ runState: { ...state.runState, ...partial } })),

  clearRunState: () => set({ runState: { ...initialRunState } }),

  setVisibleMessages: (messages) => set({ visibleMessages: messages }),
}));
