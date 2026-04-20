import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '../stores/useEditorStore';
import { useAgentStore } from '../stores/useAgentStore';

const LOCAL_BACKUP_INTERVAL_MS = 300_000; // 5分钟本地自动备份

export function useAutoSave(topicId: string) {
  const { hasUnsavedChanges, backupToLocal, saveToOSS } = useEditorStore();
  const visibleMessages = useAgentStore((s) => s.visibleMessages);
  
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  const backupToLocalRef = useRef(backupToLocal);
  const saveToOSSRef = useRef(saveToOSS);
  const visibleMessagesRef = useRef(visibleMessages);
  const backupTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    backupToLocalRef.current = backupToLocal;
  }, [backupToLocal]);

  useEffect(() => {
    saveToOSSRef.current = saveToOSS;
  }, [saveToOSS]);

  useEffect(() => {
    visibleMessagesRef.current = visibleMessages;
  }, [visibleMessages]);

  // 5分钟自动本地备份（无网络请求）
  useEffect(() => {
    const timer = setInterval(() => {
      if (hasUnsavedChangesRef.current) {
        backupToLocalRef.current(topicId);
      }
    }, LOCAL_BACKUP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [topicId]);

  // beforeunload保护：先自动备份到本地，再提示用户
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      // 先自动备份到本地
      backupToLocalRef.current(topicId);
      // 保存聊天历史到本地
      localStorage.setItem(`chat-history-${topicId}`, JSON.stringify(visibleMessagesRef.current));
      
      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [topicId]);

  // 每次文件修改后自动备份到本地（300ms防抖）
  useEffect(() => {
    if (hasUnsavedChanges) {
      // 防抖300ms，避免每次输入字符都写入localStorage导致卡顿
      if (backupTimerRef.current) clearTimeout(backupTimerRef.current);
      backupTimerRef.current = setTimeout(() => {
        backupToLocalRef.current(topicId);
      }, 300);
    }
    // 清除定时器
    return () => {
      if (backupTimerRef.current) clearTimeout(backupTimerRef.current);
    };
  }, [hasUnsavedChanges, topicId]);

  // 手动保存方法，供顶部按钮调用
  const manualSave = useCallback(async (): Promise<boolean> => {
    return saveToOSSRef.current(topicId, '手动保存', { force: true });
  }, [topicId]);

  return { save: manualSave };
}
