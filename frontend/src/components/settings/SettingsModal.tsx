import { useState, useEffect, useRef, useCallback } from 'react';
import ProfileTab from './ProfileTab';
import PasswordTab from './PasswordTab';
import ThemeTab from './ThemeTab';

type ActiveTab = 'profile' | 'password' | 'theme';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

const tabs: { id: ActiveTab; label: string }[] = [
  { id: 'profile', label: '个人资料' },
  { id: 'password', label: '修改密码' },
  { id: 'theme', label: '主题设置' },
];

export default function SettingsModal({ isOpen, onClose, triggerRef }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('profile');
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Reset active tab and focus when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('profile');
      // Focus the close button after a tick so the modal is in the DOM
      requestAnimationFrame(() => closeBtnRef.current?.focus());
    }
  }, [isOpen]);

  // Restore focus on close
  const handleClose = useCallback(() => {
    onClose();
    // Restore focus to the element that opened the modal
    if (triggerRef?.current) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, [onClose, triggerRef]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  // Trap focus inside modal
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = modalRef.current!.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  // Close on outside click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="settings-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">账户设置</h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={handleClose}
            aria-label="关闭"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === 'profile' && <ProfileTab onClose={handleClose} />}
          {activeTab === 'password' && <PasswordTab onClose={handleClose} />}
          {activeTab === 'theme' && <ThemeTab />}
        </div>
      </div>
    </div>
  );
}
