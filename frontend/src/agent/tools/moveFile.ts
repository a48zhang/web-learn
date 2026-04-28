import { registerTool } from '../toolRegistry';
import { moveProjectPath } from '../../services/projectFileService';
import { parseProjectToolPath } from './projectToolPath';

registerTool('move_file', {
  name: 'move_file',
  description: 'Move or rename a project file. Creates parent directories of the destination if needed. Paths must be project-root-relative. Absolute paths are invalid.',
  parameters: {
    type: 'object',
    properties: {
      oldPath: { type: 'string', description: 'Current project-root-relative path of the file. Absolute paths are invalid.' },
      newPath: { type: 'string', description: 'New project-root-relative path for the file. Absolute paths are invalid.' },
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
  try {
    await moveProjectPath(oldPath, newPath);
    return { content: `Successfully moved ${oldPath} to ${newPath}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to move project path';
    return { content: `Failed to move ${oldPath} to ${newPath}: ${message}`, isError: true };
  }
});
