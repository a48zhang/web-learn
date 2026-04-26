import { registerTool } from '../toolRegistry';
import { useTerminalStore } from '../../stores/useTerminalStore';
import { wcSpawnCommand } from '../webcontainer';

function appendTerminalOutput(data: string): void {
  useTerminalStore.getState().appendOutput(data);
}

function quoteCommandPart(part: string): string {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(part)) return part;
  return JSON.stringify(part);
}

export function parseCommand(command: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;
  let escaping = false;
  let tokenStarted = false;

  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];

    if (escaping) {
      current += char;
      tokenStarted = true;
      escaping = false;
      continue;
    }

    if (quote === "'") {
      if (char === "'") {
        quote = null;
      } else {
        current += char;
        tokenStarted = true;
      }
      continue;
    }

    if (quote === '"') {
      if (char === '"') {
        quote = null;
      } else if (char === '\\') {
        i += 1;
        if (i >= command.length) {
          throw new Error('Unterminated escape sequence in command');
        }
        current += command[i];
        tokenStarted = true;
      } else {
        current += char;
        tokenStarted = true;
      }
      continue;
    }

    if (char === '\\') {
      escaping = true;
      tokenStarted = true;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      tokenStarted = true;
      continue;
    }

    if (/\s/.test(char)) {
      if (tokenStarted) {
        parts.push(current);
        current = '';
        tokenStarted = false;
      }
      continue;
    }

    current += char;
    tokenStarted = true;
  }

  if (escaping) {
    throw new Error('Unterminated escape sequence in command');
  }

  if (quote) {
    throw new Error(`Unterminated ${quote === "'" ? 'single' : 'double'} quote in command`);
  }

  if (tokenStarted) {
    parts.push(current);
  }

  return parts;
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
  if (typeof commandStr !== 'string' || commandStr.trim().length === 0) {
    return { content: 'command is required and must be a string', isError: true };
  }

  try {
    const parts = parseCommand(commandStr);
    if (parts.length === 0) {
      return { content: 'command is required and must be a string', isError: true };
    }

    const cmd = parts[0];
    const cmdArgs = parts.slice(1);
    const printableCommand = [cmd, ...cmdArgs].map(quoteCommandPart).join(' ');
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
