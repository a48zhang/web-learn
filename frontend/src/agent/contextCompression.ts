import { defaultAgentContextBudget } from '@web-learn/shared';
import type { RuntimeMessage } from './runtimeMessage';
import type { AgentType } from '@web-learn/shared';

export function estimateMessageTokens(message: RuntimeMessage): number {
  return Math.ceil(message.content.length / 4) + 12;
}

export function estimatePromptTokens(input: {
  systemPrompt: string;
  skillPrompt: string;
  compressedSummary: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  nextUserInput: string;
}): number {
  return (
    Math.ceil(input.systemPrompt.length / 4) +
    Math.ceil(input.skillPrompt.length / 4) +
    Math.ceil(input.compressedSummary.length / 4) +
    Math.ceil(input.nextUserInput.length / 4) +
    input.messages.reduce((sum, message) => sum + estimateMessageTokens(message as RuntimeMessage), 0)
  );
}

export function selectRecentWindowGreedy(messages: RuntimeMessage[]): {
  recentMessages: RuntimeMessage[];
  recentTokenEstimate: number;
} {
  const selected: RuntimeMessage[] = [];
  let used = 0;
  const maxRecentWindowTokens = defaultAgentContextBudget().recentWindowTokens;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const cost = estimateMessageTokens(messages[i]);
    if (used + cost > maxRecentWindowTokens) break;
    selected.unshift(messages[i]);
    used += cost;
  }

  return { recentMessages: selected, recentTokenEstimate: used };
}

export function normalizeHistoricalMessage(message: RuntimeMessage): RuntimeMessage {
  return {
    ...message,
    content: message.content.length > 800 ? `${message.content.slice(0, 800)}...` : message.content,
  };
}

export function buildCompressionPrompt(input: {
  agentType: AgentType;
  topicTitle?: string;
  selectedSkills: string[];
  previousCompressedSummary: string;
  newlyCompressibleMessages: RuntimeMessage[];
}): string {
  return [
    '你要把一段较早的 agent 对话压缩成"可继续推理的工作记忆"。',
    '输入包括两部分：旧的压缩摘要，以及本次新增进入压缩区的历史消息。',
    '要求：',
    '1. 先总结过去对话大致内容和整体推进过程。',
    '2. 再明确指出其中必须详细记住的重点。',
    '3. 只保留后续推理需要的信息。',
    '4. 不保留寒暄、重复表达、无结果讨论。',
    '5. 只写已经确认的内容；未确认内容必须标注"待确认"。',
    '6. 如果旧摘要与新增历史有冲突，以新增历史为准修正摘要。',
    '7. 不要重复 recent window 中仍保留原文的内容。',
    '输出必须严格使用以下结构：',
    '## 历史概览',
    '- ...',
    '## 关键记忆点',
    '- ...',
    '## 长期目标',
    '- ...',
    '## 已确认事实',
    '- ...',
    '## 已确认约束',
    '- ...',
    '## 已完成事项',
    '- ...',
    '## 当前未完成问题',
    '- ...',
    '## 下一步计划',
    '- ...',
    '',
    `当前 agentType: ${input.agentType}`,
    `当前专题: ${input.topicTitle ?? '未知专题'}`,
    `当前 skills: ${input.selectedSkills.join(', ') || '无'}`,
    '',
    '## 旧压缩摘要',
    input.previousCompressedSummary || '(无)',
    '',
    '## 本次新增进入压缩区的历史消息',
    input.newlyCompressibleMessages.map((m, i) => `${i + 1}. [${m.role}] ${m.content}`).join('\n'),
  ].join('\n');
}

export function buildRuleBasedCompressionSummary(input: {
  previousCompressedSummary: string;
  newlyCompressibleMessages: RuntimeMessage[];
}): string {
  if (!input.previousCompressedSummary && input.newlyCompressibleMessages.length === 0) {
    return '';
  }
  
  if (input.newlyCompressibleMessages.length === 0) {
    return input.previousCompressedSummary;
  }

  const sections = ['## 历史概览', '## 关键记忆点'];
  
  if (input.previousCompressedSummary) {
    sections.push(input.previousCompressedSummary);
  }

  sections.push('', '## 最近压缩消息');
  sections.push(`- 共 ${input.newlyCompressibleMessages.length} 条消息被压缩`);

  return sections.join('\n');
}

export async function compressWithLlmOrFallback(
  compressionPrompt: string,
  input: {
    previousCompressedSummary: string;
    newlyCompressibleMessages: RuntimeMessage[];
  },
  requestCompressionSummary: (prompt: string) => Promise<string>
): Promise<string> {
  try {
    return await requestCompressionSummary(compressionPrompt);
  } catch {
    return buildRuleBasedCompressionSummary(input);
  }
}
