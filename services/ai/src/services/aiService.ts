import OpenAI from 'openai';
import { config } from '../utils/config';

// The backend LLM client connects to an EXTERNAL OpenAI-compatible provider.
// Configure the target via OPENAI_API_KEY (required) and OPENAI_BASE_URL (optional).
const client = config.ai.apiKey
  ? new OpenAI({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseUrl || undefined,
    })
  : null;

export const chatWithLLM = async (
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[],
  toolChoice?: string,
  model?: string
): Promise<OpenAI.Chat.Completions.ChatCompletion> => {
  if (!client || !config.ai.apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const selectedModel = model ?? config.ai.model ?? 'MiniMax-M2.7';

  const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: selectedModel,
    messages,
    stream: false,
  };

  if (tools && tools.length > 0) {
    params.tools = tools;
    if (toolChoice) {
      params.tool_choice = toolChoice as any;
    }
  }

  return await client.chat.completions.create(params);
};
