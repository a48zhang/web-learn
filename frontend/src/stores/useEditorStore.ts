import { create } from 'zustand';
import type { FileTreeNode } from '@web-learn/shared';
import { topicGitApi } from '../services/api';
import { createTarball } from '../utils/tarUtils';
import { toast } from './useToastStore';

interface SaveToOSSOptions {
  force?: boolean;
}

interface EditorState {
  files: Record<string, string>;
  fileTree: FileTreeNode[];
  openFiles: string[];
  activeFile: string | null;
  previewUrl: string | null;
  isWebContainerReady: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
  lastLocalBackupAt: Date | null;
  // 预览状态
  previewMode: 'page' | 'code';
  setPreviewMode: (mode: 'page' | 'code') => void;
  activePreviewContent: string | null;
  setActivePreviewContent: (content: string | null) => void;
  setFileContent: (path: string, content: string) => void;
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  deleteFile: (path: string) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  createFile: (path: string, content?: string) => void;
  setPreviewUrl: (url: string | null) => void;
  setWebContainerReady: (ready: boolean) => void;
  loadSnapshot: (files: Record<string, string>) => void;
  getAllFiles: () => Record<string, string>;
  getFileTree: () => FileTreeNode[];
  getChangedFiles: () => string[];
  markSaved: () => void;
  markUnsaved: () => void;
  backupToLocal: (topicId: string) => void;
  restoreFromLocalBackup: (topicId: string) => boolean;
  saveToOSS: (topicId: string, commitMessage?: string, options?: SaveToOSSOptions) => Promise<boolean>;
}

function buildFileTree(files: Record<string, string>): FileTreeNode[] {
  const root: FileTreeNode = { name: '', path: '', type: 'directory', children: [] };

  for (const [path] of Object.entries(files)) {
    const parts = path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const existing = current.children?.find((child) => child.name === part);

      if (i === parts.length - 1) {
        // It's a file
        if (!existing) {
          current.children?.push({ name: part, path, type: 'file' });
        }
      } else {
        // It's a directory
        if (!existing) {
          const dirNode: FileTreeNode = { name: part, path: parts.slice(0, i + 1).join('/'), type: 'directory', children: [] };
          current.children?.push(dirNode);
          current = dirNode;
        } else {
          current = existing;
        }
      }
    }
  }

  return root.children || [];
}

export const useEditorStore = create<EditorState>((set, get) => ({
  files: {},
  fileTree: [],
  openFiles: [],
  activeFile: null,
  previewUrl: null,
  isWebContainerReady: false,
  hasUnsavedChanges: false,
  lastSavedAt: null,
  lastLocalBackupAt: null,
  // 预览状态
  previewMode: 'page',
  setPreviewMode: (mode) => set({ previewMode: mode }),
  activePreviewContent: null,
  setActivePreviewContent: (content) => set({ activePreviewContent: content }),

  setFileContent: (path, content) => {
    set((state) => ({
      files: { ...state.files, [path]: content },
      hasUnsavedChanges: true,
    }));
  },

  openFile: (path) => {
    set((state) => {
      if (state.openFiles.includes(path)) {
        return { activeFile: path };
      }
      return {
        openFiles: [...state.openFiles, path],
        activeFile: path,
      };
    });
  },

  closeFile: (path) => {
    set((state) => {
      const newOpenFiles = state.openFiles.filter((f) => f !== path);
      const newActiveFile = state.activeFile === path
        ? (newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null)
        : state.activeFile;
      return { openFiles: newOpenFiles, activeFile: newActiveFile };
    });
  },

  setActiveFile: (path) => set({ activeFile: path }),

  deleteFile: (path) => {
    set((state) => {
      const newFiles = { ...state.files };
      // Delete file and any children (if it's a directory prefix)
      for (const key of Object.keys(newFiles)) {
        if (key === path || key.startsWith(path + '/')) {
          delete newFiles[key];
        }
      }
      return {
        files: newFiles,
        openFiles: state.openFiles.filter((f) => f !== path && !f.startsWith(path + '/')),
        fileTree: buildFileTree(newFiles),
        hasUnsavedChanges: true,
      };
    });
  },

  renameFile: (oldPath, newPath) => {
    set((state) => {
      const newFiles: Record<string, string> = {};
      for (const [key, value] of Object.entries(state.files)) {
        if (key === oldPath) {
          newFiles[newPath] = value;
        } else if (key.startsWith(oldPath + '/')) {
          newFiles[key.replace(oldPath, newPath)] = value;
        } else {
          newFiles[key] = value;
        }
      }
      return { files: newFiles, fileTree: buildFileTree(newFiles), hasUnsavedChanges: true };
    });
  },

  createFile: (path, content = '') => {
    set((state) => ({
      files: { ...state.files, [path]: content },
      fileTree: buildFileTree({ ...state.files, [path]: content }),
      hasUnsavedChanges: true,
    }));
  },

  setPreviewUrl: (url) => set({ previewUrl: url }),
  setWebContainerReady: (ready) => set({ isWebContainerReady: ready }),

  loadSnapshot: (files) => set({
    files,
    fileTree: buildFileTree(files),
    hasUnsavedChanges: false,
    lastSavedAt: null,
  }),

  getAllFiles: () => get().files,
  getFileTree: () => get().fileTree,

  markSaved: () => set({ hasUnsavedChanges: false, lastSavedAt: new Date() }),
  markUnsaved: () => set({ hasUnsavedChanges: true }),

  getChangedFiles: () => {
    // 这里可以对比上次保存的文件快照，暂时简化实现：返回所有文件路径
    // 实际项目中可以维护lastSavedFiles快照来对比
    return Object.keys(get().files);
  },

  backupToLocal: (topicId: string) => {
    try {
      const files = get().files;
      const backupData = {
        files,
        timestamp: Date.now(),
      };
      localStorage.setItem(`local-backup-${topicId}`, JSON.stringify(backupData));
      set({ lastLocalBackupAt: new Date() });
    } catch (e) {
      console.error('Local backup failed:', e);
    }
  },

  restoreFromLocalBackup: (topicId: string): boolean => {
    try {
      const backupStr = localStorage.getItem(`local-backup-${topicId}`);
      if (!backupStr) return false;
      const backupData = JSON.parse(backupStr);
      get().loadSnapshot(backupData.files);
      toast.success('已从本地备份恢复数据');
      return true;
    } catch (e) {
      console.error('Restore local backup failed:', e);
      return false;
    }
  },

  saveToOSS: async (topicId: string, commitMessage?: string, options?: SaveToOSSOptions): Promise<boolean> => {
    const { hasUnsavedChanges, getAllFiles, getChangedFiles, markSaved, backupToLocal } = get();
    if (!hasUnsavedChanges && !options?.force) return true;

    // 先自动备份到本地
    backupToLocal(topicId);

    try {
      // 【已注释】版本冲突检测：获取云端版本号（接口不存在，暂不启用）
      // const { version: cloudVersion } = await topicGitApi.getVersion(topicId);
      // 这里可以对比本地版本号，暂时简化实现，实际项目需要维护localVersion
      // if (localVersion < cloudVersion) {
      //   // 提示用户选择覆盖/合并/放弃
      //   useToastStore.getState().error('版本冲突，请选择操作');
      //   return false;
      // }

      const files = getAllFiles();
      if (Object.keys(files).length === 0) return false;
      
      // 生成commit信息
      const changedFiles = getChangedFiles();
      const defaultCommitMessage = `AI修改: 修改了${changedFiles.join('、')}`;
      const finalCommitMessage = commitMessage || defaultCommitMessage;

      const tarball = createTarball(files);
      const { url } = await topicGitApi.getPresign(topicId, 'upload', finalCommitMessage);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/gzip',
          'x-ms-blob-type': 'BlockBlob',
        },
        body: new Blob([tarball], { type: 'application/gzip' }),
      });
      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
      
      markSaved();
      return true;
    } catch (e) {
      console.error('Save to OSS failed:', e);
      return false;
    }
  },
}));
