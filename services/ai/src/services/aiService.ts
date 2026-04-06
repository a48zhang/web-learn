import OpenAI from 'openai';
import { config } from '../utils/config';
import { AgentTool, ToolContext, findTool } from './agentTools';

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const client = config.ai.apiKey
  ? new OpenAI({
    apiKey: config.ai.apiKey,
    baseURL: config.ai.baseUrl || undefined,
  })
  : null;

const normalizeToolOutput = (value: unknown) => {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

const executeTool = async (
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
  tools: AgentTool[],
  context: ToolContext
) => {
  const target = findTool(toolCall.function.name, tools);
  if (!target) {
    return { error: `Unknown tool: ${toolCall.function.name}` };
  }
  let parsed: any = {};
  try {
    parsed = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
  } catch {
    return { error: `Invalid arguments for ${toolCall.function.name}` };
  }
  try {
    return await target.execute(parsed, context);
  } catch (error: any) {
    return { error: error?.message || 'Tool execution failed' };
  }
};

export const chatWithTools = async ({
  messages,
  tools,
  context,
  metadata,
}: {
  messages: ChatMessage[];
  tools: AgentTool[];
  context: ToolContext;
  metadata?: Record<string, any>;
}) => {
  if (!client || !config.ai.apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const chatMessages: ChatMessage[] = [...messages];
  const maxToolLoops = 8;

  const openAITools: OpenAI.Chat.Completions.ChatCompletionTool[] = tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

  for (let i = 0; i < maxToolLoops; i += 1) {
    const completion = await client.chat.completions.create({
      model: config.ai.model,
      messages: chatMessages,
      tools: openAITools,
      metadata,
    });
    const choice = completion.choices[0];
    const message = choice.message;
    chatMessages.push(message);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return completion;
    }

    for (const toolCall of message.tool_calls) {
      const result = await executeTool(toolCall, tools, context);
      chatMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: normalizeToolOutput(result),
      });
    }
  }

  throw new Error('Tool calling loop exceeded maximum iterations');
};
