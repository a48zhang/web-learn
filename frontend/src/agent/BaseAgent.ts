import type {
  AgentType,
  AIChatMessage,
  PersistedAgentMessage,
  AgentCompressedContext,
  PersistedConversationState,
} from '@web-learn/shared';
import { agentConversationApi } from '../services/api';
import { chatWithTools } from '../services/llmApi';
import {
  estimatePromptTokens,
  selectRecentWindowGreedy,
  normalizeHistoricalMessage,
  buildCompressionPrompt,
  compressWithLlmOrFallback,
} from './contextCompression';
import { buildSystemPrompt, buildSkillPrompt } from './systemPrompts';
import { defaultAgentContextBudget } from '@web-learn/shared';
import type { RuntimeMessage } from './runtimeMessage';

export interface AgentSessionContext {
  topicId: string;
  topicTitle?: string;
  selectedSkills: string[];
  visibleMessages: PersistedAgentMessage[];
  compressedContext: AgentCompressedContext;
  setSelectedSkills(skills: string[]): void;
  setVisibleMessages(messages: PersistedAgentMessage[]): void;
  setCompressedContext(context: AgentCompressedContext): void;
}

export abstract class BaseAgent {
  constructor(protected readonly context: AgentSessionContext) {}

  abstract getAgentType(): AgentType;
  
  buildSystemPrompt(): AIChatMessage {
    return buildSystemPrompt({
      agentType: this.getAgentType(),
      selectedSkills: this.context.selectedSkills,
      topicTitle: this.context.topicTitle,
    });
  }

  async hydrateConversation(): Promise<void> {
    const data = await agentConversationApi.getConversation(this.context.topicId, this.getAgentType());
    this.context.setVisibleMessages(data.messages);
    this.context.setCompressedContext(data.compressedContext);
    this.context.setSelectedSkills(data.selectedSkills);
  }

  async persistConversation(state: PersistedConversationState): Promise<void> {
    await agentConversationApi.replaceConversation(this.context.topicId, this.getAgentType(), state);
  }

  async persistConversationState(): Promise<void> {
    await this.persistConversation({
      selectedSkills: this.context.selectedSkills,
      compressedContext: this.context.compressedContext,
      messages: this.context.visibleMessages,
    });
  }

  protected isAfterCompressionCursor(message: RuntimeMessage, lastCompressedMessageId: string | null): boolean {
    if (!lastCompressedMessageId) {
      return true;
    }
    return message.id !== lastCompressedMessageId;
  }

  protected async requestCompressionSummary(compressionPrompt: string): Promise<string> {
    const response = await chatWithTools(
      [
        { role: 'system', content: '你是一个专业的对话历史压缩助手。' },
        { role: 'user', content: compressionPrompt },
      ],
      undefined,
      undefined,
      'MiniMax-M2.7'
    );

    return response.choices[0]?.message?.content || '';
  }

  async maybeCompressContextBeforeLlmRequest(nextUserInput: string): Promise<void> {
    const { compressedContext, visibleMessages, selectedSkills, topicTitle } = this.context;
    const systemPrompt = this.buildSystemPrompt().content || '';
    const skillPrompt = buildSkillPrompt(selectedSkills);

    const estimatedPromptTokens = estimatePromptTokens({
      systemPrompt,
      skillPrompt,
      compressedSummary: compressedContext.summary,
      messages: visibleMessages,
      nextUserInput,
    });

    if (estimatedPromptTokens < defaultAgentContextBudget().compressionTriggerTokens) {
      return;
    }

    const { recentMessages } = selectRecentWindowGreedy(visibleMessages as RuntimeMessage[]);
    const newlyCompressibleMessages = visibleMessages
      .slice(0, visibleMessages.length - recentMessages.length)
      .filter((message) => this.isAfterCompressionCursor(message as RuntimeMessage, compressedContext.lastCompressedMessageId))
      .map((m) => normalizeHistoricalMessage(m as RuntimeMessage));

    if (newlyCompressibleMessages.length === 0) {
      return;
    }

    const compressionPrompt = buildCompressionPrompt({
      agentType: this.getAgentType(),
      topicTitle,
      selectedSkills,
      previousCompressedSummary: compressedContext.summary,
      newlyCompressibleMessages,
    });

    const nextSummary = await compressWithLlmOrFallback(
      compressionPrompt,
      {
        previousCompressedSummary: compressedContext.summary,
        newlyCompressibleMessages,
      },
      this.requestCompressionSummary.bind(this)
    );

    const nextCompressedContext: AgentCompressedContext = {
      summary: nextSummary,
      summaryVersion: 1,
      lastCompressedMessageId: newlyCompressibleMessages.at(-1)?.id ?? compressedContext.lastCompressedMessageId,
      updatedAt: new Date().toISOString(),
      hasCompressedContext: true,
    };

    this.context.setCompressedContext(nextCompressedContext);
    this.context.setVisibleMessages(recentMessages as PersistedAgentMessage[]);
  }

  protected buildLlmMessages(): AIChatMessage[] {
    const messages: AIChatMessage[] = [this.buildSystemPrompt()];

    if (this.context.compressedContext.hasCompressedContext && this.context.compressedContext.summary) {
      messages.push({
        role: 'system',
        content: [
          '以下是此前较早历史的压缩记忆，请将其视为已确认的长期上下文。',
          '如果它与 recent window 冲突，以 recent window 为准。',
          this.context.compressedContext.summary,
        ].join('\n\n'),
      });
    }

    for (const message of this.context.visibleMessages) {
      messages.push({
        role: message.role,
        content: message.content,
      });
    }

    return messages;
  }
}
