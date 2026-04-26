import { registerTool } from '../toolRegistry';
import { wcWriteFile } from '../webcontainer';
import { useEditorStore } from '../../stores/useEditorStore';
import { parseProjectToolPath } from './projectToolPath';

registerTool('write_file', {
  name: 'write_file',
  description: 'Overwrite a project file. Creates parent directories if needed. The path must be project-root-relative, for example src/App.tsx.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Project-root-relative path to the file, for example src/App.tsx. Do not use absolute paths.' },
      content: { type: 'string', description: 'New content for the file' },
    },
    required: ['path', 'content'],
  },
}, async (args) => {
  console.log("write_file: ", args.path);
  const path = parseProjectToolPath(args.path);
  const content = args.content as string;
  if (typeof path !== 'string') {
    return path;
  }
  if (typeof content !== 'string') {
    return { content: 'content is required and must be a string', isError: true };
  }
  await wcWriteFile(path, content);
  useEditorStore.getState().setFileContent(path, content);
  return { content: `Successfully wrote ${content.length} bytes to ${path}` };
});
