import { create } from 'zustand';
import type { FileTreeNode } from '@web-learn/shared';

interface EditorState {
  // File system
  files: Record<string, string>; // path -> content
  fileTree: FileTreeNode[];
  openFiles: string[]; // paths of open files
  activeFile: string | null;

  // WebContainer
  previewUrl: string | null;
  isWebContainerReady: boolean;

  // Actions
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

  setFileContent: (path, content) => {
    set((state) => ({
      files: { ...state.files, [path]: content },
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
      return { files: newFiles, fileTree: buildFileTree(newFiles) };
    });
  },

  createFile: (path, content = '') => {
    set((state) => ({
      files: { ...state.files, [path]: content },
      fileTree: buildFileTree({ ...state.files, [path]: content }),
    }));
  },

  setPreviewUrl: (url) => set({ previewUrl: url }),
  setWebContainerReady: (ready) => set({ isWebContainerReady: ready }),

  loadSnapshot: (files) => set({ files, fileTree: buildFileTree(files) }),

  getAllFiles: () => get().files,
  getFileTree: () => get().fileTree,
}));
