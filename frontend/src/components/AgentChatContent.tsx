import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgentRuntime } from '../agent/useAgentRuntime';
import { useAgentStore } from '../stores/useAgentStore';
import type { AgentMessage } from '@web-learn/shared';

interface AgentChatContentProps {
  topicId: string;
  title?: string;
}

export default function AgentChatContent({ topicId, title = 'AI 助手' }: AgentChatContentProps) {
  const [input, setInput] = useState('');
  const { runAgentLoop, visibleMessages } = useAgentRuntime();
  const runState = useAgentStore((s) => s.runState);
  const setVisibleMessages = useAgentStore((s) => s.setVisibleMessages);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (visibleMessages.length > 0) {
      debouncedSave(visibleMessages);
    }
  }, [visibleMessages, debouncedSave]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || runState.isRunning) return;
    setInput('');
    await runAgentLoop(content);
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

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-700 flex items-center justify-between shrink-0">
        <h3 className="text-xs font-medium text-zinc-300">{title}</h3>
        {visibleMessages.length > 0 && (
          <button
            type="button"
            onClick={handleClearChat}
            className="text-xs text-zinc-500 hover:text-red-400"
          >
            清空对话
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {visibleMessages.length === 0 && (
          <p className="text-xs text-zinc-500">让助手读取或修改项目文件。</p>
        )}
        {visibleMessages.map((message, idx) => (
          <div
            key={`${message.role}-${idx}`}
            className={`rounded-lg p-3 text-sm ${
              message.role === 'user'
                ? 'bg-blue-600 text-white ml-8'
                : 'bg-zinc-800 border border-zinc-700 mr-8'
            }`}
          >
            {message.role === 'assistant' ? (
              <div className="prose prose-sm max-w-none prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content || ''}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{message.content}</p>
            )}
          </div>
        ))}

        {/* Tool activity indicator */}
        {runState.isRunning && runState.currentToolName && (
          <div className="rounded-lg p-3 text-sm bg-blue-900/30 border border-blue-800 mr-8 text-blue-300">
            {runState.currentToolPath
              ? `正在${getToolActionText(runState.currentToolName)}：${runState.currentToolPath}`
              : `正在调用工具：${runState.currentToolName}`}
          </div>
        )}
        {runState.isRunning && !runState.currentToolName && (
          <p className="text-xs text-zinc-500">助手思考中...</p>
        )}
        {runState.error && (
          <div className="rounded-lg p-3 text-sm bg-red-900/30 border border-red-800 mr-8 text-red-300">
            工具执行失败：{runState.error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-700 space-y-2 shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full border border-zinc-600 rounded-md px-3 py-2 text-sm bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
          placeholder="描述你想要的更改..."
          disabled={runState.isRunning}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={runState.isRunning || !input.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-md py-2 text-sm disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  );
}
