import { registerTool } from '../toolRegistry';
import { wcDeleteFile } from '../webcontainer';
import { useEditorStore } from '../../stores/useEditorStore';
import { parseProjectToolPath } from './projectToolPath';

registerTool('delete_file', {
  name: 'delete_file',
  description: 'Delete a project file or directory. The path must be project-root-relative, for example src/App.tsx.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Project-root-relative path to the file or directory. Do not use absolute paths.' },
    },
    required: ['path'],
  },
}, async (args) => {
  const path = parseProjectToolPath(args.path);
  if (typeof path !== 'string') {
    return path;
  }
  await wcDeleteFile(path);
  useEditorStore.getState().deleteFile(path);
  return { content: `Successfully deleted ${path}` };
});
