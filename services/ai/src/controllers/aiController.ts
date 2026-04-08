import { Request, Response } from 'express';
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
    if (typeof content !== 'string' || !content.trim()) {
      return 'message content must be a non-empty string';
    }
    if (content.length > MAX_MESSAGE_CONTENT_LENGTH) {
      return `message content too long, max ${MAX_MESSAGE_CONTENT_LENGTH}`;
    }
  }
  return null;
};

export const chat = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    // Forward the OpenAI-compatible request body as-is
    const { messages, tools, tool_choice, stream, model } = req.body as {
      messages: any[];
      tools?: any[];
      tool_choice?: string;
      stream?: boolean;
      model?: string;
    };

    const messagesError = validateMessages(messages);
    if (messagesError) {
      return res.status(400).json({ success: false, error: messagesError });
    }

    const completion = await chatWithLLM(messages, tools, tool_choice, model);
    return res.json(completion);
  } catch (error: any) {
    console.error('LLM proxy error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
};
