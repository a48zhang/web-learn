import type { AgentToolDefinition, AgentToolResult } from '@web-learn/shared';

export type ToolExecuteFn = (args: Record<string, unknown>) => Promise<AgentToolResult>;

export interface RegisteredTool {
  definition: AgentToolDefinition;
  execute: ToolExecuteFn;
}

const tools = new Map<string, RegisteredTool>();

export function registerTool(name: string, definition: AgentToolDefinition, execute: ToolExecuteFn): void {
  tools.set(name, { definition, execute });
}

export function getToolDefinitions(): AgentToolDefinition[] {
  return Array.from(tools.values()).map((t) => t.definition);
}

export function getOpenAITools(): any[] {
  return Array.from(tools.values()).map((t) => ({
    type: 'function',
    function: {
      name: t.definition.name,
      description: t.definition.description,
      parameters: t.definition.parameters,
    },
  }));
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<AgentToolResult> {
  const tool = tools.get(name);
  if (!tool) {
    return { content: `Unknown tool: ${name}`, isError: true };
  }
  try {
    return await tool.execute(args);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tool execution failed';
    return { content: message, isError: true };
  }
}
