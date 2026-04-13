import { registerTool } from '../toolRegistry';
import { wcCreateFile } from '../webcontainer';
import { useEditorStore } from '../../stores/useEditorStore';
import { tryStartDevServer } from '../../hooks/useWebContainer';

registerTool('create_file', {
  name: 'create_file',
  description: 'Create a new file with optional content. Creates parent directories if needed.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the new file' },
      content: { type: 'string', description: 'Initial file content (optional)', default: '' },
    },
    required: ['path'],
  },
}, async (args) => {
  const path = args.path as string;
  const content = (args.content as string) || '';
  if (!path || typeof path !== 'string') {
    return { content: 'path is required and must be a string', isError: true };
  }
  await wcCreateFile(path, content);
  useEditorStore.getState().createFile(path, content);
  if (path === 'package.json' || path.endsWith('/package.json')) {
    tryStartDevServer();
  }
  return { content: `Successfully created file ${path}` };
});
