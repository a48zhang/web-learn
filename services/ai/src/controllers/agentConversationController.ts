import { Response } from 'express';
import { AuthenticatedRequest as AuthRequest } from '@web-learn/shared';
import { AgentConversation, AgentMessage } from '../models';
import { sequelize } from '../utils/database';

const validateConversationPayload = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return 'payload must be an object';
  }
  const { messages, selectedSkills, compressedContext } = payload as Record<string, unknown>;

  if (!Array.isArray(selectedSkills)) {
    return 'selectedSkills must be an array';
  }
  if (!selectedSkills.every((skill) => typeof skill === 'string')) {
    return 'each selectedSkill must be a string';
  }

  if (!compressedContext || typeof compressedContext !== 'object') {
    return 'compressedContext is required';
  }
  const ctx = compressedContext as Record<string, unknown>;
  if (typeof ctx.summary !== 'string') {
    return 'compressedContext.summary must be a string';
  }
  if (typeof ctx.summaryVersion !== 'number') {
    return 'compressedContext.summaryVersion must be a number';
  }
  if (ctx.firstUncompressedMessageId !== null && typeof ctx.firstUncompressedMessageId !== 'string') {
    return 'compressedContext.firstUncompressedMessageId must be a string or null';
  }
  if (typeof ctx.hasCompressedContext !== 'boolean') {
    return 'compressedContext.hasCompressedContext must be a boolean';
  }

  if (!Array.isArray(messages)) {
    return 'messages must be an array';
  }
  for (const message of messages) {
    if (!message || typeof message !== 'object') {
      return 'each message must be an object';
    }
    const m = message as Record<string, unknown>;
    if (typeof m.id !== 'string') {
      return 'message.id must be a string';
    }
    if (m.role !== 'user' && m.role !== 'assistant') {
      return 'message.role must be user or assistant';
    }
    if (typeof m.content !== 'string') {
      return 'message.content must be a string';
    }
  }

  return null;
};

export const getConversation = async (req: AuthRequest, res: Response) => {
  try {
    const { topicId, agentType } = req.params;

    if (!topicId || !agentType) {
      return res.status(400).json({ success: false, error: 'topicId and agentType are required' });
    }

    if (agentType !== 'building' && agentType !== 'learning') {
      return res.status(400).json({ success: false, error: 'agentType must be building or learning' });
    }

    const userId = String(req.user!.id);

    const conversation = await AgentConversation.findOne({
      where: { topic_id: topicId, user_id: userId, agent_type: agentType },
      include: [{ model: AgentMessage, as: 'messages' }],
      order: [[{ model: AgentMessage, as: 'messages' }, 'seq', 'ASC']],
    });

    if (!conversation) {
      return res.json({
        success: true,
        data: {
          selectedSkills: [],
          compressedContext: {
            summary: '',
            summaryVersion: 1,
            firstUncompressedMessageId: null,
            hasCompressedContext: false,
            updatedAt: new Date().toISOString(),
          },
          messages: [],
        },
      });
    }

    const messages = (conversation.get('messages') as AgentMessage[] | undefined) ?? [];

    return res.json({
      success: true,
      data: {
        selectedSkills: conversation.selected_skills,
        compressedContext: {
          summary: conversation.compressed_summary,
          summaryVersion: conversation.compressed_summary_version,
          firstUncompressedMessageId: conversation.first_uncompressed_message_id,
          hasCompressedContext: conversation.has_compressed_context,
          updatedAt: conversation.updatedAt.toISOString(),
        },
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('Failed to get conversation:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const replaceConversation = async (req: AuthRequest, res: Response) => {
  try {
    const { topicId, agentType } = req.params;

    if (!topicId || !agentType) {
      return res.status(400).json({ success: false, error: 'topicId and agentType are required' });
    }

    if (agentType !== 'building' && agentType !== 'learning') {
      return res.status(400).json({ success: false, error: 'agentType must be building or learning' });
    }

    const validationError = validateConversationPayload(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const { messages, selectedSkills, compressedContext } = req.body;
    const userId = String(req.user!.id);

    const result = await sequelize.transaction(async (transaction) => {
      let conversation = await AgentConversation.findOne({
        where: { topic_id: topicId, user_id: userId, agent_type: agentType },
        transaction,
      });

      if (!conversation) {
        conversation = await AgentConversation.create(
          {
            topic_id: topicId,
            user_id: userId,
            agent_type: agentType as 'building' | 'learning',
            selected_skills: selectedSkills,
            compressed_summary: compressedContext.summary,
            compressed_summary_version: compressedContext.summaryVersion,
            first_uncompressed_message_id: compressedContext.firstUncompressedMessageId,
            has_compressed_context: compressedContext.hasCompressedContext,
          },
          { transaction }
        );
      } else {
        await conversation.update(
          {
            selected_skills: selectedSkills,
            compressed_summary: compressedContext.summary,
            compressed_summary_version: compressedContext.summaryVersion,
            first_uncompressed_message_id: compressedContext.firstUncompressedMessageId,
            has_compressed_context: compressedContext.hasCompressedContext,
          },
          { transaction }
        );
      }

      await AgentMessage.destroy({
        where: { conversation_id: conversation.id },
        transaction,
      });

      if (messages.length > 0) {
        await AgentMessage.bulkCreate(
          messages.map((m: { id: string; role: string; content: string }, index: number) => ({
            id: m.id,
            conversation_id: conversation!.id,
            role: m.role,
            content: m.content,
            seq: index,
          })),
          { transaction }
        );
      }

      await conversation.reload({ include: [{ model: AgentMessage, as: 'messages' }], transaction });

      const reloadedMessages = (conversation.get('messages') as AgentMessage[] | undefined) ?? [];

      return {
        selectedSkills: conversation.selected_skills,
        compressedContext: {
          summary: conversation.compressed_summary,
          summaryVersion: conversation.compressed_summary_version,
          firstUncompressedMessageId: conversation.first_uncompressed_message_id,
          hasCompressedContext: conversation.has_compressed_context,
          updatedAt: conversation.updatedAt.toISOString(),
        },
        messages: reloadedMessages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Failed to replace conversation:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
