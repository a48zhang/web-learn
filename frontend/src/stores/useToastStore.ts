import { create } from 'zustand';
import type { Toast, ToastType } from '../components/Toast';

interface ToastStore {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

let toastId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (type, message, duration = 5000) => {
    const id = `toast-${++toastId}`;
    const toast: Toast = { id, type, message, duration };
    set((state) => ({ toasts: [...state.toasts, toast] }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
  clearToasts: () => {
    set({ toasts: [] });
  },
}));

// Helper functions for convenience
export const toast = {
  success: (message: string, duration?: number) => {
    useToastStore.getState().addToast('success', message, duration);
  },
  error: (message: string, duration?: number) => {
    useToastStore.getState().addToast('error', message, duration);
  },
  warning: (message: string, duration?: number) => {
    useToastStore.getState().addToast('warning', message, duration);
  },
  info: (message: string, duration?: number) => {
    useToastStore.getState().addToast('info', message, duration);
  },
};