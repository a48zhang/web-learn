import { useCallback, useMemo } from 'react';
import { chatWithTools } from '../services/llmApi';
import { getOpenAITools, executeTool } from './toolRegistry';
import { useAgentStore } from '../stores/useAgentStore';
import { useEditorStore } from '../stores/useEditorStore';
import { BuildAgent } from './BuildAgent';
import { AskAgent } from './AskAgent';
import type { AIChatMessage, PersistedAgentMessage, AgentMessage } from '@web-learn/shared';
import type { AgentSessionContext } from './BaseAgent';

const MAX_TOOL_LOOPS = 1000;
const FILE_MUTATION_TOOLS = new Set(['write_file', 'create_file', 'delete_file', 'move_file']);

export function useAgentRuntime(options: { topicId: string; agentType: 'building' | 'learning' }) {
  const visibleMessages = useAgentStore((s) => s.visibleMessages);
  const addVisibleMessage = useAgentStore((s) => s.addVisibleMessage);
  const updateLastMessage = useAgentStore((s) => s.updateLastMessage);
  const setRunState = useAgentStore((s) => s.setRunState);
  const clearRunState = useAgentStore((s) => s.clearRunState);
  const setVisibleMessages = useAgentStore((s) => s.setVisibleMessages);
  const setCompressedContext = useAgentStore((s) => s.setCompressedContext);
  const setSelectedSkills = useAgentStore((s) => s.setSelectedSkills);

  const agent = useMemo(() => {
    const context: AgentSessionContext = {
      topicId: options.topicId,
      topicTitle: undefined,
      getSelectedSkills: () => useAgentStore.getState().selectedSkills,
      getVisibleMessages: () => useAgentStore.getState().visibleMessages,
      getCompressedContext: () => useAgentStore.getState().compressedContext,
      setSelectedSkills,
      setVisibleMessages,
      setCompressedContext,
    };

    return options.agentType === 'building'
      ? new BuildAgent(context)
      : new AskAgent(context);
  }, [options.topicId, options.agentType, setCompressedContext, setSelectedSkills, setVisibleMessages]);

  const hydrateConversation = useCallback(async () => {
    try {
      await agent.hydrateConversation();
    } catch (error) {
      console.error('Failed to hydrate conversation:', error);
    }
  }, [agent]);

  async function runAgentLoop(userMessage: string, model?: string): Promise<void> {
    let encounteredError = false;
    try {
      let didMutateFiles = false;

      // Compress context if needed before starting new request
      await agent.maybeCompressContextBeforeLlmRequest(userMessage);

      // Build LLM messages with system prompt, compressed context, and visible messages
      const internalMessages: AIChatMessage[] = agent.buildLlmMessages();
      internalMessages.push({ role: 'user', content: userMessage });

      const openAITools = getOpenAITools();
      addVisibleMessage({ role: 'user', content: userMessage } as PersistedAgentMessage);
      setRunState({ isRunning: true, error: null });

      for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
        let streamedAssistantMessageStarted = false;
        const handleStreamChunk = (chunk: string) => {
          if (!chunk) {
            return;
          }

          if (!streamedAssistantMessageStarted) {
            streamedAssistantMessageStarted = true;
            addVisibleMessage({
              role: 'assistant',
              content: chunk,
            } as AgentMessage);
            return;
          }

          updateLastMessage((msg) => {
            if (msg.role !== 'assistant') {
              return msg;
            }

            return {
              ...msg,
              content: `${msg.content || ''}${chunk}`,
            };
          });
        };

        const completion = await chatWithTools(internalMessages, openAITools, handleStreamChunk, model);
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
              try { args = JSON.parse(tc.function.arguments || '{}'); } catch {
                // Ignore malformed tool arguments in the transient UI payload.
              }
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
          if (streamedAssistantMessageStarted) {
            updateLastMessage((msg) => ({
              ...msg,
              content: assistantContent || msg.content || '',
              ...(tools.length > 0 ? { tools } : {}),
            }));
          } else {
            addVisibleMessage({
              role: 'assistant',
              content: assistantContent,
              ...(tools.length > 0 ? { tools } : {})
            } as AgentMessage);
          }
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
            if (!result.isError && FILE_MUTATION_TOOLS.has(toolName)) {
              didMutateFiles = true;
            }
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

      // BuildAgent 成功修改文件后强制上传一次，避免本地快照提前清掉脏标记。
      if (agent instanceof BuildAgent && didMutateFiles) {
        const { saveToOSS } = useEditorStore.getState();
        const saved = await saveToOSS(options.topicId, undefined, { force: true });
        if (!saved) {
          throw new Error('Failed to save build changes to OSS');
        }
      }

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'LLM request failed';
      encounteredError = true;
      setRunState({
        isRunning: false,
        currentToolName: null,
        currentToolPath: null,
        error: errorMsg,
      });
    } finally {
      if (!encounteredError) {
        clearRunState();
      }
    }
  }

  return { runAgentLoop, visibleMessages, hydrateConversation };
}
