import { registerTool } from '../toolRegistry';
import { createProjectFile } from '../../services/projectFileService';
import { tryStartDevServer } from '../../hooks/useWebContainer';
import { parseProjectToolPath } from './projectToolPath';

registerTool('create_file', {
  name: 'create_file',
  description: 'Create a project file with optional content. Creates parent directories if needed. The path must be project-root-relative, for example src/App.tsx. Absolute paths are invalid.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Project-root-relative path to the new file, for example src/App.tsx. Absolute paths are invalid.' },
      content: { type: 'string', description: 'Initial file content (optional)', default: '' },
    },
    required: ['path'],
  },
}, async (args) => {
  const path = parseProjectToolPath(args.path);
  const content = args.content ?? '';
  if (typeof path !== 'string') {
    return path;
  }
  if (typeof content !== 'string') {
    return { content: 'content must be a string when provided', isError: true };
  }
  try {
    await createProjectFile(path, content);
    if (path === 'package.json' || path.endsWith('/package.json')) {
      tryStartDevServer();
    }
    return { content: `Successfully created file ${path}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create project file';
    return { content: `Failed to create ${path}: ${message}`, isError: true };
  }
});
