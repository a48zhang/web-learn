import { useEffect } from 'react';

interface LeftNavProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function LeftNav({ isOpen, onClose, children }: LeftNavProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!children && !isOpen) return null;

  return (
    <>
      {children && (
        <aside className="glass-surface hidden w-72 flex-shrink-0 border-y-0 border-l-0 border-r lg:block">
          {children}
        </aside>
      )}

      <div className="lg:hidden">
        {isOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
        )}

        <div
          className={`fixed bottom-0 left-0 top-0 z-50 flex w-[84vw] max-w-xs flex-col border-r border-border bg-surface shadow-panel transition-transform duration-300 ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-display text-base font-semibold text-slate-100">菜单</span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-surface-3 hover:text-slate-100"
              aria-label="关闭菜单"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
