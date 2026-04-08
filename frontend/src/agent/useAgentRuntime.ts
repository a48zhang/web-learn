import { chatWithTools } from '../services/llmApi';
import { getOpenAITools, executeTool } from './toolRegistry';
import { useAgentStore } from '../stores/useAgentStore';
import type { AIChatMessage } from '@web-learn/shared';

const MAX_TOOL_LOOPS = 8;

export function useAgentRuntime() {
  const visibleMessages = useAgentStore((s) => s.visibleMessages);
  const addVisibleMessage = useAgentStore((s) => s.addVisibleMessage);
  const setRunState = useAgentStore((s) => s.setRunState);

  async function runAgentLoop(userMessage: string): Promise<void> {
    // Build internal messages for this run
    const internalMessages: AIChatMessage[] = visibleMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    internalMessages.push({ role: 'user', content: userMessage });

    const openAITools = getOpenAITools();

    addVisibleMessage({ role: 'user', content: userMessage });
    setRunState({ isRunning: true, error: null });

    try {
      for (let i = 0; i < MAX_TOOL_LOOPS; i++) {

        const completion = await chatWithTools(internalMessages, openAITools);
        const choice = completion.choices[0];
        const message = choice.message;

        // Push to internal messages for the loop
        internalMessages.push(message as AIChatMessage);

        // If no tool calls, we have the final answer
        if (!message.tool_calls || message.tool_calls.length === 0) {
          const assistantContent = message.content || '';
          addVisibleMessage({ role: 'assistant', content: assistantContent });
          break;
        }

        // Execute each tool call
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;

          // Try to extract file path for UI display
          let toolPath: string | null = null;
          try {
            const args = JSON.parse(toolCall.function.arguments || '{}');
            toolPath = args.path ?? args.oldPath ?? args.newPath ?? null;
          } catch {
            // ignore
          }

          setRunState({ currentToolName: toolName, currentToolPath: toolPath });

          const result = await executeTool(toolName, JSON.parse(toolCall.function.arguments || '{}'));

          internalMessages.push({
            role: 'tool',
            content: result.content,
            tool_call_id: toolCall.id,
          } as AIChatMessage);
        }
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'LLM request failed';
      setRunState({ error: errorMsg, isRunning: false, currentToolName: null, currentToolPath: null });
    } finally {
      setRunState({ isRunning: false, currentToolName: null, currentToolPath: null });
    }
  }

  return { runAgentLoop, visibleMessages };
}
