import { registerTool } from '../toolRegistry';
import { deleteProjectPath } from '../../services/projectFileService';
import { parseProjectToolPath } from './projectToolPath';

registerTool('delete_file', {
  name: 'delete_file',
  description: 'Delete a project file or directory. The path must be project-root-relative, for example src/App.tsx. Absolute paths are invalid.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Project-root-relative path to the file or directory. Absolute paths are invalid.' },
    },
    required: ['path'],
  },
}, async (args) => {
  const path = parseProjectToolPath(args.path);
  if (typeof path !== 'string') {
    return path;
  }
  try {
    await deleteProjectPath(path);
    return { content: `Successfully deleted ${path}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete project path';
    return { content: `Failed to delete ${path}: ${message}`, isError: true };
  }
});
