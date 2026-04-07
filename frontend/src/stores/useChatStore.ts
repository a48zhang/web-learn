import { create } from 'zustand';
import type { AIChatMessage } from '@web-learn/shared';

interface ChatState {
  messages: AIChatMessage[];
  isLoading: boolean;
  error: string | null;

  addMessage: (message: AIChatMessage) => void;
  setMessages: (messages: AIChatMessage[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  error: null,

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),

  setMessages: (messages) => set({ messages }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  clearChat: () => set({ messages: [], error: null }),
}));
