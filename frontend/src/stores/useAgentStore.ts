import { create } from 'zustand';
import type { AgentMessage, AgentRunState } from '@web-learn/shared';

interface AgentStoreState {
  visibleMessages: AgentMessage[];
  runState: AgentRunState;
  model: string;
  setModel: (model: string) => void;
  addVisibleMessage: (message: AgentMessage) => void;
  updateLastMessage: (updater: (msg: AgentMessage) => AgentMessage) => void;
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
  model: localStorage.getItem('agent-model') || 'MiniMax-M2.7',

  setModel: (model: string) => {
    localStorage.setItem('agent-model', model);
    set({ model });
  },

  addVisibleMessage: (message) =>
    set((state) => ({ visibleMessages: [...state.visibleMessages, message] })),
  updateLastMessage: (updater) =>
    set((state) => {
      const messages = [...state.visibleMessages];
      if (messages.length > 0) {
        messages[messages.length - 1] = updater(messages[messages.length - 1]);
      }
      return { visibleMessages: messages };
    }),

  setRunState: (partial) =>
    set((state) => ({ runState: { ...state.runState, ...partial } })),

  clearRunState: () => set({ runState: { ...initialRunState } }),

  setVisibleMessages: (messages) => set({ visibleMessages: messages }),
}));
