import { describe, expect, it } from 'vitest';
import { selectRecentWindowGreedy, compressWithLlmOrFallback } from './contextCompression';
import { defaultAgentContextBudget } from '@web-learn/shared';
import type { PersistedAgentMessage } from '@web-learn/shared';
import type { RuntimeMessage } from './runtimeMessage';

function createMessage(id: string, role: 'user' | 'assistant', content: string): PersistedAgentMessage {
  return { id, role, content, createdAt: '2026-04-25T00:00:00.000Z' };
}

describe('selectRecentWindowGreedy', () => {
  it('always returns at least the last message, even if it exceeds the budget', () => {
    const budget = defaultAgentContextBudget();

    // Single huge message that far exceeds recentWindowTokens (32k)
    const hugeMessage = createMessage('huge-1', 'assistant', 'x'.repeat(200_000));
    const { recentMessages, recentTokenEstimate } = selectRecentWindowGreedy([hugeMessage] as RuntimeMessage[]);

    expect(recentMessages.length).toBe(1);
    expect(recentMessages[0].id).toBe('huge-1');
    expect(recentTokenEstimate).toBeGreaterThan(budget.recentWindowTokens);
  });

  it('returns the last message when all messages each exceed the budget', () => {
    const messages = [
      createMessage('big-1', 'assistant', 'x'.repeat(150_000)),
      createMessage('big-2', 'user', 'x'.repeat(150_000)),
      createMessage('big-3', 'assistant', 'x'.repeat(150_000)),
    ];
    const { recentMessages } = selectRecentWindowGreedy(messages as RuntimeMessage[]);

    expect(recentMessages.length).toBe(1);
    expect(recentMessages[0].id).toBe('big-3');
  });

  it('returns the last message when it is huge but earlier messages are small', () => {
    const messages = [
      createMessage('msg-0', 'user', 'Hello'),
      createMessage('msg-1', 'assistant', 'Hi there'),
      createMessage('msg-2', 'user', 'Write me a large file'),
      createMessage('msg-3', 'assistant', 'x'.repeat(200_000)),
    ];
    const { recentMessages } = selectRecentWindowGreedy(messages as RuntimeMessage[]);

    expect(recentMessages.length).toBe(1);
    expect(recentMessages[0].id).toBe('msg-3');
  });

  it('returns empty for empty input', () => {
    const { recentMessages } = selectRecentWindowGreedy([]);
    expect(recentMessages.length).toBe(0);
  });

  it('works normally for regular-sized conversations', () => {
    const messages = Array.from({ length: 20 }, (_, i) =>
      createMessage(`msg-${i}`, i % 2 === 0 ? 'user' as const : 'assistant' as const, `Message ${i}: ${'x'.repeat(10_000)}`)
    );
    const { recentMessages, recentTokenEstimate } = selectRecentWindowGreedy(messages as RuntimeMessage[]);

    expect(recentMessages.length).toBeGreaterThan(0);
    expect(recentMessages.length).toBeLessThan(messages.length);
    expect(recentTokenEstimate).toBeLessThanOrEqual(defaultAgentContextBudget().recentWindowTokens);
  });
});

describe('compressWithLlmOrFallback', () => {
  it('falls back when the llm compression request throws', async () => {
    const summary = await compressWithLlmOrFallback(
      'compress this',
      {
        previousCompressedSummary: '',
        newlyCompressibleMessages: [
          createMessage('msg-1', 'user', 'Please remember this requirement') as RuntimeMessage,
        ],
      },
      async () => {
        throw new Error('request failed');
      }
    );

    expect(summary).toContain('## 历史概览');
    expect(summary).toContain('共 1 条消息被压缩');
  });

  it('falls back when the llm compression request returns blank content', async () => {
    const summary = await compressWithLlmOrFallback(
      'compress this',
      {
        previousCompressedSummary: '',
        newlyCompressibleMessages: [
          createMessage('msg-1', 'assistant', 'Important implementation detail') as RuntimeMessage,
        ],
      },
      async () => '   '
    );

    expect(summary).toContain('## 历史概览');
    expect(summary).toContain('共 1 条消息被压缩');
  });
});
