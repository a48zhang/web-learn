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
      {/* Desktop sidebar */}
      {children && (
        <aside className="hidden lg:block w-64 bg-white border-r border-gray-200 flex-shrink-0">
          {children}
        </aside>
      )}

      {/* Mobile drawer */}
      <div className="lg:hidden">
        {/* Overlay */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
            aria-hidden="true"
          />
        )}

        {/* Drawer */}
        <div
          className={`fixed left-0 top-0 bottom-0 z-50 bg-white w-[84vw] max-w-xs shadow-xl flex flex-col transition-transform duration-300 ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="font-semibold text-gray-800">菜单</span>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              aria-label="关闭菜单"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
