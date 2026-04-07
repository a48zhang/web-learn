import { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatStore } from '../../stores/useChatStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { sendChatMessage } from '../../services/llmApi';
import type { AIChatMessage, AgentFileOperation } from '@web-learn/shared';

const SYSTEM_PROMPT = `你是一名专业的前端开发者，负责帮助用户将他们的想法转化为网站。

当前上下文：
- 已存在的文件：{file_list}
- 当前打开的文件：{current_file}（如有）

你的职责：
1. 理解用户的需求，如果需求不够具体，先询问用户的偏好
   - 风格偏好（简约、商务、活泼、学术等）
   - 布局偏好（单栏、双栏、带导航、带侧边栏等）
   - 颜色偏好（浅色调、深色调、品牌色等）
2. 根据用户的偏好生成完整的网站代码
3. 使用标准的前端技术栈（HTML/CSS/JS、React、Vue等）
4. 每次只返回需要创建/修改的文件列表，让前端执行文件操作

返回格式（JSON）：
{
  "message": "给用户的自然语言回复",
  "files": [
    {
      "path": "src/index.html",
      "action": "create",
      "content": "<!DOCTYPE html>..."
    }
  ]
}

可用操作：create（新建）、update（修改）、delete（删除）`;

interface AgentChatProps {
  onApplyFiles: (operations: AgentFileOperation[]) => Promise<void>;
}

export default function AgentChat({ onApplyFiles }: AgentChatProps) {
  const { messages, addMessage, isLoading, setLoading, setError, error } = useChatStore();
  const { files, activeFile } = useEditorStore();
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const buildFileList = () => {
    return Object.keys(files).join(', ') || '（暂无文件）';
  };

  const buildCurrentFile = () => {
    if (!activeFile) return '（无）';
    return `${activeFile}（${files[activeFile]?.length || 0} 字节）`;
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isLoading) return;

    setInput('');
    const userMessage: AIChatMessage = { role: 'user', content };
    addMessage(userMessage);
    setLoading(true);
    setError(null);

    // Build system prompt with context
    const systemPrompt = SYSTEM_PROMPT
      .replace('{file_list}', buildFileList())
      .replace('{current_file}', buildCurrentFile());

    const allMessages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
      userMessage,
    ];

    try {
      const response = await sendChatMessage(allMessages, (chunk) => {
        setStreamingContent((prev) => (prev || '') + chunk);
      });

      setStreamingContent(null);

      if (response) {
        addMessage({ role: 'assistant', content: response.message });

        if (response.files && response.files.length > 0) {
          await onApplyFiles(response.files);
        }
      }
    } catch {
      setError('AI服务暂时不可用，请稍后重试');
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

  return (
    <div className="h-full flex flex-col bg-zinc-900 text-zinc-300">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-zinc-500 text-center py-8">
            <p>描述你想要创建的网站</p>
            <p className="mt-2">Agent会询问你的偏好，然后帮你生成代码</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`rounded-lg p-3 text-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white ml-8'
                : 'bg-zinc-800 border border-zinc-700 mr-8'
            }`}
          >
            {msg.role === 'assistant' ? (
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content || ''}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            )}
          </div>
        ))}
        {streamingContent && (
          <div className="rounded-lg p-3 text-sm bg-zinc-800 border border-zinc-700 mr-8">
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {streamingContent}
              </ReactMarkdown>
            </div>
          </div>
        )}
        {isLoading && !streamingContent && (
          <p className="text-xs text-zinc-500">Agent思考中...</p>
        )}
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-700 shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-zinc-800 border border-zinc-600 rounded-md px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
          placeholder="描述你想要的网站，或上传文件作为参考..."
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-md py-2 text-sm disabled:opacity-50 transition-colors"
        >
          发送
        </button>
      </div>
    </div>
  );
}
