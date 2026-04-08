import { registerTool } from '../toolRegistry';
import { wcReadFile } from '../webcontainer';

registerTool('read_file', {
  name: 'read_file',
  description: 'Read the contents of a file at the given path. Returns the file content as a string.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to read' },
    },
    required: ['path'],
  },
}, async (args) => {
  const path = args.path as string;
  if (!path || typeof path !== 'string') {
    return { content: 'path is required and must be a string', isError: true };
  }
  const content = await wcReadFile(path);
  return { content };
});
