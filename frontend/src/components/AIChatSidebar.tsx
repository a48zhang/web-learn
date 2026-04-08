import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { topicApi, topicFileApi } from '../services/api';
import { chatWithTools } from '../services/llmApi';
import { getApiErrorMessage } from '../utils/errors';
import type { AgentMessage } from '@web-learn/shared';

interface AIChatSidebarProps {
  topicId: string;
  title?: string;
}

function AIChatSidebar({ topicId, title = '学习助手' }: AIChatSidebarProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load chat history on mount
  useEffect(() => {
    const fetchTopic = async () => {
      try {
        const data = await topicApi.getById(topicId);
        if (data.chatHistory && Array.isArray(data.chatHistory)) {
          const visible: AgentMessage[] = data.chatHistory
            .filter((m: any) => m.role === 'user' || m.role === 'assistant')
            .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content || '' }));
          setMessages(visible);
        }
      } catch {
        // Silently fail — start with empty chat
      }
    };
    fetchTopic();
  }, [topicId]);

  // Debounced save function
  const debouncedSave = useCallback(
    (msgs: AgentMessage[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await topicFileApi.saveChatHistory(topicId, msgs);
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

  const handleSend = async () => {
    const content = input.trim();
    if (!content || loading) return;

    const userMsg: AgentMessage = { role: 'user', content };
    const nextMessages: AgentMessage[] = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const completion = await chatWithTools(nextMessages);
      const assistantMsg = completion.choices?.[0]?.message;
      if (assistantMsg) {
        const reply: AgentMessage = { role: 'assistant', content: assistantMsg.content || '' };
        const updated = [...nextMessages, reply];
        setMessages(updated);
        debouncedSave(updated);
      }
    } catch (error: unknown) {
      const errMsg: AgentMessage = {
        role: 'assistant',
        content: `请求失败：${getApiErrorMessage(error, '未知错误')}`,
      };
      const updated = [...nextMessages, errMsg];
      setMessages(updated);
      debouncedSave(updated);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = async () => {
    setMessages([]);
    try {
      await topicFileApi.saveChatHistory(topicId, []);
    } catch {
      // Silently fail
    }
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
              {messages.length > 0 && (
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
            {messages.length === 0 && (
              <p className="text-sm text-gray-500">你可以询问任何关于本专题的问题。</p>
            )}
            {messages.map((message, idx) => (
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
            {loading && <p className="text-xs text-gray-500">助手思考中...</p>}
          </div>
          <div className="p-3 border-t border-gray-200 space-y-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="输入你的问题..."
              disabled={loading}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !input.trim()}
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
