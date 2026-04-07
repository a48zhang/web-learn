import OpenAI from 'openai';
import type { AIChatMessage, AgentResponse } from '@web-learn/shared';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api';

// Configure OpenAI SDK to point at our backend proxy
const llmClient = new OpenAI({
  apiKey: 'proxy-key', // Not used directly, backend handles auth
  baseURL: `${API_BASE_URL}/llm`,
  dangerouslyAllowBrowser: true,
});

export async function sendChatMessage(
  messages: AIChatMessage[],
  onStream?: (chunk: string) => void
): Promise<AgentResponse | null> {
  try {
    const response = await llmClient.chat.completions.create({
      model: (import.meta as any).env?.VITE_LLM_MODEL || 'gpt-4o',
      messages: messages as any,
      response_format: { type: 'json_object' },
      stream: !!onStream,
    });

    if (onStream) {
      // Streaming response
      let fullContent = '';
      for await (const chunk of response as any) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullContent += content;
        onStream(content);
      }
      // Parse JSON from full content
      try {
        return JSON.parse(fullContent) as AgentResponse;
      } catch {
        return { message: fullContent, files: [] };
      }
    }

    // Non-streaming response
    const completion = response as any;
    const content = completion.choices?.[0]?.message?.content;
    if (!content) return null;

    try {
      return JSON.parse(content) as AgentResponse;
    } catch {
      return { message: content, files: [] };
    }
  } catch (error) {
    console.error('LLM API error:', error);
    throw error;
  }
}
