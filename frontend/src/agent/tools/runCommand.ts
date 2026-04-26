import { registerTool } from '../toolRegistry';
import { wcSpawnCommand } from '../webcontainer';
import { useTerminalStore } from '../../stores/useTerminalStore';

function appendTerminalOutput(data: string): void {
  useTerminalStore.getState().appendOutput(data);
}

function formatCommandPart(part: string): string {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(part)) return part;
  return JSON.stringify(part);
}

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
    const printableCommand = [cmd, ...cmdArgs].map(formatCommandPart).join(' ');
    appendTerminalOutput(`\r\n[agent] $ ${printableCommand}\r\n`);
    const result = await wcSpawnCommand(cmd, cmdArgs, {
      onOutput: appendTerminalOutput,
    });
    appendTerminalOutput(`\r\n[agent] exited with code ${result.exitCode}\r\n`);
    const text = result.output || '(no output)';
    return { content: text };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Command execution failed';
    appendTerminalOutput(`\r\n[agent] command failed: ${message}\r\n`);
    return { content: message, isError: true };
  }
});
