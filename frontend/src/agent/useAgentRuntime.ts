import { useCallback } from 'react';
import { chatWithTools } from '../services/llmApi';
import { getOpenAITools, executeTool } from './toolRegistry';
import { useAgentStore } from '../stores/useAgentStore';
import { BuildAgent } from './BuildAgent';
import { AskAgent } from './AskAgent';
import type { AIChatMessage, PersistedAgentMessage } from '@web-learn/shared';
import type { AgentSessionContext } from './BaseAgent';

const MAX_TOOL_LOOPS = 1000;

export function useAgentRuntime(options: { topicId: string; agentType: 'building' | 'learning' }) {
  const visibleMessages = useAgentStore((s) => s.visibleMessages);
  const addVisibleMessage = useAgentStore((s) => s.addVisibleMessage);
  const updateLastMessage = useAgentStore((s) => s.updateLastMessage);
  const setRunState = useAgentStore((s) => s.setRunState);
  const clearRunState = useAgentStore((s) => s.clearRunState);
  const compressedContext = useAgentStore((s) => s.compressedContext);
  const selectedSkills = useAgentStore((s) => s.selectedSkills);
  const setVisibleMessages = useAgentStore((s) => s.setVisibleMessages);
  const setCompressedContext = useAgentStore((s) => s.setCompressedContext);
  const setSelectedSkills = useAgentStore((s) => s.setSelectedSkills);

  const createAgentSessionContext = (): AgentSessionContext => ({
    topicId: options.topicId,
    topicTitle: undefined,
    selectedSkills,
    visibleMessages,
    compressedContext,
    setSelectedSkills,
    setVisibleMessages,
    setCompressedContext,
  });

  const agent = options.agentType === 'building'
    ? new BuildAgent(createAgentSessionContext())
    : new AskAgent(createAgentSessionContext());

  const hydrateConversation = useCallback(async () => {
    try {
      await agent.hydrateConversation();
    } catch (error) {
      console.error('Failed to hydrate conversation:', error);
    }
  }, [agent]);

  async function runAgentLoop(userMessage: string, model?: string): Promise<void> {
    try {
      // Compress context if needed before starting new request
      await agent.maybeCompressContextBeforeLlmRequest(userMessage);

      // Build LLM messages with system prompt, compressed context, and visible messages
      const internalMessages: AIChatMessage[] = agent.buildLlmMessages();
      internalMessages.push({ role: 'user', content: userMessage });

      const openAITools = getOpenAITools();

      addVisibleMessage({ role: 'user', content: userMessage } as PersistedAgentMessage);
      setRunState({ isRunning: true, error: null });

      for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
        const completion = await chatWithTools(internalMessages, openAITools, undefined, model);
        const choice = completion.choices[0];
        const message = choice.message;

        internalMessages.push(message as AIChatMessage);

        const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;
        const assistantContent = message.content || '';

        // Create tool actions for UI display
        let tools: any[] = [];
        if (hasToolCalls) {
          tools = message.tool_calls!.map(tc => {
            let args = {};
            if ('function' in tc) {
              try { args = JSON.parse(tc.function.arguments || '{}'); } catch { }
              return {
                id: tc.id,
                name: tc.function.name,
                args,
                state: 'running'
              };
            }
            return null;
          }).filter(Boolean);
        }

        // Add message to view if it has content (like <think>) or tools
        if (assistantContent || tools.length > 0) {
          addVisibleMessage({
            role: 'assistant',
            content: assistantContent,
            ...(tools.length > 0 ? { tools } : {})
          } as any);
        }

        if (!hasToolCalls) {
          break;
        }

        for (const toolCall of message.tool_calls!) {
          if (!('function' in toolCall)) continue;

          const toolName = toolCall.function.name;

          let args: any = {};
          let toolPath: string | null = null;
          try {
            args = JSON.parse(toolCall.function.arguments || '{}');
            toolPath = args.path ?? args.oldPath ?? args.newPath ?? null;
          } catch {
            // ignore
          }

          setRunState({ currentToolName: toolName, currentToolPath: toolPath });

          let resultContent: string;
          try {
            const result = await executeTool(toolName, args);
            resultContent = result.content;
          } catch (e: any) {
            resultContent = `Error: ${e.message}`;
          }

          internalMessages.push({
            role: 'tool',
            content: resultContent,
            tool_call_id: toolCall.id,
          } as AIChatMessage);

          // Update tool state to success in the UI
          updateLastMessage((msg) => {
            if (!msg.tools) return msg;
            return {
              ...msg,
              tools: msg.tools.map(t =>
                t.id === toolCall.id ? { ...t, state: 'success', result: resultContent } : t
              )
            };
          });
        }
      }

      // Persist conversation after successful completion
      await agent.persistConversationState();

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'LLM request failed';
      setRunState({ error: errorMsg });
    } finally {
      clearRunState();
    }
  }

  return { runAgentLoop, visibleMessages, hydrateConversation };
}
