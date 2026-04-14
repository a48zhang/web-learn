import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '../stores/useEditorStore';
import { useAgentStore } from '../stores/useAgentStore';
import { topicGitApi } from '../services/api';
import { createTarball } from '../utils/tarUtils';

const SAVE_INTERVAL_MS = 30_000;

export function useAutoSave(topicId: string) {
  const { getAllFiles, hasUnsavedChanges, markSaved } = useEditorStore();
  const visibleMessages = useAgentStore((s) => s.visibleMessages);
  const isSavingRef = useRef(false);
  const visibleMessagesRef = useRef(visibleMessages);
  const getAllFilesRef = useRef(getAllFiles);
  const markSavedRef = useRef(markSaved);

  useEffect(() => {
    visibleMessagesRef.current = visibleMessages;
  }, [visibleMessages]);

  useEffect(() => {
    getAllFilesRef.current = getAllFiles;
  }, [getAllFiles]);

  useEffect(() => {
    markSavedRef.current = markSaved;
  }, [markSaved]);

  const saveInternal = useCallback(async (): Promise<boolean> => {
    if (isSavingRef.current) return false;
    isSavingRef.current = true;
    try {
      const files = getAllFilesRef.current();
      if (Object.keys(files).length === 0) return false;
      const tarball = createTarball(files);
      const { url } = await topicGitApi.getPresign(topicId, 'upload');
      const response = await fetch(url, {
        method: 'PUT',
        body: new Blob([tarball], { type: 'application/gzip' }),
      });
      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
      localStorage.setItem(`snapshot-${topicId}`, JSON.stringify(files));
      localStorage.setItem(`chat-history-${topicId}`, JSON.stringify(visibleMessagesRef.current));
      markSavedRef.current();
      return true;
    } catch {
      return false;
    } finally {
      isSavingRef.current = false;
    }
  }, [topicId]);

  // Periodic auto-save
  useEffect(() => {
    const timer = setInterval(() => {
      void saveInternal();
    }, SAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [saveInternal]);

  // beforeunload protection
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  return { save: saveInternal };
}
