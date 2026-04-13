import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgentRuntime } from '../agent/useAgentRuntime';
import { useAgentStore } from '../stores/useAgentStore';
import type { AgentMessage } from '@web-learn/shared';

const MODELS = [
  'MiniMax-M2.7',
];

interface AgentChatContentProps {
  topicId: string;
  title?: string;
}

export default function AgentChatContent({ topicId, title = 'AI 助手' }: AgentChatContentProps) {
  const [input, setInput] = useState('');
  const [model, setModel] = useState('MiniMax-M2.7');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const { runAgentLoop, visibleMessages } = useAgentRuntime();
  const runState = useAgentStore((s) => s.runState);
  const setVisibleMessages = useAgentStore((s) => s.setVisibleMessages);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history on mount
  useEffect(() => {
    const raw = localStorage.getItem(`chat-history-${topicId}`);
    if (raw) {
      try {
        const msgs: AgentMessage[] = JSON.parse(raw);
        if (Array.isArray(msgs)) {
          setVisibleMessages(msgs);
        }
      } catch {
        // corrupted — start fresh
      }
    }
    const savedModel = localStorage.getItem(`agent-model-${topicId}`);
    if (savedModel) setModel(savedModel);
  }, [topicId, setVisibleMessages]);

  // Debounced save to localStorage
  const debouncedSave = useCallback(
    (msgs: AgentMessage[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(`chat-history-${topicId}`, JSON.stringify(msgs));
        } catch {
          // Silently fail
        }
      }, 2000);
    },
    [topicId]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(`agent-model-${topicId}`, model);
  }, [topicId, model]);

  useEffect(() => {
    if (visibleMessages.length > 0) {
      debouncedSave(visibleMessages);
    }
  }, [visibleMessages, debouncedSave]);

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

  const handleClearChat = () => {
    setVisibleMessages([]);
    try {
      localStorage.setItem(`chat-history-${topicId}`, JSON.stringify([]));
    } catch {
      // Silently fail
    }
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

  const renderAssistantMessage = (content: string) => {
    if (!content) return null;
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
              <details key={i} className="group">
                <summary className="flex items-center gap-1.5 cursor-pointer text-[13px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors select-none w-max outline-none">
                  <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  思考过程
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
            <div key={i} className="prose prose-sm max-w-none prose-invert prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-white/10">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {part.content}
              </ReactMarkdown>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-zinc-950 text-zinc-100 font-sans relative">
      {/* Header - Glassmorphism */}
      <header className="flex-none px-4 py-3 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-zinc-200">{title}</h3>

          {/* Inline Model Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="text-xs bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 text-zinc-300 flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors"
            >
              <span>{model}</span>
              <svg className={`w-3 h-3 transition-transform ${showModelPicker ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showModelPicker && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowModelPicker(false)}
                />
                <div className="absolute top-full left-0 mt-1 bg-zinc-800/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px] z-20 animate-in fade-in slide-in-from-top-1 duration-200">
                  {MODELS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setModel(m); setShowModelPicker(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${model === m ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-300 hover:bg-white/5'
                        }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {visibleMessages.length > 0 && (
          <button
            type="button"
            onClick={handleClearChat}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            title="清空对话"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth custom-scrollbar">
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
                    renderAssistantMessage(message.content || '')
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Tool Activity Indicator */}
        {runState.isRunning && runState.currentToolName && (
          <div className="flex gap-3 max-w-full flex-row items-center">
            <div className="w-7 h-7 shrink-0" /> {/* Spacer */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 border border-zinc-700/50 rounded-full text-xs text-zinc-400">
              <svg className="w-3.5 h-3.5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="animate-pulse">
                {runState.currentToolPath
                  ? `正在${getToolActionText(runState.currentToolName)}：${runState.currentToolPath.split('/').pop()}`
                  : `正在调用工具：${runState.currentToolName}`}
              </span>
            </div>
          </div>
        )}

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
