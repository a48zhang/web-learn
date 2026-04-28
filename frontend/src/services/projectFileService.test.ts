import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createProjectFile,
  deleteProjectPath,
  getProjectSnapshot,
  listProjectFiles,
  loadProjectSnapshot,
  moveProjectPath,
  readProjectFile,
  rescanProjectFiles,
  writeProjectFile,
} from './projectFileService';
import { useEditorStore } from '../stores/useEditorStore';

const webcontainerMocks = vi.hoisted(() => ({
  wcReadFile: vi.fn(),
  wcWriteFile: vi.fn(),
  wcCreateFile: vi.fn(),
  wcDeleteFile: vi.fn(),
  wcMoveFile: vi.fn(),
  wcListFiles: vi.fn(),
  wcGetProjectSnapshot: vi.fn(),
}));

vi.mock('../agent/webcontainer', () => webcontainerMocks);

function resetEditorStore(files: Record<string, string> = {}) {
  useEditorStore.setState({
    files,
    fileTree: [],
    openFiles: [],
    activeFile: null,
    fileRevision: 0,
    lastSavedRevision: 0,
    hasUnsavedChanges: false,
    lastSavedAt: null,
    lastLocalBackupAt: null,
    previewMode: 'page',
  });
  useEditorStore.getState().loadSnapshot(files);
  useEditorStore.setState({
    fileRevision: 0,
    lastSavedRevision: 0,
    hasUnsavedChanges: false,
    lastSavedAt: null,
  });
}

describe('projectFileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    webcontainerMocks.wcGetProjectSnapshot.mockResolvedValue({});
    resetEditorStore();
  });

  it('reads and lists through the WebContainer adapter', async () => {
    webcontainerMocks.wcReadFile.mockResolvedValue('content');
    webcontainerMocks.wcListFiles.mockResolvedValue(['src/App.tsx']);

    await expect(readProjectFile('src/App.tsx')).resolves.toBe('content');
    await expect(listProjectFiles()).resolves.toEqual(['src/App.tsx']);

    expect(webcontainerMocks.wcReadFile).toHaveBeenCalledWith('src/App.tsx');
    expect(webcontainerMocks.wcListFiles).toHaveBeenCalledWith();
  });

  it('writes WebContainer before updating the editor projection', async () => {
    resetEditorStore({ 'src/App.tsx': 'old' });
    webcontainerMocks.wcWriteFile.mockResolvedValue(undefined);

    await writeProjectFile('src/App.tsx', 'new');

    expect(webcontainerMocks.wcWriteFile).toHaveBeenCalledWith('src/App.tsx', 'new');
    expect(useEditorStore.getState().files).toEqual({ 'src/App.tsx': 'new' });
    expect(useEditorStore.getState().fileRevision).toBe(1);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('stores canonical project paths when service callers pass accepted aliases', async () => {
    resetEditorStore({ 'src/App.tsx': 'old' });
    useEditorStore.getState().openFile('src/App.tsx');
    webcontainerMocks.wcWriteFile.mockResolvedValue(undefined);
    webcontainerMocks.wcCreateFile.mockResolvedValue(undefined);
    webcontainerMocks.wcMoveFile.mockResolvedValue(undefined);
    webcontainerMocks.wcDeleteFile.mockResolvedValue(undefined);

    await writeProjectFile('./src/App.tsx', 'new');
    await createProjectFile('./src/New.tsx', 'new');
    await moveProjectPath('./src/New.tsx', './src/Renamed.tsx');
    await deleteProjectPath('./src/App.tsx');

    expect(useEditorStore.getState().files).toEqual({
      'src/Renamed.tsx': 'new',
    });
    expect(Object.keys(useEditorStore.getState().files).every((path) => !path.startsWith('./'))).toBe(true);
    expect(useEditorStore.getState().activeFile).toBeNull();
  });

  it('does not update the editor projection when a WebContainer write fails', async () => {
    resetEditorStore({ 'src/App.tsx': 'old' });
    webcontainerMocks.wcWriteFile.mockRejectedValue(new Error('disk full'));

    await expect(writeProjectFile('src/App.tsx', 'new')).rejects.toThrow('disk full');

    expect(useEditorStore.getState().files).toEqual({ 'src/App.tsx': 'old' });
    expect(useEditorStore.getState().fileRevision).toBe(0);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
  });

  it('creates, deletes, and moves only after the WebContainer mutation succeeds', async () => {
    resetEditorStore({
      'src/App.tsx': 'app',
      'src/old.ts': 'old',
    });
    useEditorStore.getState().openFile('src/old.ts');
    webcontainerMocks.wcCreateFile.mockResolvedValue(undefined);
    webcontainerMocks.wcDeleteFile.mockResolvedValue(undefined);
    webcontainerMocks.wcMoveFile.mockResolvedValue(undefined);

    await createProjectFile('src/new.ts', 'new');
    await moveProjectPath('src/old.ts', 'src/moved.ts');
    await deleteProjectPath('src/App.tsx');

    expect(webcontainerMocks.wcCreateFile).toHaveBeenCalledWith('src/new.ts', 'new');
    expect(webcontainerMocks.wcMoveFile).toHaveBeenCalledWith('src/old.ts', 'src/moved.ts');
    expect(webcontainerMocks.wcDeleteFile).toHaveBeenCalledWith('src/App.tsx');
    expect(useEditorStore.getState().files).toEqual({
      'src/new.ts': 'new',
      'src/moved.ts': 'old',
    });
    expect(useEditorStore.getState().activeFile).toBe('src/moved.ts');
    expect(useEditorStore.getState().openFiles).toEqual(['src/moved.ts']);
    expect(useEditorStore.getState().fileRevision).toBe(3);
  });

  it('rejects create when the target file already exists in the WebContainer snapshot', async () => {
    resetEditorStore({ 'src/existing.ts': 'old projection' });
    webcontainerMocks.wcGetProjectSnapshot.mockResolvedValue({
      'src/existing.ts': 'actual content',
    });

    await expect(createProjectFile('src/existing.ts', 'new content')).rejects.toThrow(
      'File already exists: src/existing.ts'
    );

    expect(webcontainerMocks.wcCreateFile).not.toHaveBeenCalled();
    expect(useEditorStore.getState().files).toEqual({ 'src/existing.ts': 'old projection' });
    expect(useEditorStore.getState().fileRevision).toBe(0);
  });

  it('does not update the editor projection when create, delete, or move fails', async () => {
    resetEditorStore({ 'src/old.ts': 'old' });
    webcontainerMocks.wcCreateFile.mockRejectedValue(new Error('create failed'));
    webcontainerMocks.wcDeleteFile.mockRejectedValue(new Error('delete failed'));
    webcontainerMocks.wcMoveFile.mockRejectedValue(new Error('move failed'));

    await expect(createProjectFile('src/new.ts', 'new')).rejects.toThrow('create failed');
    await expect(deleteProjectPath('src/old.ts')).rejects.toThrow('delete failed');
    await expect(moveProjectPath('src/old.ts', 'src/new.ts')).rejects.toThrow('move failed');

    expect(useEditorStore.getState().files).toEqual({ 'src/old.ts': 'old' });
    expect(useEditorStore.getState().fileRevision).toBe(0);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
  });

  it('rescans WebContainer and replaces the projection only when content differs', async () => {
    resetEditorStore({ 'src/App.tsx': 'old' });
    webcontainerMocks.wcGetProjectSnapshot.mockResolvedValueOnce({ 'src/App.tsx': 'old' });

    await expect(rescanProjectFiles()).resolves.toEqual({
      changed: false,
      files: { 'src/App.tsx': 'old' },
    });
    expect(useEditorStore.getState().fileRevision).toBe(0);

    webcontainerMocks.wcGetProjectSnapshot.mockResolvedValueOnce({
      'src/App.tsx': 'new',
      'src/generated.ts': 'generated',
    });

    await expect(rescanProjectFiles()).resolves.toEqual({
      changed: true,
      files: {
        'src/App.tsx': 'new',
        'src/generated.ts': 'generated',
      },
    });
    expect(useEditorStore.getState().files).toEqual({
      'src/App.tsx': 'new',
      'src/generated.ts': 'generated',
    });
    expect(useEditorStore.getState().fileRevision).toBe(1);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('gets WebContainer snapshots and loads editor snapshots', async () => {
    webcontainerMocks.wcGetProjectSnapshot.mockResolvedValue({ 'src/App.tsx': 'app' });

    await expect(getProjectSnapshot()).resolves.toEqual({ 'src/App.tsx': 'app' });
    loadProjectSnapshot({ 'src/main.ts': 'main' });

    expect(useEditorStore.getState().files).toEqual({ 'src/main.ts': 'main' });
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
    expect(useEditorStore.getState().lastSavedRevision).toBe(useEditorStore.getState().fileRevision);
  });

  it('canonicalizes and clones loaded project snapshots at the projection boundary', () => {
    const files = { './src/App.tsx': 'app' };

    loadProjectSnapshot(files);
    files['./src/App.tsx'] = 'mutated outside store';

    expect(useEditorStore.getState().files).toEqual({ 'src/App.tsx': 'app' });
  });
});
