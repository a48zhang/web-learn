import { registerTool } from '../toolRegistry';
import { readProjectFile } from '../../services/projectFileService';
import { parseProjectToolPath } from './projectToolPath';

registerTool('read_file', {
  name: 'read_file',
  description: 'Read a project file. The path must be project-root-relative, for example src/App.tsx. Absolute paths are invalid.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Project-root-relative path to the file, for example src/App.tsx. Absolute paths are invalid.' },
    },
    required: ['path'],
  },
}, async (args) => {
  const path = parseProjectToolPath(args.path);
  if (typeof path !== 'string') {
    return path;
  }
  try {
    const content = await readProjectFile(path);
    return { content };
  } catch (error) {
    const message = error instanceof Error ? error.message : `File not found: ${path}`;
    return { content: `Failed to read ${path}: ${message}`, isError: true };
  }
});
