import { registerTool } from '../toolRegistry';
import { wcListFiles } from '../webcontainer';

registerTool('list_files', {
  name: 'list_files',
  description: 'List all files in the project. Returns an array of file paths.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
}, async (_args) => {
  const files = await wcListFiles();
  return { content: JSON.stringify(files) };
});
