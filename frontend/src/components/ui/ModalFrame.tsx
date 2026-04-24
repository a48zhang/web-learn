import type { ReactNode } from 'react';

interface ModalFrameProps {
  children: ReactNode;
  onClose: () => void;
  ariaLabelledBy?: string;
}

export default function ModalFrame({ children, onClose, ariaLabelledBy }: ModalFrameProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="关闭弹窗"
      />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
