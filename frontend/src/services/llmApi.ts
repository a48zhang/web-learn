import OpenAI from 'openai';
import type { AIChatMessage } from '@web-learn/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getAuthToken = () => localStorage.getItem('auth_token');

const createLlmClient = (token: string) =>
  new OpenAI({
    apiKey: token,
    baseURL: `${API_BASE_URL}/ai`,
    dangerouslyAllowBrowser: true,
  });

export async function chatWithTools(
  messages: AIChatMessage[],
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[],
  onStream?: (chunk: string) => void,
  model?: string
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const token = getAuthToken();
  if (!token?.trim()) {
    throw new Error('Missing auth token');
  }
  const llmClient = createLlmClient(token);

  const response = await llmClient.chat.completions.create({
    model: model,
    messages: messages as any,
    tools,
    tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
    stream: !!onStream,
  });

  return response as OpenAI.Chat.Completions.ChatCompletion;
}
