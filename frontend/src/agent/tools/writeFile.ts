import { registerTool } from '../toolRegistry';
import { wcWriteFile } from '../webcontainer';

registerTool('write_file', {
  name: 'write_file',
  description: 'Overwrite the contents of an existing file. Creates parent directories if needed.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to write' },
      content: { type: 'string', description: 'New content for the file' },
    },
    required: ['path', 'content'],
  },
}, async (args) => {
  const path = args.path as string;
  const content = args.content as string;
  if (!path || typeof path !== 'string') {
    return { content: 'path is required and must be a string', isError: true };
  }
  if (typeof content !== 'string') {
    return { content: 'content is required and must be a string', isError: true };
  }
  await wcWriteFile(path, content);
  return { content: `Successfully wrote ${content.length} bytes to ${path}` };
});
