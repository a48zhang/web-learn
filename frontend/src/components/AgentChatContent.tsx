import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgentRuntime } from '../agent/useAgentRuntime';
import { useAgentStore } from '../stores/useAgentStore';
import type { AgentMessage } from '@web-learn/shared';

interface AgentChatContentProps {
  topicId: string;
  agentType: 'building' | 'learning';
  title?: string;
}

export default function AgentChatContent({ topicId, agentType }: AgentChatContentProps) {
  const [input, setInput] = useState('');
  const { runAgentLoop, visibleMessages, hydrateConversation } = useAgentRuntime({ topicId, agentType });
  const runState = useAgentStore((s) => s.runState);
  const model = useAgentStore((s) => s.model);
  const compressedContext = useAgentStore((s) => s.compressedContext);
  const setSessionContext = useAgentStore((s) => s.setSessionContext);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load conversation from backend on mount
  useEffect(() => {
    setSessionContext(topicId, agentType);
    void hydrateConversation();
  }, [topicId, agentType, hydrateConversation, setSessionContext]);

  // Auto-scroll effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages, runState.isRunning, runState.currentToolName]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = '52px'; // Reset line height to recalculate
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || runState.isRunning) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '52px';
    }
    await runAgentLoop(content, model);
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getToolActionText = (toolName: string): string => {
    const map: Record<string, string> = {
      read_file: '读取文件',
      write_file: '写入文件',
      create_file: '创建文件',
      delete_file: '删除文件',
      move_file: '移动文件',
      list_files: '列出文件',
      run_command: '执行命令',
    };
    return map[toolName] || '执行工具';
  };

  const renderAssistantMessage = (message: AgentMessage) => {
    const content = message.content || '';
    const parts = [];
    let lastIndex = 0;
    const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/g;
    let match;

    while ((match = thinkRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
      }
      parts.push({ type: 'think', content: match[1] });
      lastIndex = thinkRegex.lastIndex;
    }
    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.substring(lastIndex) });
    }

    return (
      <div className="space-y-3 w-full">
        {parts.map((part, i) => {
          if (part.type === 'think') {
            return (
              <details key={`think-${i}`} className="group">
                <summary className="flex items-center gap-1.5 cursor-pointer text-[13px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors select-none w-max outline-none">
                  <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  深入思考
                </summary>
                <div className="pl-4 py-2 mt-2 border-l-2 border-zinc-700/50 text-[13px] text-zinc-400 bg-zinc-950/30 rounded-r-lg [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose prose-sm max-w-none prose-invert prose-p:leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {part.content}
                  </ReactMarkdown>
                </div>
              </details>
            );
          }
          if (!part.content.trim()) return null;
          return (
            <div key={`text-${i}`} className="prose prose-sm max-w-none prose-invert prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-white/10">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {part.content}
              </ReactMarkdown>
            </div>
          );
        })}
        {message.tools && message.tools.length > 0 && (
          <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-white/5 mx-1">
            {message.tools.map((tool, i) => {
              const ToolIcon = tool.state === 'running' ? (
                <svg className="w-3.5 h-3.5 opacity-80 text-blue-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : tool.state === 'error' ? (
                <svg className="w-3.5 h-3.5 opacity-80 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 opacity-80 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              );

              const toolPath = tool.args?.path || tool.args?.oldPath || tool.args?.newPath || '';
              const desc = toolPath ? `${getToolActionText(tool.name)}: ${toolPath.split('/').pop()}` : getToolActionText(tool.name);

              return (
                <details key={`tool-${tool.id}-${i}`} className="group group-tool">
                  <summary className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-950/20 hover:bg-zinc-950/40 border border-zinc-800/40 rounded-[6px] cursor-pointer transition-colors outline-none list-none [&::-webkit-details-marker]:hidden">
                    {ToolIcon}
                    <span className={`text-[12px] font-medium flex-1 truncate ${tool.state === 'error' ? 'text-red-400/90' : 'text-zinc-400'}`}>
                      {desc}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 shrink-0">
                      {tool.state === 'running' 
                        ? <span className="animate-pulse">执行中...</span>
                        : tool.state === 'success' 
                          ? <span className="text-emerald-500/70">已完成</span>
                          : <span className="text-red-500/70">失败</span>
                      }
                      <svg className="w-3.5 h-3.5 opacity-50 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </summary>
                  <div className="mt-1 flex flex-col gap-1.5 relative px-1">
                    <div className="p-2.5 bg-zinc-950/40 border border-zinc-800/40 rounded-[6px] text-[11px] font-mono text-zinc-400 overflow-x-auto custom-scrollbar">
                      <div className="text-zinc-500 mb-1 font-sans text-[10px] tracking-wide uppercase">参数</div>
                      <pre className="!m-0 !p-0 !bg-transparent whitespace-pre-wrap break-all leading-relaxed">
                        {JSON.stringify(tool.args, null, 2)}
                      </pre>
                    </div>
                    {tool.result && (
                      <div className={`p-2.5 bg-zinc-950/40 border border-zinc-800/40 rounded-[6px] text-[11px] font-mono overflow-x-auto custom-scrollbar ${tool.state === 'error' ? 'text-red-400/90' : 'text-zinc-400'}`}>
                        <div className="text-zinc-500 mb-1 font-sans text-[10px] tracking-wide uppercase">结果</div>
                        <pre className="!m-0 !p-0 !bg-transparent whitespace-pre-wrap break-all leading-relaxed">
                          {tool.result}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-zinc-950 text-zinc-100 font-sans relative">
      {/* Header - Glassmorphism */}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth custom-scrollbar">
        {compressedContext.hasCompressedContext && (
          <div className="text-[11px] text-zinc-500 px-4 pt-2">
            较早历史已压缩，当前对话基于摘要继续。
          </div>
        )}
        
        {visibleMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800/50 flex items-center justify-center border border-white/5">
              <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-sm text-zinc-400">我是您的 AI 助手<br />我可以帮您分析资料并修改代码</p>
          </div>
        )}

        {visibleMessages.map((message, idx) => {
          const isUser = message.role === 'user';
          return (
            <div key={`${message.role}-${idx}`} className={`flex gap-3 max-w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              <div className="shrink-0 mt-0.5">
                {isUser ? (
                  <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center shadow-sm">
                    <svg className="w-4 h-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Bubble & Content */}
              <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%] overflow-hidden`}>
                <div
                  className={`px-4 py-2.5 text-[14px] leading-relaxed shadow-sm break-words 
                    ${isUser
                      ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm w-fit'
                      : 'bg-zinc-900 border border-white/5 text-zinc-200 rounded-2xl rounded-tl-sm w-full overflow-hidden'
                    }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    renderAssistantMessage(message)
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Thinking Indicator */}
        {runState.isRunning && !runState.currentToolName && (
          <div className="flex gap-3 max-w-full flex-row">
            <div className="shrink-0 mt-0.5">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center shadow-sm">
                <svg className="w-4 h-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
            </div>
            <div className="px-4 py-3 bg-zinc-900 border border-white/5 rounded-2xl rounded-tl-sm flex items-center gap-1">
              <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Error State */}
        {runState.error && (
          <div className="flex gap-3 max-w-full flex-row">
            <div className="w-7 h-7 shrink-0" /> {/* Spacer */}
            <div className="px-4 py-2.5 bg-red-950/40 border border-red-900/50 rounded-xl text-sm text-red-400">
              执行出现问题：{runState.error}
            </div>
          </div>
        )}

        {/* Invisible anchor for auto-scroll */}
        <div ref={messagesEndRef} className="h-1 pb-4" />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent sticky bottom-0 z-10 shrink-0">
        <div className="relative max-w-4xl mx-auto bg-zinc-900 border border-white/10 rounded-2xl shadow-xl focus-within:ring-1 focus-within:ring-blue-500/50 focus-within:border-blue-500/30 transition-all duration-200">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent px-4 py-[14px] pr-14 text-[14px] leading-6 text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none overflow-y-auto custom-scrollbar block box-border"
            rows={1}
            style={{ height: '52px', minHeight: '52px' }}
            placeholder="描述你想要的更改..."
            disabled={runState.isRunning}
          />
          <div className="absolute right-[10px] bottom-[10px]">
            <button
              type="button"
              onClick={handleSend}
              disabled={runState.isRunning || !input.trim()}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
              title="发送"
            >
              <svg className="w-[18px] h-[18px] translate-x-[1px] translate-y-[0px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
