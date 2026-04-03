import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AIChatAgentType, AIChatMessage } from '@web-learn/shared';
import { aiApi } from '../services/api';
import { getApiErrorMessage } from '../utils/errors';

interface AIChatSidebarProps {
  topicId: string;
  agentType: AIChatAgentType;
  title?: string;
}

function AIChatSidebar({ topicId, agentType, title }: AIChatSidebarProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);

  const buttonText = title || (agentType === 'building' ? '搭建助手' : '学习助手');

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.role === 'user' || message.role === 'assistant'),
    [messages]
  );

  const handleSend = async () => {
    const content = input.trim();
    if (!content || loading) return;
    const nextMessages: AIChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const response = await aiApi.chat({
        messages: nextMessages,
        topic_id: Number(topicId),
        agent_type: agentType,
      });
      const assistant = response.choices?.[0]?.message;
      if (assistant) {
        setMessages((prev) => [...prev, assistant as AIChatMessage]);
      }
    } catch (error: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `请求失败：${getApiErrorMessage(error, '未知错误')}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full px-4 py-3 shadow-lg"
      >
        {open ? '关闭助手' : buttonText}
      </button>
      {open && (
        <aside className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">{buttonText}</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              关闭
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {visibleMessages.length === 0 && (
              <p className="text-sm text-gray-500">
                {agentType === 'building'
                  ? '你可以让助手创建或修改专题页面。'
                  : '你可以询问当前专题的内容。'}
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
            {loading && <p className="text-xs text-gray-500">助手思考中...</p>}
          </div>
          <div className="p-3 border-t border-gray-200 space-y-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="输入你的问题..."
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
