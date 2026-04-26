import { registerTool } from '../toolRegistry';
import { wcMoveFile } from '../webcontainer';
import { useEditorStore } from '../../stores/useEditorStore';
import { parseProjectToolPath } from './projectToolPath';

registerTool('move_file', {
  name: 'move_file',
  description: 'Move or rename a project file. Creates parent directories of the destination if needed. Paths must be project-root-relative.',
  parameters: {
    type: 'object',
    properties: {
      oldPath: { type: 'string', description: 'Current project-root-relative path of the file. Do not use absolute paths.' },
      newPath: { type: 'string', description: 'New project-root-relative path for the file. Do not use absolute paths.' },
    },
    required: ['oldPath', 'newPath'],
  },
}, async (args) => {
  const oldPath = parseProjectToolPath(args.oldPath, 'oldPath');
  if (typeof oldPath !== 'string') {
    return oldPath;
  }
  const newPath = parseProjectToolPath(args.newPath, 'newPath');
  if (typeof newPath !== 'string') {
    return newPath;
  }
  await wcMoveFile(oldPath, newPath);
  useEditorStore.getState().renameFile(oldPath, newPath);
  return { content: `Successfully moved ${oldPath} to ${newPath}` };
});
