import {
  wcCreateFile,
  wcDeleteFile,
  wcGetProjectSnapshot,
  wcListFiles,
  wcMoveFile,
  wcReadFile,
  wcWriteFile,
} from '../agent/webcontainer';
import { useEditorStore } from '../stores/useEditorStore';
import { normalizeProjectPath } from '../utils/projectPaths';

function filesEqual(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && left[key] === right[key]);
}

export async function readProjectFile(path: string): Promise<string> {
  return wcReadFile(path);
}

interface WriteProjectFileOptions {
  shouldCommit?: () => boolean;
}

export async function writeProjectFile(path: string, content: string, options?: WriteProjectFileOptions): Promise<void> {
  const normalizedPath = normalizeProjectPath(path);
  await wcWriteFile(normalizedPath, content);
  if (options?.shouldCommit && !options.shouldCommit()) {
    return;
  }
  useEditorStore.getState().setFileContent(normalizedPath, content);
}

export async function createProjectFile(path: string, content = ''): Promise<void> {
  const normalizedPath = normalizeProjectPath(path);
  const files = await wcGetProjectSnapshot();
  if (Object.prototype.hasOwnProperty.call(files, normalizedPath)) {
    throw new Error(`File already exists: ${normalizedPath}`);
  }
  await wcCreateFile(normalizedPath, content);
  useEditorStore.getState().createFile(normalizedPath, content);
}

export async function deleteProjectPath(path: string): Promise<void> {
  const normalizedPath = normalizeProjectPath(path);
  await wcDeleteFile(normalizedPath);
  useEditorStore.getState().deleteFile(normalizedPath);
}

export async function moveProjectPath(oldPath: string, newPath: string): Promise<void> {
  const normalizedOldPath = normalizeProjectPath(oldPath);
  const normalizedNewPath = normalizeProjectPath(newPath);
  await wcMoveFile(normalizedOldPath, normalizedNewPath);
  useEditorStore.getState().renameFile(normalizedOldPath, normalizedNewPath);
}

export async function listProjectFiles(): Promise<string[]> {
  return wcListFiles();
}

export async function rescanProjectFiles(): Promise<{ changed: boolean; files: Record<string, string> }> {
  const files = await wcGetProjectSnapshot();
  const changed = !filesEqual(useEditorStore.getState().files, files);

  if (changed) {
    useEditorStore.getState().replaceProjectFiles(files, { markUnsaved: true });
  }

  return { changed, files };
}

export async function getProjectSnapshot(): Promise<Record<string, string>> {
  return wcGetProjectSnapshot();
}

export function loadProjectSnapshot(files: Record<string, string>): void {
  useEditorStore.getState().loadSnapshot(files);
}
