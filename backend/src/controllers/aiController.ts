import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Topic } from '../models';
import { chatWithTools } from '../services/aiService';
import { getBuildingTools, getLearningTools } from '../services/agentTools';

const getSystemPrompt = (agentType: 'learning' | 'building', topic: Topic) => {
  if (agentType === 'building') {
    return [
      '你是专题搭建助手。',
      '目标：帮助教师创建与编辑专题内容。',
      '你必须优先使用工具读写页面内容。',
      `当前专题：${topic.title}（ID=${topic.id}，type=${topic.type}，status=${topic.status}）`,
    ].join('\n');
  }
  return [
    '你是学习助手。',
    '目标：回答专题相关问题，引用页面内容，避免无依据回答。',
    '你可以调用工具查询专题、页面与关键词。',
    `当前专题：${topic.title}（ID=${topic.id}，type=${topic.type}，status=${topic.status}）`,
  ].join('\n');
};

const ALLOWED_MESSAGE_ROLES = new Set(['system', 'user', 'assistant', 'tool']);
const MAX_MESSAGES = 50;
const MAX_MESSAGE_CONTENT_LENGTH = 10000;

const validateMessages = (messages: unknown) => {
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

export const chat = async (req: AuthRequest | Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const { messages, topic_id, agent_type } = req.body as {
      messages: any[];
      topic_id: number;
      agent_type: 'learning' | 'building';
    };
    if (!topic_id || !agent_type) {
      return res.status(400).json({ success: false, error: 'messages, topic_id, agent_type are required' });
    }
    const messagesError = validateMessages(messages);
    if (messagesError) {
      return res.status(400).json({ success: false, error: messagesError });
    }
    if (!['learning', 'building'].includes(agent_type)) {
      return res.status(400).json({ success: false, error: 'Invalid agent_type' });
    }

    const topic = await Topic.findByPk(topic_id);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }

    if (agent_type === 'learning' && topic.status !== 'published') {
      return res.status(403).json({ success: false, error: 'Topic is not published' });
    }

    if (agent_type === 'building') {
      if (authReq.user.role !== 'teacher') {
        return res.status(403).json({ success: false, error: 'Only teachers can use building assistant' });
      }
      if (topic.created_by !== authReq.user.id) {
        return res.status(403).json({ success: false, error: 'Only topic creator can use building assistant' });
      }
      if (topic.type !== 'knowledge') {
        return res.status(400).json({ success: false, error: 'Building assistant currently supports knowledge topics only' });
      }
    }

    const tools = agent_type === 'building' ? getBuildingTools() : getLearningTools();
    const systemPrompt = getSystemPrompt(agent_type, topic);

    const completion = await chatWithTools({
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      tools,
      context: {
        topicId: topic.id,
        userId: authReq.user.id,
        userRole: authReq.user.role,
      },
      metadata: {
        topic_id: topic.id,
        agent_type,
        user_id: authReq.user.id,
      },
    });

    return res.json(completion);
  } catch (error: any) {
    console.error('AI chat error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
};
