import { registerTool } from '../toolRegistry';
import { writeProjectFile } from '../../services/projectFileService';
import { tryStartDevServer } from '../../hooks/useWebContainer';
import { parseProjectToolPath } from './projectToolPath';

registerTool('write_file', {
  name: 'write_file',
  description: 'Overwrite a project file. Creates parent directories if needed. The path must be project-root-relative, for example src/App.tsx. Absolute paths are invalid.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Project-root-relative path to the file, for example src/App.tsx. Absolute paths are invalid.' },
      content: { type: 'string', description: 'New content for the file' },
    },
    required: ['path', 'content'],
  },
}, async (args) => {
  const path = parseProjectToolPath(args.path);
  const content = args.content as string;
  if (typeof path !== 'string') {
    return path;
  }
  if (typeof content !== 'string') {
    return { content: 'content is required and must be a string', isError: true };
  }
  try {
    await writeProjectFile(path, content);
    if (path === 'package.json' || path.endsWith('/package.json')) {
      tryStartDevServer();
    }
    return { content: `Successfully wrote ${content.length} bytes to ${path}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to write project file';
    return { content: `Failed to write ${path}: ${message}`, isError: true };
  }
});
