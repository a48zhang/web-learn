import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgentRuntime } from '../agent/useAgentRuntime';
import { useAgentStore } from '../stores/useAgentStore';
import type { AgentMessage } from '@web-learn/shared';

interface AIChatSidebarProps {
  topicId: string;
  title?: string;
}

function AIChatSidebar({ topicId, title = 'AI 助手' }: AIChatSidebarProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { runAgentLoop, visibleMessages } = useAgentRuntime();
  const runState = useAgentStore((s) => s.runState);
  const setVisibleMessages = useAgentStore((s) => s.setVisibleMessages);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load chat history on mount — read from localStorage cache
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

  // Debounced save chat history to localStorage
  const debouncedSave = useCallback(
    (msgs: AgentMessage[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(`chat-history-${topicId}`, JSON.stringify(msgs));
        } catch {
          // Silently fail — will retry on next message
        }
      }, 2000);
    },
    [topicId]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Save on visible message changes
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
    };
    return map[toolName] || '执行工具';
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full px-4 py-3 shadow-lg"
      >
        {open ? '关闭助手' : title}
      </button>
      {open && (
        <aside className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <div className="flex items-center gap-2">
              {visibleMessages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="text-xs text-gray-500 hover:text-red-500"
                >
                  清空对话
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                关闭
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {visibleMessages.length === 0 && (
              <p className="text-sm text-gray-500">
                让助手读取或修改项目文件。
              </p>
            )}
            {visibleMessages.map((message, idx) => (
              <div
                key={`${message.role}-${idx}`}
                className={`rounded-lg p-3 text-sm ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white ml-8'
                    : 'bg-white border border-gray-200 mr-8'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none">
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
              <div className="rounded-lg p-3 text-sm bg-blue-50 border border-blue-200 mr-8 text-blue-700">
                {runState.currentToolPath
                  ? `正在${getToolActionText(runState.currentToolName)}：${runState.currentToolPath}`
                  : `正在调用工具：${runState.currentToolName}`}
              </div>
            )}
            {runState.isRunning && !runState.currentToolName && (
              <p className="text-xs text-gray-500">助手思考中...</p>
            )}
            {runState.error && (
              <div className="rounded-lg p-3 text-sm bg-red-50 border border-red-200 mr-8 text-red-700">
                工具执行失败：{runState.error}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-gray-200 space-y-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
        </aside>
      )}
    </>
  );
}

export default AIChatSidebar;
