import { registerTool } from '../toolRegistry';
import { wcSpawnCommand } from '../webcontainer';

registerTool('run_command', {
  name: 'run_command',
  description: 'Execute a shell command in the project. Only safe commands are allowed (npm, npx, node, ls, cat, mkdir, rm, echo, cp, mv).',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The command to execute, e.g. "npm install lodash"' },
    },
    required: ['command'],
  },
}, async (args) => {
  const commandStr = args.command as string;
  if (!commandStr || typeof commandStr !== 'string') {
    return { content: 'command is required and must be a string', isError: true };
  }

  const parts = commandStr.trim().split(/\s+/);
  const cmd = parts[0];
  const cmdArgs = parts.slice(1);

  try {
    const result = await wcSpawnCommand(cmd, cmdArgs);
    const text = result.output || '(no output)';
    return { content: text };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Command execution failed';
    return { content: message, isError: true };
  }
});
