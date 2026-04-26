import { registerTool } from '../toolRegistry';
import { wcCreateFile } from '../webcontainer';
import { useEditorStore } from '../../stores/useEditorStore';
import { tryStartDevServer } from '../../hooks/useWebContainer';
import { parseProjectToolPath } from './projectToolPath';

registerTool('create_file', {
  name: 'create_file',
  description: 'Create a project file with optional content. Creates parent directories if needed. The path must be project-root-relative, for example src/App.tsx.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Project-root-relative path to the new file, for example src/App.tsx. Do not use absolute paths.' },
      content: { type: 'string', description: 'Initial file content (optional)', default: '' },
    },
    required: ['path'],
  },
}, async (args) => {
  const path = parseProjectToolPath(args.path);
  const content = (args.content as string) || '';
  if (typeof path !== 'string') {
    return path;
  }
  await wcCreateFile(path, content);
  useEditorStore.getState().createFile(path, content);
  if (path === 'package.json' || path.endsWith('/package.json')) {
    tryStartDevServer();
  }
  return { content: `Successfully created file ${path}` };
});
