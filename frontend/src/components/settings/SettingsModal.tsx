import { useState, useEffect, useRef, useCallback } from 'react';
import ProfileTab from './ProfileTab';
import PasswordTab from './PasswordTab';
import ThemeTab from './ThemeTab';
import ModalFrame from '../ui/ModalFrame';
import SurfaceCard from '../ui/SurfaceCard';

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
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Reset active tab when modal opens.
  useEffect(() => {
    if (isOpen) {
      setActiveTab('profile');
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <ModalFrame
      onClose={handleClose}
      ariaLabelledBy="settings-modal-title"
      initialFocusRef={closeBtnRef}
      restoreFocusRef={triggerRef}
    >
      <SurfaceCard className="w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <h2 id="settings-modal-title" className="text-lg font-semibold text-slate-50">账户设置</h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={handleClose}
            aria-label="关闭"
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-surface-3 hover:text-slate-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary-strong text-primary'
                  : 'text-slate-400 hover:text-slate-200'
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
      </SurfaceCard>
    </ModalFrame>
  );
}
