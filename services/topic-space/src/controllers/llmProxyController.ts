import { Request, Response } from 'express';
import { createChatCompletion } from '../services/llmProvider';

export const llmChat = async (req: Request, res: Response) => {
  try {
    const { messages, stream, response_format } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const response = await createChatCompletion(messages, {
      stream: stream || false,
      response_format,
    });

    res.json(response);
  } catch (error) {
    console.error('LLM proxy error:', error);
    res.status(500).json({ error: 'LLM service unavailable' });
  }
};

export const llmChatStream = async (req: Request, res: Response) => {
  try {
    const { messages, response_format } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const response = await createChatCompletion(messages, {
      stream: true,
      response_format,
    });

    if (response && Symbol.asyncIterator in (response as any)) {
      for await (const chunk of response as unknown as AsyncIterable<unknown>) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('LLM stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'LLM service unavailable' });
    } else {
      res.end();
    }
  }
};
