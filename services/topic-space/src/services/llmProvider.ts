import OpenAI from 'openai';
import { config } from '../utils/config';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.baseUrl,
    });
  }
  return openaiClient;
}

export async function createChatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null }>,
  options?: { stream?: boolean; response_format?: { type: 'json_object' | 'text' } }
) {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: config.llm.model,
    messages: messages as any,
    stream: options?.stream || false,
    response_format: options?.response_format,
  });
  return response;
}
