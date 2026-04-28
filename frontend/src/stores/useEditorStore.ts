import { create } from 'zustand';
import type { FileTreeNode } from '@web-learn/shared';
import { wcGetProjectSnapshot } from '../agent/webcontainer';
import { topicGitApi } from '../services/api';
import { createTarball } from '../utils/tarUtils';
import { normalizeProjectPath } from '../utils/projectPaths';
import { toast } from './useToastStore';

interface SaveToOSSOptions {
  force?: boolean;
}

interface LocalRecoverySnapshot {
  files: Record<string, string>;
  timestamp: number;
}

export interface LocalRecoverySnapshotWithSource extends LocalRecoverySnapshot {
  source: 'snapshot' | 'local-backup';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractFiles(value: unknown): Record<string, string> | null {
  if (!isPlainObject(value)) return null;

  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(value)) {
    if (typeof content === 'string') {
      files[path] = content;
    } else {
      return null;
    }
  }

  return files;
}

export function parseLocalRecoverySnapshot(raw: string | null): LocalRecoverySnapshot | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return null;

    if ('files' in parsed) {
      const files = extractFiles(parsed.files);
      if (files) {
        const timestamp = typeof parsed.timestamp === 'number' && Number.isFinite(parsed.timestamp)
          ? parsed.timestamp
          : 0;

        return { files, timestamp };
      }
    }

    const files = extractFiles(parsed);
    if (!files) return null;

    return { files, timestamp: 0 };
  } catch {
    return null;
  }
}

export function getLocalRecoverySnapshot(topicId: string): LocalRecoverySnapshotWithSource | null {
  const snapshot = parseLocalRecoverySnapshot(localStorage.getItem(`snapshot-${topicId}`));
  const localBackup = parseLocalRecoverySnapshot(localStorage.getItem(`local-backup-${topicId}`));

  if (!snapshot && !localBackup) return null;
  if (!snapshot) {
    return localBackup ? { ...localBackup, source: 'local-backup' } : null;
  }
  if (!localBackup) return { ...snapshot, source: 'snapshot' };
  if (localBackup.timestamp > snapshot.timestamp) return { ...localBackup, source: 'local-backup' };

  return { ...snapshot, source: 'snapshot' };
}

interface EditorState {
  files: Record<string, string>;
  fileTree: FileTreeNode[];
  openFiles: string[];
  activeFile: string | null;
  fileRevision: number;
  lastSavedRevision: number;
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
  replaceProjectFiles: (files: Record<string, string>, options?: { markUnsaved?: boolean }) => void;
  setPreviewUrl: (url: string | null) => void;
  setWebContainerReady: (ready: boolean) => void;
  loadSnapshot: (files: Record<string, string>) => void;
  getAllFiles: () => Record<string, string>;
  getFileTree: () => FileTreeNode[];
  getChangedFiles: () => string[];
  markSaved: (savedRevision?: number) => void;
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

function filesEqual(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && left[key] === right[key]);
}

function replacePathPrefix(path: string, oldPath: string, newPath: string): string {
  if (path === oldPath) return newPath;
  if (path.startsWith(oldPath + '/')) return newPath + path.slice(oldPath.length);
  return path;
}

function dedupe(paths: string[]): string[] {
  return Array.from(new Set(paths));
}

function normalizeFileRecord(files: Record<string, string>): Record<string, string> {
  const normalizedFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    normalizedFiles[normalizeProjectPath(path)] = content;
  }
  return normalizedFiles;
}

function backupSnapshotToLocal(topicId: string, files: Record<string, string>): void {
  const backupData = {
    files,
    timestamp: Date.now(),
  };
  localStorage.setItem(`local-backup-${topicId}`, JSON.stringify(backupData));
}

export const useEditorStore = create<EditorState>((set, get) => ({
  files: {},
  fileTree: [],
  openFiles: [],
  activeFile: null,
  fileRevision: 0,
  lastSavedRevision: 0,
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
    set((state) => {
      if (state.files[path] === content) {
        return {};
      }

      const files = { ...state.files, [path]: content };
      return {
        files,
        fileTree: buildFileTree(files),
        fileRevision: state.fileRevision + 1,
        hasUnsavedChanges: true,
      };
    });
  },

  openFile: (path) => {
    set((state) => {
      const updates: Partial<typeof state> = { activeFile: path, previewMode: 'code' };
      if (!state.openFiles.includes(path)) {
        updates.openFiles = [...state.openFiles, path];
      }
      return updates;
    });
  },

  closeFile: (path) => {
    set((state) => {
      const newOpenFiles = state.openFiles.filter((f) => f !== path);
      const newActiveFile = state.activeFile === path
        ? (newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null)
        : state.activeFile;

      const newMode = newActiveFile ? state.previewMode : 'page';
      return { openFiles: newOpenFiles, activeFile: newActiveFile, previewMode: newMode };
    });
  },

  setActiveFile: (path) => set({ activeFile: path }),

  deleteFile: (path) => {
    set((state) => {
      const newFiles = { ...state.files };
      let changed = false;
      // Delete file and any children (if it's a directory prefix)
      for (const key of Object.keys(newFiles)) {
        if (key === path || key.startsWith(path + '/')) {
          delete newFiles[key];
          changed = true;
        }
      }
      if (!changed) {
        return {};
      }

      const openFiles = state.openFiles.filter((f) => f !== path && !f.startsWith(path + '/'));
      const activeFile = state.activeFile && (state.activeFile === path || state.activeFile.startsWith(path + '/'))
        ? (openFiles.length > 0 ? openFiles[openFiles.length - 1] : null)
        : state.activeFile;
      const previewMode = activeFile ? state.previewMode : 'page';

      return {
        files: newFiles,
        openFiles,
        activeFile,
        previewMode,
        fileTree: buildFileTree(newFiles),
        fileRevision: state.fileRevision + 1,
        hasUnsavedChanges: true,
      };
    });
  },

  renameFile: (oldPath, newPath) => {
    set((state) => {
      const newFiles: Record<string, string> = {};
      let changed = false;
      for (const [key, value] of Object.entries(state.files)) {
        if (key === oldPath) {
          newFiles[newPath] = value;
          changed = true;
        } else if (key.startsWith(oldPath + '/')) {
          newFiles[replacePathPrefix(key, oldPath, newPath)] = value;
          changed = true;
        } else {
          newFiles[key] = value;
        }
      }
      if (!changed || filesEqual(state.files, newFiles)) {
        return {};
      }

      const openFiles = dedupe(state.openFiles.map((file) => replacePathPrefix(file, oldPath, newPath)));
      const activeFile = state.activeFile ? replacePathPrefix(state.activeFile, oldPath, newPath) : null;

      return {
        files: newFiles,
        openFiles,
        activeFile,
        fileTree: buildFileTree(newFiles),
        fileRevision: state.fileRevision + 1,
        hasUnsavedChanges: true,
      };
    });
  },

  createFile: (path, content = '') => {
    set((state) => {
      if (state.files[path] === content) {
        return {};
      }

      const files = { ...state.files, [path]: content };
      return {
        files,
        fileTree: buildFileTree(files),
        fileRevision: state.fileRevision + 1,
        hasUnsavedChanges: true,
      };
    });
  },

  replaceProjectFiles: (files, options) => {
    set((state) => {
      const nextFiles = normalizeFileRecord(files);
      const changed = !filesEqual(state.files, nextFiles);
      const fileRevision = changed ? state.fileRevision + 1 : state.fileRevision;
      const openFiles = state.openFiles.filter((path) => Object.prototype.hasOwnProperty.call(nextFiles, path));
      const activeFile = state.activeFile && Object.prototype.hasOwnProperty.call(nextFiles, state.activeFile)
        ? state.activeFile
        : (openFiles.length > 0 ? openFiles[openFiles.length - 1] : null);

      return {
        files: nextFiles,
        fileTree: buildFileTree(nextFiles),
        openFiles,
        activeFile,
        previewMode: activeFile ? state.previewMode : 'page',
        fileRevision,
        hasUnsavedChanges: options?.markUnsaved ? changed || state.hasUnsavedChanges : false,
        lastSavedRevision: options?.markUnsaved ? state.lastSavedRevision : fileRevision,
        lastSavedAt: options?.markUnsaved ? state.lastSavedAt : null,
      };
    });
  },

  setPreviewUrl: (url) => set({ previewUrl: url }),
  setWebContainerReady: (ready) => set({ isWebContainerReady: ready }),

  loadSnapshot: (files) => get().replaceProjectFiles(files),

  getAllFiles: () => get().files,
  getFileTree: () => get().fileTree,

  markSaved: (savedRevision) => set((state) => {
    const revisionToMark = savedRevision ?? state.fileRevision;
    const lastSavedRevision = Math.max(
      state.lastSavedRevision,
      Math.min(revisionToMark, state.fileRevision),
    );

    return {
      hasUnsavedChanges: state.fileRevision > lastSavedRevision,
      lastSavedAt: new Date(),
      lastSavedRevision,
    };
  }),
  markUnsaved: () => set({ hasUnsavedChanges: true }),

  getChangedFiles: () => {
    // 这里可以对比上次保存的文件快照，暂时简化实现：返回所有文件路径
    // 实际项目中可以维护lastSavedFiles快照来对比
    return Object.keys(get().files);
  },

  backupToLocal: (topicId: string) => {
    try {
      backupSnapshotToLocal(topicId, { ...get().files });
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
    try {
      // 【已注释】版本冲突检测：获取云端版本号（接口不存在，暂不启用）
      // const { version: cloudVersion } = await topicGitApi.getVersion(topicId);
      // 这里可以对比本地版本号，暂时简化实现，实际项目需要维护localVersion
      // if (localVersion < cloudVersion) {
      //   // 提示用户选择覆盖/合并/放弃
      //   useToastStore.getState().error('版本冲突，请选择操作');
      //   return false;
      // }

      const files = await wcGetProjectSnapshot();
      if (!filesEqual(get().files, files)) {
        get().replaceProjectFiles(files, { markUnsaved: true });
      }
      const { fileRevision: snapshotRevision, hasUnsavedChanges, markSaved } = get();
      if (Object.keys(files).length === 0) return false;
      if (!hasUnsavedChanges && !options?.force) return true;

      // 先自动备份到本地，且与上传的 tarball 使用同一个快照
      backupSnapshotToLocal(topicId, files);
      set({ lastLocalBackupAt: new Date() });

      // 生成commit信息
      const changedFiles = Object.keys(files);
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

      markSaved(snapshotRevision);
      return true;
    } catch (e) {
      console.error('Save to OSS failed:', e);
      return false;
    }
  },
}));
