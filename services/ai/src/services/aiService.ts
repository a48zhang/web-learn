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

type ChatWithLLMOptions = {
  stream?: boolean;
  signal?: AbortSignal;
};

export type ChatWithLLMResult =
  | OpenAI.Chat.Completions.ChatCompletion
  | AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

export const chatWithLLM = async (
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[],
  toolChoice?: string,
  model?: string,
  options: ChatWithLLMOptions = {}
): Promise<ChatWithLLMResult> => {
  if (!client || !config.ai.apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const selectedModel = model ?? config.ai.model ?? 'MiniMax-M2.7';
  const baseParams = {
    model: selectedModel,
    messages,
    ...(tools && tools.length > 0 ? { tools } : {}),
    ...(tools && tools.length > 0 && toolChoice ? { tool_choice: toolChoice as any } : {}),
  };

  if (options.stream) {
    return await client.chat.completions.create(
      {
        ...baseParams,
        stream: true,
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
      options.signal ? { signal: options.signal } : undefined
    );
  }

  return await client.chat.completions.create(
    {
      ...baseParams,
      stream: false,
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
    options.signal ? { signal: options.signal } : undefined
  );
};
