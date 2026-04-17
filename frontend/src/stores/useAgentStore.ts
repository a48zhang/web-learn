import { create } from 'zustand';
import type { AgentMessage, AgentRunState, AgentCompressedContext, PersistedAgentMessage } from '@web-learn/shared';

interface AgentStoreState {
  topicId: string | null;
  agentType: 'building' | 'learning';
  selectedSkills: string[];
  compressedContext: AgentCompressedContext;
  visibleMessages: PersistedAgentMessage[];
  runState: AgentRunState;
  model: string;
  setModel: (model: string) => void;
  addVisibleMessage: (message: AgentMessage) => void;
  updateLastMessage: (updater: (msg: AgentMessage) => AgentMessage) => void;
  setRunState: (state: Partial<AgentRunState>) => void;
  clearRunState: () => void;
  setVisibleMessages: (messages: PersistedAgentMessage[]) => void;
  setSessionContext: (topicId: string, agentType: 'building' | 'learning') => void;
  setSelectedSkills: (skills: string[]) => void;
  setCompressedContext: (context: AgentCompressedContext) => void;
}

const initialRunState: AgentRunState = {
  isRunning: false,
  currentToolName: null,
  currentToolPath: null,
  error: null,
};

const initialCompressedContext: AgentCompressedContext = {
  summary: '',
  summaryVersion: 1,
  lastCompressedMessageId: null,
  updatedAt: new Date().toISOString(),
  hasCompressedContext: false,
};

export const useAgentStore = create<AgentStoreState>((set) => ({
  topicId: null,
  agentType: 'building',
  selectedSkills: [],
  compressedContext: initialCompressedContext,
  visibleMessages: [],
  runState: initialRunState,
  model: localStorage.getItem('agent-model') || 'MiniMax-M2.7',

  setModel: (model: string) => {
    localStorage.setItem('agent-model', model);
    set({ model });
  },

  setSessionContext: (topicId: string, agentType: 'building' | 'learning') => {
    set({ topicId, agentType });
  },

  setSelectedSkills: (skills: string[]) => {
    set({ selectedSkills: skills });
  },

  setCompressedContext: (context: AgentCompressedContext) => {
    set({ compressedContext: context });
  },

  addVisibleMessage: (message) =>
    set((state) => ({ visibleMessages: [...state.visibleMessages, message as PersistedAgentMessage] })),

  updateLastMessage: (updater) =>
    set((state) => {
      const messages = [...state.visibleMessages];
      if (messages.length > 0) {
        messages[messages.length - 1] = updater(messages[messages.length - 1] as AgentMessage) as PersistedAgentMessage;
      }
      return { visibleMessages: messages };
    }),

  setRunState: (partial) =>
    set((state) => ({ runState: { ...state.runState, ...partial } })),

  clearRunState: () => set({ runState: { ...initialRunState } }),

  setVisibleMessages: (messages) => set({ visibleMessages: messages }),
}));
