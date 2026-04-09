import { registerTool } from '../toolRegistry';
import { wcDeleteFile } from '../webcontainer';

registerTool('delete_file', {
  name: 'delete_file',
  description: 'Delete a file or directory at the given path.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file or directory to delete' },
    },
    required: ['path'],
  },
}, async (args) => {
  const path = args.path as string;
  if (!path || typeof path !== 'string') {
    return { content: 'path is required and must be a string', isError: true };
  }
  await wcDeleteFile(path);
  return { content: `Successfully deleted ${path}` };
});
