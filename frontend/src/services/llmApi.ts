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

type ChatCompletionChunkStream = AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

type MutableToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

const ensureAsyncIterable = (value: unknown): ChatCompletionChunkStream => {
  if (value && typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    return value as ChatCompletionChunkStream;
  }

  throw new Error('Expected a streaming chat completion response');
};

const upsertToolCallChunk = (
  toolCalls: Map<number, MutableToolCall>,
  toolCallChunk: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall,
) => {
  const index = toolCallChunk.index ?? 0;
  const existing = toolCalls.get(index) ?? {
    id: toolCallChunk.id || `tool_call_${index}`,
    type: 'function' as const,
    function: {
      name: '',
      arguments: '',
    },
  };

  if (toolCallChunk.id) {
    existing.id = toolCallChunk.id;
  }
  if (toolCallChunk.type === 'function') {
    existing.type = 'function';
  }
  if (typeof toolCallChunk.function?.name === 'string') {
    existing.function.name += toolCallChunk.function.name;
  }
  if (typeof toolCallChunk.function?.arguments === 'string') {
    existing.function.arguments += toolCallChunk.function.arguments;
  }

  toolCalls.set(index, existing);
};

export async function consumeChatCompletionStream(
  stream: ChatCompletionChunkStream,
  onStream: (chunk: string) => void,
  fallbackModel: string,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  let responseId = '';
  let responseModel = fallbackModel;
  let finishReason: OpenAI.Chat.Completions.ChatCompletion.Choice['finish_reason'] = 'stop';
  let content = '';
  let sawChunk = false;
  const toolCalls = new Map<number, MutableToolCall>();

  for await (const chunk of stream) {
    sawChunk = true;
    responseId ||= chunk.id;
    responseModel = chunk.model || responseModel;

    for (const choice of chunk.choices ?? []) {
      if (choice.finish_reason !== null && choice.finish_reason !== undefined) {
        finishReason = choice.finish_reason;
      }

      const delta = choice.delta;
      if (!delta) {
        continue;
      }

      if (typeof delta.content === 'string' && delta.content.length > 0) {
        content += delta.content;
        onStream(delta.content);
      }

      for (const toolCallChunk of delta.tool_calls ?? []) {
        upsertToolCallChunk(toolCalls, toolCallChunk);
      }
    }
  }

  if (!sawChunk) {
    throw new Error('Streaming chat completion ended without any chunks');
  }

  const assembledToolCalls = Array.from(toolCalls.entries())
    .sort(([left], [right]) => left - right)
    .map(([, toolCall]) => ({
      id: toolCall.id,
      type: 'function' as const,
      function: {
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
      },
    }));

  return {
    id: responseId || 'chatcmpl-stream',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: responseModel,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: content || null,
          refusal: null,
          ...(assembledToolCalls.length > 0 ? { tool_calls: assembledToolCalls } : {}),
        },
        finish_reason: finishReason,
        logprobs: null,
      },
    ],
  };
}

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
  const selectedModel = model || 'MiniMax-M2.7';

  const response = await llmClient.chat.completions.create({
    model: selectedModel,
    messages: messages as any,
    tools,
    tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
    stream: !!onStream,
  });

  if (!onStream) {
    return response as OpenAI.Chat.Completions.ChatCompletion;
  }

  return await consumeChatCompletionStream(ensureAsyncIterable(response), onStream, selectedModel);
}
