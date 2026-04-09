import { registerTool } from '../toolRegistry';
import { wcMoveFile } from '../webcontainer';

registerTool('move_file', {
  name: 'move_file',
  description: 'Move or rename a file. Creates parent directories of the destination if needed.',
  parameters: {
    type: 'object',
    properties: {
      oldPath: { type: 'string', description: 'Current path of the file' },
      newPath: { type: 'string', description: 'New path for the file' },
    },
    required: ['oldPath', 'newPath'],
  },
}, async (args) => {
  const oldPath = args.oldPath as string;
  const newPath = args.newPath as string;
  if (!oldPath || typeof oldPath !== 'string' || !newPath || typeof newPath !== 'string') {
    return { content: 'oldPath and newPath are required and must be strings', isError: true };
  }
  await wcMoveFile(oldPath, newPath);
  return { content: `Successfully moved ${oldPath} to ${newPath}` };
});
