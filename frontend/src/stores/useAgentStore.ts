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
  firstUncompressedMessageId: null,
  updatedAt: new Date().toISOString(),
  hasCompressedContext: false,
};

function toPersistedAgentMessage(message: AgentMessage): PersistedAgentMessage {
  const persistedMessage = message as PersistedAgentMessage;

  return {
    ...message,
    id: persistedMessage.id || crypto.randomUUID(),
    createdAt: persistedMessage.createdAt || new Date().toISOString(),
  };
}

function getStoredModel(): string {
  if (typeof globalThis.localStorage?.getItem !== 'function') {
    return 'MiniMax-M2.7';
  }

  return globalThis.localStorage.getItem('agent-model') || 'MiniMax-M2.7';
}

export const useAgentStore = create<AgentStoreState>((set) => ({
  topicId: null,
  agentType: 'building',
  selectedSkills: [],
  compressedContext: initialCompressedContext,
  visibleMessages: [],
  runState: initialRunState,
  model: getStoredModel(),

  setModel: (model: string) => {
    if (typeof globalThis.localStorage?.setItem === 'function') {
      globalThis.localStorage.setItem('agent-model', model);
    }
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
    set((state) => ({ visibleMessages: [...state.visibleMessages, toPersistedAgentMessage(message)] })),

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
