import { chatWithTools } from '../services/llmApi';
import { getOpenAITools, executeTool } from './toolRegistry';
import { useAgentStore } from '../stores/useAgentStore';
import type { AIChatMessage } from '@web-learn/shared';

const MAX_TOOL_LOOPS = 8;

const SYSTEM_PROMPT: AIChatMessage = {
  role: 'system',
  content: `你是一名专业的前端开发者，负责帮助用户将他们的想法转化为网站。

你可以使用以下文件系统工具直接操作项目文件：
- list_files: 列出项目中所有文件
- read_file: 读取文件内容
- write_file: 覆盖文件内容
- create_file: 创建新文件
- delete_file: 删除文件
- move_file: 移动或重命名文件
- run_command: 执行终端命令（npm, npx, node, ls, cat, mkdir, rm, echo 等）

你的工作流程：
1. 先用 list_files 了解当前项目结构
2. 理解用户需求（如不明确，先询问风格、布局、颜色等偏好）
3. 使用工具直接创建或修改文件
4. 完成后告知用户所做的更改

使用标准的前端技术栈（HTML/CSS/JS 或 React 等）。每次完成后给出简洁的中文说明。`,
};

export function useAgentRuntime() {
  const visibleMessages = useAgentStore((s) => s.visibleMessages);
  const addVisibleMessage = useAgentStore((s) => s.addVisibleMessage);
  const updateLastMessage = useAgentStore((s) => s.updateLastMessage);
  const setRunState = useAgentStore((s) => s.setRunState);
  const clearRunState = useAgentStore((s) => s.clearRunState);

  async function runAgentLoop(userMessage: string, model?: string): Promise<void> {
    const internalMessages: AIChatMessage[] = [
      SYSTEM_PROMPT,
      ...visibleMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];
    internalMessages.push({ role: 'user', content: userMessage });

    const openAITools = getOpenAITools();

    addVisibleMessage({ role: 'user', content: userMessage });
    setRunState({ isRunning: true, error: null });

    try {
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
          });
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
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'LLM request failed';
      setRunState({ error: errorMsg });
    } finally {
      clearRunState();
    }
  }

  return { runAgentLoop, visibleMessages };
}
