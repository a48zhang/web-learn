import { Request, Response } from 'express';
import OpenAI from 'openai';
import { AuthenticatedRequest as AuthRequest } from '@web-learn/shared';
import { chatWithLLM } from '../services/aiService';

const ALLOWED_MESSAGE_ROLES = new Set(['system', 'user', 'assistant', 'tool']);
const MAX_MESSAGES = 100;
const MAX_MESSAGE_CONTENT_LENGTH = 10000;

const validateMessages = (messages: unknown): string | null => {
  if (!Array.isArray(messages)) {
    return 'messages must be an array';
  }
  if (messages.length === 0 || messages.length > MAX_MESSAGES) {
    return `messages length must be between 1 and ${MAX_MESSAGES}`;
  }
  for (const message of messages) {
    if (!message || typeof message !== 'object') {
      return 'each message must be an object';
    }
    const role = (message as { role?: unknown }).role;
    const content = (message as { content?: unknown }).content;
    if (typeof role !== 'string' || !ALLOWED_MESSAGE_ROLES.has(role)) {
      return 'message role is invalid';
    }
    // Tool messages can have null content; assistant messages with tool_calls can also have null content
    if (role === 'tool' || role === 'assistant') {
      if (content !== null && content !== undefined && typeof content !== 'string') {
        return 'message content must be a string or null';
      }
      if (typeof content === 'string' && content.length > MAX_MESSAGE_CONTENT_LENGTH) {
        return `message content too long, max ${MAX_MESSAGE_CONTENT_LENGTH}`;
      }
    } else {
      // user/system messages must have non-empty string content
      if (typeof content !== 'string' || !content.trim()) {
        return 'message content must be a non-empty string';
      }
      if (content.length > MAX_MESSAGE_CONTENT_LENGTH) {
        return `message content too long, max ${MAX_MESSAGE_CONTENT_LENGTH}`;
      }
    }
  }
  return null;
};

const validateStreamFlag = (stream: unknown): string | null => {
  if (stream === undefined || typeof stream === 'boolean') {
    return null;
  }
  return 'stream must be a boolean when provided';
};

const writeSseData = (res: Response, payload: unknown) => {
  res.write(`data: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}\n\n`);
};

export const chat = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const { messages, tools, tool_choice, model, stream } = req.body as {
      messages: any[];
      tools?: any[];
      tool_choice?: string;
      model?: string;
      stream?: unknown;
    };

    const messagesError = validateMessages(messages);
    if (messagesError) {
      return res.status(400).json({ success: false, error: messagesError });
    }

    const streamError = validateStreamFlag(stream);
    if (streamError) {
      return res.status(400).json({ success: false, error: streamError });
    }

    if (stream === true) {
      const abortController = new AbortController();
      req.on('close', () => abortController.abort());

      try {
        const streamResponse = await chatWithLLM(messages, tools, tool_choice, model, {
          stream: true,
          signal: abortController.signal,
        });

        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        if (typeof res.flushHeaders === 'function') {
          res.flushHeaders();
        }

        for await (const chunk of streamResponse as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
          writeSseData(res, chunk);
        }

        writeSseData(res, '[DONE]');
        res.end();
        return;
      } catch (error: any) {
        console.error('LLM streaming proxy error:', error);
        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            error: error?.message || 'Internal server error',
          });
        }

        writeSseData(res, { error: error?.message || 'Internal server error' });
        writeSseData(res, '[DONE]');
        res.end();
        return;
      }
    }

    const completion = await chatWithLLM(messages, tools, tool_choice, model, { stream: false });
    return res.json(completion);
  } catch (error: any) {
    console.error('LLM proxy error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
};
