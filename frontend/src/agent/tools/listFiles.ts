import { registerTool } from '../toolRegistry';
import { useEditorStore } from '../../stores/useEditorStore';

registerTool('list_files', {
  name: 'list_files',
  description: 'List all files in the project. Returns an array of file paths.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
}, async (_args) => {
  // Read from EditorStore directly to ensure consistency with FileTree
  const files = useEditorStore.getState().files;
  const filePaths = Object.keys(files);
  return { content: JSON.stringify(filePaths) };
});
