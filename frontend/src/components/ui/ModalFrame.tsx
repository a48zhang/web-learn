import { useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';

interface ModalFrameProps {
  children: ReactNode;
  onClose: () => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export default function ModalFrame({
  children,
  onClose,
  ariaLabel,
  ariaLabelledBy,
  initialFocusRef,
  restoreFocusRef,
}: ModalFrameProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const restoreFocusTarget = restoreFocusRef?.current ?? null;

    const frame = requestAnimationFrame(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }

      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(focusableSelector);
      if (firstFocusable) {
        firstFocusable.focus();
        return;
      }

      panelRef.current?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      const focusTarget = restoreFocusTarget ?? previouslyFocusedRef.current;
      focusTarget?.focus();
    };
  }, [initialFocusRef, restoreFocusRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector);
      if (!focusable || focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === first || activeElement === panelRef.current) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="关闭弹窗"
      />
      <div ref={panelRef} tabIndex={-1} className="relative z-10 w-full max-w-md outline-none">
        {children}
      </div>
    </div>
  );
}
