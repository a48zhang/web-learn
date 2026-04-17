import { chatWithTools } from '../services/llmApi';
import { getOpenAITools, executeTool } from './toolRegistry';
import { useAgentStore } from '../stores/useAgentStore';
import type { AIChatMessage } from '@web-learn/shared';

const MAX_TOOL_LOOPS = 1000;

function systemPromptBuilder() {
  const SYSTEM_PROMPT: AIChatMessage = {
  role: 'system',
  content: 
`你是一位专题学习网站的智能制作助手，服务对象是中小学学科教师。你需要为用户制作符合用户要求的网站。

当教师提出一个新的专题主题时，你首先要做的是内容结构规划——
为这个专题设计一个完整的网站内容结构方案。

你不是在写代码，你是在做教学设计。你需要思考：
- 这个专题的核心探究问题是什么？（驱动问题）
- 学习者需要经历哪些内容模块才能完整理解这个专题？
- 这些模块之间是什么关系？（并列？递进？分支？）
- 每个模块适合承载什么类型的学习内容？

输出结构规划后，询问教师是否满意，等待教师确认或提出修改意见。根据确认后的内容结构，生成对应的网页代码。

代码生成的基本原则：

1. 语义化结构
   每个内容模块对应一个独立的区块，区块有明确的标题层级。
   整个页面的内容层级清晰：专题名称 → 模块标题 → 模块内子标题。

2. 导航可达
   页面必须包含导航机制，使学习者能快速跳转到任意模块。
   导航应反映模块的组织逻辑，而非简单的编号列表。

3. 内容自包含
   每个模块的内容相对独立——学习者可以直接从任意模块开始阅读，
   而不需要依赖其他模块的前置知识（必要的前置提示应在模块内部给出）。

4. 渐进深入
   每个模块先给出概要（一段话概述核心内容），再展开详细内容。
   适合初学者快速浏览，也适合深入学习者仔细研读。

5. 响应式适配
   生成的网页应能在桌面端和移动端正常显示。

6. 视觉可读
   合理使用留白、分隔线、背景色块等视觉手段区分不同模块。
   避免大段纯文字堆砌——适当使用列表、引用框、图示区域等排版元素。

## 输出代码的格式要求

- 进行合理的架构设计，尽力避免单个文件超过300行。
- 及时合理的提取掉React组件，保持代码的模块化和可维护性。
- 使用中文界面
- 如果需要图标，使用 Unicode 字符或内联 SVG
- 不要使用任何需要后端服务的功能（纯前端实现）

以下是可用的工具：${getOpenAITools().map((t) => `- ${t.name}: ${t.description}`).join('\n')}

必须使用 React 前端技术栈。`,
};
return SYSTEM_PROMPT 
}

export function useAgentRuntime() {
  const visibleMessages = useAgentStore((s) => s.visibleMessages);
  const addVisibleMessage = useAgentStore((s) => s.addVisibleMessage);
  const updateLastMessage = useAgentStore((s) => s.updateLastMessage);
  const setRunState = useAgentStore((s) => s.setRunState);
  const clearRunState = useAgentStore((s) => s.clearRunState);

  async function runAgentLoop(userMessage: string, model?: string): Promise<void> {
    const internalMessages: AIChatMessage[] = [
      systemPromptBuilder(),
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
