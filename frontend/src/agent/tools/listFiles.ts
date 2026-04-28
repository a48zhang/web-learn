import { registerTool } from '../toolRegistry';
import { listProjectFiles } from '../../services/projectFileService';

registerTool('list_files', {
  name: 'list_files',
  description: 'List all files in the project. Returns an array of project-root-relative file paths. Absolute paths are invalid for file tools.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
}, async () => {
  try {
    const filePaths = await listProjectFiles();
    return { content: JSON.stringify(filePaths) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list project files';
    return { content: `Failed to list project files: ${message}`, isError: true };
  }
});
