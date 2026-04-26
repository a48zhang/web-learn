import { registerTool } from '../toolRegistry';
import { useEditorStore } from '../../stores/useEditorStore';
import { parseProjectToolPath } from './projectToolPath';

registerTool('read_file', {
  name: 'read_file',
  description: 'Read a project file. The path must be project-root-relative, for example src/App.tsx.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Project-root-relative path to the file, for example src/App.tsx. Do not use absolute paths.' },
    },
    required: ['path'],
  },
}, async (args) => {
  const path = parseProjectToolPath(args.path);
  if (typeof path !== 'string') {
    return path;
  }
  // Read from EditorStore directly to ensure consistency with FileTree
  const files = useEditorStore.getState().files;
  const content = files[path];
  if (content === undefined) {
    return { content: `File not found: ${path}`, isError: true };
  }
  return { content };
});
